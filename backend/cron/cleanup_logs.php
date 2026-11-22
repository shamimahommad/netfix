<?php
/**
 * NetFix ISP SaaS - High-Throughput Per-ISP Log Retention Housekeeping Script
 * Purges old PPPoE connection and auth logs based on each ISP tenant's configured
 * `log_retention_days` (configured by SaaS Admin in Tenant Management).
 *
 * Uses non-blocking, chunked DELETE operations (default 5,000 rows per loop)
 * with a brief sleep interval to avoid table locks or row lock escalation
 * on the primary billing database.
 *
 * Usage:
 *   php backend/cron/cleanup_logs.php [--days=90] [--chunk=5000] [--tenant=ID] [--dry-run]
 *
 * Crontab suggestion:
 *   0 3 * * * php /var/www/html/backend/cron/cleanup_logs.php >> /var/log/netfix_cleanup.log 2>&1
 */

declare(ticks = 1);
ini_set('memory_limit', '256M');
set_time_limit(600); // 10 minutes max

require_once __DIR__ . '/../config/database.php';

$explicitDays = null;
if (getenv('LOG_RETENTION_DAYS')) {
    $explicitDays = max(1, (int)getenv('LOG_RETENTION_DAYS'));
}
$chunkSize = 5000;
$tenantFilter = null;
$dryRun = false;

// Parse CLI flags
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--days=')) {
        $explicitDays = max(1, (int)substr($arg, 7));
    } elseif (str_starts_with($arg, '--chunk=')) {
        $chunkSize = max(500, min(20000, (int)substr($arg, 8)));
    } elseif (str_starts_with($arg, '--tenant=')) {
        $tenantFilter = (int)substr($arg, 9);
    } elseif ($arg === '--dry-run') {
        $dryRun = true;
    }
}

echo "====================================================================\n";
echo "  NetFix ISP SaaS - Multi-Tenant PPPoE Log Retention Worker\n";
echo "====================================================================\n";
echo "  [*] Mode:            " . ($explicitDays ? "Global Override ({$explicitDays} days)" : "Per-Tenant SaaS Admin Retention Policy") . "\n";
echo "  [*] Chunk Size:      {$chunkSize} rows per transaction\n";
echo "  [*] Tenant Filter:   " . ($tenantFilter ? "Tenant #{$tenantFilter}" : "All Active Tenants") . "\n";
echo "  [*] Dry Run Mode:    " . ($dryRun ? "ENABLED (No rows will be deleted)" : "DISABLED") . "\n";
echo "====================================================================\n\n";

try {
    $db = Database::getConnection();

    // 1. Fetch tenants to process
    $tenantQuery = "SELECT tenant_id, tenant_code, tenant_name, COALESCE(log_retention_days, 90) as retention_days 
                    FROM tenants 
                    WHERE status = 'active'";
    $tenantParams = [];

    if ($tenantFilter) {
        $tenantQuery .= " AND tenant_id = :tid";
        $tenantParams['tid'] = $tenantFilter;
    }
    $tenantQuery .= " ORDER BY tenant_id ASC";

    $tStmt = $db->prepare($tenantQuery);
    $tStmt->execute($tenantParams);
    $tenants = $tStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($tenants)) {
        echo "[INFO] No active tenants found to process.\n";
        exit(0);
    }

    $grandTotalPurged = 0;
    $grandStartTime = microtime(true);

    foreach ($tenants as $t) {
        $tid = (int)$t['tenant_id'];
        $tName = $t['tenant_name'] ?: ("ISP #" . $t['tenant_code']);
        $retentionDays = $explicitDays !== null ? $explicitDays : (int)$t['retention_days'];
        $cutoffDate = date('Y-m-d H:i:s', strtotime("-{$retentionDays} days"));

        echo "--------------------------------------------------------------------\n";
        echo "[TENANT #{$tid} - {$tName}]\n";
        echo "  Retention Policy: {$retentionDays} days (Purging before {$cutoffDate})\n";

        // Count candidates for this tenant
        $cStmt = $db->prepare("SELECT COUNT(*) FROM pppoe_connection_logs WHERE tenant_id = :tid AND logged_at < :cutoff");
        $cStmt->execute(['tid' => $tid, 'cutoff' => $cutoffDate]);
        $tenantCandidates = (int)$cStmt->fetchColumn();

        echo "  Expired records: {$tenantCandidates}\n";

        if ($tenantCandidates === 0) {
            echo "  [OK] No expired logs for this ISP.\n";
            continue;
        }

        if ($dryRun) {
            echo "  [DRY RUN] Would delete {$tenantCandidates} records for Tenant #{$tid}.\n";
            continue;
        }

        $tenantPurged = 0;
        $batchNum = 1;
        $delStmt = $db->prepare("DELETE FROM pppoe_connection_logs WHERE tenant_id = :tid AND logged_at < :cutoff LIMIT {$chunkSize}");

        while (true) {
            $delStmt->execute(['tid' => $tid, 'cutoff' => $cutoffDate]);
            $deleted = $delStmt->rowCount();
            $tenantPurged += $deleted;

            echo sprintf("  [%s] Batch #%d: Purged %d row(s) (Progress: %d / %d)\n",
                date('H:i:s'), $batchNum, $deleted, $tenantPurged, $tenantCandidates);

            if ($deleted < $chunkSize) {
                break;
            }

            $batchNum++;
            usleep(50000); // 50ms pause to release InnoDB row locks
        }

        $grandTotalPurged += $tenantPurged;
        echo "  [DONE] Tenant #{$tid}: Successfully purged {$tenantPurged} log(s).\n";
    }

    $elapsed = round(microtime(true) - $grandStartTime, 2);
    echo "\n====================================================================\n";
    echo "[SUCCESS] Finished log retention worker. Purged {$grandTotalPurged} expired PPPoE log(s) across " . count($tenants) . " tenant(s) in {$elapsed} seconds.\n";
    echo "====================================================================\n";

} catch (\Throwable $e) {
    echo "[ERROR] Log cleanup failed: " . $e->getMessage() . "\n";
    exit(1);
}
