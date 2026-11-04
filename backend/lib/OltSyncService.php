<?php
/**
 * NetFix ISP SaaS - OLT Background & Scheduled Sync Service
 * Manages periodic (1-3 hours) OLT telemetry syncing and fast local DB storage
 */

require_once __DIR__ . '/VsolOltClient.php';

class OltSyncService {
    public const DEFAULT_SYNC_INTERVAL_SECONDS = 7200; // 2 Hours

    /**
     * Synchronize a specific OLT device with local database storage.
     * Only connects to hardware if interval has elapsed or if $force is true.
     */
    public static function sync(PDO $db, array $oltDev, bool $force = false, int $intervalSeconds = self::DEFAULT_SYNC_INTERVAL_SECONDS): array {
        $deviceId = (int)$oltDev['network_device_id'];
        $tenantId = (int)$oltDev['tenant_id'];

        $lastSyncTime = !empty($oltDev['last_sync_at']) ? strtotime($oltDev['last_sync_at']) : 0;
        $now = time();
        $ageSeconds = $now - $lastSyncTime;

        // If not forced and synced recently (within interval), return stored data instantly
        if (!$force && $lastSyncTime > 0 && $ageSeconds < $intervalSeconds) {
            return self::getLocalData($db, $tenantId, $deviceId, $oltDev);
        }

        // Live hardware sync from OLT
        $ip = $oltDev['management_ip'] ?? '';
        if (empty($ip)) {
            return self::getLocalData($db, $tenantId, $deviceId, $oltDev);
        }

        $port = (int)($oltDev['web_port'] ?: 1010);
        $user = $oltDev['api_username'] ?: 'star';
        $pass = $oltDev['api_password'] ?: 'star321';
        $proto = ($port == 80) ? 'http' : 'https';

        $client = new VsolOltClient($ip, $port, $user, $pass, $proto, 8);
        $sysInfo = $client->getSystemInfo();
        $ponPorts = $client->getPonPorts();
        $onus = $client->getOnus(null, true);

        if (!$sysInfo && empty($onus)) {
            // If connection failed, return honest error so user knows hardware was unreachable
            $local = self::getLocalData($db, $tenantId, $deviceId, $oltDev);
            $local['syncError'] = "Could not connect to OLT hardware at {$ip}:{$port}. Please verify the IP address, API/Web port, and credentials.";
            $local['isOnline'] = false;
            return $local;
        }

        // Update network_devices table with telemetry JSON & last_sync_at
        $telemetry = [
            'system' => $sysInfo,
            'model' => $sysInfo['model'] ?? 'V1601E04-DP',
            'firmware' => $sysInfo['firmware'] ?? '',
            'hardware' => $sysInfo['hardware'] ?? '',
            'serial' => $sysInfo['serial'] ?? '',
            'mac' => $sysInfo['mac'] ?? '',
            'uptime' => $sysInfo['uptime'] ?? '',
            'cpuUsagePercent' => $sysInfo['cpuUsagePercent'] ?? 0,
            'memoryUsagePercent' => $sysInfo['memoryUsagePercent'] ?? 0,
            'temperatureC' => !empty($sysInfo['cpuTemp']) ? (float)str_replace('°C', '', $sysInfo['cpuTemp']) : null,
            'ponPorts' => $ponPorts,
            'totalOnusOnline' => count($onus),
            'lastHardwareSync' => date('Y-m-d H:i:s'),
        ];

        $upStmt = $db->prepare("UPDATE network_devices SET telemetry = :telemetry, last_sync_at = NOW() WHERE network_device_id = :did");
        $upStmt->execute([
            'telemetry' => json_encode($telemetry),
            'did' => $deviceId,
        ]);

        // Upsert ONUs into olt_onus table
        if (!empty($onus)) {
            $sql = "INSERT INTO olt_onus (tenant_id, network_device_id, pon_port, pon_port_name, onu_id, mac_address, rx_power_dbm, status, last_sync_at) 
                    VALUES (:tid, :did, :pon, :pname, :onuid, :mac, :rx, 'online', NOW())
                    ON DUPLICATE KEY UPDATE 
                        pon_port = VALUES(pon_port),
                        pon_port_name = VALUES(pon_port_name),
                        onu_id = VALUES(onu_id),
                        rx_power_dbm = VALUES(rx_power_dbm),
                        status = 'online',
                        last_sync_at = NOW()";
            $insStmt = $db->prepare($sql);

            $db->beginTransaction();
            try {
                foreach ($onus as $onu) {
                    $insStmt->execute([
                        'tid' => $tenantId,
                        'did' => $deviceId,
                        'pon' => $onu['ponPort'],
                        'pname' => $onu['ponPortName'],
                        'onuid' => $onu['onuId'],
                        'mac' => $onu['macAddress'],
                        'rx' => $onu['rxPowerDbm'],
                    ]);
                }
                $db->commit();
            } catch (\Throwable $e) {
                if ($db->inTransaction()) $db->rollBack();
            }
        }

        // Refresh device row and return local data
        $refStmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :did");
        $refStmt->execute(['did' => $deviceId]);
        $freshDev = $refStmt->fetch() ?: $oltDev;

        return self::getLocalData($db, $tenantId, $deviceId, $freshDev);
    }

