<?php
/**
 * NetFix ISP SaaS - High-Throughput Native Redis Client
 * Lightweight, zero-dependency client with auto-detection for phpredis extension
 * or native RESP TCP socket fallback.
 */

class RedisClient {
    private static ?RedisClient $instance = null;
    private $nativeRedis = null;
    private $socket = null;
    private string $host;
    private int $port;
    private ?string $password;
    private float $timeout;
    private bool $isConnected = false;

    public function __construct(?string $host = null, ?int $port = null, ?string $password = null, float $timeout = 1.5) {
        $this->host = $host ?? getenv('REDIS_HOST') ?: '127.0.0.1';
        $this->port = $port ?? (int)(getenv('REDIS_PORT') ?: 6379);
        $this->password = $password ?? getenv('REDIS_PASSWORD') ?: null;
        $this->timeout = $timeout;
        $this->connect();
    }

    public static function getInstance(): self {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function isConnected(): bool {
        return $this->isConnected;
    }

    private function connect(): bool {
        $this->isConnected = false;

        // 1. Try phpredis C extension if loaded
        if (class_exists('Redis', false)) {
            try {
                $r = new \Redis();
                if ($r->connect($this->host, $this->port, $this->timeout)) {
                    if ($this->password) {
                        $r->auth($this->password);
                    }
                    $this->nativeRedis = $r;
                    $this->isConnected = true;
                    return true;
                }
            } catch (\Throwable $e) {
                $this->nativeRedis = null;
            }
        }

        // 2. Fallback to Native PHP TCP Socket (RESP Protocol)
        $remote = "tcp://{$this->host}:{$this->port}";
        $errno = 0;
        $errstr = '';
        $this->socket = @stream_socket_client($remote, $errno, $errstr, $this->timeout);

        if (!$this->socket) {
            $this->isConnected = false;
            return false;
        }

        stream_set_timeout($this->socket, (int)$this->timeout, (int)(($this->timeout - (int)$this->timeout) * 1000000));

        if ($this->password) {
            $authRes = $this->sendCommand(['AUTH', $this->password]);
            if ($authRes === false || strpos((string)$authRes, 'ERR') !== false) {
                @fclose($this->socket);
                $this->socket = null;
                return false;
            }
        }

        $this->isConnected = true;
        return true;
    }

    /**
     * Send command via RESP (REdis Serialization Protocol)
     */
    private function sendCommand(array $args) {
        if (!$this->socket) {
            if (!$this->connect()) {
                return false;
            }
        }

        // Build RESP Array: *<num_args>\r\n$<len>\r\n<arg>\r\n...
        $buf = '*' . count($args) . "\r\n";
        foreach ($args as $arg) {
            $str = (string)$arg;
            $buf .= '$' . strlen($str) . "\r\n" . $str . "\r\n";
        }

        $written = @fwrite($this->socket, $buf);
        if ($written === false || $written < strlen($buf)) {
            $this->closeSocket();
            return false;
        }

        return $this->readReply();
    }

    private function readReply() {
        if (!$this->socket) return false;

        $line = fgets($this->socket);
        if ($line === false) {
            $this->closeSocket();
            return false;
        }

        $type = $line[0];
        $payload = substr($line, 1, -2); // strip type and \r\n

        switch ($type) {
            case '+': // Simple string
                return $payload;
            case '-': // Error
                return false;
            case ':': // Integer
                return (int)$payload;
            case '$': // Bulk string
                $len = (int)$payload;
                if ($len === -1) return null;
                $data = '';
                $remaining = $len;
                while ($remaining > 0 && !feof($this->socket)) {
                    $chunk = fread($this->socket, min($remaining, 8192));
                    if ($chunk === false) {
                        $this->closeSocket();
                        return false;
                    }
                    $data .= $chunk;
                    $remaining -= strlen($chunk);
                }
                fread($this->socket, 2); // Read trailing \r\n
                return $data;
            case '*': // Array
                $count = (int)$payload;
                if ($count === -1) return null;
                $res = [];
                for ($i = 0; $i < $count; $i++) {
                    $res[] = $this->readReply();
                }
                return $res;
            default:
                return false;
        }
    }

    private function closeSocket(): void {
        if ($this->socket) {
            @fclose($this->socket);
            $this->socket = null;
        }
        $this->isConnected = false;
    }

    // ==========================================
    // Public Redis Commands
    // ==========================================

    public function ping(): bool {
        if ($this->nativeRedis) {
            try {
                return $this->nativeRedis->ping() !== false;
            } catch (\Throwable $e) {
                return false;
            }
        }
        $res = $this->sendCommand(['PING']);
        return ($res === 'PONG' || $res === '+PONG');
    }

    public function lpush(string $key, ...$values): int|false {
        if (empty($values)) return 0;
        if ($this->nativeRedis) {
            try {
                return (int)$this->nativeRedis->lPush($key, ...$values);
            } catch (\Throwable $e) {
                return false;
            }
        }
        $args = array_merge(['LPUSH', $key], $values);
        $res = $this->sendCommand($args);
        return is_numeric($res) ? (int)$res : false;
    }

    public function rpush(string $key, ...$values): int|false {
        if (empty($values)) return 0;
        if ($this->nativeRedis) {
            try {
                return (int)$this->nativeRedis->rPush($key, ...$values);
            } catch (\Throwable $e) {
                return false;
            }
        }
        $args = array_merge(['RPUSH', $key], $values);
        $res = $this->sendCommand($args);
        return is_numeric($res) ? (int)$res : false;
    }

    public function ltrim(string $key, int $start, int $stop): bool {
        if ($this->nativeRedis) {
            try {
                return (bool)$this->nativeRedis->lTrim($key, $start, $stop);
            } catch (\Throwable $e) {
                return false;
            }
        }
        $res = $this->sendCommand(['LTRIM', $key, $start, $stop]);
        return ($res === 'OK' || $res === true);
    }

    public function lrange(string $key, int $start, int $stop): array {
        if ($this->nativeRedis) {
            try {
                $r = $this->nativeRedis->lRange($key, $start, $stop);
                return is_array($r) ? $r : [];
            } catch (\Throwable $e) {
                return [];
            }
        }
        $res = $this->sendCommand(['LRANGE', $key, $start, $stop]);
        return is_array($res) ? $res : [];
    }

    public function llen(string $key): int {
        if ($this->nativeRedis) {
            try {
                return (int)$this->nativeRedis->lLen($key);
            } catch (\Throwable $e) {
                return 0;
            }
        }
        $res = $this->sendCommand(['LLEN', $key]);
        return is_numeric($res) ? (int)$res : 0;
    }

    public function expire(string $key, int $seconds): bool {
        if ($this->nativeRedis) {
            try {
                return (bool)$this->nativeRedis->expire($key, $seconds);
            } catch (\Throwable $e) {
                return false;
            }
        }
        $res = $this->sendCommand(['EXPIRE', $key, $seconds]);
        return ($res === 1 || $res === true);
    }

    public function del(string ...$keys): int {
        if (empty($keys)) return 0;
        if ($this->nativeRedis) {
            try {
                return (int)$this->nativeRedis->del(...$keys);
            } catch (\Throwable $e) {
                return 0;
            }
        }
        $args = array_merge(['DEL'], $keys);
        $res = $this->sendCommand($args);
        return is_numeric($res) ? (int)$res : 0;
    }
}

