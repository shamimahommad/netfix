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

        $data = array_map(function($r) {
            return [
                'id' => (string)$r['access_profile_id'],
                'packageId' => (string)$r['access_profile_id'],
                'serverId' => (string)$r['network_device_id'],
                'serverName' => $r['server_name'] ?? 'Main Gateway',
                'name' => $r['profile_name'],
                'profileName' => $r['profile_name'],
                'code' => $r['profile_code'],
                'profileCode' => $r['profile_code'],
                'protocol' => $r['protocol'],
                'price' => (float)$r['price'],
                'downloadSpeedKbps' => (int)$r['download_speed_kbps'],
                'uploadSpeedKbps' => (int)$r['upload_speed_kbps'],
                'download_speed' => (int)($r['download_speed_kbps'] / 1024),
                'upload_speed' => (int)($r['upload_speed_kbps'] / 1024),
                'colorHex' => $r['color_hex'],
                'status' => $r['status'],
                'isDefault' => (bool)$r['is_default'],
                'validityDays' => (int)$r['validity_days'],
                'dataVolumeType' => $r['data_volume_type'],
                'dataVolumeGb' => $r['data_volume_gb'] ? (int)$r['data_volume_gb'] : null,
                'privacy' => $r['privacy'],
                'mikrotikProfile' => $r['mikrotik_profile_name'] ?: $r['profile_name'],
                'activeSubscribers' => (int)$r['active_subscribers'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public static function create(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $name = trim($data['name'] ?? $data['profileName'] ?? '');
        $price = (float)($data['price'] ?? 500);
        $deviceId = $data['serverId'] ?? $data['networkDeviceId'] ?? 1;

        if (empty($name)) {
            Response::error('Package name is required', 400);
        }

        $downloadKbps = (int)($data['downloadSpeedKbps'] ?? (($data['download_speed'] ?? 10) * 1024));
        $uploadKbps = (int)($data['uploadSpeedKbps'] ?? (($data['upload_speed'] ?? 10) * 1024));
        $code = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $name)) . '-' . rand(100, 999);

        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO access_profiles 
            (tenant_id, network_device_id, profile_code, profile_name, protocol, download_speed_kbps, upload_speed_kbps, price, validity_days, status)
            VALUES (:tid, :did, :code, :name, :proto, :dl, :ul, :price, :val, 'enabled')");
        $stmt->execute([
            'tid' => $tenantId,
            'did' => $deviceId,
            'code' => $code,
            'name' => $name,
            'proto' => $data['protocol'] ?? 'pppoe',
            'dl' => $downloadKbps,
            'ul' => $uploadKbps,
            'price' => $price,
            'val' => $data['validityDays'] ?? 30,
        ]);

        $id = $db->lastInsertId();

        Response::json([
            'success' => true,
            'message' => 'Package created successfully',
            'data' => [
                'id' => (string)$id,
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
        if (isset($data['price'])) {
            $fields[] = "price = :price";
            $params['price'] = (float)$data['price'];
        }
        if (isset($data['status'])) {
            $fields[] = "status = :status";
            $params['status'] = $data['status'];
        }
        if (isset($data['validityDays'])) {
            $fields[] = "validity_days = :vdays";
            $params['vdays'] = (int)$data['validityDays'];
        }

        if (!empty($fields)) {
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

        $stmt = $db->prepare("UPDATE access_profiles SET status = 'disabled' WHERE access_profile_id = :id AND tenant_id = :tid");
        $stmt->execute(['id' => $id, 'tid' => $tenantId]);

        Response::json([
            'success' => true,
            'message' => 'Package disabled successfully',
        ]);
    }
}

