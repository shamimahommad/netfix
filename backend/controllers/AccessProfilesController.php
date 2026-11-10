<?php
/**
 * NetFix ISP SaaS - Access Profiles (Packages / Plans) Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/MikrotikSyncService.php';

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
            COALESCE(
                nd.device_name,
                (
                    SELECT nd2.device_name 
                    FROM customer_services cs2 
                    JOIN customer_network_accounts na2 ON na2.customer_id = cs2.customer_id 
                    JOIN network_devices nd2 ON nd2.network_device_id = na2.network_device_id 
                    WHERE cs2.access_profile_id = ap.access_profile_id AND nd2.device_name IS NOT NULL 
                    LIMIT 1
                ),
                (
                    SELECT nd3.device_name 
                    FROM network_devices nd3 
                    WHERE nd3.tenant_id = ap.tenant_id AND nd3.device_type = 'router' 
                    ORDER BY nd3.network_device_id DESC 
                    LIMIT 1
                ),
                'PPPoE Server'
            ) as server_name,
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
                'serverName' => !empty($r['server_name']) ? $r['server_name'] : 'PPPoE Server',
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

    /**
     * Preview profiles directly from live MikroTik router
     */
    public static function mikrotikPreview(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $deviceId = trim($_GET['serverId'] ?? $_GET['deviceId'] ?? '');
        $protocol = strtolower(trim($_GET['protocol'] ?? 'pppoe'));

        // Pick device
        if (!empty($deviceId) && $deviceId !== '0') {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id AND (tenant_id = :tid OR :is_saas = 1) LIMIT 1");
            $stmt->execute(['id' => $deviceId, 'tid' => $tenantId, 'is_saas' => (($user['role'] ?? '') === 'saas_admin' ? 1 : 0)]);
            $router = $stmt->fetch();
        } else {
            $stmt = $db->prepare("SELECT * FROM network_devices WHERE (tenant_id = :tid OR :is_saas = 1) AND status = 'active' AND device_type = 'router' ORDER BY network_device_id ASC LIMIT 1");
            $stmt->execute(['tid' => $tenantId, 'is_saas' => (($user['role'] ?? '') === 'saas_admin' ? 1 : 0)]);
            $router = $stmt->fetch();
        }

        if (!$router) {
            Response::error('MikroTik router not found or not configured for this account', 404);
            return;
        }

        $api = MikrotikSyncService::connect($router, 5);
        if (!$api) {
            Response::error("Could not connect to MikroTik router {$router['device_name']} ({$router['management_ip']}:{$router['management_port']}). Please verify IP reachable and API port 8728.", 503);
            return;
        }

        try {
            $cmd = ($protocol === 'hotspot') ? '/ip/hotspot/user/profile/print' : '/ppp/profile/print';
            $results = $api->comm($cmd);
            $api->disconnect();

            if (!is_array($results)) {
                $results = [];
            }

            // Existing packages in DB to check duplicates
            $pkgStmt = $db->prepare("SELECT access_profile_id, LOWER(profile_name) as pname, LOWER(COALESCE(mikrotik_profile_name, '')) as mpname, price, download_speed_kbps, upload_speed_kbps FROM access_profiles WHERE tenant_id = :tid");
            $pkgStmt->execute(['tid' => $tenantId]);
            $existing = [];
            while ($p = $pkgStmt->fetch()) {
                if (!empty($p['mpname'])) {
                    $existing[$p['mpname']] = $p;
                }
                if (!empty($p['pname'])) {
                    $existing[$p['pname']] = $p;
                }
            }

            $list = [];
            foreach ($results as $item) {
                $name = trim($item['name'] ?? '');
                if (empty($name)) continue;

                $rateLimit = trim($item['rate-limit'] ?? '');
                $parsedSpeed = self::parseRateLimit($rateLimit, $name);
                $isDefault = in_array(strtolower($name), ['default', 'default-encryption'], true);

                $lowerName = strtolower($name);
                $isExisting = isset($existing[$lowerName]);
                $existingPrice = $isExisting ? (float)$existing[$lowerName]['price'] : null;

                // Suggested price based on download speed if no existing price
                $suggestedPrice = $existingPrice ?: ($parsedSpeed['download_mbps'] * 50 > 300 ? $parsedSpeed['download_mbps'] * 50 : 500);

                $list[] = [
                    'id' => (string)($item['.id'] ?? $name),
                    'name' => $name,
                    'rate_limit' => $rateLimit ?: 'Not set',
                    'download_speed' => $parsedSpeed['download_mbps'],
                    'upload_speed' => $parsedSpeed['upload_mbps'],
                    'download_kbps' => $parsedSpeed['download_kbps'],
                    'upload_kbps' => $parsedSpeed['upload_kbps'],
                    'is_existing' => $isExisting,
                    'suggested_price' => $suggestedPrice,
                    'is_default' => $isDefault,
                ];
            }

            Response::json([
                'success' => true,
                'router' => [
                    'id' => (string)$router['network_device_id'],
                    'name' => $router['device_name'],
                    'ip' => $router['management_ip'],
                ],
                'protocol' => $protocol,
                'total' => count($list),
                'data' => $list,
            ]);
        } catch (\Throwable $e) {
            if ($api) $api->disconnect();
            Response::error('Failed to read profiles from MikroTik: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Import selected profiles from MikroTik into access_profiles
     */
    public static function mikrotikImport(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $deviceId = !empty($data['serverId']) ? (int)$data['serverId'] : (!empty($data['deviceId']) ? (int)$data['deviceId'] : 0);
        $protocol = strtolower(trim($data['protocol'] ?? 'pppoe'));
        $packages = $data['packages'] ?? [];

        if (!is_array($packages) || empty($packages)) {
            Response::error('No packages selected for import', 400);
            return;
        }

        $presetColors = ['#2563EB', '#059669', '#7C3AED', '#D97706', '#DC2626', '#0284C7', '#4F46E5', '#DB2777'];
        $importedCount = 0;
        $updatedCount = 0;

        foreach ($packages as $idx => $pkg) {
            $name = trim($pkg['name'] ?? '');
            if (empty($name)) continue;

            $mtkName = trim($pkg['mikrotik_profile_name'] ?? $name);
            $dlMbps = max(1, (int)($pkg['download_speed'] ?? 10));
            $ulMbps = max(1, (int)($pkg['upload_speed'] ?? 10));
            $price = max(0, (float)($pkg['price'] ?? 500));
            $validityDays = max(1, (int)($pkg['validityDays'] ?? 30));
            $volumeType = $pkg['volumeType'] ?? 'unlimited';
            $volumeGb = !empty($pkg['volumeGb']) ? (int)$pkg['volumeGb'] : null;
            $color = $presetColors[$idx % count($presetColors)];

            $dlKbps = $dlMbps * 1024;
            $ulKbps = $ulMbps * 1024;
            $code = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $name)) . '-' . rand(100, 999);

            // Check if profile exists for this tenant
            $checkStmt = $db->prepare("SELECT access_profile_id FROM access_profiles WHERE tenant_id = :tid AND (LOWER(profile_name) = LOWER(:pname) OR LOWER(mikrotik_profile_name) = LOWER(:mpname)) LIMIT 1");
            $checkStmt->execute(['tid' => $tenantId, 'pname' => $name, 'mpname' => $mtkName]);
            $existingId = $checkStmt->fetchColumn();

            if ($existingId) {
                // Update existing package price and speed
                $updateStmt = $db->prepare("UPDATE access_profiles SET 
                    network_device_id = :did,
                    protocol = :proto,
                    price = :price,
                    download_speed_kbps = :dl,
                    upload_speed_kbps = :ul,
                    validity_days = :vdays,
                    mikrotik_profile_name = :mpname,
                    updated_at = NOW()
                    WHERE access_profile_id = :id AND tenant_id = :tid");
                $updateStmt->execute([
                    'did' => $deviceId,
                    'proto' => $protocol,
                    'price' => $price,
                    'dl' => $dlKbps,
                    'ul' => $ulKbps,
                    'vdays' => $validityDays,
                    'mpname' => $mtkName,
                    'id' => $existingId,
                    'tid' => $tenantId,
                ]);
                $updatedCount++;
            } else {
                // Insert new package
                $insertStmt = $db->prepare("INSERT INTO access_profiles 
                    (tenant_id, network_device_id, profile_code, profile_name, protocol, color_hex, download_speed_kbps, upload_speed_kbps, price, validity_days, validity_hours, data_volume_type, data_volume_gb, privacy, status, mikrotik_profile_id, mikrotik_profile_name)
                    VALUES (:tid, :did, :code, :name, :proto, :color, :dl, :ul, :price, :vdays, 0, :vtype, :vgb, 'public', 'enabled', :mpid, :mpname)");
                $insertStmt->execute([
                    'tid' => $tenantId,
                    'did' => $deviceId,
                    'code' => $code,
                    'name' => $name,
                    'proto' => $protocol,
                    'color' => $color,
                    'dl' => $dlKbps,
                    'ul' => $ulKbps,
                    'price' => $price,
                    'vdays' => $validityDays,
                    'vtype' => $volumeType,
                    'vgb' => $volumeGb,
                    'mpid' => $mtkName,
                    'mpname' => $mtkName,
                ]);
                $importedCount++;
            }
        }

        Response::json([
            'success' => true,
            'message' => "Successfully processed packages: {$importedCount} newly imported, {$updatedCount} updated.",
            'imported_count' => $importedCount,
            'updated_count' => $updatedCount,
            'total_processed' => $importedCount + $updatedCount,
        ]);
    }

    /**
     * Bandwidth helper parsers
     */
    public static function parseRateLimit(?string $rateLimit, ?string $profileName = null): array {
        $dl = 10;
        $ul = 10;
        
        if (!empty($rateLimit)) {
            $parts = explode(' ', trim($rateLimit))[0];
            $rxTx = explode('/', $parts);
            if (count($rxTx) === 2) {
                $ulKbps = self::parseBandwidthToKbps($rxTx[0]);
                $dlKbps = self::parseBandwidthToKbps($rxTx[1]);
                if ($ulKbps > 0) $ul = (int)round($ulKbps / 1024);
                if ($dlKbps > 0) $dl = (int)round($dlKbps / 1024);
            }
        }
        
        if ($dl === 10 && $ul === 10 && !empty($profileName)) {
            if (preg_match('/(\d+)\s*(?:mbps|mb|m)/i', $profileName, $m)) {
                $spd = (int)$m[1];
                if ($spd > 0) {
                    $dl = $spd;
                    $ul = $spd;
                }
            }
        }
        
        return [
            'download_mbps' => max(1, $dl),
            'upload_mbps' => max(1, $ul),
            'download_kbps' => max(1, $dl) * 1024,
            'upload_kbps' => max(1, $ul) * 1024,
        ];
    }

    private static function parseBandwidthToKbps(string $val): int {
        $val = trim($val);
        if (empty($val)) return 0;
        if (preg_match('/^(\d+(?:\.\d+)?)\s*g(?:bps)?$/i', $val, $m)) {
            return (int)round((float)$m[1] * 1024 * 1024);
        }
        if (preg_match('/^(\d+(?:\.\d+)?)\s*m(?:bps)?$/i', $val, $m)) {
            return (int)round((float)$m[1] * 1024);
        }
        if (preg_match('/^(\d+(?:\.\d+)?)\s*k(?:bps)?$/i', $val, $m)) {
            return (int)round((float)$m[1]);
        }
        if (is_numeric($val)) {
            return (int)round((float)$val / 1000);
        }
        return 0;
    }
}

