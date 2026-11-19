<?php
/**
 * NetFix ISP SaaS - PPPoE Logs Handler (Default: Redis In-Memory Tier)
 * Routes:
 *   GET /logs/pppoe
 *   GET /logs/pppoe.php
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/Response.php';
require_once __DIR__ . '/../../lib/RedisClient.php';
require_once __DIR__ . '/../../controllers/NetworkController.php';

try {
    $user = AuthMiddleware::requireAuth();
    $tenantId = AuthMiddleware::getTenantId();
    $db = Database::getConnection();

    // 1. Check Redis for high-throughput live syslog records (Default storage mode)
    $redis = null;
    $redisLogs = [];
    try {
        $redis = RedisClient::getInstance();
        if ($redis && $redis->isConnected() && $tenantId !== null) {
            $redisKey = "logs:tenant:{$tenantId}";
            $rawList = $redis->lrange($redisKey, 0, 999);
            if (!empty($rawList)) {
                foreach ($rawList as $itemStr) {
                    $item = json_decode($itemStr, true);
                    if ($item && is_array($item)) {
                        $redisLogs[] = $item;
                    }
                }
            }
        }
    } catch (\Throwable $ignored) {}

    // 2. If Redis has ingested logs, serve them instantly from Redis In-Memory
    if (!empty($redisLogs)) {
        // Fetch routers for switcher dropdown
        $rStmt = $db->prepare("SELECT network_device_id, device_name, management_ip, status FROM network_devices WHERE tenant_id = :tid AND device_type = 'router' ORDER BY network_device_id ASC");
        $rStmt->execute(['tid' => $tenantId]);
        $routers = $rStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Apply filters (search, event type, router)
        $search = strtolower(trim($_GET['search'] ?? ''));
        $eventType = strtolower(trim($_GET['event_type'] ?? ''));
        $targetRouterId = $_GET['router_id'] ?? null;

        $filtered = array_filter($redisLogs, function ($log) use ($search, $eventType, $targetRouterId) {
            if ($targetRouterId && $targetRouterId !== 'all') {
                if ((string)($log['router_id'] ?? '') !== (string)$targetRouterId) {
                    return false;
                }
            }
            if (!empty($eventType) && $eventType !== 'all') {
                if (strtolower($log['event_type'] ?? '') !== $eventType) {
                    return false;
                }
            }
            if (!empty($search)) {
                $haystack = strtolower(($log['username'] ?? '') . ' ' . ($log['raw_message'] ?? '') . ' ' . ($log['assigned_ip'] ?? '') . ' ' . ($log['caller_mac'] ?? ''));
                if (!str_contains($haystack, $search)) {
                    return false;
                }
            }
            return true;
        });

        // Compute metrics
        $connected = 0;
        $disconnected = 0;
        $authFailed = 0;
        foreach ($filtered as $l) {
            $et = strtolower($l['event_type'] ?? '');
            if ($et === 'connected') $connected++;
            elseif ($et === 'disconnected') $disconnected++;
            elseif ($et === 'auth_failed') $authFailed++;
        }

        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = max(1, min(200, (int)($_GET['per_page'] ?? 50)));
        $total = count($filtered);
        $paginated = array_slice(array_values($filtered), ($page - 1) * $perPage, $perPage);

        Response::json([
            'success' => true,
            'data' => $paginated,
            'logs' => $paginated,
            'total' => $total,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'total_pages' => max(1, ceil($total / $perPage)),
            ],
            'routers' => $routers,
            'metrics' => [
                'connected' => $connected,
                'disconnected' => $disconnected,
                'auth_failed' => $authFailed,
            ],
            'tier' => [
                'mode' => 'short_term_redis',
                'label' => 'Short-Term Live (Redis)',
                'badge' => 'Redis In-Memory Tier',
                'retention' => '24 Hours',
                'engine' => 'Redis In-Memory Tier',
                'max_live_logs' => 1000,
            ],
        ]);
        exit;
    }

    // 3. Fallback: Delegate seamlessly to NetworkController::pppoeLogs (fetches live & caches in Redis)
    NetworkController::pppoeLogs();
} catch (\Throwable $e) {
    Response::error('Failed to load PPPoE logs: ' . $e->getMessage(), 500);
}
