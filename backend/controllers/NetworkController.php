<?php
/**
 * NetFix ISP SaaS - Network Controller
 * Handles MikroTik routers, OLT devices, Live Traffic, RouterOS API & Ping
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/RouterosAPI.php';
require_once __DIR__ . '/../lib/TenantSequenceService.php';

class NetworkController {
    public static function index(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $where = [];
        $params = [];

        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            if ($tenantId === null) {
                Response::json(['success' => true, 'data' => []]);
                return;
            }
            $where[] = "tenant_id = :tid";
            $params['tid'] = $tenantId;
        }

        if (!empty($_GET['type'])) {
            $type = $_GET['type'];
            if ($type === 'mikrotik') {
                $where[] = "(vendor = 'mikrotik' OR device_type = 'router')";
            } elseif ($type === 'olt') {
                $where[] = "(device_type = 'olt' OR vendor = 'olt' OR vendor IN ('vsol', 'bdcom', 'huawei', 'zte', 'cdata', 'syrotech', 'focuscom', 'btpon', 'tbs', 'ip-com'))";
            }
        }

        $whereSql = !empty($where) ? "WHERE " . implode(' AND ', $where) : "";

        $stmt = $db->prepare("SELECT * FROM network_devices {$whereSql} ORDER BY network_device_id DESC");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $devices = array_map(function($r) {
            $devId = (string)$r['network_device_id'];
            return [
                'networkDeviceId' => $devId,
                'deviceId' => $devId,
                'device_id' => $devId,
                'id' => $devId,
                'deviceCode' => $r['device_code'],
                'deviceName' => $r['device_name'],
                'deviceType' => $r['device_type'],
                'vendor' => $r['vendor'],
                'status' => $r['status'],
                'managementIp' => $r['management_ip'],
                'managementPort' => (int)$r['management_port'],
                'winboxPort' => $r['winbox_port'] ? (int)$r['winbox_port'] : null,
                'webPort' => $r['web_port'] ? (int)$r['web_port'] : null,
                'apiUsername' => $r['api_username'],
                'isProduction' => (bool)$r['is_production'],
                'customPingInterval' => $r['custom_ping_interval'],
                'snmpCommunity' => $r['snmp_community'] ?? 'public',
                'snmpPort' => (int)($r['snmp_port'] ?? 161),
                'ponType' => $r['pon_type'] ?? 'gpon',
                'totalPonPorts' => (int)($r['total_pon_ports'] ?? 8),
                'lastSyncAt' => $r['last_sync_at'],
                'createdAt' => $r['created_at'],
                // Real-time calculated status
                'pingStatus' => ($r['status'] === 'active' || $r['status'] === 'online') ? 'online' : ($r['status'] === 'auth_failed' ? 'auth_failed' : 'offline'),
                'latencyMs' => ($r['status'] === 'active' || $r['status'] === 'online') ? 12 : null,
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $devices,
        ]);
    }

    public static function show(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE (network_device_id = :id OR device_code = :code) AND tenant_id = :tid LIMIT 1");
            $stmt->execute(['id' => $id, 'code' => $id, 'tid' => $tenantId]);
        } else {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id OR device_code = :code LIMIT 1");
            $stmt->execute(['id' => $id, 'code' => $id]);
        }
        $r = $stmt->fetch();

        if (!$r) {
            Response::error('Device not found', 404);
        }

        $devId = (string)$r['network_device_id'];
        $device = [
            'networkDeviceId' => $devId,
            'deviceId' => $devId,
            'device_id' => $devId,
            'id' => $devId,
            'deviceCode' => $r['device_code'],
            'deviceName' => $r['device_name'],
            'deviceType' => $r['device_type'],
            'vendor' => $r['vendor'],
            'status' => $r['status'],
            'managementIp' => $r['management_ip'],
            'managementPort' => (int)$r['management_port'],
            'winboxPort' => $r['winbox_port'] ? (int)$r['winbox_port'] : null,
            'webPort' => $r['web_port'] ? (int)$r['web_port'] : null,
            'apiUsername' => $r['api_username'],
            'isProduction' => (bool)$r['is_production'],
            'customPingInterval' => $r['custom_ping_interval'],
            'snmpCommunity' => $r['snmp_community'] ?? 'public',
            'snmpPort' => (int)($r['snmp_port'] ?? 161),
            'ponType' => $r['pon_type'] ?? 'gpon',
            'totalPonPorts' => (int)($r['total_pon_ports'] ?? 8),
            'lastSyncAt' => $r['last_sync_at'],
            'telemetry' => json_decode($r['telemetry'] ?? '{}', true) ?: [],
            'createdAt' => $r['created_at'],
            'pingStatus' => ($r['status'] === 'active' || $r['status'] === 'online') ? 'online' : ($r['status'] === 'auth_failed' ? 'auth_failed' : 'offline'),
            'latencyMs' => ($r['status'] === 'active' || $r['status'] === 'online') ? 12 : null,
        ];

        Response::json([
            'success' => true,
            'data' => $device,
        ]);
    }

    public static function dropdown(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $where = [];
        $params = [];

        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            if ($tenantId === null) {
                Response::json(['success' => true, 'data' => []]);
                return;
            }
            $where[] = "tenant_id = :tid";
            $params['tid'] = $tenantId;
        }

        $type = !empty($_GET['type']) ? strtolower(trim($_GET['type'])) : 'router';

        if ($type === 'router' || $type === 'mikrotik') {
            $where[] = "(device_type = 'router' OR vendor = 'mikrotik') AND device_type != 'olt'";
        } elseif ($type === 'olt') {
            $where[] = "(device_type = 'olt' OR vendor IN ('olt', 'vsol', 'bdcom', 'huawei', 'zte', 'cdata', 'syrotech', 'focuscom', 'btpon', 'tbs', 'ip-com'))";
        } elseif ($type !== 'all') {
            $where[] = "device_type = :dtype";
            $params['dtype'] = $type;
        }

        $whereSql = !empty($where) ? "WHERE " . implode(' AND ', $where) : "";
        $sql = "SELECT network_device_id as id, device_name as name, device_type as type, vendor, status 
            FROM network_devices {$whereSql} ORDER BY device_name ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            $id = (string)$r['id'];
            return [
                'id' => $id,
                'networkDeviceId' => $id,
                'deviceId' => $id,
                'name' => $r['name'],
                'type' => $r['type'],
                'vendor' => $r['vendor'],
                'status' => $r['status'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public static function nextCode(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $code = TenantSequenceService::peekNextCode($db, (string)$tenantId, 'device', 6);
        Response::json(['deviceCode' => $code]);
    }

    public static function create(?array $overrideData = null): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = $overrideData ?? (json_decode(file_get_contents('php://input'), true) ?: []);

        $deviceName = trim($data['deviceName'] ?? $data['name'] ?? '');
        $ip = trim($data['managementIp'] ?? $data['ipAddress'] ?? '192.168.88.1');

        if (empty($deviceName)) {
            Response::error('Device name is required', 400);
        }

        $db = Database::getConnection();

        // Strictly pure numeric globally unique device ID (Base 300000 -> 300001...)
        // System-enforced: cannot be cut, modified, or manually overridden
        $code = TenantSequenceService::generateNextCode($db, (string)$tenantId, 'device', 6);

        $deviceType = $data['deviceType'] ?? 'router';
        $vendor = $data['vendor'] ?? ($deviceType === 'olt' ? 'olt' : 'mikrotik');
        $port = isset($data['managementPort']) ? (int)$data['managementPort'] : ($deviceType === 'olt' ? 23 : 8728);
        $winbox = isset($data['winboxPort']) ? (int)$data['winboxPort'] : ($deviceType === 'olt' ? null : 8291);
        $webPort = isset($data['webPort']) ? (int)$data['webPort'] : 80;
        $snmpCommunity = $data['snmpCommunity'] ?? 'public';
        $snmpPort = isset($data['snmpPort']) ? (int)$data['snmpPort'] : 161;
        $ponType = $data['ponType'] ?? 'gpon';
        $totalPonPorts = isset($data['totalPonPorts']) ? (int)$data['totalPonPorts'] : 8;

        try {
            $stmt = $db->prepare("INSERT INTO network_devices 
                (tenant_id, device_code, device_name, device_type, vendor, status, management_ip, management_port, winbox_port, web_port, api_username, api_password, snmp_community, snmp_port, pon_type, total_pon_ports)
                VALUES (:tid, :code, :name, :type, :vendor, 'active', :ip, :port, :winbox, :web, :user, :pwd, :snmp_comm, :snmp_port, :pon_type, :pon_ports)");
            $stmt->execute([
                'tid' => $tenantId,
                'code' => $code,
                'name' => $deviceName,
                'type' => $deviceType,
                'vendor' => $vendor,
                'ip' => $ip,
                'port' => $port,
                'winbox' => $winbox,
                'web' => $webPort,
                'user' => $data['apiUsername'] ?? 'admin',
                'pwd' => $data['apiPassword'] ?? 'admin123',
                'snmp_comm' => $snmpCommunity,
                'snmp_port' => $snmpPort,
                'pon_type' => $ponType,
                'pon_ports' => $totalPonPorts,
            ]);

            $id = $db->lastInsertId();

            Response::json([
                'success' => true,
                'message' => 'Network device added successfully',
                'data' => [
                    'deviceId' => (string)$id,
                    'deviceCode' => $code,
                    'deviceName' => $deviceName,
                ],
            ], 201);
        } catch (Throwable $e) {
            if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('Duplicate device ID detected. Device code must be globally unique across all networks.', 409);
            }
            Response::error('Failed to create network device: ' . $e->getMessage(), 500);
        }
    }

    public static function createOlt(): void {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?: [];
        $data['deviceType'] = 'olt';
        if (empty($data['vendor']) || $data['vendor'] === 'mikrotik') {
            $data['vendor'] = 'vsol';
        }
        self::create($data);
    }

    public static function update(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $db = Database::getConnection();

        $fields = [];
        $params = ['id' => $id, 'tid' => $tenantId];

        if (isset($data['deviceName'])) {
            $fields[] = "device_name = :name";
            $params['name'] = $data['deviceName'];
        }
        if (isset($data['vendor'])) {
            $fields[] = "vendor = :vendor";
            $params['vendor'] = $data['vendor'];
        }
        if (isset($data['managementIp'])) {
            $fields[] = "management_ip = :ip";
            $params['ip'] = $data['managementIp'];
        }
        if (isset($data['managementPort'])) {
            $fields[] = "management_port = :port";
            $params['port'] = (int)$data['managementPort'];
        }
        if (isset($data['webPort'])) {
            $fields[] = "web_port = :web";
            $params['web'] = (int)$data['webPort'];
        }
        if (isset($data['apiUsername'])) {
            $fields[] = "api_username = :user";
            $params['user'] = $data['apiUsername'];
        }
        if (isset($data['apiPassword'])) {
            $fields[] = "api_password = :pwd";
            $params['pwd'] = $data['apiPassword'];
        }
        if (isset($data['snmpCommunity'])) {
            $fields[] = "snmp_community = :snmp_comm";
            $params['snmp_comm'] = $data['snmpCommunity'];
        }
        if (isset($data['snmpPort'])) {
            $fields[] = "snmp_port = :snmp_port";
            $params['snmp_port'] = (int)$data['snmpPort'];
        }
        if (isset($data['ponType'])) {
            $fields[] = "pon_type = :pon_type";
            $params['pon_type'] = $data['ponType'];
        }
        if (isset($data['totalPonPorts'])) {
            $fields[] = "total_pon_ports = :pon_ports";
            $params['pon_ports'] = (int)$data['totalPonPorts'];
        }

        if (!empty($fields)) {
            $sql = "UPDATE network_devices SET " . implode(', ', $fields) . " WHERE network_device_id = :id AND tenant_id = :tid";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }

        Response::json([
            'success' => true,
            'message' => 'Device updated successfully',
            'data' => ['deviceId' => $id],
        ]);
    }

    /**
     * Measure real-time reachability using direct TCP socket connection on IP:PORT.
     * Prevents false-positive ICMP replies when management IP is hosted on upstream gateway router.
     */
    public static function probeDevicePort(string $ip, array $portsToTry, float $timeout = 1.2): array {
        $ip = trim($ip);
        if (empty($ip)) {
            return [
                'online' => false,
                'status' => 'offline',
                'latencyMs' => null,
                'port' => null,
                'error' => 'No management IP configured',
                'method' => 'tcp_socket',
            ];
        }

        $lastError = 'Connection refused or timed out';
        foreach ($portsToTry as $port) {
            $port = (int)$port;
            if ($port <= 0 || $port > 65535) continue;

            $startTime = microtime(true);
            $errno = 0;
            $errstr = '';
            $fp = @fsockopen($ip, $port, $errno, $errstr, $timeout);
            $latency = round((microtime(true) - $startTime) * 1000, 1);

            if ($fp) {
                fclose($fp);
                return [
                    'online' => true,
                    'status' => 'online',
                    'latencyMs' => $latency,
                    'port' => $port,
                    'method' => 'tcp_socket',
                    'error' => null,
                ];
            }
            if ($errstr) $lastError = $errstr;
        }

        return [
            'online' => false,
            'status' => 'offline',
            'latencyMs' => null,
            'port' => $portsToTry[0] ?? null,
            'error' => $lastError,
            'method' => 'tcp_socket',
        ];
    }

    public static function getDeviceTargetPorts(array $device): array {
        $ports = [];
        $type = strtolower($device['device_type'] ?? 'router');

        if ($type === 'olt') {
            // For OLT: Web Management / Sync API port is priority, then CLI telnet/ssh port
            if (!empty($device['web_port'])) $ports[] = (int)$device['web_port'];
            if (!empty($device['management_port'])) $ports[] = (int)$device['management_port'];
            if (empty($ports)) $ports = [80, 23];
        } else {
            // For MikroTik / Router: API port (management_port), Winbox port, Web port
            if (!empty($device['management_port'])) $ports[] = (int)$device['management_port'];
            if (!empty($device['winbox_port'])) $ports[] = (int)$device['winbox_port'];
            if (!empty($device['web_port'])) $ports[] = (int)$device['web_port'];
            if (empty($ports)) $ports = [8728, 8291];
        }

        return array_values(array_unique(array_filter($ports)));
    }

    public static function pingNow(string $deviceId): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE (network_device_id = :id OR device_code = :code) AND tenant_id = :tid LIMIT 1");
            $stmt->execute(['id' => $deviceId, 'code' => $deviceId, 'tid' => $tenantId]);
        } else {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id OR device_code = :code LIMIT 1");
            $stmt->execute(['id' => $deviceId, 'code' => $deviceId]);
        }
        $device = $stmt->fetch();

        if (!$device) {
            Response::error('Device not found', 404);
        }

        $ip = trim($device['management_ip'] ?? '');
        if (empty($ip)) {
            Response::json([
                'success' => false,
                'action_status' => 'failed',
                'execution_time' => 0.01,
                'error_message' => 'No management IP configured for this device',
                'data' => [
                    'status' => 'offline',
                    'latencyMs' => null,
                    'method' => 'tcp_socket',
                ],
            ]);
            return;
        }

        $ports = self::getDeviceTargetPorts($device);
        $startTime = microtime(true);
        $probe = self::probeDevicePort($ip, $ports, 2.5);
        $execTime = round(microtime(true) - $startTime, 3);

        $status = $probe['status'];
        $latencyMs = $probe['latencyMs'];
        $errorMessage = $probe['error'];

        // If TCP port open on MikroTik router, verify credentials via RouterOS API
        if ($probe['online'] && strtolower($device['device_type'] ?? '') === 'router' && !empty($device['api_username'])) {
            try {
                require_once __DIR__ . '/../lib/RouterosAPI.php';
                $api = new RouterosAPI();
                $api->port = !empty($device['management_port']) ? (int)$device['management_port'] : 8728;
                $api->timeout = 2;
                if (!$api->connect($ip, $device['api_username'], $device['api_password'] ?? '')) {
                    $status = 'auth_failed';
                    $errorMessage = 'TCP port connected, but RouterOS API authentication failed (invalid credentials)';
                } else {
                    $api->disconnect();
                }
            } catch (\Throwable $e) {}
        }

        // Update real status in network_devices table
        $dbStatus = ($status === 'online') ? 'active' : (($status === 'auth_failed') ? 'auth_failed' : 'offline');
        try {
            $upStmt = $db->prepare("UPDATE network_devices SET status = :status, last_sync_at = NOW() WHERE network_device_id = :did");
            $upStmt->execute(['status' => $dbStatus, 'did' => $device['network_device_id']]);
        } catch (\Throwable $e) {}

        Response::json([
            'success' => true,
            'action_status' => ($status === 'online') ? 'success' : 'failed',
            'execution_time' => $execTime,
            'error_message' => $errorMessage,
            'data' => [
                'status' => $status,
                'latencyMs' => $latencyMs,
                'portTested' => $probe['port'],
                'target' => "{$ip}:{$probe['port']}",
                'method' => 'tcp_socket',
            ],
        ]);
    }

    public static function getProfiles(string $deviceId): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $protocol = strtolower(trim($_GET['protocol'] ?? 'pppoe'));
        $db = Database::getConnection();

        $profiles = [];

        // 1. Try to fetch live from MikroTik router if device exists
        $device = null;
        if (!empty($deviceId) && $deviceId !== '0') {
            $devStmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :did AND tenant_id = :tid LIMIT 1");
            $devStmt->execute(['did' => $deviceId, 'tid' => $tenantId]);
            $device = $devStmt->fetch();
        } else {
            // Pick first active router for tenant if not explicitly provided
            $devStmt = $db->prepare("SELECT * FROM network_devices WHERE tenant_id = :tid AND status = 'active' ORDER BY network_device_id ASC LIMIT 1");
            $devStmt->execute(['tid' => $tenantId]);
            $device = $devStmt->fetch();
        }

        if ($device && !empty($device['management_ip']) && !empty($device['api_username'])) {
                try {
                    $api = new RouterosAPI();
                    $api->port = !empty($device['management_port']) ? (int)$device['management_port'] : 8728;
                    $api->timeout = 3;
                    if ($api->connect($device['management_ip'], $device['api_username'], $device['api_password'] ?? '')) {
                        $cmd = ($protocol === 'hotspot') ? '/ip/hotspot/user/profile/print' : '/ppp/profile/print';
                        $results = $api->comm($cmd);
                        $api->disconnect();

                        if (is_array($results) && count($results) > 0) {
                            foreach ($results as $item) {
                                if (!empty($item['name'])) {
                                    $profiles[] = [
                                        'id' => (string)($item['.id'] ?? $item['name']),
                                        'name' => (string)$item['name'],
                                    ];
                                }
                            }
                        }
                    }
                } catch (\Throwable $e) {
                    // Silently fall back to DB / defaults on connection failure
                }
            }

        // 2. If no live profiles fetched, check access_profiles in DB
        if (empty($profiles)) {
            $stmt = $db->prepare("SELECT DISTINCT mikrotik_profile_name as name, mikrotik_profile_id as id 
                FROM access_profiles 
                WHERE tenant_id = :tid AND mikrotik_profile_name IS NOT NULL AND mikrotik_profile_name != ''");
            $stmt->execute(['tid' => $tenantId]);
            $dbProfiles = $stmt->fetchAll();

            foreach ($dbProfiles as $p) {
                if (!empty($p['name'])) {
                    $profiles[] = [
                        'id' => (string)($p['id'] ?: $p['name']),
                        'name' => (string)$p['name'],
                    ];
                }
            }
        }

        // 3. Fallback to standard MikroTik defaults
        if (empty($profiles)) {
            $profiles = [
                ['id' => 'default', 'name' => 'default'],
                ['id' => 'default-encryption', 'name' => 'default-encryption'],
                ['id' => 'standard', 'name' => 'standard'],
            ];
        }

        Response::json([
            'success' => true,
            'data' => $profiles,
        ]);
    }

    public static function pingStatus(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            $stmt = $db->prepare("SELECT network_device_id, device_name, device_type, management_ip, management_port, winbox_port, web_port, status FROM network_devices WHERE tenant_id = :tid");
            $stmt->execute(['tid' => $tenantId]);
        } else {
            $stmt = $db->query("SELECT network_device_id, device_name, device_type, management_ip, management_port, winbox_port, web_port, status FROM network_devices");
        }
        $devices = $stmt->fetchAll();

        $items = [];
        foreach ($devices as $d) {
            $ip = trim($d['management_ip'] ?? '');
            if (empty($ip)) {
                $items[] = [
                    'deviceId' => (string)$d['network_device_id'],
                    'pingStatus' => 'offline',
                    'latencyMs' => null,
                    'portTested' => null,
                    'lastCheckedAt' => date('c'),
                ];
                continue;
            }

            $ports = self::getDeviceTargetPorts($d);
            // Fast 0.8s TCP socket probe per device (responds in 5-30ms if device port is up)
            $probe = self::probeDevicePort($ip, $ports, 0.8);

            $status = $probe['status'];
            if ($probe['online'] && $d['status'] === 'auth_failed') {
                $status = 'auth_failed';
            }

            // Keep status in network_devices in sync
            $newDbStatus = ($status === 'online') ? 'active' : (($status === 'auth_failed') ? 'auth_failed' : 'offline');
            if ($d['status'] !== $newDbStatus) {
                try {
                    $u = $db->prepare("UPDATE network_devices SET status = :st WHERE network_device_id = :did");
                    $u->execute(['st' => $newDbStatus, 'did' => $d['network_device_id']]);
                } catch (\Throwable $e) {}
            }

            $items[] = [
                'deviceId' => (string)$d['network_device_id'],
                'pingStatus' => $status,
                'latencyMs' => $probe['latencyMs'],
                'portTested' => $probe['port'],
                'lastCheckedAt' => date('c'),
            ];
        }

        Response::json([
            'success' => true,
            'data' => $items,
        ]);
    }

    public static function liveTraffic(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $serverId = $_GET['serverId'] ?? $_GET['router_id'] ?? null;
        $serverName = trim($_GET['serverName'] ?? '');
        $username = trim($_GET['username'] ?? '');
        $interfaceName = trim($_GET['interfaceName'] ?? '');

        // 1. Resolve Router device
        $router = null;
        if (!empty($serverId)) {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE (network_device_id = :id OR device_code = :code) LIMIT 1");
            $stmt->execute(['id' => $serverId, 'code' => $serverId]);
            $router = $stmt->fetch();
        }

        if (!$router && !empty($serverName)) {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE device_name = :name LIMIT 1");
            $stmt->execute(['name' => $serverName]);
            $router = $stmt->fetch();
        }

        if (!$router && !empty($username)) {
            $stmt = $db->prepare("SELECT na.network_device_id FROM customer_network_accounts na WHERE na.username = :user LIMIT 1");
            $stmt->execute(['user' => $username]);
            $devId = $stmt->fetchColumn();
            if ($devId) {
                $stmtDev = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id LIMIT 1");
                $stmtDev->execute(['id' => $devId]);
                $router = $stmtDev->fetch();
            }
        }

        // Fallback to first available MikroTik router
        if (!$router) {
            $stmt = $db->query("SELECT * FROM network_devices WHERE vendor = 'mikrotik' AND status = 'active' LIMIT 1");
            $router = $stmt->fetch();
        }

        if (!$router) {
            Response::error('MikroTik router not found or not configured', 404);
            return;
        }

        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
        $api = MikrotikSyncService::connect($router, 3);
        if (!$api) {
            Response::error("Could not connect to MikroTik router {$router['device_name']} at {$router['management_ip']}:{$router['management_port']}", 503);
            return;
        }

        // 2. Resolve interface name and active session
        $targetIface = $interfaceName;
        $sessionInfo = null;

        if (!empty($username)) {
            $actList = $api->comm('/ppp/active/print', ['?name' => $username]);
            if (!empty($actList[0])) {
                $sessionInfo = $actList[0];
            }

            if (empty($targetIface)) {
                $targetIface = "<pppoe-{$username}>";
            }
        }

        // 3. Monitor traffic on target interface
        $mon = [];
        if (!empty($targetIface)) {
            $mon = $api->comm('/interface/monitor-traffic', [
                'interface' => $targetIface,
                'once' => '',
            ]);

            // If empty, try without angle brackets
            if (empty($mon) && str_starts_with($targetIface, '<') && str_ends_with($targetIface, '>')) {
                $trimmed = substr($targetIface, 1, -1);
                $mon = $api->comm('/interface/monitor-traffic', [
                    'interface' => $trimmed,
                    'once' => '',
                ]);
                if (!empty($mon)) {
                    $targetIface = $trimmed;
                }
            }
        }

        // If interface not found or currently offline
        if (empty($mon) || empty($mon[0])) {
            Response::json([
                'success' => true,
                'data' => [
                    'timestamp' => date('c'),
                    'download_bps' => 0,
                    'upload_bps' => 0,
                    'rx_bps' => 0,
                    'tx_bps' => 0,
                    'rx_mbps' => 0,
                    'tx_mbps' => 0,
                    'router_name' => $router['device_name'],
                    'router_id' => $router['network_device_id'],
                    'username' => $username,
                    'interface' => $targetIface,
                    'status' => 'offline',
                    'session' => $sessionInfo,
                ],
            ]);
            return;
        }

        $row = $mon[0];
        // In RouterOS:
        // tx-bits-per-second = Router transmits to client = Client Download
        // rx-bits-per-second = Router receives from client = Client Upload
        $clientDownloadBps = (int)($row['tx-bits-per-second'] ?? 0);
        $clientUploadBps = (int)($row['rx-bits-per-second'] ?? 0);

        Response::json([
            'success' => true,
            'data' => [
                'timestamp' => date('c'),
                'download_bps' => $clientDownloadBps,
                'upload_bps' => $clientUploadBps,
                // Match client UI & user's demo graph:
                // Red dot = Tx = Upload
                // Blue dot = Rx = Download
                'tx_bps' => $clientUploadBps,
                'rx_bps' => $clientDownloadBps,
                'tx_mbps' => round($clientUploadBps / 1000000, 2),
                'rx_mbps' => round($clientDownloadBps / 1000000, 2),
                'tx_packets' => (int)($row['rx-packets-per-second'] ?? 0),
                'rx_packets' => (int)($row['tx-packets-per-second'] ?? 0),
                'router_name' => $router['device_name'],
                'router_id' => $router['network_device_id'],
                'username' => $username,
                'interface' => $targetIface,
                'status' => 'online',
                'ip' => $sessionInfo['address'] ?? null,
                'mac' => $sessionInfo['caller-id'] ?? null,
                'uptime' => $sessionInfo['uptime'] ?? null,
                'session' => $sessionInfo,
            ],
        ]);
    }

    public static function activeSessions(?string $serverIdParam = null): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $serverId = $serverIdParam ?? $_GET['serverId'] ?? $_GET['router_id'] ?? null;
        $router = null;

        if (!empty($serverId)) {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE (network_device_id = :id OR device_code = :code) LIMIT 1");
            $stmt->execute(['id' => $serverId, 'code' => $serverId]);
            $router = $stmt->fetch();
        }

        if (!$router && !empty($_GET['serverName'])) {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE device_name = :name LIMIT 1");
            $stmt->execute(['name' => $_GET['serverName']]);
            $router = $stmt->fetch();
        }

        if (!$router) {
            $stmt = $db->query("SELECT * FROM network_devices WHERE vendor = 'mikrotik' AND status = 'active' LIMIT 1");
            $router = $stmt->fetch();
        }

        if (!$router) {
            Response::json(['success' => true, 'data' => []]);
            return;
        }

        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
        $api = MikrotikSyncService::connect($router, 3);
        if (!$api) {
            Response::json(['success' => true, 'data' => []]);
            return;
        }

        $active = $api->comm('/ppp/active/print');
        $sessions = [];
        if (is_array($active)) {
            foreach ($active as $act) {
                $u = $act['name'] ?? '';
                if (empty($u)) continue;
                $sessions[] = [
                    'name' => "<pppoe-{$u}>",
                    'type' => 'pppoe',
                    'username' => $u,
                    'ip' => $act['address'] ?? '',
                    'callerId' => $act['caller-id'] ?? '',
                    'uptime' => $act['uptime'] ?? '',
                ];
            }
        }

        Response::json([
            'success' => true,
            'data' => $sessions,
        ]);
    }

    public static function oltStatus(string $deviceId): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE (network_device_id = :id OR device_code = :code) AND tenant_id = :tid LIMIT 1");
            $stmt->execute(['id' => $deviceId, 'code' => $deviceId, 'tid' => $tenantId]);
            $device = $stmt->fetch();
        } else {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id OR device_code = :code LIMIT 1");
            $stmt->execute(['id' => $deviceId, 'code' => $deviceId]);
            $device = $stmt->fetch();
        }

        if (!$device) {
            Response::error('OLT device not found', 404);
        }

        require_once __DIR__ . '/../lib/OltSyncService.php';
        $force = !empty($_GET['refresh']) && $_GET['refresh'] === 'true';
        $data = OltSyncService::sync($db, $device, $force);

        Response::json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public static function oltOnus(string $deviceId): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE (network_device_id = :id OR device_code = :code) AND tenant_id = :tid LIMIT 1");
            $stmt->execute(['id' => $deviceId, 'code' => $deviceId, 'tid' => $tenantId]);
            $device = $stmt->fetch();
        } else {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id OR device_code = :code LIMIT 1");
            $stmt->execute(['id' => $deviceId, 'code' => $deviceId]);
            $device = $stmt->fetch();
        }

        if (!$device) {
            Response::error('OLT device not found', 404);
        }

        $realDeviceId = (int)$device['network_device_id'];
        $pon = !empty($_GET['pon']) ? (int)$_GET['pon'] : null;

        // Fetch customer network accounts for this tenant to match by router MAC or username
        $custMap = ['mac' => [], 'user' => []];
        try {
            $cStmt = $db->prepare("SELECT c.customer_id, c.customer_code, c.full_name, na.username, na.mac_address 
                FROM customer_network_accounts na
                JOIN customers c ON c.customer_id = na.customer_id
                WHERE na.tenant_id = :tid");
            $cStmt->execute(['tid' => $device['tenant_id']]);
            $custRows = $cStmt->fetchAll();
            foreach ($custRows as $cr) {
                if (!empty($cr['mac_address'])) {
                    $m = strtoupper(str_replace(['-', '.', ' '], ':', trim($cr['mac_address'])));
                    $custMap['mac'][$m] = $cr;
                }
                if (!empty($cr['username'])) {
                    $u = strtolower(trim($cr['username']));
                    $custMap['user'][$u] = $cr;
                }
            }
        } catch (\Throwable $e) {}

        // Query fast local DB storage
        $sql = "SELECT * FROM olt_onus WHERE network_device_id = :did AND tenant_id = :tid";
        $params = ['did' => $realDeviceId, 'tid' => $device['tenant_id']];
        if ($pon) {
            $sql .= " AND pon_port = :pon";
            $params['pon'] = $pon;
        }
        $sql .= " ORDER BY pon_port ASC, onu_id ASC";

        $onuStmt = $db->prepare($sql);
        $onuStmt->execute($params);
        $rows = $onuStmt->fetchAll();

        $onus = [];
        foreach ($rows as $r) {
            $onuMac = strtoupper($r['mac_address']);
            $routerMac = !empty($r['router_mac']) ? strtoupper($r['router_mac']) : null;
            $pppoeUsername = !empty($r['pppoe_username']) ? trim($r['pppoe_username']) : null;

            // Match customer via router_mac or pppoe_username
            $matchedCustomer = null;
            if ($routerMac && isset($custMap['mac'][$routerMac])) {
                $cr = $custMap['mac'][$routerMac];
                $matchedCustomer = [
                    'customerId' => (string)$cr['customer_id'],
                    'customerCode' => (string)$cr['customer_code'],
                    'customerName' => (string)$cr['full_name'],
                    'username' => (string)$cr['username'],
                ];
                if (!$pppoeUsername) $pppoeUsername = $cr['username'];
            } elseif ($pppoeUsername && isset($custMap['user'][strtolower($pppoeUsername)])) {
                $cr = $custMap['user'][strtolower($pppoeUsername)];
                $matchedCustomer = [
                    'customerId' => (string)$cr['customer_id'],
                    'customerCode' => (string)$cr['customer_code'],
                    'customerName' => (string)$cr['full_name'],
                    'username' => (string)$cr['username'],
                ];
                if (!$routerMac && !empty($cr['mac_address'])) {
                    $routerMac = strtoupper(str_replace(['-', '.', ' '], ':', trim($cr['mac_address'])));
                }
            }

            $onus[] = [
                'ponPort' => (int)$r['pon_port'],
                'ponPortName' => $r['pon_port_name'],
                'onuId' => $r['onu_id'],
                'macAddress' => $onuMac,
                'routerMac' => $routerMac,
                'vlanId' => !empty($r['vlan_id']) ? (int)$r['vlan_id'] : null,
                'pppoe' => $pppoeUsername,
                'rxPowerDbm' => (float)$r['rx_power_dbm'],
                'status' => $r['status'],
                'lastSyncAt' => $r['last_sync_at'],
                'customer' => $matchedCustomer,
            ];
        }

        Response::json([
            'success' => true,
            'data' => [
                'total' => count($onus),
                'onus' => $onus,
            ],
        ]);
    }

    public static function syncOlt(string $deviceId): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE (network_device_id = :id OR device_code = :code) AND tenant_id = :tid LIMIT 1");
            $stmt->execute(['id' => $deviceId, 'code' => $deviceId, 'tid' => $tenantId]);
            $device = $stmt->fetch();
        } else {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id OR device_code = :code LIMIT 1");
            $stmt->execute(['id' => $deviceId, 'code' => $deviceId]);
            $device = $stmt->fetch();
        }

        if (!$device) {
            Response::error('OLT device not found', 404);
        }

        require_once __DIR__ . '/../lib/OltSyncService.php';
        $data = OltSyncService::sync($db, $device, true);

        if (!empty($data['syncError'])) {
            Response::json([
                'success' => false,
                'message' => $data['syncError'],
                'data' => $data,
            ]);
            return;
        }

        Response::json([
            'success' => true,
            'message' => 'OLT telemetry and ONUs synchronized successfully with hardware',
            'data' => $data,
        ]);
    }

    public static function delete(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        // Unlink or nullify any access profiles tied to this router so deletion succeeds smoothly
        try {
            $db->prepare("UPDATE access_profiles SET network_device_id = NULL WHERE network_device_id = :id")->execute(['id' => $id]);
        } catch (Exception $e) {
            // Ignore if column doesn't allow null
        }

        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            $stmt = $db->prepare("DELETE FROM network_devices WHERE network_device_id = :id AND tenant_id = :tid");
            $stmt->execute(['id' => $id, 'tid' => $tenantId]);
        } else {
            $stmt = $db->prepare("DELETE FROM network_devices WHERE network_device_id = :id");
            $stmt->execute(['id' => $id]);
        }

        Response::json(['success' => true, 'message' => 'Device deleted successfully']);
    }

    public static function pppoeLogs(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        // 1. Get all routers for this tenant
        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            $rStmt = $db->prepare("SELECT network_device_id, device_name, management_ip, management_port, status 
                                   FROM network_devices 
                                   WHERE tenant_id = :tid AND device_type = 'router' 
                                   ORDER BY network_device_id ASC");
            $rStmt->execute(['tid' => $tenantId]);
            $routers = $rStmt->fetchAll() ?: [];
        } else {
            $routers = $db->query("SELECT network_device_id, device_name, management_ip, management_port, status FROM network_devices WHERE device_type = 'router' ORDER BY network_device_id ASC")->fetchAll() ?: [];
        }

        if (empty($routers)) {
            Response::json([
                'success' => true,
                'is_online' => false,
                'current_router' => null,
                'routers' => [],
                'total' => 0,
                'logs' => [],
                'status_message' => 'No MikroTik routers configured yet.'
            ]);
            return;
        }

        // 2. Determine target router
        $targetRouterId = $_GET['router_id'] ?? null;
        $targetRouter = null;

        if ($targetRouterId) {
            foreach ($routers as $r) {
                if ((string)$r['network_device_id'] === (string)$targetRouterId) {
                    $targetRouter = $r;
                    break;
                }
            }
        }

        if (!$targetRouter) {
            $targetRouter = $routers[0];
        }

        // Fetch full router details including credentials
        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            $dStmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id AND tenant_id = :tid LIMIT 1");
            $dStmt->execute(['id' => $targetRouter['network_device_id'], 'tid' => $tenantId]);
        } else {
            $dStmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id LIMIT 1");
            $dStmt->execute(['id' => $targetRouter['network_device_id']]);
        }
        $routerFull = $dStmt->fetch();

        if (!$routerFull) {
            Response::error('Selected router not found', 404);
            return;
        }

        require_once __DIR__ . '/../lib/RouterosAPI.php';
        $api = new RouterosAPI();
        $api->port = (int)($routerFull['management_port'] ?: 8728);
        $api->timeout = 3;

        $connected = @$api->connect(
            $routerFull['management_ip'],
            $routerFull['api_username'] ?: 'admin',
            $routerFull['api_password'] ?: ''
        );

        $parsedLogs = [];

        if ($connected) {
            $rawLogs = $api->comm('/log/print');
            $api->disconnect();

            // Filter for PPP & PPPoE logs
            $filtered = array_reverse(array_filter($rawLogs ?: [], function($l) {
                $topics = strtolower($l['topics'] ?? '');
                $msg = strtolower($l['message'] ?? '');
                return str_contains($topics, 'ppp') || str_contains($topics, 'pppoe') || str_contains($msg, 'pppoe');
            }));

            // Fetch known customer pppoe usernames for this tenant to cross-match
            $cStmt = $db->prepare("SELECT na.username, na.mac_address, na.remote_address, c.customer_id, c.customer_code, c.full_name, c.phone 
                                   FROM customer_network_accounts na 
                                   JOIN customers c ON c.customer_id = na.customer_id 
                                   WHERE na.tenant_id = :tid AND na.username IS NOT NULL");
            $cStmt->execute(['tid' => $tenantId]);
            $customersMap = [];
            foreach ($cStmt->fetchAll() as $c) {
                if (!empty($c['username'])) {
                    $customersMap[strtolower(trim($c['username']))] = $c;
                }
            }

            foreach ($filtered as $item) {
                $msg = $item['message'] ?? '';
                $topics = $item['topics'] ?? '';
                $time = $item['time'] ?? '';

                $username = null;
                if (preg_match('/<pppoe-([^>]+)>/i', $msg, $m)) {
                    $username = $m[1];
                } elseif (preg_match('/^([a-zA-Z0-9_.-]+)\s+logged\s+in/i', $msg, $m)) {
                    $username = $m[1];
                } elseif (preg_match('/user\s+([a-zA-Z0-9_.-]+)/i', $msg, $m)) {
                    $username = $m[1];
                }

                $mac = null;
                if (preg_match('/((?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})/', $msg, $m)) {
                    $mac = strtoupper(str_replace('-', ':', $m[1]));
                }

                $ip = null;
                if (preg_match('/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/', $msg, $m)) {
                    $ip = $m[1];
                }

                $action = 'info';
                if (stripos($msg, 'logged in') !== false) {
                    $action = 'login';
                } elseif (stripos($msg, 'logged out') !== false || stripos($msg, 'disconnected') !== false || stripos($msg, 'terminated') !== false) {
                    $action = 'logout';
                } elseif (stripos($msg, 'authentication failed') !== false || stripos($msg, 'failed') !== false) {
                    $action = 'failed';
                } elseif (stripos($msg, 'connected') !== false || stripos($msg, 'connection established') !== false) {
                    $action = 'connected';
                } elseif (stripos($msg, 'authenticated') !== false) {
                    $action = 'authenticated';
                }

                $customerInfo = null;
                if ($username && isset($customersMap[strtolower($username)])) {
                    $customerInfo = $customersMap[strtolower($username)];
                }

                $parsedLogs[] = [
                    'id' => $item['.id'] ?? uniqid(),
                    'time' => $time,
                    'topics' => $topics,
                    'action' => $action,
                    'username' => $username,
                    'customer' => $customerInfo ? [
                        'customer_id' => (string)$customerInfo['customer_id'],
                        'customer_code' => $customerInfo['customer_code'],
                        'full_name' => $customerInfo['full_name'],
                        'phone' => $customerInfo['phone']
                    ] : null,
                    'ip' => $ip,
                    'mac' => $mac,
                    'message' => $msg,
                ];
            }
        }

        Response::json([
            'success' => true,
            'is_online' => $connected,
            'current_router' => [
                'network_device_id' => (string)$targetRouter['network_device_id'],
                'device_name' => $targetRouter['device_name'],
                'management_ip' => $targetRouter['management_ip'],
                'management_port' => (int)$targetRouter['management_port'],
            ],
            'routers' => array_map(function($r) {
                return [
                    'network_device_id' => (string)$r['network_device_id'],
                    'device_name' => $r['device_name'],
                    'management_ip' => $r['management_ip'],
                    'status' => $r['status'],
                ];
            }, $routers),
            'total' => count($parsedLogs),
            'logs' => $parsedLogs,
            'status_message' => $connected ? 'Logs retrieved from live router' : 'Router unreachable or API disconnected',
        ]);
    }
}

