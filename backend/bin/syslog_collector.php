<?php
/**
 * NetFix ISP SaaS - High-Throughput Tiered Syslog Ingestion Daemon
 * Listens on UDP port (default 514 / 5514), parses RouterOS syslog payloads in real time,
 * resolves multi-tenant router mappings via IP / Token, and routes logs according to each
 * tenant's SaaS-Admin-configured Log Storage Policy:
 *
 * 1. 'short_term_redis'   -> Zero disk I/O! LPUSH to Redis list logs:tenant:{id}, LTRIM to max_live_logs, EXPIRE 24h
 * 2. 'long_term_victoria' -> Buffered NDJSON batch-streamed to VictoriaLogs /insert/jsonline (ultra-compressed)
 * 3. 'disabled'           -> Dropped immediately with zero compute overhead
 *
 * Usage:
 *   php backend/bin/syslog_collector.php [--port=514] [--flush-interval=1] [--batch-size=500]
 */

declare(ticks = 1);

// Increase memory limit for high-volume streaming
ini_set('memory_limit', '256M');
set_time_limit(0);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/RedisClient.php';
require_once __DIR__ . '/../lib/VictoriaLogsClient.php';

class MikrotikSyslogCollector {
    private int $port;
    private int $maxBatchSize;
    private float $flushInterval;
    private $socket = null;
    private ?PDO $db = null;

    // Storage Engine Clients
    private ?RedisClient $redis = null;
    private ?VictoriaLogsClient $victoria = null;

    // In-memory router directory cache: refreshed periodically (every 60s)
    private array $ipLookup = [];
    private array $tokenLookup = [];
    private float $lastCacheRefresh = 0;
    private int $cacheTtlSeconds = 60;

    // High-throughput Buffers
    private array $redisBuffer = [];    // [tenant_id => [record, record, ...]]
    private array $victoriaBuffer = []; // [record, record, ...]
    private array $mysqlFallbackBuffer = []; // Fallback if storage engines fail
    private float $lastFlushTime = 0;

    // Telemetry & Metrics
    private int $totalReceived = 0;
    private int $totalRedisInserted = 0;
    private int $totalVictoriaInserted = 0;
    private int $totalMysqlInserted = 0;
    private int $totalDropped = 0;
    private float $startTime = 0;
    private bool $running = true;

    public function __construct(int $port = 514, int $maxBatchSize = 500, float $flushInterval = 1.0) {
        $this->port = $port > 0 ? $port : 514;
        $this->maxBatchSize = $maxBatchSize > 0 ? $maxBatchSize : 500;
        $this->flushInterval = $flushInterval > 0 ? $flushInterval : 1.0;
        $this->startTime = microtime(true);
        $this->lastFlushTime = microtime(true);
    }

    /**
     * Initialize UDP Server socket, database, and storage clients
     */
    public function start(): void {
        $this->initSignalHandlers();
        $this->initDatabase();
        $this->initStorageClients();
        $this->refreshRouterCache(true);

        $bindAddress = "udp://0.0.0.0:{$this->port}";
        $errno = 0;
        $errstr = '';

        $this->socket = @stream_socket_server($bindAddress, $errno, $errstr, STREAM_SERVER_BIND);

        if (!$this->socket) {
            // If port 514 failed (e.g. non-root on Linux), try fallback port 5514
            if ($this->port === 514) {
                $fallbackPort = 5514;
                echo "[WARN] Could not bind to UDP port 514 ({$errstr}). Trying fallback UDP port {$fallbackPort}...\n";
                $this->port = $fallbackPort;
                $bindAddress = "udp://0.0.0.0:{$this->port}";
                $this->socket = @stream_socket_server($bindAddress, $errno, $errstr, STREAM_SERVER_BIND);
            }
        }

        if (!$this->socket) {
            echo "[FATAL] Failed to create UDP socket on {$bindAddress}: [{$errno}] {$errstr}\n";
            exit(1);
        }

        // Set non-blocking mode
        stream_set_blocking($this->socket, false);

        echo "====================================================================\n";
        echo "  NetFix ISP SaaS - High-Throughput Tiered Syslog Collector\n";
        echo "====================================================================\n";
        echo "  [*] Listening on UDP:       {$bindAddress}\n";
        echo "  [*] Ingestion Batch Limit:  {$this->maxBatchSize} items\n";
        echo "  [*] Auto-Flush Interval:    {$this->flushInterval} second(s)\n";
        echo "  [*] Cached Routers:         " . count($this->ipLookup) . " by IP, " . count($this->tokenLookup) . " by Token\n";
        echo "  [*] Redis Engine:           " . ($this->redis && $this->redis->isConnected() ? 'ONLINE (' . getenv('REDIS_HOST') . ')' : 'STANDBY/AUTO-CONNECT') . "\n";
        echo "  [*] VictoriaLogs Engine:    " . ($this->victoria ? $this->victoria->getBaseUrl() : 'NOT CONFIGURED') . "\n";
        echo "  [*] Engine ready. Processing incoming syslog stream...\n";
        echo "====================================================================\n\n";

        $this->eventLoop();
    }

