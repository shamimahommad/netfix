<?php
/**
 * NetFix ISP SaaS - High-Throughput Log Retention Housekeeping Script
 * Purges old PPPoE connection and auth logs older than retention limit (default 90 days).
 *
 * Uses non-blocking, chunked DELETE operations (default 5,000 rows per loop)
 * with a brief sleep interval to avoid table locks or row lock escalation
 * on the primary billing database.
 *
 * Usage:
 *   php backend/cron/cleanup_logs.php [--days=90] [--chunk=5000] [--tenant=ID] [--dry-run]
 *
 * Crontab suggestion:
 *   0 3 * * * php /var/www/html/backend/cron/cleanup_logs.php --days=90 >> /var/log/netfix_cleanup.log 2>&1
 */

declare(ticks = 1);
ini_set('memory_limit', '256M');
set_time_limit(600); // 10 minutes max

require_once __DIR__ . '/../config/database.php';

$days = 90;
if (getenv('LOG_RETENTION_DAYS')) {
    $days = max(7, (int)getenv('LOG_RETENTION_DAYS'));
}
$chunkSize = 5000;
$tenantFilter = null;
$dryRun = false;

// Parse CLI flags
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--days=')) {
        $days = max(1, (int)substr($arg, 7));
    } elseif (str_starts_with($arg, '--chunk=')) {
        $chunkSize = max(500, min(20000, (int)substr($arg, 8)));
    } elseif (str_starts_with($arg, '--tenant=')) {
        $tenantFilter = (int)substr($arg, 9);
    } elseif ($arg === '--dry-run') {
        $dryRun = true;
    }
}

$cutoffDate = date('Y-m-d H:i:s', strtotime("-{$days} days"));

echo "====================================================================\n";
echo "  NetFix ISP SaaS - PPPoE Log Retention Cleanup Worker\n";
echo "====================================================================\n";
echo "  [*] Retention Policy: Purging logs older than {$days} days\n";
echo "  [*] Cutoff Timestamp: {$cutoffDate}\n";
echo "  [*] Chunk Size:       {$chunkSize} rows per transaction\n";
echo "  [*] Tenant Filter:    " . ($tenantFilter ? "Tenant #{$tenantFilter}" : "All Tenants") . "\n";
echo "  [*] Dry Run Mode:     " . ($dryRun ? "ENABLED (No rows will be deleted)" : "DISABLED") . "\n";
echo "====================================================================\n\n";

try {
    $db = Database::getConnection();

    // Check total candidates for cleanup
    $countSql = "SELECT COUNT(*) FROM pppoe_connection_logs WHERE logged_at < :cutoff";
    $countParams = ['cutoff' => $cutoffDate];
    if ($tenantFilter) {
        $countSql .= " AND tenant_id = :tid";
        $countParams['tid'] = $tenantFilter;
    }

    $cStmt = $db->prepare($countSql);
    $cStmt->execute($countParams);
    $totalCandidates = (int)$cStmt->fetchColumn();

    echo "[INFO] Found {$totalCandidates} log record(s) older than {$cutoffDate}.\n";

    if ($totalCandidates === 0) {
        echo "[OK] No expired logs to purge. Database is clean.\n";
        exit(0);
    }

    if ($dryRun) {
        echo "[DRY RUN] Would delete {$totalCandidates} records in approximately " . ceil($totalCandidates / $chunkSize) . " batches.\n";
        exit(0);
    }

    // Execute chunked deletion loop
    $startTime = microtime(true);
    $totalPurged = 0;
    $batchNum = 1;

    $delSql = "DELETE FROM pppoe_connection_logs WHERE logged_at < :cutoff";
    if ($tenantFilter) {
        $delSql .= " AND tenant_id = :tid";
    }
    $delSql .= " LIMIT {$chunkSize}";

    $delStmt = $db->prepare($delSql);

    while (true) {
        $delParams = ['cutoff' => $cutoffDate];
        if ($tenantFilter) {
            $delParams['tid'] = $tenantFilter;
        }

        $delStmt->execute($delParams);
        $deleted = $delStmt->rowCount();
        $totalPurged += $deleted;

        echo sprintf("[%s] Batch #%d: Purged %d row(s) (Total purged so far: %d / %d)\n",
            date('H:i:s'), $batchNum, $deleted, $totalPurged, $totalCandidates);

        if ($deleted < $chunkSize) {
            // Reached end of matching records
            break;
        }

        $batchNum++;
        // Brief 50ms pause to release InnoDB row locks and allow concurrent billing transactions
        usleep(50000);
    }

    $elapsed = round(microtime(true) - $startTime, 2);
    echo "\n====================================================================\n";
    echo "[SUCCESS] Purged {$totalPurged} expired PPPoE log(s) in {$elapsed} seconds.\n";
    echo "====================================================================\n";

} catch (\Throwable $e) {
    echo "[ERROR] Log cleanup failed: " . $e->getMessage() . "\n";
    exit(1);
}
