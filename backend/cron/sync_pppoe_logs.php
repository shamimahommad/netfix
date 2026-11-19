<?php
/**
 * NetFix ISP SaaS - Background PPPoE Router Logs Ingestion Worker
 * Periodically pulls active logs from MikroTik routers and stores them in Redis.
 * This guarantees that web dashboard queries read 100% from Redis with 0ms router latency.
 *
 * Usage:
 *   php backend/cron/sync_pppoe_logs.php [--tenant=ID] [--router=ID]
 *
 * Crontab suggestion (every 1 minute):
 *   * * * * * php /var/www/html/backend/cron/sync_pppoe_logs.php >> /var/log/netfix_logs_sync.log 2>&1
 */

declare(ticks = 1);
ini_set('memory_limit', '256M');
set_time_limit(120);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/RedisClient.php';
require_once __DIR__ . '/../lib/MikrotikSyncService.php';

$redis = RedisClient::getInstance();
if (!$redis || !$redis->isConnected()) {
    echo "[" . date('Y-m-d H:i:s') . "] [ERROR] Redis server is not reachable. Exiting.\n";
    exit(1);
}

$db = Database::getConnection();

// Parse CLI flags
$tenantFilter = null;
$routerFilter = null;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--tenant=')) {
        $tenantFilter = (int)substr($arg, 9);
    } elseif (str_starts_with($arg, '--router=')) {
        $routerFilter = (int)substr($arg, 9);
    }
}

$sql = "SELECT network_device_id, tenant_id, device_name, management_ip, management_port, api_username, api_password, status 
        FROM network_devices 
        WHERE device_type = 'router' AND status = 'active'";
$params = [];

if ($tenantFilter) {
    $sql .= " AND tenant_id = :tid";
    $params['tid'] = $tenantFilter;
}
if ($routerFilter) {
    $sql .= " AND network_device_id = :did";
    $params['did'] = $routerFilter;
}

$stmt = $db->prepare($sql);
$stmt->execute($params);
$routers = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

echo "[" . date('Y-m-d H:i:s') . "] Starting PPPoE Router Logs Ingestion -> Redis (" . count($routers) . " router(s))...\n";

$syncedCount = 0;
$failCount = 0;

foreach ($routers as $router) {
    $rId = (int)$router['network_device_id'];
    $rName = $router['device_name'];
    $cacheKey = "netfix:router_raw_logs:r_{$rId}";

    $api = MikrotikSyncService::connect($router, 3);
    if (!$api) {
        echo "[-] Could not connect to {$rName} (#{$rId}). Skipped.\n";
        $failCount++;
        continue;
    }

    try {
        $logs = $api->comm('/log/print');
        $api->disconnect();

        if (is_array($logs)) {
            // Store raw logs in Redis with 120s TTL (exceeds 1-minute cron)
            $redis->set($cacheKey, json_encode($logs, JSON_UNESCAPED_UNICODE), 120);
            echo "[✓] Ingested " . count($logs) . " log(s) from {$rName} (#{$rId}) into Redis.\n";
            $syncedCount++;
        }
    } catch (\Throwable $e) {
        echo "[x] Error querying {$rName} (#{$rId}): " . $e->getMessage() . "\n";
        $failCount++;
    }
}

echo "[" . date('Y-m-d H:i:s') . "] Finished logs ingestion. Synced: {$syncedCount}, Failed: {$failCount}.\n";