    private function initSignalHandlers(): void {
        if (function_exists('pcntl_signal')) {
            $shutdownHandler = function ($signo) {
                echo "\n[INFO] Signal received ({$signo}). Flushing remaining buffers and shutting down gracefully...\n";
                $this->running = false;
            };
            pcntl_signal(SIGINT, $shutdownHandler);
            pcntl_signal(SIGTERM, $shutdownHandler);
        }
    }

    private function initDatabase(): void {
        try {
            $this->db = Database::getConnection();
        } catch (\Throwable $e) {
            echo "[ERROR] Database connection failed: " . $e->getMessage() . "\n";
        }
    }

    private function initStorageClients(): void {
        try {
            $this->redis = RedisClient::getInstance();
        } catch (\Throwable $e) {
            echo "[WARN] Redis client init warning: " . $e->getMessage() . "\n";
        }

        try {
            $this->victoria = VictoriaLogsClient::getInstance();
        } catch (\Throwable $e) {
            echo "[WARN] VictoriaLogs client init warning: " . $e->getMessage() . "\n";
        }
    }

    /**
     * Refresh in-memory Router Directory cache and Tenant Policy from MySQL
     */
    private function refreshRouterCache(bool $force = false): void {
        $now = microtime(true);
        if (!$force && ($now - $this->lastCacheRefresh) < $this->cacheTtlSeconds) {
            return;
        }

        try {
            if (!$this->db) $this->initDatabase();
            if (!$this->db) return;

            $sql = "SELECT nd.network_device_id, nd.tenant_id, nd.device_name, nd.management_ip, nd.syslog_token,
                           COALESCE(t.log_storage_mode, 'short_term_redis') as log_storage_mode,
                           COALESCE(t.log_retention_days, 1) as log_retention_days,
                           COALESCE(t.max_live_logs, 1000) as max_live_logs
                    FROM network_devices nd
                    LEFT JOIN tenants t ON t.tenant_id = nd.tenant_id
                    WHERE nd.device_type = 'router' AND nd.status = 'active'";

            $stmt = $this->db->query($sql);
            $routers = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $newIp = [];
            $newToken = [];

            foreach ($routers as $r) {
                $cleanIp = trim($r['management_ip'] ?? '');
                if ($cleanIp !== '') {
                    $newIp[$cleanIp] = $r;
                }
                $token = trim($r['syslog_token'] ?? '');
                if ($token !== '') {
                    $newToken[$token] = $r;
                }
            }

            $this->ipLookup = $newIp;
            $this->tokenLookup = $newToken;
            $this->lastCacheRefresh = $now;
        } catch (\Throwable $e) {
            echo "[WARN] Router cache refresh error: " . $e->getMessage() . "\n";
            $this->db = null; // Mark for reconnect
        }
    }

    /**
     * Main Non-Blocking Socket Event Loop
     */
    private function eventLoop(): void {
        $read = [$this->socket];
        $write = null;
        $except = null;

        while ($this->running) {
            $read = [$this->socket];

            // Wait up to 100ms for incoming packets
            $numChanged = @stream_select($read, $write, $except, 0, 100000);

            if ($numChanged > 0) {
                // Drain socket buffer
                while (true) {
                    $peer = '';
                    $packet = @stream_socket_recvfrom($this->socket, 2048, 0, $peer);

                    if ($packet === false || $packet === '') {
                        break;
                    }

                    $this->totalReceived++;
                    $this->handlePacket($packet, $peer);

                    // Check total pending buffer across engines
                    $totalPending = $this->countPendingBuffer();
                    if ($totalPending >= $this->maxBatchSize) {
                        $this->flushBuffer();
                    }
                }
            }

            // Periodic flush check every $flushInterval seconds
            if ((microtime(true) - $this->lastFlushTime) >= $this->flushInterval) {
                $this->flushBuffer();
            }

            // Periodic router cache refresh check
            $this->refreshRouterCache();
        }

        // Final flush on shutdown
        $this->flushBuffer();
        if ($this->socket) {
            @fclose($this->socket);
        }
        echo "[EXIT] Syslog collector daemon stopped cleanly.\n";
    }

