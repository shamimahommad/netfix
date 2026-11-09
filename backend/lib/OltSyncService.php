<?php
/**
 * NetFix ISP SaaS - OLT Background & Scheduled Sync Service
 * Manages periodic (1-3 hours) OLT telemetry syncing and fast local DB storage
 */

require_once __DIR__ . '/VsolOltClient.php';
require_once __DIR__ . '/FocuscomOltClient.php';
require_once __DIR__ . '/BtponOltClient.php';
require_once __DIR__ . '/BdcomOltClient.php';
require_once __DIR__ . '/BdcomWebOltClient.php';
require_once __DIR__ . '/AtopOltClient.php';

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

        // If not explicitly forced, always return local stored DB data instantly in < 5ms
        if (!$force) {
            return self::getLocalData($db, $tenantId, $deviceId, $oltDev);
        }

        // Live hardware sync from OLT
        $ip = $oltDev['management_ip'] ?? '';
        if (empty($ip)) {
            return self::getLocalData($db, $tenantId, $deviceId, $oltDev);
        }

        $vendor = strtolower(trim($oltDev['vendor'] ?? 'vsol'));
        $isBdcom = ($vendor === 'bdcom');
        $isBtpon = in_array($vendor, ['btpon', 'tbs', 'ip-com', 'ipcom']);
        $isFocuscom = ($vendor === 'focuscom');
        $isAtop = ($vendor === 'atop');

        if ($isBdcom) {
            // BDCOM supports GoAhead Web Engine (port 2321 / 80) and Telnet CLI (port 23 / 1081)
            $webP = (int)($oltDev['web_port'] ?? 0);
            $mgmtP = (int)($oltDev['management_port'] ?? 0);

            if ($webP > 0 || $mgmtP === 2321 || $mgmtP === 80 || $mgmtP === 8080) {
                $port = $webP ?: ($mgmtP ?: 2321);
                $proto = ($port == 443) ? 'https' : 'http';
            } else {
                $port = $mgmtP ?: 23;
                $proto = 'telnet';
            }
        } else {
            $defaultPort = $isBtpon ? 16148 : ($isFocuscom ? 2322 : ($isAtop ? 2000 : 1010));
            $port = (int)($oltDev['web_port'] ?: ($oltDev['management_port'] ?: $defaultPort));
            $proto = ($port == 443) ? 'https' : 'http';
            if ($vendor === 'vsol' && $port != 80) {
                $proto = 'https';
            }
        }
        $user = $oltDev['api_username'] ?: ($isAtop ? 'root' : (($isBdcom || $isFocuscom || $isBtpon) ? 'admin' : 'star'));
        $pass = $oltDev['api_password'] ?: (($isBdcom || $isFocuscom || $isBtpon || $isAtop) ? 'admin' : 'star321');

        $totalPonPorts = (int)($oltDev['total_pon_ports'] ?? (($isFocuscom || $isBdcom) ? 4 : 8));
        if ($totalPonPorts <= 0) $totalPonPorts = (($isFocuscom || $isBdcom) ? 4 : 8);
        $ponType = strtolower($oltDev['pon_type'] ?? 'epon');

        // Dynamic timeout: 45s for 8+ port OLTs with hundreds of ONUs, 25s for 4-port
        $timeout = ($totalPonPorts > 4) ? 45 : 25;

        if ($isBdcom) {
            if ($proto === 'http' || $proto === 'https' || $port === 2321 || $port === 80 || $port === 8080) {
                $client = new BdcomWebOltClient($ip, $port, $user, $pass, $proto, $timeout);
            } else {
                $client = new BdcomOltClient($ip, $port, $user, $pass, $proto, $timeout);
            }
        } elseif ($isBtpon) {
            $client = new BtponOltClient($ip, $port, $user, $pass, $proto, $timeout);
        } elseif ($isFocuscom) {
            $client = new FocuscomOltClient($ip, $port, $user, $pass, $proto, $timeout);
        } elseif ($isAtop) {
            $client = new AtopOltClient($ip, $port, $user, $pass, $proto, $timeout);
        } else {
            $client = new VsolOltClient($ip, $port, $user, $pass, $proto, $timeout);
        }
        $sysInfo = $client->getSystemInfo($totalPonPorts);
        $ponPorts = $client->getPonPorts($totalPonPorts, $ponType);
        $onus = $client->getOnus(null, true);

        // Option 2: Live MAC Address Table from OLT (includes Router MAC, VLAN ID, Port ID)
        $macTable = [];
        try {
            if ($isBdcom || $isBtpon || $isFocuscom || $isAtop) {
                $macTable = $client->getMacTable(null, $onus);
            } else {
                $macTable = $client->getMacTable();
            }
        } catch (\Throwable $e) {}

        if (!$sysInfo && empty($onus)) {
            // If connection failed, return honest error so user knows hardware was unreachable
            $local = self::getLocalData($db, $tenantId, $deviceId, $oltDev);
            $protoName = ($isBdcom && ($proto === 'http' || $proto === 'https' || $port === 2321)) ? 'Web Management' : ($isBdcom ? 'Telnet CLI' : 'API/Web');
            $local['syncError'] = "Could not connect to OLT {$protoName} at {$ip}:{$port}. Please verify the IP address, {$protoName} port, and credentials.";
            $local['isOnline'] = false;
            return $local;
        }

        // Auto-migrate olt_onus schema if missing columns (router_mac, vlan_id, pppoe_username)
        self::ensureOltSchema($db);

        if ($isBdcom) {
            $defaultModel = 'BDCOM P3310D';
        } elseif ($isBtpon) {
            $defaultModel = 'BTPON PTF-EP8X4G8';
        } elseif ($isFocuscom) {
            $defaultModel = 'Focuscom EP5800-04';
        } elseif ($isAtop) {
            $defaultModel = 'ATOP PPSL-10E08';
        } else {
            $defaultModel = ($totalPonPorts > 4) 
                ? "VSOL " . strtoupper($ponType) . " {$totalPonPorts}-Port OLT" 
                : 'V1601E04-DP';
        }

        $onlineCount = 0;
        foreach ($onus as $o) {
            if (($o['status'] ?? 'online') === 'online') {
                $onlineCount++;
            }
        }

        // Update network_devices table with telemetry JSON & last_sync_at
        $telemetry = [
            'system' => $sysInfo,
            'model' => !empty($sysInfo['model']) ? $sysInfo['model'] : $defaultModel,
            'firmware' => $sysInfo['firmware'] ?? '',
            'hardware' => $sysInfo['hardware'] ?? '',
            'serial' => $sysInfo['serial'] ?? '',
            'mac' => $sysInfo['mac'] ?? '',
            'uptime' => $sysInfo['uptime'] ?? '',
            'cpuUsagePercent' => $sysInfo['cpuUsagePercent'] ?? 0,
            'memoryUsagePercent' => $sysInfo['memoryUsagePercent'] ?? 0,
            'temperatureC' => !empty($sysInfo['cpuTemp']) ? (float)str_replace('°C', '', $sysInfo['cpuTemp']) : null,
            'totalPonPorts' => $totalPonPorts,
            'ponPorts' => $ponPorts,
            'totalOnus' => count($onus),
            'totalOnusOnline' => $onlineCount,
            'lastHardwareSync' => date('Y-m-d H:i:s'),
        ];

        $upStmt = $db->prepare("UPDATE network_devices SET telemetry = :telemetry, last_sync_at = NOW() WHERE network_device_id = :did");
        $upStmt->execute([
            'telemetry' => json_encode($telemetry),
            'did' => $deviceId,
        ]);

        // Upsert ONUs into olt_onus table with Router MAC and VLAN ID from Option 2
        if (!empty($onus)) {
            // Pre-load customer accounts to resolve PPPoE username by Router MAC
            $custMap = [];
            try {
                $cStmt = $db->prepare("SELECT na.username, na.mac_address 
                    FROM customer_network_accounts na
                    WHERE (na.tenant_id = :tid OR na.tenant_id = :ctid) AND na.mac_address IS NOT NULL AND na.mac_address != ''");
                $cStmt->execute(['tid' => $tenantId, 'ctid' => $oltDev['tenant_id'] ?? $tenantId]);
                $cRows = $cStmt->fetchAll();
                foreach ($cRows as $cr) {
                    $m = strtoupper(str_replace(['-', '.', ' '], ':', trim($cr['mac_address'])));
                    $custMap[$m] = trim($cr['username']);
                }
            } catch (\Throwable $e) {}

            try {
                $sql = "INSERT INTO olt_onus (tenant_id, network_device_id, pon_port, pon_port_name, onu_id, mac_address, router_mac, vlan_id, pppoe_username, rx_power_dbm, status, uptime, last_sync_at) 
                        VALUES (:tid, :did, :pon, :pname, :onuid, :mac, :rmac, :vlan, :pppoe, :rx, :status, :uptime, NOW())
                        ON DUPLICATE KEY UPDATE 
                            pon_port = VALUES(pon_port),
                            pon_port_name = VALUES(pon_port_name),
                            onu_id = VALUES(onu_id),
                            router_mac = COALESCE(VALUES(router_mac), router_mac),
                            vlan_id = COALESCE(VALUES(vlan_id), vlan_id),
                            pppoe_username = COALESCE(VALUES(pppoe_username), pppoe_username),
                            rx_power_dbm = VALUES(rx_power_dbm),
                            status = VALUES(status),
                            uptime = VALUES(uptime),
                            last_sync_at = NOW()";
                $insStmt = $db->prepare($sql);

                $db->beginTransaction();
                foreach ($onus as $onu) {
                    $onuId = $onu['onuId'];
                    $onuMac = $onu['macAddress'];
                    $macEntry = $macTable[$onuId] ?? ($macTable[$onuMac] ?? null);
                    $routerMac = $macEntry['routerMac'] ?? null;
                    $vlanId = $macEntry['vlanId'] ?? null;
                    $pppoeUser = null;

                    if ($routerMac && isset($custMap[$routerMac])) {
                        $pppoeUser = $custMap[$routerMac];
                    }

                    $insStmt->execute([
                        'tid' => $tenantId,
                        'did' => $deviceId,
                        'pon' => $onu['ponPort'],
                        'pname' => $onu['ponPortName'],
                        'onuid' => $onu['onuId'],
                        'mac' => $onu['macAddress'],
                        'rmac' => $routerMac,
                        'vlan' => $vlanId,
                        'pppoe' => $pppoeUser,
                        'rx' => $onu['rxPowerDbm'],
                        'status' => $onu['status'] ?? 'online',
                        'uptime' => !empty($onu['aliveTime']) ? $onu['aliveTime'] : (!empty($onu['uptime']) ? $onu['uptime'] : null),
                    ]);
                }
                $db->commit();
            } catch (\Throwable $e) {
                if ($db->inTransaction()) $db->rollBack();
                error_log("OLT ONU detailed sync error: " . $e->getMessage() . " - attempting basic fallback");

                // Fallback: insert with basic columns guaranteed in standard schema
                try {
                    $basicSql = "INSERT INTO olt_onus (tenant_id, network_device_id, pon_port, pon_port_name, onu_id, mac_address, rx_power_dbm, status, uptime, last_sync_at) 
                                 VALUES (:tid, :did, :pon, :pname, :onuid, :mac, :rx, :status, :uptime, NOW())
                                 ON DUPLICATE KEY UPDATE 
                                     pon_port = VALUES(pon_port),
                                     pon_port_name = VALUES(pon_port_name),
                                     onu_id = VALUES(onu_id),
                                     rx_power_dbm = VALUES(rx_power_dbm),
                                     status = VALUES(status),
                                     uptime = VALUES(uptime),
                                     last_sync_at = NOW()";
                    $basicStmt = $db->prepare($basicSql);

                    $db->beginTransaction();
                    foreach ($onus as $onu) {
                        $basicStmt->execute([
                            'tid' => $tenantId,
                            'did' => $deviceId,
                            'pon' => $onu['ponPort'],
                            'pname' => $onu['ponPortName'],
                            'onuid' => $onu['onuId'],
                            'mac' => $onu['macAddress'],
                            'rx' => $onu['rxPowerDbm'],
                            'status' => $onu['status'] ?? 'online',
                            'uptime' => !empty($onu['aliveTime']) ? $onu['aliveTime'] : (!empty($onu['uptime']) ? $onu['uptime'] : null),
                        ]);
                    }
                    $db->commit();
                } catch (\Throwable $e2) {
                    if ($db->inTransaction()) $db->rollBack();
                    error_log("OLT ONU basic fallback sync failed: " . $e2->getMessage());
                }
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
        $devTid = (int)($oltDev['tenant_id'] ?? $tenantId);
        $stmtCounts = $db->prepare("SELECT pon_port, COUNT(*) as count, SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_count FROM olt_onus WHERE (tenant_id = :tid OR tenant_id = :dtid) AND network_device_id = :did GROUP BY pon_port");
        $stmtCounts->execute(['tid' => $tenantId, 'dtid' => $devTid, 'did' => $deviceId]);
        $countsByPon = [];
        $onlineByPon = [];
        $totalStored = 0;
        $totalOnline = 0;
        foreach ($stmtCounts->fetchAll() as $row) {
            $p = (int)$row['pon_port'];
            $countsByPon[$p] = (int)$row['count'];
            $onlineByPon[$p] = (int)($row['online_count'] ?? $row['count']);
            $totalStored += (int)$row['count'];
            $totalOnline += (int)($row['online_count'] ?? $row['count']);
        }

        $totalPonPorts = (int)($oltDev['total_pon_ports'] ?? 8);
        if ($totalPonPorts <= 0) $totalPonPorts = 8;
        $ponType = strtolower($oltDev['pon_type'] ?? 'epon');
        $prefix = ($ponType === 'gpon') ? 'GPON 0/' : 'EPON 0/';

        $ponPorts = $telemetry['ponPorts'] ?? [];
        if (empty($ponPorts)) {
            for ($p = 1; $p <= $totalPonPorts; $p++) {
                $count = $countsByPon[$p] ?? 0;
                $ponPorts[] = [
                    'portNum' => $p,
                    'port' => "PON$p",
                    'portName' => "{$prefix}{$p}",
                    'status' => $count > 0 ? 'online' : 'offline',
                    'operStatus' => $count > 0 ? 'up' : 'down',
                    'txPowerDbm' => null,
                    'temperatureC' => null,
                    'connectedOnus' => $count,
                ];
            }
        } else {
            // If telemetry has fewer ports than configured, extend them dynamically
            $existingNums = array_map(function($pp) {
                return (int)($pp['portNum'] ?? str_replace('PON', '', $pp['port']));
            }, $ponPorts);

            for ($p = 1; $p <= $totalPonPorts; $p++) {
                if (!in_array($p, $existingNums)) {
                    $count = $countsByPon[$p] ?? 0;
                    $ponPorts[] = [
                        'portNum' => $p,
                        'port' => "PON$p",
                        'portName' => "{$prefix}{$p}",
                        'status' => $count > 0 ? 'online' : 'offline',
                        'operStatus' => $count > 0 ? 'up' : 'down',
                        'txPowerDbm' => null,
                        'temperatureC' => null,
                        'connectedOnus' => $count,
                    ];
                }
            }

            usort($ponPorts, function($a, $b) {
                $na = (int)($a['portNum'] ?? str_replace('PON', '', $a['port']));
                $nb = (int)($b['portNum'] ?? str_replace('PON', '', $b['port']));
                return $na <=> $nb;
            });

            foreach ($ponPorts as &$pp) {
                $pNum = (int)($pp['portNum'] ?? str_replace('PON', '', $pp['port']));
                $pp['connectedOnus'] = $countsByPon[$pNum] ?? 0;
                $pp['onlineOnus'] = $onlineByPon[$pNum] ?? 0;
            }
            unset($pp);
        }

        $defaultModel = ($oltDev['vendor'] === 'atop')
            ? "ATOP " . strtoupper($ponType) . " {$totalPonPorts}-Port OLT"
            : (($totalPonPorts > 4) 
                ? "VSOL " . strtoupper($ponType) . " {$totalPonPorts}-Port OLT" 
                : 'V1601E04-DP');

        $isSynced = !empty($telemetry['system']) || !empty($lastSync);
        $system = $telemetry['system'] ?? [
            'vendor' => strtoupper($oltDev['vendor'] ?: 'VSOL'),
            'model' => $defaultModel,
            'serial' => $oltDev['device_code'] ?? '',
            'hardware' => null,
            'firmware' => null,
            'uptime' => null,
            'cpuTemp' => null,
            'cpuUsage' => null,
            'memoryUsage' => null,
            'totalPonPorts' => $totalPonPorts,
            'totalGePorts' => 8,
        ];
        $system['totalPonPorts'] = $totalPonPorts;

        return [
            'isStored' => true,
            'isSynced' => $isSynced,
            'isOnline' => $isSynced,
            'lastSyncAt' => $lastSync,
            'syncAgeMinutes' => $syncAgeMinutes,
            'nextScheduledSyncMinutes' => max(0, 120 - ($syncAgeMinutes ?? 0)),
            'system' => $system,
            'model' => $telemetry['model'] ?? $system['model'] ?? $defaultModel,
            'firmware' => $telemetry['firmware'] ?? $system['firmware'] ?? null,
            'uptime' => $telemetry['uptime'] ?? $system['uptime'] ?? null,
            'cpuUsagePercent' => $telemetry['cpuUsagePercent'] ?? ($system['cpuUsagePercent'] ?? null),
            'memoryUsagePercent' => $telemetry['memoryUsagePercent'] ?? ($system['memoryUsagePercent'] ?? null),
            'temperatureC' => $telemetry['temperatureC'] ?? null,
            'totalPonPorts' => $totalPonPorts,
            'ponPorts' => $ponPorts,
            'totalOnus' => $totalStored,
            'totalOnusOnline' => $totalOnline,
            'totalOnusOffline' => max(0, $totalStored - $totalOnline),
        ];
    }

    /**
     * Ensures all modern schema columns exist in olt_onus table
     */
    public static function ensureOltSchema(PDO $db): void {
        static $checked = false;
        if ($checked) return;

        try {
            $colsStmt = $db->query("SHOW COLUMNS FROM olt_onus");
            $existingCols = [];
            while ($c = $colsStmt->fetch(PDO::FETCH_ASSOC)) {
                $existingCols[] = strtolower($c['Field']);
            }

            if (!in_array('router_mac', $existingCols)) {
                $db->exec("ALTER TABLE olt_onus ADD COLUMN router_mac VARCHAR(30) NULL AFTER mac_address");
            }
            if (!in_array('vlan_id', $existingCols)) {
                $db->exec("ALTER TABLE olt_onus ADD COLUMN vlan_id INT NULL AFTER router_mac");
            }
            if (!in_array('pppoe_username', $existingCols)) {
                $db->exec("ALTER TABLE olt_onus ADD COLUMN pppoe_username VARCHAR(100) NULL AFTER vlan_id");
            }
            if (!in_array('uptime', $existingCols)) {
                $db->exec("ALTER TABLE olt_onus ADD COLUMN uptime VARCHAR(60) NULL AFTER status");
            }
            $checked = true;
        } catch (\Throwable $e) {
            error_log("Failed to auto-migrate olt_onus table: " . $e->getMessage());
        }
    }
}

