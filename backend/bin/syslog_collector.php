<?php
/**
 * NetFix ISP SaaS - High-Throughput MikroTik PPPoE Syslog Ingestion Daemon
 * Listens on UDP port (default 514 / 5514), parses RouterOS syslog payloads in real time,
 * resolves multi-tenant router mappings via IP / Token, and performs batch insertions
 * every 1 second into MySQL pppoe_connection_logs to avoid primary DB contention.
 *
 * Usage:
 *   php backend/bin/syslog_collector.php [--port=514] [--flush-interval=1] [--batch-size=500]
 */

declare(ticks = 1);

// Increase memory limit for continuous streaming
ini_set('memory_limit', '256M');
set_time_limit(0);

require_once __DIR__ . '/../config/database.php';

class MikrotikSyslogCollector {
    private int $port;
    private int $maxBatchSize;
    private float $flushInterval;
    private $socket = null;
    private ?PDO $db = null;

    // In-memory router directory cache: refreshed periodically
    private array $ipLookup = [];
    private array $tokenLookup = [];
    private float $lastCacheRefresh = 0;
    private int $cacheTtlSeconds = 60;

    // High-throughput batch buffer
    private array $batchBuffer = [];
    private float $lastFlushTime = 0;

    // Telemetry & Metrics
    private int $totalReceived = 0;
    private int $totalInserted = 0;
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
     * Initialize UDP Server socket and database connection
     */
    public function start(): void {
        $this->initSignalHandlers();
        $this->initDatabase();
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
        echo "  NetFix ISP SaaS - MikroTik PPPoE Syslog Ingestion Daemon\n";
        echo "====================================================================\n";
        echo "  [*] Listening on UDP: {$bindAddress}\n";
        echo "  [*] Batch size limit: {$this->maxBatchSize} items\n";
        echo "  [*] Flush interval:   {$this->flushInterval} second(s)\n";
        echo "  [*] Cached Routers:   " . count($this->ipLookup) . " active by IP, " . count($this->tokenLookup) . " by Token\n";
        echo "  [*] Engine ready. Processing incoming syslog stream...\n";
        echo "====================================================================\n\n";

        $this->eventLoop();
    }

    /**
     * Register OS signals for graceful shutdown
     */
    private function initSignalHandlers(): void {
        if (function_exists('pcntl_signal')) {
            $shutdownHandler = function ($signo) {
                echo "\n[INFO] Signal received ({$signo}). Flushing remaining buffer and shutting down gracefully...\n";
                $this->running = false;
            };
            pcntl_signal(SIGINT, $shutdownHandler);
            pcntl_signal(SIGTERM, $shutdownHandler);
        }
    }

    /**
     * Connect / Reconnect to Database
     */
    private function initDatabase(): void {
        try {
            $this->db = Database::getConnection();
        } catch (\Throwable $e) {
            echo "[ERROR] Database connection failed: " . $e->getMessage() . "\n";
        }
    }

    /**
     * Refresh in-memory Router Directory cache from MySQL
     */
    private function refreshRouterCache(bool $force = false): void {
        $now = microtime(true);
        if (!$force && ($now - $this->lastCacheRefresh) < $this->cacheTtlSeconds) {
            return;
        }

        try {
            if (!$this->db) $this->initDatabase();
            if (!$this->db) return;

            $stmt = $this->db->query("SELECT network_device_id, tenant_id, device_name, management_ip, syslog_token 
                                      FROM network_devices 
                                      WHERE device_type = 'router' AND status = 'active'");
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

                    // If batch buffer reaches capacity, flush immediately
                    if (count($this->batchBuffer) >= $this->maxBatchSize) {
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

    /**
     * Process a single raw UDP syslog packet
     */
    private function handlePacket(string $rawPacket, string $peerAddress): void {
        // Peer address format: "192.168.1.1:51450" or "[::1]:51450"
        $remoteIp = $peerAddress;
        if (preg_match('/^\[?([0-9a-fA-F\.:]+)\]?:[0-9]+$/', $peerAddress, $pm)) {
            $remoteIp = $pm[1];
        }

        // Parse PPPoE events from packet payload
        $parsed = self::parseMikrotikPayload($rawPacket);
        if (!$parsed) {
            // Not a PPPoE event (e.g. dhcp, system, firewall)
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
            // Router IP or Token not recognized in NetFix SaaS database
            $this->totalDropped++;
            return;
        }

        // Add to batch buffer
        $this->batchBuffer[] = [
            'tenant_id' => (int)$router['tenant_id'],
            'router_id' => (int)$router['network_device_id'],
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
    }

    /**
     * Flush in-memory buffer to MySQL using a single multi-row INSERT query
     */
    private function flushBuffer(): void {
        $count = count($this->batchBuffer);
        $this->lastFlushTime = microtime(true);

        if ($count === 0) {
            return;
        }

        $items = $this->batchBuffer;
        $this->batchBuffer = [];

        try {
            if (!$this->db) $this->initDatabase();
            if (!$this->db) {
                // If DB is unreachable, preserve buffer up to 5000 items to prevent data loss
                $this->batchBuffer = array_slice(array_merge($items, $this->batchBuffer), 0, 5000);
                return;
            }

            $sql = "INSERT INTO pppoe_connection_logs 
                    (tenant_id, router_id, username, event_type, assigned_ip, caller_mac, interface_name, 
                     session_time_seconds, bytes_uploaded, bytes_downloaded, disconnect_reason, raw_message, logged_at) 
                    VALUES ";

            $placeholders = [];
            $values = [];

            foreach ($items as $item) {
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

            $this->totalInserted += $count;
            $elapsed = round(microtime(true) - $this->startTime, 1);
            $rate = ($elapsed > 0) ? round($this->totalInserted / $elapsed, 1) : $count;

            echo sprintf("[%s] Flushed %d log(s) | Total Inserted: %d | Dropped: %d | Rate: %s logs/sec\n", 
                date('H:i:s'), $count, $this->totalInserted, $this->totalDropped, $rate);

        } catch (\Throwable $e) {
            echo "[ERROR] Batch flush failed: " . $e->getMessage() . "\n";
            $this->db = null; // Force reconnect on next cycle
            // Re-queue items up to memory limit
            $this->batchBuffer = array_slice(array_merge($items, $this->batchBuffer), 0, 5000);
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

        // Extract Caller MAC Address (normalize to uppercase with colons)
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

