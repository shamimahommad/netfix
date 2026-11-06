<?php
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/lib/OltSyncService.php';

$db = Database::getConnection();

// 1. Check if device already exists
$stmt = $db->prepare("SELECT * FROM network_devices WHERE management_ip = :ip AND web_port = :port");
$stmt->execute(['ip' => '122.50.10.88', 'port' => 16148]);
$existing = $stmt->fetch(PDO::FETCH_ASSOC);

if ($existing) {
    $deviceId = (int)$existing['network_device_id'];
    echo "Updating existing device ID {$deviceId}...\n";
    $up = $db->prepare("UPDATE network_devices SET 
        device_code = COALESCE(NULLIF(device_code, ''), '300008'),
        device_name = :name,
        device_type = 'olt',
        vendor = 'btpon',
        pon_type = 'epon',
        total_pon_ports = 8,
        api_username = 'admin',
        api_password = :pass,
        status = 'active',
        management_port = 23
        WHERE network_device_id = :did");
    $up->execute([
        'name' => 'BTPON EPON OLT (PTF-EP8X4G8)',
        'pass' => 'admin',
        'did' => $deviceId
    ]);
} else {
    echo "Inserting new BTPON OLT into network_devices...\n";
    $ins = $db->prepare("INSERT INTO network_devices (
        tenant_id, device_name, device_type, vendor, management_ip, 
        web_port, management_port, api_username, api_password, pon_type, 
        total_pon_ports, status, created_at, updated_at
    ) VALUES (
        2, :name, 'olt', 'btpon', '122.50.10.88',
        16148, 23, 'admin', 'admin', 'epon',
        8, 'active', NOW(), NOW()
    )");
    $ins->execute([
        'name' => 'BTPON EPON OLT (PTF-EP8X4G8)'
    ]);
    $deviceId = (int)$db->lastInsertId();
    echo "Inserted new device ID: {$deviceId}\n";
}

// 2. Fetch fresh device row
$stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :did");
$stmt->execute(['did' => $deviceId]);
$oltDev = $stmt->fetch(PDO::FETCH_ASSOC);

echo "Starting Live Hardware Synchronization for OLT Device #{$deviceId}...\n";
$start = microtime(true);
$result = OltSyncService::sync($db, $oltDev, true);
$duration = round(microtime(true) - $start, 2);

echo "Synchronization finished in {$duration}s!\n\n";

echo "=== SYNC RESULT SUMMARY ===\n";
echo "Device ID: " . $deviceId . "\n";
echo "Vendor: " . ($result['system']['vendor'] ?? 'N/A') . "\n";
echo "Model: " . ($result['system']['model'] ?? 'N/A') . "\n";
echo "Firmware: " . ($result['system']['firmware'] ?? 'N/A') . "\n";
echo "Hardware: " . ($result['system']['hardware'] ?? 'N/A') . "\n";
echo "MAC: " . ($result['system']['mac'] ?? 'N/A') . "\n";
echo "Uptime: " . ($result['system']['uptime'] ?? 'N/A') . "\n";
echo "CPU Usage: " . ($result['system']['cpuUsage'] ?? 'N/A') . "\n";
echo "Memory Usage: " . ($result['system']['memoryUsage'] ?? 'N/A') . "\n";
echo "Total PON Ports: " . count($result['ponPorts'] ?? []) . "\n";
echo "Total ONUs Synced: " . count($result['onus'] ?? []) . "\n";

// Count database verification
$cStmt = $db->prepare("SELECT 
    COUNT(*) as total_onus,
    SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_onus,
    SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_onus,
    SUM(CASE WHEN router_mac IS NOT NULL AND router_mac != '' THEN 1 ELSE 0 END) as with_router_mac,
    SUM(CASE WHEN rx_power_dbm IS NOT NULL THEN 1 ELSE 0 END) as with_optical_power
FROM olt_onus WHERE network_device_id = :did");
$cStmt->execute(['did' => $deviceId]);
$stats = $cStmt->fetch(PDO::FETCH_ASSOC);

echo "\n=== DATABASE VERIFICATION (olt_onus) ===\n";
echo "Total ONUs in DB: " . $stats['total_onus'] . "\n";
echo "Online ONUs: " . $stats['online_onus'] . "\n";
echo "Offline ONUs: " . $stats['offline_onus'] . "\n";
echo "ONUs with Customer Router MAC: " . $stats['with_router_mac'] . "\n";
echo "ONUs with Optical Power (RX dBm): " . $stats['with_optical_power'] . "\n";

echo "\n=== FIRST 5 ONUs IN DB ===\n";
$sampleStmt = $db->prepare("SELECT onu_id, pon_port_name, mac_address, router_mac, vlan_id, rx_power_dbm, status FROM olt_onus WHERE network_device_id = :did LIMIT 5");
$sampleStmt->execute(['did' => $deviceId]);
print_r($sampleStmt->fetchAll(PDO::FETCH_ASSOC));
