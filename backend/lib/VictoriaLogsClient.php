<?php
/**
 * NetFix ISP SaaS - High-Throughput VictoriaLogs HTTP Client
 * Integrates with VictoriaLogs Single-Node or Cluster for compressed, long-term log storage.
 * Ingestion: POST /insert/jsonline (NDJSON stream)
 * Query: GET /select/logsql/query (LogsQL engine)
 */

class VictoriaLogsClient {
    private static ?VictoriaLogsClient $instance = null;
    private string $baseUrl;
    private float $timeout;

    public function __construct(?string $baseUrl = null, float $timeout = 2.0) {
        $url = $baseUrl ?? getenv('VICTORIALOGS_URL') ?: 'http://127.0.0.1:9428';
        $this->baseUrl = rtrim($url, '/');
        $this->timeout = $timeout;
    }

    public static function getInstance(): self {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getBaseUrl(): string {
        return $this->baseUrl;
    }

    /**
     * Check if VictoriaLogs is running and accessible
     */
    public function ping(): bool {
        $ch = curl_init("{$this->baseUrl}/health");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT_MS => (int)($this->timeout * 1000),
            CURLOPT_NOBODY => true,
        ]);
        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($httpCode >= 200 && $httpCode < 400);
    }

    /**
     * Ingest batch of log events into VictoriaLogs via /insert/jsonline
     * @param array $records Array of log associative arrays
     * @param array $streamFields Stream labels (indexed for ultra-fast partition pruning)
     * @return bool True if successfully ingested
     */
    public function insertJsonLines(array $records, array $streamFields = ['tenant_id', 'router_id', 'username', 'event_type']): bool {
        if (empty($records)) {
            return true;
        }

        $streamQuery = implode(',', $streamFields);
        $url = "{$this->baseUrl}/insert/jsonline?_stream_fields={$streamQuery}";

        $ndjson = '';
        foreach ($records as $r) {
            // Ensure VictoriaLogs required and standard fields
            $time = !empty($r['logged_at']) ? date('c', strtotime($r['logged_at'])) : date('c');
            $line = [
                '_time' => $time,
                '_msg' => $r['raw_message'] ?? "PPPoE {$r['event_type']} for {$r['username']}",
                'tenant_id' => (string)($r['tenant_id'] ?? 0),
                'router_id' => (string)($r['router_id'] ?? 0),
                'username' => (string)($r['username'] ?? ''),
                'event_type' => (string)($r['event_type'] ?? 'info'),
                'assigned_ip' => (string)($r['assigned_ip'] ?? ''),
                'caller_mac' => (string)($r['caller_mac'] ?? ''),
                'interface_name' => (string)($r['interface_name'] ?? ''),
                'session_time_seconds' => (int)($r['session_time_seconds'] ?? 0),
                'bytes_uploaded' => (int)($r['bytes_uploaded'] ?? 0),
                'bytes_downloaded' => (int)($r['bytes_downloaded'] ?? 0),
                'disconnect_reason' => (string)($r['disconnect_reason'] ?? ''),
            ];
            $ndjson .= json_encode($line, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $ndjson,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/stream+json',
                'Content-Length: ' . strlen($ndjson),
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT_MS => (int)($this->timeout * 1000),
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300) {
            return true;
        }

        // Telemetry warning
        return false;
    }

    /**
     * Query VictoriaLogs using LogsQL syntax
     * @param string $logSql LogsQL filter string
     * @param int $limit Maximum records to return
     * @param string|null $start ISO8601 timestamp or relative duration (e.g. -24h)
     * @param string|null $end ISO8601 timestamp
     * @return array Array of parsed log objects
     */
    public function queryLogs(string $logSql, int $limit = 100, ?string $start = null, ?string $end = null): array {
        $params = [
            'query' => $logSql,
            'limit' => $limit,
        ];
        if ($start) $params['start'] = $start;
        if ($end) $params['end'] = $end;

        $url = "{$this->baseUrl}/select/logsql/query?" . http_build_query($params);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT_MS => 4000,
            CURLOPT_HTTPHEADER => [
                'Accept: application/stream+json',
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) {
            return [];
        }

        $results = [];
        $lines = explode("\n", trim($response));
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') continue;
            $row = json_decode($line, true);
            if ($row) {
                // Map VictoriaLogs row to NetFix unified log record format
                $results[] = [
                    'id' => $row['_msg_id'] ?? $row['id'] ?? md5($row['_time'] . ($row['username'] ?? '')),
                    'tenant_id' => (int)($row['tenant_id'] ?? 0),
                    'router_id' => (int)($row['router_id'] ?? 0),
                    'username' => $row['username'] ?? '',
                    'event_type' => $row['event_type'] ?? 'info',
                    'assigned_ip' => $row['assigned_ip'] ?? null,
                    'caller_mac' => $row['caller_mac'] ?? null,
                    'interface_name' => $row['interface_name'] ?? null,
                    'session_time_seconds' => (int)($row['session_time_seconds'] ?? 0),
                    'bytes_uploaded' => (int)($row['bytes_uploaded'] ?? 0),
                    'bytes_downloaded' => (int)($row['bytes_downloaded'] ?? 0),
                    'disconnect_reason' => $row['disconnect_reason'] ?? null,
                    'raw_message' => $row['_msg'] ?? '',
                    'logged_at' => !empty($row['_time']) ? date('Y-m-d H:i:s', strtotime($row['_time'])) : date('Y-m-d H:i:s'),
                ];
            }
        }

        return $results;
    }
}

