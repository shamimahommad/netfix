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
    public static function requireAdminOrCompanyRole(array $user): void {
        $role = strtolower(trim($user['role'] ?? ''));
        $allowed = ['saas_admin', 'admin', 'manager', 'isp_admin', 'tenant_admin', 'super_admin'];
        if (!in_array($role, $allowed, true)) {
            Response::error('Access denied. Network and system management is restricted to ISP administrators only.', 403);
            exit;
        }
    }

    public static function index(): void {
        $user = AuthMiddleware::requireAuth();
        self::requireAdminOrCompanyRole($user);
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
                $where[] = "(device_type = 'olt' OR vendor = 'olt' OR vendor IN ('vsol', 'bdcom', 'huawei', 'zte', 'cdata', 'syrotech', 'focuscom', 'btpon', 'tbs', 'ip-com', 'atop'))";
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
            'devices' => $devices,
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
            $where[] = "(device_type = 'olt' OR vendor IN ('olt', 'vsol', 'bdcom', 'huawei', 'zte', 'cdata', 'syrotech', 'focuscom', 'btpon', 'tbs', 'ip-com', 'atop'))";
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
            $vendor = strtolower(trim($device['vendor'] ?? ''));
            if ($vendor === 'bdcom') {
                // For BDCOM OLT: Check Web port (e.g. 2321 / 80) and Telnet CLI port (e.g. 23 / 1081)
                if (!empty($device['web_port'])) $ports[] = (int)$device['web_port'];
                if (!empty($device['management_port'])) $ports[] = (int)$device['management_port'];
                if (empty($ports)) $ports = [2321, 23, 1081, 80];
            } else {
                // For Web API OLTs (VSOL, BTPON, Focuscom): Web API port is priority
                if (!empty($device['web_port'])) $ports[] = (int)$device['web_port'];
                if (!empty($device['management_port'])) $ports[] = (int)$device['management_port'];
                if (empty($ports)) $ports = [80, 23];
            }
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

        // If TCP port open on MikroTik router, verify credentials via RouterOS API or REST
        if ($probe['online'] && strtolower($device['device_type'] ?? '') === 'router' && !empty($device['api_username'])) {
            try {
                require_once __DIR__ . '/../lib/MikrotikSyncService.php';
                $api = MikrotikSyncService::connect($device, 2);
                if (!$api) {
                    $status = 'auth_failed';
                    $errorMessage = 'TCP port connected, but authentication failed (invalid credentials or service disabled)';
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

    public static function testConnection(): void {
        $user = AuthMiddleware::requireAuth();
        self::requireAdminOrCompanyRole($user);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $testType = strtolower(trim($input['testType'] ?? 'ping'));
        $deviceType = strtolower(trim($input['deviceType'] ?? 'router'));
        $vendor = strtolower(trim($input['vendor'] ?? ($deviceType === 'router' ? 'mikrotik' : 'vsol')));
        $rawIp = trim($input['managementIp'] ?? '');
        $username = trim($input['apiUsername'] ?? '');
        $password = (string)($input['apiPassword'] ?? '');

        // Sanitize IP: strip http://, https://, and trailing slashes
        $ip = preg_replace('#^https?://#i', '', $rawIp);
        $ip = rtrim($ip, '/');

        if (empty($ip)) {
            Response::error('Management IP address is required for testing', 400);
            return;
        }

        $managementPort = !empty($input['managementPort']) ? (int)$input['managementPort'] : null;
        $webPort = !empty($input['webPort']) ? (int)$input['webPort'] : null;
        $winboxPort = !empty($input['winboxPort']) ? (int)$input['winboxPort'] : null;
        $useSsl = !empty($input['useSsl']) || ($managementPort === 8729);
        if ($useSsl && empty($managementPort)) {
            $managementPort = 8729;
        }

        // ==========================================
        // 1. PING TEST
        // ==========================================
        if ($testType === 'ping') {
            $ports = [];
            if ($deviceType === 'router' || $vendor === 'mikrotik') {
                if ($managementPort) $ports[] = $managementPort;
                if ($webPort) $ports[] = $webPort;
                if ($winboxPort) $ports[] = $winboxPort;
                if (empty($ports)) $ports = $useSsl ? [8729, 8291, 50000, 80] : [8728, 8729, 50000, 80, 8291];
            } else {
                if ($vendor === 'bdcom') {
                    if ($webPort) $ports[] = $webPort;
                    if ($managementPort) $ports[] = $managementPort;
                    if (empty($ports)) $ports = [2321, 23, 1081, 80];
                } else {
                    if ($webPort) $ports[] = $webPort;
                    if ($managementPort) $ports[] = $managementPort;
                    if (empty($ports)) {
                        $def = ($vendor === 'btpon') ? 16148 : (($vendor === 'focuscom') ? 2322 : 80);
                        $ports = [$def, 80, 23];
                    }
                }
            }

            $probe = self::probeDevicePort($ip, $ports, 2.5);

            if ($probe['online']) {
                Response::json([
                    'success' => true,
                    'status' => 'online',
                    'latencyMs' => $probe['latencyMs'],
                    'port' => $probe['port'],
                    'message' => "PING Success! Device reached at {$ip}:{$probe['port']} in {$probe['latencyMs']} ms.",
                ]);
                return;
            } else {
                Response::json([
                    'success' => false,
                    'status' => 'offline',
                    'latencyMs' => null,
                    'message' => "PING Failed: Host at {$ip} is not responding on checked ports (" . implode(', ', $ports) . ").",
                    'error' => $probe['error'] ?? 'Connection timed out',
                ]);
                return;
            }
        }

        // ==========================================
        // 2. LOGIN TEST
        // ==========================================
        if ($testType === 'login') {
            if (empty($username)) {
                Response::error('Username is required for login test', 400);
                return;
            }

            try {
                if ($deviceType === 'router' || $vendor === 'mikrotik') {
                    $apiType = strtolower(trim($input['apiType'] ?? ''));
                    $isRest = ($apiType === 'rest' || $managementPort === 50000 || $managementPort === 80 || $managementPort === 443 || ($webPort > 0 && ($managementPort === $webPort || $managementPort === 0)));

                    if ($isRest) {
                        require_once __DIR__ . '/../lib/MikrotikRestClient.php';
                        $targetPort = ($managementPort && $managementPort !== 8728 && $managementPort !== 8729) ? $managementPort : ($webPort ?: 80);
                        $restClient = new MikrotikRestClient();
                        $restClient->timeout = 5;
                        if ($restClient->connect($ip, $username, $password, $targetPort)) {
                            $identity = 'MikroTik';
                            $idRes = $restClient->comm('/system/identity/print');
                            if (!empty($idRes[0]['name'])) $identity = $idRes[0]['name'];

                            $version = '';
                            $board = '';
                            $res = $restClient->comm('/system/resource/print');
                            if (!empty($res[0]['version'])) $version = $res[0]['version'];
                            if (!empty($res[0]['board-name'])) $board = $res[0]['board-name'];
                            $restClient->disconnect();

                            $details = [];
                            if ($version) $details[] = "v{$version}";
                            if ($board) $details[] = $board;
                            $detailStr = !empty($details) ? ' (' . implode(', ', $details) . ')' : '';

                            Response::json([
                                'success' => true,
                                'status' => 'authenticated',
                                'message' => "Login Successful via REST API (port {$targetPort})! Connected to '{$identity}'{$detailStr}.",
                                'data' => [
                                    'identity' => $identity,
                                    'version' => $version,
                                    'board' => $board,
                                    'protocol' => 'REST / www',
                                ],
                            ]);
                            return;
                        } else {
                            Response::json([
                                'success' => false,
                                'status' => 'auth_failed',
                                'message' => "REST API Login Failed on port {$targetPort}! " . ($restClient->error_str ?: 'Please verify username, password, or Web service.'),
                            ]);
                            return;
                        }
                    }

                    // Otherwise try standard binary RouterosAPI
                    require_once __DIR__ . '/../lib/RouterosAPI.php';
                    $api = new RouterosAPI();
                    $api->port = $managementPort ?: ($useSsl ? 8729 : 8728);
                    $api->ssl = $useSsl || ($api->port === 8729);
                    $api->timeout = 3;

                    $connected = @$api->connect($ip, $username, $password);
                    if ($connected) {
                        $identity = 'MikroTik';
                        try {
                            $idRes = $api->comm('/system/identity/print');
                            if (!empty($idRes[0]['name'])) $identity = $idRes[0]['name'];
                        } catch (\Throwable $e) {}

                        $version = '';
                        $board = '';
                        try {
                            $res = $api->comm('/system/resource/print');
                            if (!empty($res[0]['version'])) $version = $res[0]['version'];
                            if (!empty($res[0]['board-name'])) $board = $res[0]['board-name'];
                        } catch (\Throwable $e) {}

                        $api->disconnect();

                        $details = [];
                        if ($version) $details[] = "v{$version}";
                        if ($board) $details[] = $board;
                        $detailStr = !empty($details) ? ' (' . implode(', ', $details) . ')' : '';

                        Response::json([
                            'success' => true,
                            'status' => 'authenticated',
                            'message' => "Login Successful! Connected to '{$identity}'{$detailStr}.",
                            'data' => [
                                'identity' => $identity,
                                'version' => $version,
                                'board' => $board,
                            ],
                        ]);
                        return;
                    }

                    // Automatic Fallback: If binary API failed, check if webPort is set (e.g. 50000 or 80) and try REST API!
                    if ($webPort > 0) {
                        require_once __DIR__ . '/../lib/MikrotikRestClient.php';
                        $restClient = new MikrotikRestClient();
                        $restClient->timeout = 5;
                        if ($restClient->connect($ip, $username, $password, $webPort)) {
                            $identity = 'MikroTik';
                            $idRes = $restClient->comm('/system/identity/print');
                            if (!empty($idRes[0]['name'])) $identity = $idRes[0]['name'];

                            $version = '';
                            $board = '';
                            $res = $restClient->comm('/system/resource/print');
                            if (!empty($res[0]['version'])) $version = $res[0]['version'];
                            if (!empty($res[0]['board-name'])) $board = $res[0]['board-name'];
                            $restClient->disconnect();

                            $details = [];
                            if ($version) $details[] = "v{$version}";
                            if ($board) $details[] = $board;
                            $detailStr = !empty($details) ? ' (' . implode(', ', $details) . ')' : '';

                            Response::json([
                                'success' => true,
                                'status' => 'authenticated',
                                'message' => "Login Successful via REST API (port {$webPort})! Connected to '{$identity}'{$detailStr}.",
                                'data' => [
                                    'identity' => $identity,
                                    'version' => $version,
                                    'board' => $board,
                                    'protocol' => 'REST / www',
                                ],
                            ]);
                            return;
                        }
                    }

                    Response::json([
                        'success' => false,
                        'status' => 'auth_failed',
                        'message' => "Login Failed! Unable to authenticate on port {$api->port}. Check username/password or verify RouterOS API/Web service is enabled.",
                    ]);
                    return;
                } else {
                    // OLT Login test
                    if ($vendor === 'bdcom') {
                        require_once __DIR__ . '/../lib/BdcomOltClient.php';
                        require_once __DIR__ . '/../lib/BdcomWebOltClient.php';

                        $webP = (int)($webPort ?: 0);
                        $cliP = (int)($managementPort ?: 0);

                        // If webPort is specified (e.g. 2321, 80, 8080) or if managementPort is a web port:
                        // Web mode testing:
                        if ($webP > 0 || $cliP === 2321 || $cliP === 80 || $cliP === 8080) {
                            $targetWebPort = $webP ?: ($cliP ?: 2321);
                            $webClient = new BdcomWebOltClient($ip, $targetWebPort, $username, $password, 'http', 8);
                            if ($webClient->login()) {
                                $sys = $webClient->getSystemInfo(4);
                                $model = $sys['model'] ?? 'BDCOM OLT';
                                Response::json([
                                    'success' => true,
                                    'status' => 'authenticated',
                                    'message' => "Login Successful! Connected to {$model} via BDCOM Web Management (port {$targetWebPort}).",
                                    'data' => [
                                        'model' => $model,
                                        'protocol' => 'BDCOM Web Management',
                                        'serial' => $sys['serial'] ?? '',
                                        'firmware' => $sys['firmware'] ?? '',
                                        'hardware' => $sys['hardware'] ?? '',
                                    ],
                                ]);
                                return;
                            } else {
                                Response::json([
                                    'success' => false,
                                    'status' => 'auth_failed',
                                    'message' => "Login Failed! Could not authenticate to BDCOM OLT Web Management on port {$targetWebPort}. Verify web username, password, or port.",
                                ]);
                                return;
                            }
                        }

                        // Telnet CLI mode testing:
                        $targetCliPort = ($cliP && $cliP !== 2321) ? $cliP : 23;
                        $cliClient = new BdcomOltClient($ip, $targetCliPort, $username, $password, 'telnet', 6);
                        $ok = @$cliClient->login();
                        if ($ok) {
                            $sys = $cliClient->getSystemInfo(4);
                            $cliClient->disconnect();
                            $model = $sys['model'] ?? 'BDCOM OLT';
                            Response::json([
                                'success' => true,
                                'status' => 'authenticated',
                                'message' => "Login Successful! Connected to {$model} via BDCOM Telnet CLI (port {$targetCliPort}).",
                                'data' => [
                                    'model' => $model,
                                    'protocol' => 'Telnet CLI',
                                    'serial' => $sys['serial'] ?? '',
                                    'firmware' => $sys['firmware'] ?? '',
                                ],
                            ]);
                            return;
                        } else {
                            Response::json([
                                'success' => false,
                                'status' => 'auth_failed',
                                'message' => "Login Failed! Could not connect or authenticate to BDCOM OLT via Telnet on port {$targetCliPort}. Verify CLI credentials, or switch to Web mode if Telnet is disabled.",
                            ]);
                            return;
                        }
                    } elseif (in_array($vendor, ['btpon', 'tbs', 'ip-com', 'ipcom'])) {
                        require_once __DIR__ . '/../lib/BtponOltClient.php';
                        $port = $webPort ?: ($managementPort ?: 16148);
                        $client = new BtponOltClient($ip, $port, $username, $password, 'http', 6);
                        $ok = @$client->login();
                        if ($ok) {
                            $sys = $client->getSystemInfo(8);
                            $model = $sys['model'] ?? 'BTPON EPON-OLT';
                            Response::json([
                                'success' => true,
                                'status' => 'authenticated',
                                'message' => "Login Successful! Connected to {$model} via Web Engine.",
                                'data' => ['model' => $model],
                            ]);
                            return;
                        } else {
                            Response::json([
                                'success' => false,
                                'status' => 'auth_failed',
                                'message' => "Login Failed! Could not authenticate with BTPON OLT Web API on port {$port}.",
                            ]);
                            return;
                        }
                    } elseif ($vendor === 'focuscom') {
                        require_once __DIR__ . '/../lib/FocuscomOltClient.php';
                        $port = $webPort ?: ($managementPort ?: 2322);
                        $client = new FocuscomOltClient($ip, $port, $username, $password, 'http', 6);
                        $ok = @$client->login();
                        if ($ok) {
                            $sys = $client->getSystemInfo(4);
                            $model = $sys['model'] ?? 'Focuscom EP5800-04';
                            Response::json([
                                'success' => true,
                                'status' => 'authenticated',
                                'message' => "Login Successful! Connected to {$model}.",
                                'data' => ['model' => $model],
                            ]);
                            return;
                        } else {
                            Response::json([
                                'success' => false,
                                'status' => 'auth_failed',
                                'message' => "Login Failed! Could not authenticate with Focuscom OLT on port {$port}.",
                            ]);
                            return;
                        }
                    } elseif ($vendor === 'atop') {
                        require_once __DIR__ . '/../lib/AtopOltClient.php';
                        $port = $webPort ?: ($managementPort ?: 2000);
                        $client = new AtopOltClient($ip, $port, $username, $password, 'http', 6);
                        $ok = @$client->login();
                        if ($ok) {
                            $sys = $client->getSystemInfo(8);
                            $model = $sys['model'] ?? 'ATOP PPSL-10E08';
                            Response::json([
                                'success' => true,
                                'status' => 'authenticated',
                                'message' => "Login Successful! Connected to {$model} Web API.",
                                'data' => ['model' => $model],
                            ]);
                            return;
                        } else {
                            Response::json([
                                'success' => false,
                                'status' => 'auth_failed',
                                'message' => "Login Failed! Could not authenticate with ATOP OLT on port {$port}. Verify credentials and Web port.",
                            ]);
                            return;
                        }
                    } else {
                        // Default VSOL or others
                        require_once __DIR__ . '/../lib/VsolOltClient.php';
                        $port = $webPort ?: ($managementPort ?: 80);
                        $proto = ($port == 443 || $port != 80) ? 'https' : 'http';
                        $client = new VsolOltClient($ip, $port, $username, $password, $proto, 6);
                        $ok = @$client->login();
                        if ($ok) {
                            $sys = $client->getSystemInfo(4);
                            $model = $sys['model'] ?? 'VSOL OLT';
                            Response::json([
                                'success' => true,
                                'status' => 'authenticated',
                                'message' => "Login Successful! Connected to {$model} Web Management Interface.",
                                'data' => ['model' => $model],
                            ]);
                            return;
                        } else {
                            Response::json([
                                'success' => false,
                                'status' => 'auth_failed',
                                'message' => "Login Failed! Could not authenticate with VSOL OLT on port {$port}. Verify credentials and Web port.",
                            ]);
                            return;
                        }
                    }
                }
            } catch (\Throwable $e) {
                Response::json([
                    'success' => false,
                    'status' => 'error',
                    'message' => "Login Test Error: " . $e->getMessage(),
                ]);
                return;
            }
        }

        Response::error('Invalid test type specified', 400);
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
                    require_once __DIR__ . '/../lib/MikrotikSyncService.php';
                    $api = MikrotikSyncService::connect($device, 3);
                    if ($api) {
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
        if ($force) {
            $data = OltSyncService::sync($db, $device, true);
        } else {
            $data = OltSyncService::getLocalData($db, (int)$device['tenant_id'], (int)$device['network_device_id'], $device);
        }

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
                'uptime' => $r['uptime'] ?? null,
                'lastSyncAt' => $r['last_sync_at'],
                'customer' => $matchedCustomer,
            ];
        }

        $onlineCount = 0;
        $offlineCount = 0;
        foreach ($onus as $o) {
            if (strtolower($o['status'] ?? '') === 'online') {
                $onlineCount++;
            } else {
                $offlineCount++;
            }
        }

        Response::json([
            'success' => true,
            'data' => [
                'total' => count($onus),
                'online' => $onlineCount,
                'offline' => $offlineCount,
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

        $userId = (int)$user['user_id'];
        $callerRole = strtolower($user['role'] ?? '');
        $isLevel0 = in_array($callerRole, ['admin', 'isp_admin', 'manager', 'tenant_admin', 'saas_admin', 'super_admin'], true);

        require_once __DIR__ . '/../lib/HierarchySecurityService.php';
        $hierarchyUser = HierarchySecurityService::getUser($userId);
        $userHierarchyPath = $hierarchyUser['hierarchy_path'] ?? "/{$userId}/";

        // 1. Get all routers for this tenant
        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            $rStmt = $db->prepare("SELECT network_device_id, device_name, management_ip, management_port, status 
                                   FROM network_devices 
                                   WHERE tenant_id = :tid AND device_type = 'router' 
                                   ORDER BY network_device_id ASC");
            $rStmt->execute(['tid' => $tenantId]);
            $routers = $rStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } else {
            $routers = $db->query("SELECT network_device_id, device_name, management_ip, management_port, status FROM network_devices WHERE device_type = 'router' ORDER BY network_device_id ASC")->fetchAll(PDO::FETCH_ASSOC) ?: [];
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

        // 2. Fetch allowed customers for this user (Strict Hierarchical RBAC)
        // - Admin sees all customers in tenant
        // - Reseller sees only own customers + downline agents' customers
        // - Agent sees only own customers
        // - Admin's customers are strictly excluded for Resellers and Agents!
        $custSql = "SELECT na.username, na.mac_address, na.remote_address, na.network_device_id as router_id,
                           c.customer_id, c.customer_code, c.full_name, c.phone,
                           c.owner_id, c.owner_role, c.owner_path,
                           u.username as owner_username, u.first_name as owner_first_name, u.last_name as owner_last_name, u.role as owner_user_role
                    FROM customer_network_accounts na 
                    JOIN customers c ON c.customer_id = na.customer_id 
                    LEFT JOIN users u ON u.user_id = c.owner_id
                    WHERE na.tenant_id = :tid AND na.username IS NOT NULL";
        $custParams = ['tid' => $tenantId];

        if (!$isLevel0) {
            $custSql .= " AND (c.owner_id = :user_owner_id OR c.owner_path LIKE :user_path_like)";
            $custParams['user_owner_id'] = $userId;
            $custParams['user_path_like'] = rtrim($userHierarchyPath, '/') . '/%';
        }

        $cStmt = $db->prepare($custSql);
        $cStmt->execute($custParams);
        $allowedCustomers = $cStmt->fetchAll(PDO::FETCH_ASSOC);

        $custMap = [];
        $custMacMap = [];
        $custIpMap = [];
        $customerRouterCounts = [];

        foreach ($allowedCustomers as $c) {
            $rId = (string)($c['router_id'] ?? '');
            if ($rId) {
                $customerRouterCounts[$rId] = ($customerRouterCounts[$rId] ?? 0) + 1;
            }
            if (!empty($c['username'])) {
                $custMap[strtolower(trim($c['username']))] = $c;
            }
            if (!empty($c['mac_address'])) {
                $normMac = strtoupper(str_replace(['-', '.', ' '], ':', trim($c['mac_address'])));
                $custMacMap[$normMac] = $c;
            }
            if (!empty($c['remote_address'])) {
                $custIpMap[trim($c['remote_address'])] = $c;
            }
        }

        // 3. Determine target router(s)
        $targetRouterId = $_GET['router_id'] ?? null;
        $queryAllRouters = ($targetRouterId === 'all');
        $targetRouter = null;

        if (!$targetRouterId && !$queryAllRouters) {
            // For Resellers / Agents, auto-select router that holds their customers!
            if (!$isLevel0 && !empty($customerRouterCounts)) {
                arsort($customerRouterCounts);
                $bestRouterId = array_key_first($customerRouterCounts);
                foreach ($routers as $r) {
                    if ((string)$r['network_device_id'] === (string)$bestRouterId) {
                        $targetRouter = $r;
                        break;
                    }
                }
            }
            if (!$targetRouter) {
                $targetRouter = $routers[0];
            }
        } elseif ($targetRouterId && !$queryAllRouters) {
            foreach ($routers as $r) {
                if ((string)$r['network_device_id'] === (string)$targetRouterId) {
                    $targetRouter = $r;
                    break;
                }
            }
            if (!$targetRouter) {
                $targetRouter = $routers[0];
            }
        }

        require_once __DIR__ . '/../lib/MikrotikSyncService.php';

        // 4. Fetch raw logs from target router(s)
        $routersToQuery = [];
        if ($queryAllRouters) {
            $routersToQuery = $routers;
        } else {
            $routersToQuery = [$targetRouter];
        }

        $allRawLogs = [];
        $anyOnline = false;

        foreach ($routersToQuery as $rItem) {
            if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
                $dStmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id AND tenant_id = :tid LIMIT 1");
                $dStmt->execute(['id' => $rItem['network_device_id'], 'tid' => $tenantId]);
            } else {
                $dStmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id LIMIT 1");
                $dStmt->execute(['id' => $rItem['network_device_id']]);
            }
            $routerFull = $dStmt->fetch(PDO::FETCH_ASSOC);
            if (!$routerFull) continue;

            $timeout = count($routersToQuery) > 1 ? 3 : 4;
            $api = MikrotikSyncService::connect($routerFull, $timeout);
            if ($api) {
                $anyOnline = true;
                $logs = $api->comm('/log/print');
                $api->disconnect();
                if (is_array($logs)) {
                    foreach ($logs as $l) {
                        $l['_router_id'] = (string)$rItem['network_device_id'];
                        $l['_router_name'] = $rItem['device_name'];
                        $allRawLogs[] = $l;
                    }
                }
            }
        }

        // 5. Filter for PPP & PPPoE logs
        $filtered = array_reverse(array_filter($allRawLogs, function($l) {
            $topics = strtolower($l['topics'] ?? '');
            $msg = strtolower($l['message'] ?? '');
            return str_contains($topics, 'ppp') || str_contains($topics, 'pppoe') || str_contains($msg, 'pppoe');
        }));

        $parsedLogs = [];

        foreach ($filtered as $item) {
            $msg = $item['message'] ?? '';
            $topics = $item['topics'] ?? '';
            $time = $item['time'] ?? '';
            $rId = $item['_router_id'] ?? ($targetRouter ? (string)$targetRouter['network_device_id'] : '');
            $rName = $item['_router_name'] ?? ($targetRouter ? $targetRouter['device_name'] : '');

            // Robust Username parsing across MikroTik formats
            $username = null;
            if (preg_match('/<(?:pppoe|pptp|ovpn|l2tp)-([^>]+)>:\s*(.*)/i', $msg, $m)) {
                $username = trim($m[1]);
            } elseif (preg_match('/(?:^|\s)user\s+([a-zA-Z0-9_.@-]+)/i', $msg, $m)) {
                $username = trim($m[1]);
            } elseif (preg_match('/^([a-zA-Z0-9_.@-]+)\s+logged\s+(?:in|out)/i', $msg, $m)) {
                $username = trim($m[1]);
            }

            // MAC Address parsing
            $mac = null;
            if (preg_match('/((?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})/', $msg, $m)) {
                $mac = strtoupper(str_replace('-', ':', $m[1]));
            }

            // IP Address parsing
            $ip = null;
            if (preg_match('/(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/', $msg, $m)) {
                $ip = $m[1];
            }

            // Cross-match customer from allowed pool
            $customerInfo = null;
            if ($username && isset($custMap[strtolower($username)])) {
                $customerInfo = $custMap[strtolower($username)];
            } elseif ($mac && isset($custMacMap[$mac])) {
                $customerInfo = $custMacMap[$mac];
                if (!$username) $username = $customerInfo['username'];
            } elseif ($ip && isset($custIpMap[$ip])) {
                $customerInfo = $custIpMap[$ip];
                if (!$username) $username = $customerInfo['username'];
            }

            // DOWNWARD-ONLY RBAC ENFORCEMENT:
            // Resellers and Agents can ONLY see logs that belong to their accessible customers!
            // Admin's customers and other resellers' customers are completely hidden!
            if (!$isLevel0 && !$customerInfo) {
                continue;
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

            $ownerFullName = '';
            if ($customerInfo) {
                $ownerFullName = trim(($customerInfo['owner_first_name'] ?? '') . ' ' . ($customerInfo['owner_last_name'] ?? ''));
                if (empty($ownerFullName)) {
                    $ownerFullName = $customerInfo['owner_username'] ?? 'Admin';
                }
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
                    'phone' => $customerInfo['phone'] ?? null,
                    'owner_id' => (string)($customerInfo['owner_id'] ?? ''),
                    'owner_name' => $ownerFullName,
                    'owner_role' => $customerInfo['owner_user_role'] ?? ($customerInfo['owner_role'] ?? 'admin'),
                ] : null,
                'ip' => $ip,
                'mac' => $mac,
                'message' => $msg,
                'router_id' => $rId,
                'router_name' => $rName,
            ];
        }

        $currentRouterData = null;
        if ($queryAllRouters) {
            $currentRouterData = [
                'network_device_id' => 'all',
                'device_name' => 'All Routers Combined (' . count($routers) . ' Routers)',
                'management_ip' => 'Cluster',
                'management_port' => 0,
            ];
        } elseif ($targetRouter) {
            $currentRouterData = [
                'network_device_id' => (string)$targetRouter['network_device_id'],
                'device_name' => $targetRouter['device_name'],
                'management_ip' => $targetRouter['management_ip'],
                'management_port' => (int)$targetRouter['management_port'],
            ];
        }

        Response::json([
            'success' => true,
            'is_online' => $anyOnline,
            'current_router' => $currentRouterData,
            'routers' => array_map(function($r) {
                return [
                    'network_device_id' => (string)$r['network_device_id'],
                    'device_name' => $r['device_name'],
                    'management_ip' => $r['management_ip'],
                    'status' => $r['status'],
                ];
            }, $routers),
            'user_role' => $callerRole,
            'is_admin' => $isLevel0,
            'total' => count($parsedLogs),
            'logs' => $parsedLogs,
            'status_message' => $anyOnline ? 'Logs retrieved from live router' : 'Router unreachable or API disconnected',
        ]);
    }

    public static function mikrotikImportPreview(): void {
        $user = AuthMiddleware::requireAuth();
        self::requireAdminOrCompanyRole($user);
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $deviceId = trim($_GET['deviceId'] ?? '');
        $profileFilter = trim($_GET['profile'] ?? '');
        $hideExisting = filter_var($_GET['hideExisting'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if (empty($deviceId)) {
            Response::error('Router device ID is required', 400);
            return;
        }

        $devStmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :did AND (tenant_id = :tid OR :is_saas = 1) LIMIT 1");
        $devStmt->execute(['did' => $deviceId, 'tid' => $tenantId, 'is_saas' => (($user['role'] ?? '') === 'saas_admin' ? 1 : 0)]);
        $router = $devStmt->fetch();

        if (!$router) {
            Response::error('Router not found or unauthorized', 404);
            return;
        }

        // Fetch packages to map
        $pkgStmt = $db->prepare("SELECT access_profile_id, profile_code, profile_name, price FROM access_profiles WHERE (tenant_id = :tid OR :is_saas = 1) AND status = 'active'");
        $pkgStmt->execute(['tid' => $tenantId, 'is_saas' => (($user['role'] ?? '') === 'saas_admin' ? 1 : 0)]);
        $dbPackages = $pkgStmt->fetchAll();
        $pkgMap = [];
        foreach ($dbPackages as $p) {
            $pkgMap[strtolower(trim($p['profile_name']))] = $p;
            if (!empty($p['profile_code'])) {
                $pkgMap[strtolower(trim($p['profile_code']))] = $p;
            }
        }

        // Fetch existing PPPoE accounts
        $existingStmt = $db->prepare("SELECT LOWER(cna.username) as uname, c.customer_code, c.full_name, c.phone 
            FROM customer_network_accounts cna 
            JOIN customers c ON c.customer_id = cna.customer_id 
            WHERE cna.tenant_id = :tid AND cna.protocol = 'pppoe'");
        $existingStmt->execute(['tid' => $tenantId]);
        $existingUsers = [];
        while ($r = $existingStmt->fetch()) {
            $existingUsers[$r['uname']] = $r;
        }

        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
        $api = MikrotikSyncService::connect($router, 4);

        if (!$api) {
            Response::error("Could not connect to MikroTik router {$router['device_name']} ({$router['management_ip']}:{$router['management_port']}). Please check router connection, IP reachable, and API port 8728.", 503);
            return;
        }

        try {
            $commParams = [];
            if (!empty($profileFilter) && $profileFilter !== '-- All Profiles --' && $profileFilter !== 'all') {
                $commParams['?profile'] = $profileFilter;
            }
            $secrets = $api->comm('/ppp/secret/print', $commParams);
            $api->disconnect();

            if (!is_array($secrets)) {
                $secrets = [];
            }

            $users = [];
            $newCount = 0;
            $existingCount = 0;

            foreach ($secrets as $sec) {
                $username = trim($sec['name'] ?? '');
                if (empty($username)) continue;

                $lowerUname = strtolower($username);
                $exists = isset($existingUsers[$lowerUname]);

                if ($exists) {
                    $existingCount++;
                    if ($hideExisting) {
                        continue;
                    }
                } else {
                    $newCount++;
                }

                $comment = trim($sec['comment'] ?? '');
                $password = trim($sec['password'] ?? '');
                $profile = trim($sec['profile'] ?? 'default');
                $callerId = trim($sec['caller-id'] ?? '');
                $disabled = ($sec['disabled'] ?? 'false') === 'true';

                // Customer PPPoE username is the customer full_name
                $suggestedName = $username;

                // Default 11-digit phone number: '012' prefix + 8 random digits
                $random8 = str_pad((string)mt_rand(10000000, 99999999), 8, '0', STR_PAD_LEFT);
                $suggestedPhone = '012' . $random8;
                if (!empty($comment) && preg_match('/(01[3-9]\d{8})/', $comment, $pm)) {
                    $suggestedPhone = $pm[1];
                }

                // Match package
                $matchedPkg = $pkgMap[strtolower($profile)] ?? null;

                $users[] = [
                    'username' => $username,
                    'password' => $password,
                    'profile' => $profile,
                    'comment' => $comment,
                    'address' => $comment,
                    'suggested_address' => $comment,
                    'caller_id' => $callerId,
                    'disabled' => $disabled,
                    'exists_in_db' => $exists,
                    'existing_info' => $exists ? $existingUsers[$lowerUname] : null,
                    'suggested_name' => $suggestedName,
                    'suggested_phone' => $suggestedPhone,
                    'matched_package_id' => $matchedPkg ? $matchedPkg['access_profile_id'] : null,
                    'matched_package_name' => $matchedPkg ? $matchedPkg['profile_name'] : null,
                    'matched_package_price' => $matchedPkg ? (float)$matchedPkg['price'] : 0,
                ];
            }

            Response::json([
                'success' => true,
                'router' => [
                    'id' => $router['network_device_id'],
                    'name' => $router['device_name'],
                    'ip' => $router['management_ip'],
                ],
                'total' => count($users),
                'new_count' => $newCount,
                'existing_count' => $existingCount,
                'data' => $users,
            ]);
        } catch (Throwable $e) {
            Response::error('Failed to query MikroTik secrets: ' . $e->getMessage(), 500);
        }
    }

    public static function mikrotikImportConfirm(): void {
        $user = AuthMiddleware::requireAuth();
        self::requireAdminOrCompanyRole($user);
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $deviceId = $data['deviceId'] ?? null;
        $users = $data['users'] ?? [];

        if (empty($deviceId) || empty($users) || !is_array($users)) {
            Response::error('Router ID and users list are required', 400);
            return;
        }

        $importAs = strtolower($data['importAs'] ?? 'prepaid');
        $expiryDate = !empty($data['expiryDate']) ? trim($data['expiryDate']) : null;
        $invoiceMonth = !empty($data['invoiceMonth']) ? trim($data['invoiceMonth']) : date('Y-m');
        $generateInvoice = !empty($data['generateInvoice']);
        $savePasswords = isset($data['savePasswords']) ? (bool)$data['savePasswords'] : true;
        $doNotOverwrite = isset($data['doNotOverwriteExisting']) ? (bool)$data['doNotOverwriteExisting'] : true;
        $resellerId = !empty($data['resellerId']) ? (int)$data['resellerId'] : null;
        $areaId = $data['areaId'] ?? null;
        $subAreaId = $data['subAreaId'] ?? null;
        $defaultPackageId = $data['defaultPackageId'] ?? null;

        $db = Database::getConnection();
        $db->beginTransaction();

        try {
            // Validate router
            $devStmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :did AND (tenant_id = :tid OR :is_saas = 1) LIMIT 1");
            $devStmt->execute(['did' => $deviceId, 'tid' => $tenantId, 'is_saas' => (($user['role'] ?? '') === 'saas_admin' ? 1 : 0)]);
            $router = $devStmt->fetch();
            if (!$router) {
                $db->rollBack();
                Response::error('Invalid network router', 404);
                return;
            }

            // Determine owner
            $ownerId = $resellerId ?: (int)$user['user_id'];
            $ownerUser = HierarchySecurityService::getUser($ownerId);
            $ownerRole = $ownerUser['role'] ?? 'admin';
            $ownerLevel = $ownerUser['role_level'] ?? 100;
            $ownerPath = $ownerUser['hierarchy_path'] ?? "/{$ownerId}/";

            // Pre-fetch packages
            $pkgStmt = $db->prepare("SELECT access_profile_id, LOWER(profile_name) as pname, LOWER(profile_code) as pcode, price FROM access_profiles WHERE tenant_id = :tid OR :is_saas = 1");
            $pkgStmt->execute(['tid' => $tenantId, 'is_saas' => (($user['role'] ?? '') === 'saas_admin' ? 1 : 0)]);
            $pkgMap = [];
            $pkgPrices = [];
            $firstPkgId = null;
            while ($p = $pkgStmt->fetch()) {
                if (!$firstPkgId) $firstPkgId = $p['access_profile_id'];
                $pkgMap[trim($p['pname'])] = $p['access_profile_id'];
                $pkgPrices[$p['access_profile_id']] = (float)$p['price'];
                if (!empty($p['pcode'])) {
                    $pkgMap[trim($p['pcode'])] = $p['access_profile_id'];
                }
            }

            // Existing accounts
            $existingStmt = $db->prepare("SELECT LOWER(username) FROM customer_network_accounts WHERE tenant_id = :tid");
            $existingStmt->execute(['tid' => $tenantId]);
            $existingUsernames = array_flip($existingStmt->fetchAll(PDO::FETCH_COLUMN));

            $stmtCustomer = $db->prepare("INSERT INTO customers 
                (tenant_id, customer_code, customer_type, full_name, email, phone, installation_address, status, billing_status, connection_date, owner_id, owner_role, owner_role_level, owner_path, metadata, created_by)
                VALUES (:tid, :code, 'individual', :name, :email, :phone, :addr, :status, 'Paid', CURDATE(), :oid, :orole, :olevel, :opath, :meta, :created_by)");

            $stmtService = $db->prepare("INSERT INTO customer_services 
                (tenant_id, customer_id, access_profile_id, network_device_id, protocol, billing_cycle, status, starts_at, expires_at, created_by)
                VALUES (:tid, :cid, :pid, :did, 'pppoe', 'monthly', 'active', NOW(), :expires, :uid)");

            $stmtNet = $db->prepare("INSERT INTO customer_network_accounts 
                (tenant_id, customer_id, network_device_id, protocol, username, password, status, is_online)
                VALUES (:tid, :cid, :did, 'pppoe', :uname, :pwd, 'active', 0)");

            $stmtInvoice = $db->prepare("INSERT INTO invoices 
                (tenant_id, customer_id, customer_service_id, invoice_number, invoice_date, due_date, status, subtotal, total_amount, paid_amount, balance_due, base_price, sell_price, created_by)
                VALUES (:tid, :cid, :sid, :inv_num, :inv_date, DATE_ADD(:inv_date_calc, INTERVAL 10 DAY), 'paid', :sub, :tot, :paid, 0.00, :base, :sell, :uid)");

            $imported = 0;
            $skipped = 0;

            foreach ($users as $u) {
                $username = trim($u['username'] ?? '');
                if (empty($username)) continue;

                $lowerUname = strtolower($username);
                if (isset($existingUsernames[$lowerUname])) {
                    if ($doNotOverwrite) {
                        $skipped++;
                        continue;
                    }
                }

                $name = trim($u['name'] ?? $u['suggested_name'] ?? $username);
                if (empty($name)) {
                    $name = $username;
                }
                $defaultPhone = '012' . str_pad((string)mt_rand(10000000, 99999999), 8, '0', STR_PAD_LEFT);
                $phone = trim($u['phone'] ?? $u['suggested_phone'] ?? '');
                if (empty($phone) || !preg_match('/^01\d{9}$/', $phone)) {
                    $phone = $defaultPhone;
                }

                $address = trim($u['address'] ?? $u['suggested_address'] ?? $u['comment'] ?? '');
                if (empty($address)) {
                    $address = 'Dhaka, Bangladesh';
                }

                $password = $savePasswords ? trim($u['password'] ?? 'pass123') : 'pass123';
                $disabled = !empty($u['disabled']);
                $custStatus = $disabled ? 'suspended' : 'active';

                // Resolve package
                $pkgId = $u['packageId'] ?? $u['matched_package_id'] ?? null;
                if (!$pkgId && !empty($u['profile']) && isset($pkgMap[strtolower($u['profile'])])) {
                    $pkgId = $pkgMap[strtolower($u['profile'])];
                }
                if (!$pkgId) {
                    $pkgId = $defaultPackageId ?: $firstPkgId;
                }

                $customerCode = TenantSequenceService::generateNextCode($db, (string)$tenantId, 'customer', 6);
                $effectiveExpiry = $expiryDate ?: date('Y-m-d', strtotime('+30 days'));

                $stmtCustomer->execute([
                    'tid' => $tenantId,
                    'code' => $customerCode,
                    'name' => $name,
                    'email' => null,
                    'phone' => $phone,
                    'addr' => $address,
                    'status' => $custStatus,
                    'oid' => $ownerId,
                    'orole' => $ownerRole,
                    'olevel' => $ownerLevel,
                    'opath' => $ownerPath,
                    'meta' => json_encode([
                        'service_area_id' => $areaId,
                        'sub_area_id' => $subAreaId,
                        'mikrotik_caller_id' => $u['caller_id'] ?? null,
                        'mikrotik_comment' => $u['comment'] ?? null,
                    ]),
                    'created_by' => $user['user_id'],
                ]);
                $customerId = $db->lastInsertId();

                $stmtService->execute([
                    'tid' => $tenantId,
                    'cid' => $customerId,
                    'pid' => $pkgId,
                    'did' => $deviceId,
                    'expires' => $effectiveExpiry . ' 23:59:59',
                    'uid' => $user['user_id'],
                ]);
                $serviceId = $db->lastInsertId();

                $stmtNet->execute([
                    'tid' => $tenantId,
                    'cid' => $customerId,
                    'did' => $deviceId,
                    'uname' => $username,
                    'pwd' => $password,
                ]);
                $existingUsernames[$lowerUname] = true;

                if ($generateInvoice && $pkgId) {
                    $pkgPrice = $pkgPrices[$pkgId] ?? 0.00;
                    $invNumber = TenantSequenceService::generateNextCode($db, (string)$tenantId, 'invoice', 6);
                    $invDate = !empty($invoiceMonth) ? date('Y-m-d', strtotime($invoiceMonth . '-01')) : date('Y-m-d');
                    $stmtInvoice->execute([
                        'tid' => $tenantId,
                        'cid' => $customerId,
                        'sid' => $serviceId,
                        'inv_num' => $invNumber,
                        'inv_date' => $invDate,
                        'inv_date_calc' => $invDate,
                        'sub' => $pkgPrice,
                        'tot' => $pkgPrice,
                        'paid' => $pkgPrice,
                        'base' => $pkgPrice,
                        'sell' => $pkgPrice,
                        'uid' => $user['user_id'],
                    ]);
                }

                $imported++;
            }

            $db->commit();

            Response::json([
                'success' => true,
                'message' => "Successfully imported {$imported} PPPoE user(s) from MikroTik" . ($skipped > 0 ? " ({$skipped} existing users skipped)" : ""),
                'importedCount' => $imported,
                'skippedCount' => $skipped,
            ]);
        } catch (Throwable $e) {
            $db->rollBack();
            Response::error('Failed to import MikroTik users: ' . $e->getMessage(), 500);
        }
    }
}

