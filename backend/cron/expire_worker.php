<?php
/**
 * NetFix ISP SaaS - Expiration & Auto-Cutoff Worker (CLI Cron)
 * 
 * Scheduled to run every 10 minutes via Crontab or Supervisor:
 * Crontab: star/10 star star star star php /var/www/html/backend/cron/expire_worker.php
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/BillingCronService.php';

echo "[" . date('Y-m-d H:i:s') . "] Starting NetFix Auto-Cutoff Worker Engine...\n";

try {
    $result = BillingCronService::runAutoCutoff(null, 'scheduled');
    $processed = $result['expiredProcessed'] ?? 0;
    $disabled = $result['mikrotikDisabled'] ?? 0;
    $duration = $result['durationMs'] ?? 0;
    echo "[" . date('Y-m-d H:i:s') . "] Finished. Processed: {$processed}, MikroTik Cutoffs: {$disabled}, Duration: {$duration}ms\n";
    exit(0);
} catch (\Throwable $e) {
    echo "[" . date('Y-m-d H:i:s') . "] CRITICAL ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
