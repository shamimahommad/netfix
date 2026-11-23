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
require_once __DIR__ . '/CdataOltClient.php';

class OltSyncService {
    public const DEFAULT_SYNC_INTERVAL_SECONDS = 7200; // 2 Hours

    /**
     * Synchronize a specific OLT device with local database storage.
     * Only connects to hardware if interval has elapsed or if $force is true.
     */
    public static function sync(PDO $db, array $oltDev, bool $force = false, ?int $intervalSeconds = null): array {
        @set_time_limit(300);
        @ini_set('max_execution_time', '300');
        $syncStartTimestamp = microtime(true);

        $deviceId = (int)$oltDev['network_device_id'];
        $tenantId = (int)$oltDev['tenant_id'];

        if ($intervalSeconds === null) {
            $settings = self::getSettings($tenantId);
            $intervalSeconds = $settings['syncIntervalMinutes'] * 60;
        }

        $lastSyncTime = !empty($oltDev['last_sync_at']) ? strtotime($oltDev['last_sync_at']) : 0;
        $now = time();
        $ageSeconds = $now - $lastSyncTime;

        // Only connect to hardware if $force is true OR device has never synced OR interval has elapsed
        $needsSync = $force || ($lastSyncTime === 0) || ($ageSeconds >= $intervalSeconds);
        if (!$needsSync) {
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
        $isCdata = in_array($vendor, ['cdata', 'itlink', 'it-link', 'itcom', 'cortina']);

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
        } elseif ($isCdata) {
            $defaultPort = 1014;
            $port = (int)($oltDev['web_port'] ?: ($oltDev['management_port'] ?: $defaultPort));
            $proto = ($port == 443) ? 'https' : 'http';
        } else {
            $defaultPort = $isBtpon ? 16148 : ($isFocuscom ? 2322 : ($isAtop ? 2000 : 1010));
            $port = (int)($oltDev['web_port'] ?: ($oltDev['management_port'] ?: $defaultPort));
            $proto = ($port == 443) ? 'https' : 'http';
            if ($vendor === 'vsol' && $port != 80) {
                $proto = 'https';
            }
        }
        $user = $oltDev['api_username'] ?: ($isAtop ? 'root' : (($isBdcom || $isFocuscom || $isBtpon || $isCdata) ? 'admin' : 'star'));
        $pass = $oltDev['api_password'] ?: (($isBdcom || $isFocuscom || $isBtpon || $isAtop || $isCdata) ? 'admin' : 'star321');

        $totalPonPorts = (int)($oltDev['total_pon_ports'] ?? (($isFocuscom || $isBdcom || $isCdata) ? 4 : 8));
        if ($totalPonPorts <= 0) $totalPonPorts = (($isFocuscom || $isBdcom || $isCdata) ? 4 : 8);
        $ponType = strtolower($oltDev['pon_type'] ?? 'epon');

        // Fast Pre-Flight Check: Verify OLT IP:Port responds to TCP socket (2.5s timeout for remote routed networks)
        $cacheDir = __DIR__ . '/../cache';
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0777, true);
        }
        $oltOfflineFile = $cacheDir . '/olt_' . $deviceId . '_unreachable.txt';

        $fp = @fsockopen($ip, $port, $errno, $errstr, 2.5);
        if (!$fp && $vendor === 'vsol') {
            // Auto-fallback between standard web ports (80 <-> 443) for VSOL web management
            $altPort = ($port === 443) ? 80 : (($port === 80) ? 443 : 0);
            if ($altPort > 0) {
                $altFp = @fsockopen($ip, $altPort, $errno, $errstr, 2.5);
                if ($altFp) {
                    fclose($altFp);
                    $port = $altPort;
                    $proto = ($port === 443) ? 'https' : 'http';
                    // Auto-update web_port in DB so subsequent calls don't need fallback
                    try {
                        $db->prepare("UPDATE network_devices SET web_port = :wp WHERE network_device_id = :did")
                            ->execute(['wp' => $port, 'did' => $deviceId]);
                    } catch (\Throwable $e) {}
                    $fp = true;
                }
            }
        }

        if (!$fp) {
            @file_put_contents($oltOfflineFile, time());
            $local = self::getLocalData($db, $tenantId, $deviceId, $oltDev);
            $local['syncError'] = "OLT hardware at {$ip}:{$port} is currently unreachable or offline.";
            $local['isOnline'] = false;
            return $local;
        }
        if (is_resource($fp)) {
            fclose($fp);
        }

        if (file_exists($oltOfflineFile)) {
            @unlink($oltOfflineFile);
        }

        // Dynamic timeout: 45s for 8+ port OLTs with hundreds of ONUs, 20s for 4-port
        $timeout = ($totalPonPorts > 4) ? 45 : 20;

        if ($isBdcom) {
            if ($proto === 'http' || $proto === 'https' || $port === 2321 || $port === 80 || $port === 8080) {
                $client = new BdcomWebOltClient($ip, $port, $user, $pass, $proto, $timeout);
            } else {
                $client = new BdcomOltClient($ip, $port, $user, $pass, $proto, $timeout);
            }
        } elseif ($isCdata) {
            $client = new CdataOltClient($ip, $port, $user, $pass, $proto, $timeout);
        } elseif ($isBtpon) {
            $client = new BtponOltClient($ip, $port, $user, $pass, $proto, $timeout);
        } elseif ($isFocuscom) {
            $client = new FocuscomOltClient($ip, $port, $user, $pass, $proto, $timeout);
        } elseif ($isAtop) {
            $client = new AtopOltClient($ip, $port, $user, $pass, $proto, $timeout);
        } else {
            $client = new VsolOltClient($ip, $port, $user, $pass, $proto, $timeout);
            // If VSOL client auto-switched port during login, persist to DB
            if ($client->getPort() !== $port) {
                $port = $client->getPort();
                $proto = $client->getProtocol();
                try {
                    $db->prepare("UPDATE network_devices SET web_port = :wp WHERE network_device_id = :did")
                        ->execute(['wp' => $port, 'did' => $deviceId]);
                } catch (\Throwable $e) {}
            }
        }
        $sysInfo = $client->getSystemInfo($totalPonPorts);
        $ponPorts = $client->getPonPorts($totalPonPorts, $ponType);
        $onus = $client->getOnus(null, true);

        // Option 2: Live MAC Address Table from OLT (includes Router MAC, VLAN ID, Port ID)
        $macTable = [];
        try {
            if ($isBdcom || $isBtpon || $isFocuscom || $isAtop || $isCdata) {
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
        } elseif ($isCdata) {
            $defaultModel = 'C-Data / ITCOM EPON OLT';
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
        $syncStartTime = date('Y-m-d H:i:s');
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

                    $pName = !empty($onu['ponPortName']) ? $onu['ponPortName'] : (!empty($onu['portName']) ? $onu['portName'] : ("PON0/0/" . ($onu['ponPort'] ?? 1)));

                    $insStmt->execute([
                        'tid' => $tenantId,
                        'did' => $deviceId,
                        'pon' => $onu['ponPort'] ?? 1,
                        'pname' => $pName,
                        'onuid' => $onu['onuId'] ?? 1,
                        'mac' => $onu['macAddress'] ?? ($onu['mac'] ?? ''),
                        'rmac' => $routerMac,
                        'vlan' => $vlanId,
                        'pppoe' => $pppoeUser,
                        'rx' => $onu['rxPowerDbm'] ?? null,
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
                        $pName = !empty($onu['ponPortName']) ? $onu['ponPortName'] : (!empty($onu['portName']) ? $onu['portName'] : ("PON0/0/" . ($onu['ponPort'] ?? 1)));
                        $basicStmt->execute([
                            'tid' => $tenantId,
                            'did' => $deviceId,
                            'pon' => $onu['ponPort'] ?? 1,
                            'pname' => $pName,
                            'onuid' => $onu['onuId'] ?? 1,
                            'mac' => $onu['macAddress'] ?? ($onu['mac'] ?? ''),
                            'rx' => $onu['rxPowerDbm'] ?? null,
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

        // Auto-reconciliation: Purge any ONUs from the database that were removed/deleted on the physical OLT
        if (is_array($onus)) {
            try {
                $pruneStmt = $db->prepare("DELETE FROM olt_onus 
                    WHERE network_device_id = :did 
                      AND (last_sync_at < :syncStart OR last_sync_at IS NULL)");
                $pruneStmt->execute([
                    'did' => $deviceId,
                    'syncStart' => $syncStartTime,
                ]);
                $prunedCount = $pruneStmt->rowCount();
                if ($prunedCount > 0) {
                    error_log("[OLT RECONCILIATION] Auto-pruned {$prunedCount} deleted/deregistered ONU(s) from OLT ID {$deviceId}");
                }
            } catch (\Throwable $pe) {
                error_log("[OLT RECONCILIATION] Prune stale ONUs warning: " . $pe->getMessage());
            }
        }

        $totalDuration = round(microtime(true) - $syncStartTimestamp, 2);
        error_log("[OLT SYNC] Device #{$deviceId} ({$vendor}) sync finished in {$totalDuration}s. ONUs: " . count($onus) . ", Pruned: " . ($prunedCount ?? 0));

        // Update telemetry with execution duration
        $telemetry['syncDurationSeconds'] = $totalDuration;
        $telemetry['prunedOnus'] = $prunedCount ?? 0;
        try {
            $db->prepare("UPDATE network_devices SET telemetry = :telemetry WHERE network_device_id = :did")
                ->execute(['telemetry' => json_encode($telemetry), 'did' => $deviceId]);
        } catch (\Throwable $e) {}

        // Refresh device row and return local data
        $refStmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :did");
        $refStmt->execute(['did' => $deviceId]);
        $freshDev = $refStmt->fetch() ?: $oltDev;

        $localData = self::getLocalData($db, $tenantId, $deviceId, $freshDev);
        $localData['syncDurationSeconds'] = $totalDuration;
        $localData['prunedOnus'] = $prunedCount ?? 0;
        return $localData;
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

        $settings = self::getSettings($tenantId);
        $syncIntervalMins = $settings['syncIntervalMinutes'] ?? 120;

        return [
            'isStored' => true,
            'isSynced' => $isSynced,
            'isOnline' => $isSynced,
            'lastSyncAt' => $lastSync,
            'syncAgeMinutes' => $syncAgeMinutes,
            'syncIntervalMinutes' => $syncIntervalMins,
            'nextScheduledSyncMinutes' => max(0, $syncIntervalMins - ($syncAgeMinutes ?? 0)),
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
     * Get OLT sync settings (checks tenant-specific, then global SaaS tenant_id = 0)
     */
    public static function getSettings(?int $tenantId = null): array {
        $db = Database::getConnection();
        self::ensureOltCronSchema($db);

        $rows = [];

        // Try tenant-specific if tenantId given
        if ($tenantId !== null && $tenantId > 0) {
            $stmt = $db->prepare("SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = :tid AND setting_key LIKE 'olt_sync_%'");
            $stmt->execute(['tid' => $tenantId]);
            $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
        }

        // Fall back to global (tenant_id = 0)
        if (empty($rows)) {
            $stmt = $db->query("SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = 0 AND setting_key LIKE 'olt_sync_%'");
            $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
        }

        return [
            'autoSyncEnabled' => ($rows['olt_sync_enabled'] ?? '1') === '1',
            'syncIntervalMinutes' => max(5, (int)($rows['olt_sync_interval'] ?? 120)),
            'syncTimeoutSeconds' => max(10, min(120, (int)($rows['olt_sync_timeout'] ?? 30))),
        ];
    }

    /**
     * Save OLT sync settings (restricted to SaaS Admin or Tenant Admin)
     */
    public static function saveSettings(array $settings, ?int $tenantId = null): bool {
        $db = Database::getConnection();
        self::ensureOltCronSchema($db);

        $targetTenantId = ($tenantId !== null) ? $tenantId : 0;

        $enabled = isset($settings['autoSyncEnabled']) ? ($settings['autoSyncEnabled'] ? '1' : '0') : null;
        $interval = isset($settings['syncIntervalMinutes']) ? (string)max(5, (int)$settings['syncIntervalMinutes']) : null;
        $timeout = isset($settings['syncTimeoutSeconds']) ? (string)max(10, min(120, (int)$settings['syncTimeoutSeconds'])) : null;

        $items = [
            'olt_sync_enabled' => $enabled,
            'olt_sync_interval' => $interval,
            'olt_sync_timeout' => $timeout,
        ];

        $stmt = $db->prepare("INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, created_at, updated_at) 
            VALUES (:tid, :k, :v, NOW(), NOW()) 
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()");

        foreach ($items as $k => $v) {
            if ($v !== null) {
                $stmt->execute(['tid' => $targetTenantId, 'k' => $k, 'v' => $v]);
            }
        }

        // If saving global (0), also propagate to all existing rows
        if ($targetTenantId === 0) {
            foreach ($items as $k => $v) {
                if ($v !== null) {
                    $uStmt = $db->prepare("UPDATE tenant_settings SET setting_value = :v, updated_at = NOW() WHERE setting_key = :k");
                    $uStmt->execute(['v' => $v, 'k' => $k]);
                }
            }
        }

        return true;
    }

    /**
     * Run Scheduled OLT Sync Job across all eligible active OLTs
     */
    public static function runScheduledSync(?int $tenantId = null, string $triggerType = 'scheduled', bool $force = false): array {
        @set_time_limit(600);
        @ini_set('max_execution_time', '600');
        $startTime = microtime(true);
        $db = Database::getConnection();
        self::ensureOltCronSchema($db);

        $settings = self::getSettings($tenantId);
        $intervalSeconds = $settings['syncIntervalMinutes'] * 60;

        // If auto-sync is disabled and this is a scheduled cron run, skip execution
        if (!$settings['autoSyncEnabled'] && !$force && $triggerType === 'scheduled') {
            return [
                'success' => false,
                'status' => 'disabled',
                'message' => 'OLT Auto-Sync Cron is currently disabled in SaaS Admin settings.',
                'totalOlts' => 0,
                'syncedOlts' => 0,
                'failedOlts' => 0,
                'skippedOlts' => 0,
                'durationMs' => 0,
            ];
        }

        // 1. Initialize run record in olt_cron_runs
        $runStmt = $db->prepare("INSERT INTO olt_cron_runs (tenant_id, trigger_type, status, started_at) 
            VALUES (:tid, :trigger, 'running', NOW())");
        $runStmt->execute([
            'tid' => $tenantId,
            'trigger' => $triggerType,
        ]);
        $runId = (int)$db->lastInsertId();

        // 2. Query active OLT devices
        if ($tenantId !== null && $tenantId > 0) {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE device_type = 'olt' AND status = 'active' AND tenant_id = :tid");
            $stmt->execute(['tid' => $tenantId]);
        } else {
            $stmt = $db->query("SELECT * FROM network_devices WHERE device_type = 'olt' AND status = 'active'");
        }
        $olts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalOlts = count($olts);
        $syncedCount = 0;
        $failedCount = 0;
        $skippedCount = 0;
        $totalOnus = 0;
        $onlineOnus = 0;
        $offlineOnus = 0;
        $errors = [];
        $syncedDetails = [];

        $now = time();

        foreach ($olts as $olt) {
            $oltId = (int)$olt['network_device_id'];
            $oltName = $olt['device_name'];
            $lastSync = !empty($olt['last_sync_at']) ? strtotime($olt['last_sync_at']) : 0;
            $age = $now - $lastSync;

            $isDue = $force || ($lastSync === 0) || ($age >= $intervalSeconds);

            if (!$isDue) {
                $skippedCount++;
                $syncedDetails[] = [
                    'oltId' => $oltId,
                    'name' => $oltName,
                    'ip' => $olt['management_ip'],
                    'status' => 'skipped',
                    'reason' => 'Synced ' . round($age / 60) . ' mins ago (Interval: ' . $settings['syncIntervalMinutes'] . 'm)',
                ];
                continue;
            }

            try {
                $res = self::sync($db, $olt, true, $intervalSeconds);
                if (!empty($res['syncError'])) {
                    $failedCount++;
                    $errors[] = "{$oltName}: {$res['syncError']}";
                    $syncedDetails[] = [
                        'oltId' => $oltId,
                        'name' => $oltName,
                        'ip' => $olt['management_ip'],
                        'status' => 'failed',
                        'error' => $res['syncError'],
                    ];
                } else {
                    $syncedCount++;
                    $totalOnus += (int)($res['totalOnus'] ?? 0);
                    $onlineOnus += (int)($res['totalOnusOnline'] ?? 0);
                    $offlineOnus += (int)($res['totalOnusOffline'] ?? 0);
                    $syncedDetails[] = [
                        'oltId' => $oltId,
                        'name' => $oltName,
                        'ip' => $olt['management_ip'],
                        'status' => 'synced',
                        'totalOnus' => (int)($res['totalOnus'] ?? 0),
                        'onlineOnus' => (int)($res['totalOnusOnline'] ?? 0),
                    ];
                }
            } catch (\Throwable $e) {
                $failedCount++;
                $errors[] = "{$oltName}: " . $e->getMessage();
                $syncedDetails[] = [
                    'oltId' => $oltId,
                    'name' => $oltName,
                    'ip' => $olt['management_ip'],
                    'status' => 'failed',
                    'error' => $e->getMessage(),
                ];
            }
        }

        $durationMs = (int)round((microtime(true) - $startTime) * 1000);
        $finalStatus = ($failedCount > 0 && $syncedCount === 0 && $totalOlts > 0) ? 'failed' : 'completed';

        // 3. Update olt_cron_runs table
        $upStmt = $db->prepare("UPDATE olt_cron_runs SET 
            status = :status,
            total_olts = :tot,
            synced_olts = :synced,
            failed_olts = :failed,
            skipped_olts = :skipped,
            total_onus = :onus,
            online_onus = :on_onus,
            offline_onus = :off_onus,
            duration_ms = :dur,
            error_summary = :err,
            completed_at = NOW()
            WHERE id = :rid");

        $upStmt->execute([
            'status' => $finalStatus,
            'tot' => $totalOlts,
            'synced' => $syncedCount,
            'failed' => $failedCount,
            'skipped' => $skippedCount,
            'onus' => $totalOnus,
            'on_onus' => $onlineOnus,
            'off_onus' => $offlineOnus,
            'dur' => $durationMs,
            'err' => !empty($errors) ? implode('; ', array_slice($errors, 0, 5)) : null,
            'rid' => $runId,
        ]);

        return [
            'success' => ($finalStatus === 'completed'),
            'runId' => $runId,
            'status' => $finalStatus,
            'triggerType' => $triggerType,
            'totalOlts' => $totalOlts,
            'syncedOlts' => $syncedCount,
            'failedOlts' => $failedCount,
            'skippedOlts' => $skippedCount,
            'totalOnus' => $totalOnus,
            'onlineOnus' => $onlineOnus,
            'offlineOnus' => $offlineOnus,
            'durationMs' => $durationMs,
            'errors' => $errors,
            'details' => $syncedDetails,
            'timestamp' => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * Get detailed status, metrics, and history for OLT Cron
     */
    public static function getStatus(?int $tenantId = null): array {
        $db = Database::getConnection();
        self::ensureOltCronSchema($db);

        $settings = self::getSettings($tenantId);
        $intervalMinutes = $settings['syncIntervalMinutes'];

        // Metrics
        $totalStmt = $db->query("SELECT COUNT(*) FROM network_devices WHERE device_type = 'olt'");
        $totalOlts = (int)$totalStmt->fetchColumn();

        $activeStmt = $db->query("SELECT COUNT(*) FROM network_devices WHERE device_type = 'olt' AND status = 'active'");
        $activeOlts = (int)$activeStmt->fetchColumn();

        $syncedWindowStmt = $db->prepare("SELECT COUNT(*) FROM network_devices 
            WHERE device_type = 'olt' AND status = 'active' AND last_sync_at >= DATE_SUB(NOW(), INTERVAL :mins MINUTE)");
        $syncedWindowStmt->execute(['mins' => $intervalMinutes]);
        $syncedInWindow = (int)$syncedWindowStmt->fetchColumn();

        $needsSync = max(0, $activeOlts - $syncedInWindow);

        $onuStmt = $db->query("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_cnt FROM olt_onus");
        $onuData = $onuStmt->fetch(PDO::FETCH_ASSOC);
        $totalOnus = (int)($onuData['total'] ?? 0);
        $onlineOnus = (int)($onuData['online_cnt'] ?? 0);

        // Last Run
        $lastRunStmt = $db->query("SELECT * FROM olt_cron_runs ORDER BY id DESC LIMIT 1");
        $lastRun = $lastRunStmt->fetch(PDO::FETCH_ASSOC) ?: null;

        // History
        $histStmt = $db->query("SELECT * FROM olt_cron_runs ORDER BY id DESC LIMIT 10");
        $history = $histStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $cronScriptPath = realpath(__DIR__ . '/../cron/sync_olt.php') ?: (__DIR__ . '/../cron/sync_olt.php');

        return [
            'engineStatus' => $settings['autoSyncEnabled'] ? 'active' : 'paused',
            'serverTime' => date('Y-m-d H:i:s'),
            'settings' => $settings,
            'metrics' => [
                'totalOlts' => $totalOlts,
                'activeOlts' => $activeOlts,
                'syncedInWindow' => $syncedInWindow,
                'needsSync' => $needsSync,
                'totalOnus' => $totalOnus,
                'onlineOnus' => $onlineOnus,
            ],
            'lastRun' => $lastRun,
            'history' => $history,
            'cronCommands' => [
                'linux' => "*/15 * * * * php " . $cronScriptPath . " >> /var/log/netfix_olt_sync.log 2>&1",
                'windows' => 'php "' . $cronScriptPath . '"',
                'webUrl' => '/cron/sync-olt',
            ],
        ];
    }

    /**
     * Ensures olt_cron_runs table exists
     */
    public static function ensureOltCronSchema(PDO $db): void {
        static $checked = false;
        if ($checked) return;

        try {
            $db->exec("CREATE TABLE IF NOT EXISTS `olt_cron_runs` (
              `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
              `tenant_id` bigint(20) unsigned DEFAULT NULL,
              `trigger_type` enum('scheduled','manual','api') NOT NULL DEFAULT 'scheduled',
              `status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
              `total_olts` int(11) NOT NULL DEFAULT 0,
              `synced_olts` int(11) NOT NULL DEFAULT 0,
              `failed_olts` int(11) NOT NULL DEFAULT 0,
              `skipped_olts` int(11) NOT NULL DEFAULT 0,
              `total_onus` int(11) NOT NULL DEFAULT 0,
              `online_onus` int(11) NOT NULL DEFAULT 0,
              `offline_onus` int(11) NOT NULL DEFAULT 0,
              `duration_ms` int(11) NOT NULL DEFAULT 0,
              `error_summary` text DEFAULT NULL,
              `started_at` datetime NOT NULL,
              `completed_at` datetime DEFAULT NULL,
              PRIMARY KEY (`id`),
              KEY `idx_olt_cron_tenant` (`tenant_id`),
              KEY `idx_olt_cron_status` (`status`),
              KEY `idx_olt_cron_started` (`started_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            $checked = true;
        } catch (\Throwable $e) {
            error_log("Failed to ensure olt_cron_runs table: " . $e->getMessage());
        }
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

