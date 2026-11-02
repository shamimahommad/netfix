<?php
/**
 * NetFix ISP SaaS - Access Profiles (Packages / Plans) Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class AccessProfilesController {
    public static function dropdown(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT 
            access_profile_id as id,
            profile_name as name,
            price,
            download_speed_kbps as download_kbps,
            upload_speed_kbps as upload_kbps,
            is_default
            FROM access_profiles 
            WHERE tenant_id = :tid AND status = 'enabled'
            ORDER BY price ASC");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        $items = array_map(function($r) {
            return [
                'id' => (string)$r['id'],
                'name' => $r['name'],
                'price' => (float)$r['price'],
                'download_kbps' => (int)$r['download_kbps'],
                'upload_kbps' => (int)$r['upload_kbps'],
                'is_default' => (bool)$r['is_default'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $items,
        ]);
    }

    public static function index(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $where = ["ap.tenant_id = :tid"];
        $params = ['tid' => $tenantId];

        if (!empty($_GET['serverId'])) {
            $where[] = "ap.network_device_id = :sid";
            $params['sid'] = $_GET['serverId'];
        }
        if (!empty($_GET['protocol'])) {
            $where[] = "ap.protocol = :proto";
            $params['proto'] = $_GET['protocol'];
        }
        if (!empty($_GET['search'])) {
            $where[] = "(ap.profile_name LIKE :s OR ap.profile_code LIKE :s)";
            $params['s'] = '%' . trim($_GET['search']) . '%';
        }

        $whereSql = implode(' AND ', $where);

        $stmt = $db->prepare("SELECT 
            ap.*,
            nd.device_name as server_name,
            COUNT(cs.customer_id) as active_subscribers
            FROM access_profiles ap
            LEFT JOIN network_devices nd ON nd.network_device_id = ap.network_device_id
            LEFT JOIN customer_services cs ON cs.access_profile_id = ap.access_profile_id AND cs.status = 'active'
            WHERE {$whereSql}
            GROUP BY ap.access_profile_id
            ORDER BY ap.access_profile_id DESC");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $total = count($rows);
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 10)));
        $totalPages = ceil($total / $limit) ?: 1;

        $pagedRows = array_slice($rows, ($page - 1) * $limit, $limit);

        $data = array_map(function($r) {
            $color = !empty($r['color_hex']) ? $r['color_hex'] : '#2563EB';
            $validityDays = (int)($r['validity_days'] ?? 30);
            $validityHours = (int)($r['validity_hours'] ?? 0);
            $volumeType = !empty($r['data_volume_type']) ? $r['data_volume_type'] : 'unlimited';
            $volumeGb = !empty($r['data_volume_gb']) ? (int)$r['data_volume_gb'] : null;
            $dlKbps = (int)($r['download_speed_kbps'] ?? 10240);
            $ulKbps = (int)($r['upload_speed_kbps'] ?? 10240);
            $activeCount = (int)($r['active_subscribers'] ?? 0);
            $profileName = $r['profile_name'];
            $mtkProfile = $r['mikrotik_profile_name'] ?: $profileName;

            return [
                'id' => (string)$r['access_profile_id'],
                'packageId' => (string)$r['access_profile_id'],
                'serverId' => (string)$r['network_device_id'],
                'serverName' => $r['server_name'] ?? 'Main Gateway',
                'name' => $profileName,
                'profileName' => $profileName,
                'code' => $r['profile_code'],
                'profileCode' => $r['profile_code'],
                'protocol' => $r['protocol'] ?? 'pppoe',
                'color' => $color,
                'colorHex' => $color,
                'price' => (float)$r['price'],
                'downloadSpeedKbps' => $dlKbps,
                'uploadSpeedKbps' => $ulKbps,
                'download_speed' => (int)round($dlKbps / 1024),
                'upload_speed' => (int)round($ulKbps / 1024),
                'status' => $r['status'] ?? 'enabled',
                'isDefault' => (bool)$r['is_default'],
                'validityDays' => $validityDays,
                'validityHours' => $validityHours,
                'validity' => [
                    'days' => $validityDays,
                    'hours' => $validityHours,
                ],
                'dataVolumeType' => $volumeType,
                'dataVolumeGb' => $volumeGb,
                'volumeType' => $volumeType,
                'volumeGb' => $volumeGb,
                'volume' => [
                    'type' => $volumeType,
                    'gb' => $volumeGb,
                ],
                'privacy' => $r['privacy'] ?? 'public',
                'mikrotikProfileId' => $r['mikrotik_profile_id'] ?? null,
                'mikrotikProfileName' => $mtkProfile,
                'mikrotikProfile' => $mtkProfile,
                'activeSubscribers' => $activeCount,
                'count' => $activeCount,
                'createdAt' => $r['created_at'] ?? date('Y-m-d H:i:s'),
                'updatedAt' => $r['updated_at'] ?? date('Y-m-d H:i:s'),
            ];
        }, $pagedRows);

        Response::json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => $totalPages,
            ],
        ]);
    }

    public static function create(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $name = trim($data['name'] ?? $data['profileName'] ?? '');
        $price = (float)($data['price'] ?? 500);
        $deviceId = !empty($data['serverId']) ? (int)$data['serverId'] : (!empty($data['networkDeviceId']) ? (int)$data['networkDeviceId'] : 0);

        if (empty($name)) {
            Response::error('Package name is required', 400);
        }

        $downloadKbps = (int)($data['downloadSpeedKbps'] ?? (($data['download_speed'] ?? 10) * 1024));
        $uploadKbps = (int)($data['uploadSpeedKbps'] ?? (($data['upload_speed'] ?? 10) * 1024));
        $code = !empty($data['code']) ? trim($data['code']) : (strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $name)) . '-' . rand(100, 999));
        $protocol = $data['protocol'] ?? 'pppoe';
        $color = $data['color'] ?? $data['colorHex'] ?? '#2563EB';
        $validityDays = isset($data['validityDays']) ? (int)$data['validityDays'] : 30;
        $validityHours = isset($data['validityHours']) ? (int)$data['validityHours'] : 0;
        $volumeType = $data['volumeType'] ?? $data['dataVolumeType'] ?? 'unlimited';
        $volumeGb = !empty($data['volumeGb']) ? (int)$data['volumeGb'] : (!empty($data['dataVolumeGb']) ? (int)$data['dataVolumeGb'] : null);
        $privacy = $data['privacy'] ?? 'public';
        $status = $data['status'] ?? 'enabled';
        $mtkProfileId = $data['mikrotik_profile_id'] ?? $data['mikrotikProfileId'] ?? null;
        $mtkProfileName = $data['mikrotik_profile_name'] ?? $data['mikrotikProfileName'] ?? $name;

        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO access_profiles 
            (tenant_id, network_device_id, profile_code, profile_name, protocol, color_hex, download_speed_kbps, upload_speed_kbps, price, validity_days, validity_hours, data_volume_type, data_volume_gb, privacy, status, mikrotik_profile_id, mikrotik_profile_name)
            VALUES (:tid, :did, :code, :name, :proto, :color, :dl, :ul, :price, :vdays, :vhours, :vtype, :vgb, :priv, :status, :mpid, :mpname)");
        $stmt->execute([
            'tid' => $tenantId,
            'did' => $deviceId,
            'code' => $code,
            'name' => $name,
            'proto' => $protocol,
            'color' => $color,
            'dl' => $downloadKbps,
            'ul' => $uploadKbps,
            'price' => $price,
            'vdays' => $validityDays,
            'vhours' => $validityHours,
            'vtype' => $volumeType,
            'vgb' => $volumeGb,
            'priv' => $privacy,
            'status' => $status,
            'mpid' => $mtkProfileId,
            'mpname' => $mtkProfileName,
        ]);

        $id = $db->lastInsertId();

        Response::json([
            'success' => true,
            'message' => 'Package created successfully',
            'data' => [
                'id' => (string)$id,
                'packageId' => (string)$id,
                'name' => $name,
                'price' => $price,
            ],
        ], 201);
    }

    public static function update(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $db = Database::getConnection();

        $fields = [];
        $params = ['id' => $id, 'tid' => $tenantId];

        if (isset($data['name']) || isset($data['profileName'])) {
            $fields[] = "profile_name = :name";
            $params['name'] = $data['name'] ?? $data['profileName'];
        }
        if (isset($data['serverId']) || isset($data['networkDeviceId'])) {
            $fields[] = "network_device_id = :did";
            $params['did'] = !empty($data['serverId']) ? (int)$data['serverId'] : (!empty($data['networkDeviceId']) ? (int)$data['networkDeviceId'] : 0);
        }
        if (isset($data['protocol'])) {
            $fields[] = "protocol = :proto";
            $params['proto'] = $data['protocol'];
        }
        if (isset($data['color']) || isset($data['colorHex'])) {
            $fields[] = "color_hex = :color";
            $params['color'] = $data['color'] ?? $data['colorHex'];
        }
        if (isset($data['price'])) {
            $fields[] = "price = :price";
            $params['price'] = (float)$data['price'];
        }
        if (isset($data['downloadSpeedKbps']) || isset($data['download_speed'])) {
            $fields[] = "download_speed_kbps = :dl";
            $params['dl'] = (int)($data['downloadSpeedKbps'] ?? (($data['download_speed'] ?? 10) * 1024));
        }
        if (isset($data['uploadSpeedKbps']) || isset($data['upload_speed'])) {
            $fields[] = "upload_speed_kbps = :ul";
            $params['ul'] = (int)($data['uploadSpeedKbps'] ?? (($data['upload_speed'] ?? 10) * 1024));
        }
        if (isset($data['status'])) {
            $fields[] = "status = :status";
            $params['status'] = $data['status'];
        }
        if (isset($data['validityDays'])) {
            $fields[] = "validity_days = :vdays";
            $params['vdays'] = (int)$data['validityDays'];
        }
        if (isset($data['validityHours'])) {
            $fields[] = "validity_hours = :vhours";
            $params['vhours'] = (int)$data['validityHours'];
        }
        if (isset($data['volumeType']) || isset($data['dataVolumeType'])) {
            $fields[] = "data_volume_type = :vtype";
            $params['vtype'] = $data['volumeType'] ?? $data['dataVolumeType'];
        }
        if (array_key_exists('volumeGb', $data) || array_key_exists('dataVolumeGb', $data)) {
            $fields[] = "data_volume_gb = :vgb";
            $params['vgb'] = !empty($data['volumeGb']) ? (int)$data['volumeGb'] : (!empty($data['dataVolumeGb']) ? (int)$data['dataVolumeGb'] : null);
        }
        if (isset($data['privacy'])) {
            $fields[] = "privacy = :priv";
            $params['priv'] = $data['privacy'];
        }
        if (isset($data['mikrotik_profile_id']) || isset($data['mikrotikProfileId'])) {
            $fields[] = "mikrotik_profile_id = :mpid";
            $params['mpid'] = $data['mikrotik_profile_id'] ?? $data['mikrotikProfileId'];
        }
        if (isset($data['mikrotik_profile_name']) || isset($data['mikrotikProfileName'])) {
            $fields[] = "mikrotik_profile_name = :mpname";
            $params['mpname'] = $data['mikrotik_profile_name'] ?? $data['mikrotikProfileName'];
        }

        if (!empty($fields)) {
            $fields[] = "updated_at = NOW()";
            $sql = "UPDATE access_profiles SET " . implode(', ', $fields) . " WHERE access_profile_id = :id AND tenant_id = :tid";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }

        Response::json([
            'success' => true,
            'message' => 'Package updated successfully',
            'data' => ['id' => $id],
        ]);
    }

    public static function delete(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        // Check if package has active customers
        $checkStmt = $db->prepare("SELECT COUNT(*) FROM customer_services WHERE access_profile_id = :id AND status = 'active'");
        $checkStmt->execute(['id' => $id]);
        if ($checkStmt->fetchColumn() > 0) {
            Response::error('Package has active subscribers and cannot be deleted.', 400);
        }

        // Delete package
        $stmt = $db->prepare("DELETE FROM access_profiles WHERE access_profile_id = :id AND tenant_id = :tid");
        $stmt->execute(['id' => $id, 'tid' => $tenantId]);

        Response::json([
            'success' => true,
            'message' => 'Package deleted successfully',
        ]);
    }
}