    /**
     * Retrieve local OLT data from database in < 5ms without contacting hardware.
     */
    public static function getLocalData(PDO $db, int $tenantId, int $deviceId, array $oltDev): array {
        $telemetry = json_decode($oltDev['telemetry'] ?? '{}', true) ?: [];
        $lastSync = $oltDev['last_sync_at'] ?? null;
        $syncAgeMinutes = $lastSync ? round((time() - strtotime($lastSync)) / 60) : null;

        // Fetch stored ONUs count by PON port
        $stmtCounts = $db->prepare("SELECT pon_port, COUNT(*) as count FROM olt_onus WHERE tenant_id = :tid AND network_device_id = :did GROUP BY pon_port");
        $stmtCounts->execute(['tid' => $tenantId, 'did' => $deviceId]);
        $countsByPon = [];
        $totalStored = 0;
        foreach ($stmtCounts->fetchAll() as $row) {
            $countsByPon[(int)$row['pon_port']] = (int)$row['count'];
            $totalStored += (int)$row['count'];
        }

        $ponPorts = $telemetry['ponPorts'] ?? [];
        foreach ($ponPorts as &$pp) {
            $pNum = (int)str_replace('PON', '', $pp['port']);
            $pp['connectedOnus'] = $countsByPon[$pNum] ?? 0;
        }
        unset($pp);

        $isSynced = !empty($telemetry['system']) || !empty($lastSync);
        $system = $telemetry['system'] ?? [
            'vendor' => strtoupper($oltDev['vendor'] ?: 'VSOL'),
            'model' => 'EPON/GPON OLT',
            'serial' => $oltDev['device_code'] ?? '',
            'hardware' => null,
            'firmware' => null,
            'uptime' => null,
            'cpuTemp' => null,
            'cpuUsage' => null,
            'memoryUsage' => null,
            'totalPonPorts' => 4,
            'totalGePorts' => 8,
        ];

        return [
            'isStored' => true,
            'isSynced' => $isSynced,
            'isOnline' => $isSynced,
            'lastSyncAt' => $lastSync,
            'syncAgeMinutes' => $syncAgeMinutes,
            'nextScheduledSyncMinutes' => max(0, 120 - ($syncAgeMinutes ?? 0)),
            'system' => $system,
            'model' => $telemetry['model'] ?? $system['model'] ?? null,
            'firmware' => $telemetry['firmware'] ?? $system['firmware'] ?? null,
            'uptime' => $telemetry['uptime'] ?? $system['uptime'] ?? null,
            'cpuUsagePercent' => $telemetry['cpuUsagePercent'] ?? ($system['cpuUsagePercent'] ?? null),
            'memoryUsagePercent' => $telemetry['memoryUsagePercent'] ?? ($system['memoryUsagePercent'] ?? null),
            'temperatureC' => $telemetry['temperatureC'] ?? null,
            'ponPorts' => $ponPorts,
            'totalOnus' => $totalStored,
        ];
    }
}

