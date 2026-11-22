<?php
/**
 * NetFix ISP SaaS - 5-Minute MikroTik PPPoE Active Sessions & Disconnect Logger
 * 
 * Periodically polls active PPPoE sessions from MikroTik routers, tracks dynamic traffic/GB usage,
 * detects who connected and who disconnected, and writes session logs into pppoe_connection_logs.
 * 
 * Crontab (every 5 minutes):
 *   star/5 star star star star php /var/www/html/backend/cron/sync_pppoe_sessions.php >> /var/log/netfix_pppoe_sync.log 2>&1
 * 
 * Usage via CLI:
 *   php backend/cron/sync_pppoe_sessions.php [--tenant=ID] [--router=ID]
 */

declare(ticks = 1);
ini_set('memory_limit', '256M');
set_time_limit(180);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/MikrotikSyncService.php';

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

echo "[" . date('Y-m-d H:i:s') . "] Starting 5-Minute MikroTik PPPoE Session Ingestion...\n";

try {
    $result = MikrotikSyncService::pollAndRecordPppoeSessions($db, $tenantFilter, $routerFilter);

    $totalActive = $result['totalActive'] ?? 0;
    $onlineUp = $result['totalOnlineUpdated'] ?? 0;
    $offlineUp = $result['totalOfflineUpdated'] ?? 0;
    $connLogs = $result['connectedLogsRecorded'] ?? 0;
    $discLogs = $result['disconnectedLogsRecorded'] ?? 0;
    $errors = $result['errors'] ?? [];

    echo "[✓] PPPoE Sync Completed successfully:\n";
    echo "    - Total Online Active Sessions: {$totalActive}\n";
    echo "    - Online Accounts Refreshed: {$onlineUp}\n";
    echo "    - Offline Accounts Handled: {$offlineUp}\n";
    echo "    - New Connect Logs Recorded: {$connLogs}\n";
    echo "    - Disconnect Logs Recorded: {$discLogs}\n";

    if (!empty($errors)) {
        echo "[!] Warnings / Errors encountered (" . count($errors) . "):\n";
        foreach ($errors as $err) {
            echo "    - {$err}\n";
        }
    }

    exit(0);
} catch (\Throwable $e) {
    echo "[x] Critical error during PPPoE sync: " . $e->getMessage() . "\n";
    exit(1);
}
