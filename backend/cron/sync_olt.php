<?php
/**
 * NetFix ISP SaaS - OLT Periodic Cron Sync Engine
 * Scheduled to run every 15-30 minutes via Crontab or Windows Task Scheduler.
 * 
 * Logic:
 *   - Only syncs OLTs whose last sync age >= configured interval (set by SaaS Admin).
 *   - Honors SaaS Admin global sync settings (enabled/disabled, interval in minutes).
 *   - Logs run telemetry to `olt_cron_runs` table for audit, metrics, and health inspection.
 * 
 * CLI Usage:
 *   php backend/cron/sync_olt.php                  (Standard automated cron check)
 *   php backend/cron/sync_olt.php --force          (Forces immediate sync for all active OLTs)
 *   php backend/cron/sync_olt.php --tenant=2       (Syncs OLTs belonging to tenant #2)
 *   php backend/cron/sync_olt.php --interval=60    (Overrides sync interval to 60 mins)
 */

declare(ticks = 1);
ini_set('memory_limit', '512M');
set_time_limit(600); // 10 minutes max execution time

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/OltSyncService.php';

$args = $argv ?? [];
$force = in_array('--force', $args);
$tenantId = null;
$overrideInterval = null;

foreach ($args as $arg) {
    if (str_starts_with($arg, '--tenant=')) {
        $tenantId = (int)substr($arg, 9);
    } elseif (str_starts_with($arg, '--interval=')) {
        $overrideInterval = (int)substr($arg, 11);
    }
}

echo "====================================================================\n";
echo "  NetFix ISP SaaS - OLT Hardware Automated Cron Sync Engine\n";
echo "====================================================================\n";
echo "  [*] Time:     " . date('Y-m-d H:i:s') . "\n";
echo "  [*] Force:    " . ($force ? 'YES (All active OLTs)' : 'NO (Due OLTs only)') . "\n";
echo "  [*] Tenant:   " . ($tenantId ? "Tenant #{$tenantId}" : 'Global (All Active Tenants)') . "\n";

$settings = OltSyncService::getSettings($tenantId);
$intervalMins = $overrideInterval ?: $settings['syncIntervalMinutes'];
echo "  [*] Config:   Auto-Sync is " . ($settings['autoSyncEnabled'] ? 'ENABLED' : 'DISABLED') . " | Interval: {$intervalMins} mins\n";
echo "--------------------------------------------------------------------\n";

if (!$settings['autoSyncEnabled'] && !$force) {
    echo "  [!] OLT Auto-Sync Cron is currently disabled in SaaS Admin settings.\n";
    echo "      Pass --force to run anyway, or enable it in SaaS Settings.\n";
    echo "====================================================================\n";
    exit(0);
}

try {
    $result = OltSyncService::runScheduledSync($tenantId, 'scheduled', $force);

    echo "  [+] Total OLT Devices Found: {$result['totalOlts']}\n";
    echo "  [+] Synced Successfully:    {$result['syncedOlts']}\n";
    echo "  [+] Skipped (Not yet due):  {$result['skippedOlts']}\n";
    echo "  [-] Failed / Unreachable:   {$result['failedOlts']}\n";
    echo "  [*] Total ONUs Tracked:     {$result['totalOnus']} ({$result['onlineOnus']} Online, {$result['offlineOnus']} Offline)\n";
    echo "  [*] Duration:               " . round($result['durationMs'] / 1000, 2) . "s\n";

    if (!empty($result['errors'])) {
        echo "\n  [!] Errors Encountered:\n";
        foreach ($result['errors'] as $err) {
            echo "      - {$err}\n";
        }
    }

    echo "====================================================================\n";
    echo "  NetFix OLT Sync Run #{$result['runId']} completed with status: " . strtoupper($result['status']) . "\n";
    echo "====================================================================\n";
    exit($result['failedOlts'] > 0 && $result['syncedOlts'] === 0 ? 1 : 0);

} catch (\Throwable $e) {
    echo "\n  [CRITICAL ERROR] " . $e->getMessage() . "\n";
    echo "====================================================================\n";
    exit(1);
}