    private function countPendingBuffer(): int {
        $count = count($this->victoriaBuffer) + count($this->mysqlFallbackBuffer);
        foreach ($this->redisBuffer as $tList) {
            $count += count($tList);
        }
        return $count;
    }

    /**
     * Process a single raw UDP syslog packet and route according to tenant policy
     */
    private function handlePacket(string $rawPacket, string $peerAddress): void {
        $remoteIp = $peerAddress;
        if (preg_match('/^\[?([0-9a-fA-F\.:]+)\]?:[0-9]+$/', $peerAddress, $pm)) {
            $remoteIp = $pm[1];
        }

        // Parse PPPoE events from packet payload
        $parsed = self::parseMikrotikPayload($rawPacket);
        if (!$parsed) {
            $this->totalDropped++;
            return;
        }

        // Match Router via Token (priority) or Source IP
        $router = null;
        if (!empty($parsed['router_token']) && isset($this->tokenLookup[$parsed['router_token']])) {
            $router = $this->tokenLookup[$parsed['router_token']];
        } elseif (isset($this->ipLookup[$remoteIp])) {
            $router = $this->ipLookup[$remoteIp];
        }

        if (!$router) {
            $this->totalDropped++;
            return;
        }

        $tenantId = (int)$router['tenant_id'];
        $routerId = (int)$router['network_device_id'];
        $storageMode = $router['log_storage_mode'] ?? 'short_term_redis';
        $maxLiveLogs = (int)($router['max_live_logs'] ?? 1000);

        // Routing Decision 1: Disabled -> Drop immediately
        if ($storageMode === 'disabled') {
            $this->totalDropped++;
            return;
        }

        // Construct standard log record
        $record = [
            'id' => uniqid('pppoe_', true),
            'tenant_id' => $tenantId,
            'router_id' => $routerId,
            'router_name' => $router['device_name'] ?? "Router #{$routerId}",
            'username' => $parsed['username'],
            'event_type' => $parsed['event_type'],
            'assigned_ip' => $parsed['assigned_ip'],
            'caller_mac' => $parsed['caller_mac'],
            'interface_name' => $parsed['interface_name'],
            'session_time_seconds' => $parsed['session_time_seconds'],
            'bytes_uploaded' => $parsed['bytes_uploaded'],
            'bytes_downloaded' => $parsed['bytes_downloaded'],
            'disconnect_reason' => $parsed['disconnect_reason'],
            'raw_message' => substr($parsed['raw_message'], 0, 500),
            'logged_at' => date('Y-m-d H:i:s'),
        ];

        // Routing Decision 2: Short-Term Live (Redis List)
        if ($storageMode === 'short_term_redis') {
            if (!isset($this->redisBuffer[$tenantId])) {
                $this->redisBuffer[$tenantId] = [];
            }
            $record['_max_live'] = $maxLiveLogs;
            $this->redisBuffer[$tenantId][] = $record;
            return;
        }

        // Routing Decision 3: Long-Term Enterprise (VictoriaLogs)
        if ($storageMode === 'long_term_victoria') {
            $this->victoriaBuffer[] = $record;
            return;
        }

        // Fallback to MySQL if unknown mode
        $this->mysqlFallbackBuffer[] = $record;
    }

