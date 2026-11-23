<?php
/**
 * NetFix ISP SaaS - Non-blocking Background OLT Device Sync Worker
 * Executed as an isolated background CLI process so the main HTTP web server
 * is NEVER blocked while communicating with remote hardware.
 * 
 * Usage:
 *   php sync_single_device.php {deviceId}
 */

declare(ticks = 1);
ini_set('memory_limit', '512M');
set_time_limit(300);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/OltSyncService.php';

$deviceId = null;
foreach ($argv ?? [] as $arg) {
    if (is_numeric($arg) && (int)$arg > 0) {
        $deviceId = (int)$arg;
    } elseif (str_starts_with($arg, '--device=')) {
        $deviceId = (int)substr($arg, 9);
    }
}

if (!$deviceId) {
    error_log("[OLT BG WORKER] Error: No deviceId provided");
    exit(1);
}

$cacheDir = __DIR__ . '/../cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0777, true);
}
$statusFile = $cacheDir . '/olt_sync_status_' . $deviceId . '.json';

$startTime = microtime(true);

// Helper to update live progress status
$updateStatus = function(string $status, string $step, array $extra = []) use ($statusFile, $deviceId, $startTime) {
    $data = array_merge([
        'deviceId' => $deviceId,
        'status' => $status, // 'running', 'completed', 'failed'
        'step' => $step,
        'startedAt' => round($startTime),
        'updatedAt' => time(),
        'durationSeconds' => round(microtime(true) - $startTime, 1),
    ], $extra);
    @file_put_contents($statusFile, json_encode($data, JSON_PRETTY_PRINT));
};

try {
    $db = Database::getConnection();

    $stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id OR device_code = :code LIMIT 1");
    $stmt->execute(['id' => $deviceId, 'code' => $deviceId]);
    $device = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$device) {
        $updateStatus('failed', 'Device not found', ['error' => "Network device #{$deviceId} not found"]);
        exit(1);
    }

    $updateStatus('running', 'Connecting to OLT hardware & authenticating session...', [
        'deviceName' => $device['device_name'],
        'vendor' => $device['vendor'],
        'ip' => $device['management_ip'],
    ]);

    // Execute live hardware sync
    $result = OltSyncService::sync($db, $device, true);

    if (!empty($result['syncError'])) {
        $updateStatus('failed', 'Hardware connection failed', [
            'error' => $result['syncError'],
            'finishedAt' => time(),
        ]);
        exit(1);
    }

    $totalDuration = round(microtime(true) - $startTime, 2);
    $totalOnus = $result['totalOnus'] ?? 0;
    $onlineOnus = $result['totalOnusOnline'] ?? 0;
    $pruned = $result['prunedOnus'] ?? 0;

    $updateStatus('completed', 'Sync completed successfully', [
        'finishedAt' => time(),
        'durationSeconds' => $totalDuration,
        'totalOnus' => $totalOnus,
        'onlineOnus' => $onlineOnus,
        'prunedOnus' => $pruned,
        'success' => true,
    ]);

    error_log("[OLT BG WORKER] Device #{$deviceId} finished sync in {$totalDuration}s. ONUs: {$totalOnus}, Pruned: {$pruned}");
    exit(0);

} catch (\Throwable $e) {
    $errMsg = $e->getMessage();
    error_log("[OLT BG WORKER] Exception for device #{$deviceId}: " . $errMsg);
    $updateStatus('failed', 'Error occurred during sync', [
        'error' => $errMsg,
        'finishedAt' => time(),
        'success' => false,
    ]);
    exit(1);
}
