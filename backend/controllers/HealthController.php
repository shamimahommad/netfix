<?php
/**
 * NetFix ISP SaaS - Health & Diagnostic Telemetry Controller
 * Implements industry standard RFC-compliant health check endpoints:
 * - Public /health endpoint returns minimal, non-leaking status for load balancers & monitoring.
 * - Detailed diagnostic telemetry is restricted to authenticated SaaS Super Administrators.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class HealthController {
    /**
     * Public Minimal Health Check Endpoint
     * Handles /health, /healthcheck, /health-check, /ping, /status
     * Returns ONLY status, service name, and timestamp.
     * Does NOT leak database stats, memory, disk, PHP version, or server internals.
     */
    public static function check(): void {
        $isHealthy = false;
        try {
            $db = Database::tryConnection();
            if ($db !== null) {
                $db->query("SELECT 1");
                $isHealthy = true;
            }
        } catch (\Throwable $e) {
            $isHealthy = false;
        }

        $statusCode = $isHealthy ? 200 : 503;
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($statusCode);
        echo json_encode([
            'status' => $isHealthy ? 'ok' : 'degraded',
            'service' => 'NetFix ISP SaaS Engine',
            'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Authenticated Detailed Diagnostic Telemetry Endpoint
     * Restricted to SaaS Super Administrator.
     * Returns comprehensive server telemetry: MySQL latency, disk space, memory, PHP runtime, Redis.
     */
    public static function detailed(): void {
        $user = AuthMiddleware::requireAuth();
        if (($user['role'] ?? '') !== 'saas_admin' && ($user['user_type'] ?? '') !== 'saas') {
            Response::error('Access restricted to SaaS Super Administrator', 403);
            return;
        }

        $diagnostics = self::getDetailedDiagnostics();
        $statusCode = ($diagnostics['overall'] === 'healthy') ? 200 : 503;
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($statusCode);
        echo json_encode($diagnostics, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Collect full telemetry and diagnostic checks
     */
    public static function getDetailedDiagnostics(): array {
        $startTime = microtime(true);
        $checks = [];
        $isHealthy = true;

        // 1. MySQL Database Health & Latency Probe
        $dbStart = microtime(true);
        try {
            $db = Database::tryConnection();
            if ($db === null) {
                throw new Exception('Database connection failed');
            }
            $stmt = $db->query("SELECT 1");
            $dbLatencyMs = round((microtime(true) - $dbStart) * 1000, 2);

            $userCount = 0;
            try {
                $userCount = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();
            } catch (\Throwable $e) {}

            $checks['database'] = [
                'status' => 'healthy',
                'driver' => 'mysql',
                'latency_ms' => $dbLatencyMs,
                'registered_users' => $userCount,
                'message' => "Connected ({$dbLatencyMs}ms)",
            ];
        } catch (\Throwable $e) {
            $isHealthy = false;
            $checks['database'] = [
                'status' => 'unhealthy',
                'driver' => 'mysql',
                'error' => 'Database connection failed',
                'message' => 'Unavailable',
            ];
        }

        // 2. Redis Cache Probe (if configured)
        $redisHost = getenv('REDIS_HOST');
        if (!empty($redisHost) && $redisHost !== 'none') {
            $redisPort = (int)(getenv('REDIS_PORT') ?: 6379);
            $redisStart = microtime(true);
            try {
                $sock = @fsockopen($redisHost, $redisPort, $errCode, $errStr, 1.0);
                if ($sock) {
                    fwrite($sock, "*1\r\n\$4\r\nPING\r\n");
                    $reply = fgets($sock);
                    fclose($sock);
                    $redisLatencyMs = round((microtime(true) - $redisStart) * 1000, 2);
                    $checks['redis'] = [
                        'status' => 'healthy',
                        'host' => $redisHost,
                        'port' => $redisPort,
                        'latency_ms' => $redisLatencyMs,
                        'message' => "PONG ({$redisLatencyMs}ms)",
                    ];
                } else {
                    $checks['redis'] = [
                        'status' => 'degraded',
                        'host' => $redisHost,
                        'port' => $redisPort,
                        'message' => "Socket unreachable: {$errStr}",
                    ];
                }
            } catch (\Throwable $e) {
                $checks['redis'] = [
                    'status' => 'degraded',
                    'message' => $e->getMessage(),
                ];
            }
        } else {
            $checks['redis'] = [
                'status' => 'skipped',
                'message' => 'Redis not configured for this environment',
            ];
        }

        // 3. VictoriaLogs Probe (if configured)
        $vlogsUrl = getenv('VICTORIALOGS_URL');
        if (!empty($vlogsUrl)) {
            $vlogsStart = microtime(true);
            $ch = curl_init("{$vlogsUrl}/health");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 2,
                CURLOPT_CONNECTTIMEOUT => 1,
            ]);
            $res = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            $vlogsLatency = round((microtime(true) - $vlogsStart) * 1000, 2);

            $checks['victorialogs'] = [
                'status' => ($httpCode === 200) ? 'healthy' : 'degraded',
                'url' => $vlogsUrl,
                'http_status' => $httpCode,
                'latency_ms' => $vlogsLatency,
                'message' => ($httpCode === 200) ? "Active ({$vlogsLatency}ms)" : "HTTP status {$httpCode}",
            ];
        }

        // 4. Storage & Filesystem Capacity
        $diskPath = defined('PHP_OS_FAMILY') && PHP_OS_FAMILY === 'Windows' ? 'C:' : '/';
        $freeBytes = @disk_free_space($diskPath);
        $totalBytes = @disk_total_space($diskPath);
        if ($freeBytes !== false && $totalBytes !== false && $totalBytes > 0) {
            $freeGb = round($freeBytes / (1024 * 1024 * 1024), 2);
            $totalGb = round($totalBytes / (1024 * 1024 * 1024), 2);
            $usedPercent = round((1 - ($freeBytes / $totalBytes)) * 100, 1);
            $checks['storage'] = [
                'status' => ($usedPercent > 95) ? 'warning' : 'healthy',
                'free_gb' => $freeGb,
                'total_gb' => $totalGb,
                'used_percentage' => $usedPercent,
                'message' => "{$freeGb} GB free of {$totalGb} GB ({$usedPercent}% used)",
            ];
        }

        // 5. Memory & Runtime Telemetry
        $memUsageMb = round(memory_get_usage(true) / 1024 / 1024, 2);
        $peakMemMb = round(memory_get_peak_usage(true) / 1024 / 1024, 2);
        $checks['memory'] = [
            'status' => 'healthy',
            'current_usage_mb' => $memUsageMb,
            'peak_usage_mb' => $peakMemMb,
            'memory_limit' => ini_get('memory_limit') ?: 'unlimited',
        ];

        // 6. PHP & System Environment
        $requiredExtensions = ['pdo_mysql', 'bcmath', 'sockets', 'curl', 'json'];
        $missingExtensions = [];
        foreach ($requiredExtensions as $ext) {
            if (!extension_loaded($ext)) {
                $missingExtensions[] = $ext;
            }
        }

        $checks['php'] = [
            'status' => empty($missingExtensions) ? 'healthy' : 'warning',
            'version' => PHP_VERSION,
            'sapi' => php_sapi_name(),
            'missing_extensions' => $missingExtensions,
        ];

        $totalLatencyMs = round((microtime(true) - $startTime) * 1000, 2);

        return [
            'status' => $isHealthy ? 'ok' : 'error',
            'overall' => $isHealthy ? 'healthy' : 'unhealthy',
            'service' => 'NetFix ISP SaaS Engine',
            'version' => '1.0.0',
            'environment' => getenv('APP_ENV') ?: 'production',
            'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
            'total_latency_ms' => $totalLatencyMs,
            'checks' => $checks,
        ];
    }
}