    /**
     * Flush in-memory buffers to Redis and VictoriaLogs in high-speed batches
     */
    private function flushBuffer(): void {
        $this->lastFlushTime = microtime(true);
        $flushedCount = 0;

        // 1. Flush Redis Buffer
        if (!empty($this->redisBuffer)) {
            $redisItems = $this->redisBuffer;
            $this->redisBuffer = [];

            if (!$this->redis) {
                $this->initStorageClients();
            }

            foreach ($redisItems as $tenantId => $records) {
                $maxLive = (int)($records[0]['_max_live'] ?? 1000);
                $jsonList = [];
                foreach ($records as $r) {
                    unset($r['_max_live']);
                    $jsonList[] = json_encode($r, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                }

                $key = "logs:tenant:{$tenantId}";
                $res = $this->redis ? $this->redis->lpush($key, ...$jsonList) : false;

                if ($res !== false) {
                    // LTRIM to keep only latest max_live_logs
                    $this->redis->ltrim($key, 0, $maxLive - 1);
                    // Keep ephemeral buffer with 24 hours TTL
                    $this->redis->expire($key, 86400);

                    $this->totalRedisInserted += count($records);
                    $flushedCount += count($records);
                } else {
                    // Redis connection issue -> fallback to MySQL temporarily to prevent data loss
                    foreach ($records as $r) {
                        unset($r['_max_live']);
                        $this->mysqlFallbackBuffer[] = $r;
                    }
                }
            }
        }

        // 2. Flush VictoriaLogs Buffer
        if (!empty($this->victoriaBuffer)) {
            $vicRecords = $this->victoriaBuffer;
            $this->victoriaBuffer = [];

            if (!$this->victoria) {
                $this->initStorageClients();
            }

            $success = $this->victoria ? $this->victoria->insertJsonLines($vicRecords) : false;

            if ($success) {
                $this->totalVictoriaInserted += count($vicRecords);
                $flushedCount += count($vicRecords);
            } else {
                // If VictoriaLogs is down, preserve records in MySQL fallback buffer
                $this->mysqlFallbackBuffer = array_slice(array_merge($this->mysqlFallbackBuffer, $vicRecords), 0, 5000);
            }
        }

        // 3. Flush MySQL Fallback Buffer (Only if engines fail or fallback is triggered)
        if (!empty($this->mysqlFallbackBuffer)) {
            $mysqlRecords = $this->mysqlFallbackBuffer;
            $this->mysqlFallbackBuffer = [];
            $this->flushToMySQL($mysqlRecords);
            $flushedCount += count($mysqlRecords);
        }

        // Periodic Telemetry Output
        if ($flushedCount > 0) {
            $elapsed = round(microtime(true) - $this->startTime, 1);
            $totalInserted = $this->totalRedisInserted + $this->totalVictoriaInserted + $this->totalMysqlInserted;
            $rate = ($elapsed > 0) ? round($totalInserted / $elapsed, 1) : $flushedCount;

            echo sprintf("[%s] Flushed: %d | Redis: %d | VictoriaLogs: %d | MySQL Fallback: %d | Dropped: %d | Rate: %s/s\n",
                date('H:i:s'),
                $flushedCount,
                $this->totalRedisInserted,
                $this->totalVictoriaInserted,
                $this->totalMysqlInserted,
                $this->totalDropped,
                $rate
            );
        }
    }

    /**
     * Fallback batch insert to MySQL only if primary storage is unreachable
     */
    private function flushToMySQL(array $records): void {
        if (empty($records)) return;

        try {
            if (!$this->db) $this->initDatabase();
            if (!$this->db) return;

            $sql = "INSERT INTO pppoe_connection_logs 
                    (tenant_id, router_id, username, event_type, assigned_ip, caller_mac, interface_name, 
                     session_time_seconds, bytes_uploaded, bytes_downloaded, disconnect_reason, raw_message, logged_at) 
                    VALUES ";

            $placeholders = [];
            $values = [];

            foreach ($records as $item) {
                $placeholders[] = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                $values[] = $item['tenant_id'];
                $values[] = $item['router_id'];
                $values[] = $item['username'];
                $values[] = $item['event_type'];
                $values[] = $item['assigned_ip'];
                $values[] = $item['caller_mac'];
                $values[] = $item['interface_name'];
                $values[] = $item['session_time_seconds'];
                $values[] = $item['bytes_uploaded'];
                $values[] = $item['bytes_downloaded'];
                $values[] = $item['disconnect_reason'];
                $values[] = $item['raw_message'];
                $values[] = $item['logged_at'];
            }

            $sql .= implode(', ', $placeholders);
            $stmt = $this->db->prepare($sql);
            $stmt->execute($values);

            $this->totalMysqlInserted += count($records);
        } catch (\Throwable $e) {
            echo "[ERROR] Fallback MySQL flush failed: " . $e->getMessage() . "\n";
            $this->db = null;
        }
    }

    /**
     * High-Speed MikroTik Syslog Payload Parser
     */
    public static function parseMikrotikPayload(string $rawPacket): ?array {
        $raw = trim($rawPacket);
        if ($raw === '') return null;

        // 1. Strip Syslog PRI prefix (<14> etc.)
        $clean = preg_replace('/^<[0-9]{1,3}>/', '', $raw);

        // 2. Extract Prefix Token if present (e.g. [NETFIX_R10]: or [RTR_123]:)
        $routerToken = null;
        if (preg_match('/\[([a-zA-Z0-9_\-]+)\]:/', $clean, $tm)) {
            $routerToken = $tm[1];
        }

        // 3. Extract Message body (after timestamp and topics)
        $msg = $clean;
        if (preg_match('/^[A-Z][a-z]{2}\s+\d+\s+[\d:]+\s+\S+\s+(?:[a-zA-Z0-9_, -]+:\s*)?(.*)$/', $clean, $mm)) {
            $msg = trim($mm[1]);
        }

        $eventType = null;
        $username = null;
        $assignedIp = null;
        $callerMac = null;
        $interfaceName = null;
        $disconnectReason = null;
        $sessionTimeSeconds = null;
        $bytesUploaded = null;
        $bytesDownloaded = null;

        // Extract PPPoE interface name: <pppoe-username>
        if (preg_match('/<(pppoe-([^>]+))>/i', $msg, $im)) {
            $interfaceName = $im[1];
            $candUser = trim($im[2]);
            if ($candUser !== '0' && $candUser !== '') {
                $username = $candUser;
            }
        }

        // 1. Auth Failed check
        if (stripos($msg, 'authentication failed') !== false) {
            $eventType = 'auth_failed';
            if (preg_match('/user\s+([a-zA-Z0-9_.@-]+)\s+authentication failed/i', $msg, $um)) {
                $username = trim($um[1]);
            }
        }
        // 2. Disconnected / Terminating / Logout check (must be checked BEFORE 'connected')
        elseif (stripos($msg, 'disconnected') !== false || stripos($msg, 'logged out') !== false || stripos($msg, 'terminating') !== false) {
            $eventType = 'disconnected';
            if (!$username && preg_match('/(?:^|\s)([a-zA-Z0-9_.@-]+)\s+logged out/i', $msg, $um)) {
                $username = trim($um[1]);
            }
            if (preg_match('/terminating\.\.\.\s*-\s*(.+)$/i', $msg, $rm)) {
                $disconnectReason = trim($rm[1]);
            } elseif (preg_match('/disconnected,\s*([0-9\s]+)/i', $msg, $sm)) {
                $stats = preg_split('/\s+/', trim($sm[1]));
                if (isset($stats[0])) $sessionTimeSeconds = (int)$stats[0];
                if (isset($stats[1])) $bytesUploaded = (int)$stats[1];
                if (isset($stats[2])) $bytesDownloaded = (int)$stats[2];
                $disconnectReason = 'normal logout';
            } elseif (stripos($msg, 'disconnected') !== false) {
                $disconnectReason = 'disconnected';
            }
        }
        // 3. Connected / Login check
        elseif (stripos($msg, 'connected') !== false || stripos($msg, 'logged in') !== false) {
            $eventType = 'connected';
            if (!$username && preg_match('/(?:^|\s)([a-zA-Z0-9_.@-]+)\s+logged in/i', $msg, $um)) {
                $username = trim($um[1]);
            }
        } else {
            return null; // Not a PPPoE event
        }

        if (!$username) {
            return null;
        }

        // Extract Caller MAC Address
        if (preg_match('/(?:caller|from)\s+((?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})/i', $msg, $mcm)) {
            $callerMac = strtoupper(str_replace('-', ':', $mcm[1]));
        } elseif (preg_match('/((?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})/', $msg, $mcm)) {
            $callerMac = strtoupper(str_replace('-', ':', $mcm[1]));
        }

        // Extract Assigned IPv4 Address
        if (preg_match('/(?:connected,\s*|logged\s+in,\s*)(\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b)/i', $msg, $ipm)) {
            $assignedIp = $ipm[1];
        } elseif (preg_match('/(\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b)/', $msg, $ipm)) {
            $assignedIp = $ipm[1];
        }

        return [
            'router_token' => $routerToken,
            'username' => $username,
            'event_type' => $eventType,
            'assigned_ip' => $assignedIp,
            'caller_mac' => $callerMac,
            'interface_name' => $interfaceName ?: "pppoe-{$username}",
            'session_time_seconds' => $sessionTimeSeconds,
            'bytes_uploaded' => $bytesUploaded,
            'bytes_downloaded' => $bytesDownloaded,
            'disconnect_reason' => $disconnectReason,
            'raw_message' => $raw,
        ];
    }
}

// CLI Argument parsing
$port = (int)(getenv('SYSLOG_PORT') ?: 514);
$batchSize = 500;
$flushInterval = 1.0;

foreach ($argv as $arg) {
    if (str_starts_with($arg, '--port=')) {
        $port = (int)substr($arg, 7);
    } elseif (str_starts_with($arg, '--batch-size=')) {
        $batchSize = (int)substr($arg, 13);
    } elseif (str_starts_with($arg, '--flush-interval=')) {
        $flushInterval = (float)substr($arg, 17);
    }
}

$daemon = new MikrotikSyslogCollector($port, $batchSize, $flushInterval);
$daemon->start();
