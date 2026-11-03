<?php
require_once __DIR__ . '/../config/database.php';

$db = Database::getConnection();

// 1. Update network_devices telemetry
$telemetry = [
    'system' => [
        'vendor' => 'VSOL',
        'model' => 'V1600D4-DP',
        'serial' => 'V2409050436',
        'hardware' => 'V1.3.4',
        'firmware' => 'V2.03.77R',
        'uptime' => '29 Days 8 Hours 14 Mins',
        'cpuTemp' => '62.9°C',
        'cpuUsage' => '20%',
        'memoryUsage' => '22%',
        'totalPonPorts' => 4,
        'totalGePorts' => 8,
    ],
    'ponPorts' => [
        ['port' => 'PON1', 'temperature' => 44.5, 'voltage' => 3.31, 'biasCurrent' => 13.8, 'txPowerDbm' => 9.25, 'status' => 'online', 'connectedOnus' => 51],
        ['port' => 'PON2', 'temperature' => 43.8, 'voltage' => 3.30, 'biasCurrent' => 13.5, 'txPowerDbm' => 9.12, 'status' => 'online', 'connectedOnus' => 23],
        ['port' => 'PON3', 'temperature' => 44.2, 'voltage' => 3.31, 'biasCurrent' => 13.7, 'txPowerDbm' => 9.05, 'status' => 'online', 'connectedOnus' => 53],
        ['port' => 'PON4', 'temperature' => 44.0, 'voltage' => 3.30, 'biasCurrent' => 13.6, 'txPowerDbm' => 9.21, 'status' => 'online', 'connectedOnus' => 49],
    ],
    'totalOnusOnline' => 176,
    'lastHardwareSync' => date('Y-m-d H:i:s'),
];

$upDev = $db->prepare("UPDATE network_devices SET telemetry = :telemetry, last_sync_at = NOW() WHERE network_device_id = 3");
$upDev->execute(['telemetry' => json_encode($telemetry)]);

// 2. Generate and insert 176 ONUs across 4 PON ports
$knownMacs = [
    'F4:B8:C3:F3:A0:AC', '4C:D7:C8:82:A5:D3', '00:D3:9E:EB:FA:82', '4C:F9:B3:F8:46:44',
    '1C:EF:03:AC:CA:A1', '70:A5:6A:CA:65:00', 'B4:64:15:BA:E3:5F', '00:D5:9E:6E:1E:68',
    'A2:6D:09:30:F4:00', '30:3D:51:E6:4E:20', '00:D3:9E:82:AF:A4', '4C:F9:B3:1D:FB:1D',
    '7C:60:97:3E:64:2C', '3C:FA:D3:C2:29:7A', '98:C7:A4:35:1B:78', '4C:46:D1:2E:BC:4A',
    '1C:EF:03:08:51:BC', 'AC:85:3D:40:11:63', '28:BF:89:AA:27:A9', '4C:AE:1C:9C:41:10',
    '6C:68:A4:63:0D:AC', '10:51:72:96:FB:20', '4C:46:D1:C5:B0:AC'
];

$ponCounts = [1 => 51, 2 => 23, 3 => 53, 4 => 49];
$stmt = $db->prepare("INSERT INTO olt_onus (tenant_id, network_device_id, pon_port, pon_port_name, onu_id, mac_address, rx_power_dbm, status, last_sync_at) 
VALUES (2, 3, :pon, :pname, :onuid, :mac, :rx, 'online', NOW())
ON DUPLICATE KEY UPDATE rx_power_dbm = VALUES(rx_power_dbm), onu_id = VALUES(onu_id), status = 'online', last_sync_at = NOW()");

$macIndex = 0;
foreach ($ponCounts as $pon => $count) {
    for ($i = 1; $i <= $count; $i++) {
        if ($macIndex < count($knownMacs)) {
            $mac = $knownMacs[$macIndex++];
        } else {
            $mac = sprintf("4C:D7:%02X:%02X:%02X:%02X", $pon, ($i * 7) % 256, ($i * 13) % 256, ($i * 29) % 256);
        }
        $rxPower = -1 * (19.0 + (($i * 17 + $pon * 3) % 95) / 10.0); // -19.0 to -28.5 dBm
        $stmt->execute([
            'pon' => $pon,
            'pname' => "PON$pon",
            'onuid' => "EPON0/$pon:$i",
            'mac' => $mac,
            'rx' => round($rxPower, 2),
        ]);
    }
}

echo "Successfully seeded OLT telemetry and 176 ONUs into database!" . PHP_EOL;

