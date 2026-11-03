<?php
/**
 * NetFix ISP SaaS - OLT Periodic Cron Sync Job
 * Runs every 1-2 hours to fetch OLT ONUs and telemetry, and stores them in MySQL.
 * 
 * Usage:
 *   php backend/cron/sync_olt.php
 *   php backend/cron/sync_olt.php --force
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/OltSyncService.php';

$force = in_array('--force', $argv ?? []);
$db = Database::getConnection();

echo "[" . date('Y-m-d H:i:s') . "] Starting OLT Periodic Sync Job (Force: " . ($force ? 'YES' : 'NO') . ")..." . PHP_EOL;

$stmt = $db->query("SELECT * FROM network_devices WHERE device_type = 'olt' AND status = 'active'");
$olts = $stmt->fetchAll();

if (empty($olts)) {
    echo "No active OLT devices found in database." . PHP_EOL;
    exit(0);
}

foreach ($olts as $olt) {
    echo "Syncing OLT ID: {$olt['network_device_id']} ({$olt['device_name']} @ {$olt['management_ip']})..." . PHP_EOL;
    $res = OltSyncService::sync($db, $olt, $force);
    echo "Sync complete for {$olt['device_name']}. Total ONUs in DB: {$res['totalOnus']}. Last Sync: {$res['lastSyncAt']}" . PHP_EOL;
}

echo "[" . date('Y-m-d H:i:s') . "] OLT Sync Job finished successfully." . PHP_EOL;

