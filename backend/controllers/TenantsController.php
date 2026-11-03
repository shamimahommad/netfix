<?php
/**
 * NetFix ISP SaaS - Tenants & Settings Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class TenantsController {
    public static function index(): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->query("SELECT 
            t.*,
            tl.max_customers,
            tl.max_routers,
            tl.max_resellers,
            (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.tenant_id) as total_customers,
            (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id) as total_routers
            FROM tenants t
            LEFT JOIN tenant_limits tl ON tl.tenant_id = t.tenant_id
            ORDER BY t.tenant_id DESC");
        $rows = $stmt->fetchAll();

        $tenants = array_map(function($r) {
            $limits = [
                'maxRouters' => (int)($r['max_routers'] ?? 10),
                'maxOlts' => 5,
                'maxUsers' => (int)($r['max_resellers'] ?? 50),
                'maxCustomers' => (int)($r['max_customers'] ?? 5000),
                'mapEnabled' => true,
                'monitoringEnabled' => true,
            ];

            return [
                // CamelCase for modern frontend
                'tenantId' => (string)$r['tenant_id'],
                'tenantCode' => $r['tenant_code'],
                'tenantName' => $r['tenant_name'],
                'tenantSlug' => $r['tenant_slug'],
                'businessEmail' => $r['business_email'],
                'businessPhone' => $r['business_phone'],
                'businessAddress' => $r['business_address'],
                'countryCode' => $r['country_code'] ?? 'BD',
                'timezone' => $r['timezone'] ?? 'Asia/Dhaka',
                'currencyCode' => $r['currency_code'] ?? 'BDT',
                'status' => $r['status'] ?? 'active',
                'trialEndsAt' => $r['trial_ends_at'],
                'activatedAt' => $r['activated_at'],
                'createdAt' => $r['created_at'],
                'updatedAt' => $r['updated_at'] ?? $r['created_at'],
                'totalCustomers' => (int)$r['total_customers'],
                'totalRouters' => (int)$r['total_routers'],
                'limits' => $limits,

                // SnakeCase backward compatibility
                'tenant_id' => (string)$r['tenant_id'],
                'tenant_code' => $r['tenant_code'],
                'tenant_name' => $r['tenant_name'],
                'tenant_slug' => $r['tenant_slug'],
                'business_email' => $r['business_email'],
                'business_phone' => $r['business_phone'],
                'business_address' => $r['business_address'],
                'total_customers' => (int)$r['total_customers'],
                'total_routers' => (int)$r['total_routers'],
                'max_customers' => (int)($r['max_customers'] ?? 5000),
                'max_routers' => (int)($r['max_routers'] ?? 10),
                'max_resellers' => (int)($r['max_resellers'] ?? 50),
                'created_at' => $r['created_at'],
                'updated_at' => $r['updated_at'] ?? $r['created_at'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $tenants,
        ]);
    }

    public static function show(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT 
            t.*,
            tl.max_customers,
            tl.max_routers,
            tl.max_resellers,
            (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.tenant_id) as total_customers,
            (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id) as total_routers
            FROM tenants t
            LEFT JOIN tenant_limits tl ON tl.tenant_id = t.tenant_id
            WHERE t.tenant_id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $tenant = $stmt->fetch();

        if (!$tenant) {
            Response::error('Tenant not found', 404);
        }

        $limits = [
            'maxRouters' => (int)($tenant['max_routers'] ?? 10),
            'maxOlts' => 5,
            'maxUsers' => (int)($tenant['max_resellers'] ?? 50),
            'maxCustomers' => (int)($tenant['max_customers'] ?? 5000),
            'mapEnabled' => true,
            'monitoringEnabled' => true,
        ];

        $data = [
            // CamelCase
            'tenantId' => (string)$tenant['tenant_id'],
            'tenantCode' => $tenant['tenant_code'],
            'tenantName' => $tenant['tenant_name'],
            'tenantSlug' => $tenant['tenant_slug'],
            'businessEmail' => $tenant['business_email'],
            'businessPhone' => $tenant['business_phone'],
            'businessAddress' => $tenant['business_address'],
            'countryCode' => $tenant['country_code'] ?? 'BD',
            'timezone' => $tenant['timezone'] ?? 'Asia/Dhaka',
            'currencyCode' => $tenant['currency_code'] ?? 'BDT',
            'status' => $tenant['status'] ?? 'active',
            'trialEndsAt' => $tenant['trial_ends_at'],
            'activatedAt' => $tenant['activated_at'],
            'createdAt' => $tenant['created_at'],
            'updatedAt' => $tenant['updated_at'] ?? $tenant['created_at'],
            'totalCustomers' => (int)$tenant['total_customers'],
            'totalRouters' => (int)$tenant['total_routers'],
            'limits' => $limits,

            // SnakeCase
            'tenant_id' => (string)$tenant['tenant_id'],
            'tenant_code' => $tenant['tenant_code'],
            'tenant_name' => $tenant['tenant_name'],
            'tenant_slug' => $tenant['tenant_slug'],
            'business_email' => $tenant['business_email'],
            'business_phone' => $tenant['business_phone'],
            'business_address' => $tenant['business_address'],
        ];

        Response::json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public static function profile(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT 
            t.*,
            tl.max_customers,
            tl.max_routers,
            tl.max_resellers,
            (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.tenant_id) as total_customers,
            (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id) as total_routers
            FROM tenants t
            LEFT JOIN tenant_limits tl ON tl.tenant_id = t.tenant_id
            WHERE t.tenant_id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $tenant = $stmt->fetch();

        if (!$tenant) {
            Response::error('Tenant not found', 404);
        }

        $limits = [
            'maxRouters' => (int)($tenant['max_routers'] ?? 10),
            'maxOlts' => 5,
            'maxUsers' => (int)($tenant['max_resellers'] ?? 50),
            'maxCustomers' => (int)($tenant['max_customers'] ?? 5000),
            'mapEnabled' => true,
            'monitoringEnabled' => true,
        ];

        $tenantData = [
            'tenantId' => (string)$tenant['tenant_id'],
            'tenantCode' => $tenant['tenant_code'],
            'tenantName' => $tenant['tenant_name'],
            'tenantSlug' => $tenant['tenant_slug'],
            'businessEmail' => $tenant['business_email'],
            'businessPhone' => $tenant['business_phone'],
            'businessAddress' => $tenant['business_address'],
            'countryCode' => $tenant['country_code'] ?? 'BD',
            'timezone' => $tenant['timezone'] ?? 'Asia/Dhaka',
            'currencyCode' => $tenant['currency_code'] ?? 'BDT',
            'status' => $tenant['status'] ?? 'active',
            'trialEndsAt' => $tenant['trial_ends_at'],
            'activatedAt' => $tenant['activated_at'],
            'createdAt' => $tenant['created_at'],
            'updatedAt' => $tenant['updated_at'] ?? $tenant['created_at'],
            'totalCustomers' => (int)$tenant['total_customers'],
            'totalRouters' => (int)$tenant['total_routers'],
            'limits' => $limits,
            'tenant_id' => (string)$tenant['tenant_id'],
            'tenant_code' => $tenant['tenant_code'],
            'tenant_name' => $tenant['tenant_name'],
        ];

        // Fetch settings from tenant_settings table
        $stmtSet = $db->prepare("SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = :tid");
        $stmtSet->execute(['tid' => $id]);
        $settingsRows = $stmtSet->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        $settings = [
            'tenantSettingsId' => (string)$tenant['tenant_id'],
            'tenantId' => (string)$tenant['tenant_id'],
            'mapEnabled' => isset($settingsRows['map_enabled']) ? (bool)$settingsRows['map_enabled'] : true,
            'monitoringEnabled' => isset($settingsRows['monitoring_enabled']) ? (bool)$settingsRows['monitoring_enabled'] : true,
            'smsEnabled' => isset($settingsRows['sms_enabled']) ? (bool)$settingsRows['sms_enabled'] : true,
            'paymentBkashEnabled' => isset($settingsRows['payment_bkash_enabled']) ? (bool)$settingsRows['payment_bkash_enabled'] : false,
            'paymentSurjopayEnabled' => isset($settingsRows['payment_surjopay_enabled']) ? (bool)$settingsRows['payment_surjopay_enabled'] : false,
            'paymentSslEnabled' => isset($settingsRows['payment_ssl_enabled']) ? (bool)$settingsRows['payment_ssl_enabled'] : false,
            'createdAt' => $tenant['created_at'],
            'updatedAt' => $tenant['updated_at'] ?? $tenant['created_at'],
        ];

        // Payment gateways
        $stmtPg = $db->prepare("SELECT * FROM payment_gateway_settings WHERE tenant_id = :tid");
        $stmtPg->execute(['tid' => $id]);
        $pgRows = $stmtPg->fetchAll() ?: [];
        $paymentGateways = array_map(function($pg) {
            return [
                'paymentGatewaySettingsId' => (string)$pg['id'],
                'tenantId' => (string)$pg['tenant_id'],
                'gateway' => $pg['gateway'],
                'isEnabled' => (bool)$pg['is_active'],
                'credentials' => [
                    'appKey' => $pg['app_key'] ?? '',
                    'appSecret' => $pg['app_secret'] ?? '',
                    'username' => $pg['username'] ?? '',
                    'password' => $pg['password'] ?? '',
                    'sandbox' => (bool)$pg['is_sandbox'],
                ],
                'createdAt' => $pg['created_at'],
                'updatedAt' => $pg['updated_at'],
            ];
        }, $pgRows);

        // SMS gateways
        $stmtSms = $db->prepare("SELECT * FROM sms_gateway_settings WHERE tenant_id = :tid");
        $stmtSms->execute(['tid' => $id]);
        $smsRows = $stmtSms->fetchAll() ?: [];
        $smsGateways = array_map(function($sms) {
            return [
                'smsGatewaySettingsId' => (string)$sms['id'],
                'tenantId' => (string)$sms['tenant_id'],
                'providerName' => $sms['provider'],
                'isEnabled' => (bool)$sms['is_active'],
                'credentials' => [
                    'apiKey' => $sms['api_key'] ?? '',
                    'senderId' => $sms['sender_id'] ?? '',
                    'balance' => (float)$sms['balance'],
                ],
                'createdAt' => $sms['created_at'],
                'updatedAt' => $sms['updated_at'],
            ];
        }, $smsRows);

        // Fetch MikroTik Routers
        $stmtRouters = $db->prepare("SELECT 
            nd.network_device_id, nd.device_code, nd.device_name, nd.device_type, nd.vendor,
            nd.management_ip, nd.management_port, nd.winbox_port, nd.web_port, nd.status,
            nd.last_sync_at, nd.created_at,
            (SELECT COUNT(*) FROM customer_network_accounts cna WHERE cna.network_device_id = nd.network_device_id) as total_customers
            FROM network_devices nd 
            WHERE nd.tenant_id = :tid AND nd.device_type = 'router'
            ORDER BY nd.network_device_id DESC");
        $stmtRouters->execute(['tid' => $id]);
        $routersRows = $stmtRouters->fetchAll() ?: [];
        $routers = array_map(function($r) {
            return [
                'networkDeviceId' => (string)$r['network_device_id'],
                'deviceCode' => $r['device_code'],
                'deviceName' => $r['device_name'],
                'deviceType' => $r['device_type'],
                'vendor' => $r['vendor'],
                'managementIp' => $r['management_ip'],
                'managementPort' => (int)$r['management_port'],
                'winboxPort' => (int)($r['winbox_port'] ?? 8291),
                'webPort' => (int)($r['web_port'] ?? 80),
                'status' => $r['status'],
                'lastSyncAt' => $r['last_sync_at'],
                'totalCustomers' => (int)($r['total_customers'] ?? 0),
                'createdAt' => $r['created_at'],
            ];
        }, $routersRows);

        // Fetch OLT Devices
        $stmtOlts = $db->prepare("SELECT 
            nd.network_device_id, nd.device_code, nd.device_name, nd.device_type, nd.vendor,
            nd.management_ip, nd.management_port, nd.pon_type, nd.total_pon_ports, nd.status,
            nd.last_sync_at, nd.created_at,
            (SELECT COUNT(*) FROM olt_onus o WHERE o.network_device_id = nd.network_device_id) as total_onus
            FROM network_devices nd 
            WHERE nd.tenant_id = :tid AND nd.device_type = 'olt'
            ORDER BY nd.network_device_id DESC");
        $stmtOlts->execute(['tid' => $id]);
        $oltsRows = $stmtOlts->fetchAll() ?: [];
        $olts = array_map(function($o) {
            return [
                'networkDeviceId' => (string)$o['network_device_id'],
                'deviceCode' => $o['device_code'],
                'deviceName' => $o['device_name'],
                'deviceType' => $o['device_type'],
                'vendor' => $o['vendor'],
                'managementIp' => $o['management_ip'],
                'managementPort' => (int)$o['management_port'],
                'ponType' => $o['pon_type'] ?? 'gpon',
                'totalPonPorts' => (int)($o['total_pon_ports'] ?? 8),
                'totalOnus' => (int)($o['total_onus'] ?? 0),
                'status' => $o['status'],
                'lastSyncAt' => $o['last_sync_at'],
                'createdAt' => $o['created_at'],
            ];
        }, $oltsRows);

        // Fetch Tenant Staff / Admin Users
        $stmtUsers = $db->prepare("SELECT user_id, email, username, first_name, last_name, phone, role, status, last_login_at, created_at 
            FROM users 
            WHERE tenant_id = :tid 
            ORDER BY user_id ASC");
        $stmtUsers->execute(['tid' => $id]);
        $userRows = $stmtUsers->fetchAll() ?: [];
        $usersList = array_map(function($u) {
            return [
                'userId' => (string)$u['user_id'],
                'email' => $u['email'],
                'username' => $u['username'],
                'firstName' => $u['first_name'],
                'lastName' => $u['last_name'],
                'phone' => $u['phone'],
                'role' => $u['role'],
                'status' => $u['status'],
                'lastLoginAt' => $u['last_login_at'],
                'createdAt' => $u['created_at'],
            ];
        }, $userRows);

        // Fetch Tenant Statistics
        $stmtStats = $db->prepare("SELECT 
            (SELECT COUNT(*) FROM customers WHERE tenant_id = :tid) as total_customers,
            (SELECT COUNT(*) FROM network_devices WHERE tenant_id = :tid AND device_type = 'router') as total_routers,
            (SELECT COUNT(*) FROM network_devices WHERE tenant_id = :tid AND device_type = 'olt') as total_olts,
            (SELECT COUNT(*) FROM olt_onus WHERE tenant_id = :tid) as total_onus,
            (SELECT COUNT(*) FROM users WHERE tenant_id = :tid AND role IN ('reseller', 'sub_reseller')) as total_resellers");
        $stmtStats->execute(['tid' => $id]);
        $statsRow = $stmtStats->fetch() ?: [];

        $stats = [
            'totalCustomers' => (int)($statsRow['total_customers'] ?? 0),
            'totalRouters' => (int)($statsRow['total_routers'] ?? 0),
            'totalOlts' => (int)($statsRow['total_olts'] ?? 0),
            'totalOnus' => (int)($statsRow['total_onus'] ?? 0),
            'totalResellers' => (int)($statsRow['total_resellers'] ?? 0),
        ];

        Response::json([
            'success' => true,
            'data' => [
                'tenant' => $tenantData,
                'settings' => $settings,
                'paymentGateways' => $paymentGateways,
                'smsGateways' => $smsGateways,
                'smsGateway' => $smsGateways[0] ?? null,
                'routers' => $routers,
                'olts' => $olts,
                'users' => $usersList,
                'stats' => $stats,
                'limits' => $limits,
                'features' => [
                    'mikrotikSync' => true,
                    'customerPortal' => true,
                    'smsNotifications' => true,
                    'resellerCommission' => true,
                ],
            ],
        ]);
    }

    public static function mySettings(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmtPg = $db->prepare("SELECT * FROM payment_gateway_settings WHERE tenant_id = :tid");
        $stmtPg->execute(['tid' => $tenantId]);
        $pgs = $stmtPg->fetchAll() ?: [];

        $stmtSms = $db->prepare("SELECT * FROM sms_gateway_settings WHERE tenant_id = :tid");
        $stmtSms->execute(['tid' => $tenantId]);
        $sms = $stmtSms->fetchAll() ?: [];

        Response::json([
            'success' => true,
            'data' => [
                'settings' => [
                    'currency' => 'BDT',
                    'timezone' => 'Asia/Dhaka',
                    'companyName' => 'NetFix Broadband',
                ],
                'paymentGateways' => $pgs,
                'smsGateways' => $sms,
            ],
        ]);
    }

    public static function smsProviders(): void {
        Response::json([
            'success' => true,
            'data' => [
                ['id' => 'mim_sms', 'name' => 'MIM SMS Gateway (Bangladesh)'],
                ['id' => 'greenweb', 'name' => 'GreenWeb SMS'],
                ['id' => 'bulksmsbd', 'name' => 'BulkSMS BD'],
                ['id' => 'infobip', 'name' => 'Infobip Global'],
            ],
        ]);
    }

    public static function create(): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $name = trim($data['tenantName'] ?? $data['tenant_name'] ?? '');
        $email = trim($data['businessEmail'] ?? $data['business_email'] ?? '');

        if (empty($name) || empty($email)) {
            Response::error('Tenant Name and Business Email are required', 400);
        }

        $code = trim($data['tenantCode'] ?? $data['tenant_code'] ?? '');
        if (empty($code)) {
            $code = 'ISP' . rand(100, 999);
        }

        $slug = trim($data['tenantSlug'] ?? $data['tenant_slug'] ?? '');
        if (empty($slug)) {
            $slug = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $name)) . '-' . rand(10, 99);
        }

        $countryCode = strtoupper(trim($data['countryCode'] ?? $data['country_code'] ?? 'BD'));
        $status = $data['status'] ?? 'active';
        $phone = $data['businessPhone'] ?? $data['business_phone'] ?? null;
        $address = $data['businessAddress'] ?? $data['business_address'] ?? null;

        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO tenants 
            (tenant_code, tenant_name, tenant_slug, business_email, business_phone, business_address, country_code, status)
            VALUES (:code, :name, :slug, :email, :phone, :addr, :country, :status)");
        $stmt->execute([
            'code' => $code,
            'name' => $name,
            'slug' => $slug,
            'email' => $email,
            'phone' => $phone,
            'addr' => $address,
            'country' => $countryCode,
            'status' => $status,
        ]);

        $id = (int)$db->lastInsertId();

        // Create default limits
        $limits = $data['limits'] ?? [];
        $maxCustomers = (int)($limits['maxCustomers'] ?? $limits['max_customers'] ?? 5000);
        $maxRouters = (int)($limits['maxRouters'] ?? $limits['max_routers'] ?? 10);
        $maxUsers = (int)($limits['maxUsers'] ?? $limits['max_resellers'] ?? 50);

        $stmtLim = $db->prepare("INSERT INTO tenant_limits (tenant_id, max_customers, max_routers, max_resellers)
            VALUES (:id, :mc, :mr, :mres)");
        $stmtLim->execute([
            'id' => $id,
            'mc' => $maxCustomers,
            'mr' => $maxRouters,
            'mres' => $maxUsers,
        ]);

        // If admin password is provided, create initial tenant admin user
        $adminPassword = $data['adminPassword'] ?? null;
        if (!empty($adminPassword)) {
            $passwordHash = password_hash($adminPassword, PASSWORD_BCRYPT);
            $stmtUser = $db->prepare("INSERT INTO users 
                (tenant_id, email, username, password_hash, first_name, last_name, phone, role, role_level, status)
                VALUES (:tid, :email, :username, :hash, :fn, :ln, :phone, 'admin', 100, 'active')");
            $stmtUser->execute([
                'tid' => $id,
                'email' => $email,
                'username' => strtolower($code) . '_admin',
                'hash' => $passwordHash,
                'fn' => $name,
                'ln' => 'Admin',
                'phone' => $phone,
            ]);
        }

        Response::json([
            'success' => true,
            'message' => 'Tenant created successfully',
            'data' => [
                'tenantId' => (string)$id,
                'tenant_id' => (string)$id,
                'tenantCode' => $code,
                'tenant_code' => $code,
                'tenantName' => $name,
                'tenant_name' => $name,
            ],
        ], 201);
    }

    public static function update(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $db = Database::getConnection();

        $name = $data['tenantName'] ?? $data['tenant_name'] ?? null;
        $phone = $data['businessPhone'] ?? $data['business_phone'] ?? null;
        $address = $data['businessAddress'] ?? $data['business_address'] ?? null;
        $status = $data['status'] ?? null;
        $country = $data['countryCode'] ?? $data['country_code'] ?? null;

        $updates = [];
        $params = ['id' => $id];

        if ($name !== null) { $updates[] = "tenant_name = :name"; $params['name'] = $name; }
        if ($phone !== null) { $updates[] = "business_phone = :phone"; $params['phone'] = $phone; }
        if ($address !== null) { $updates[] = "business_address = :addr"; $params['addr'] = $address; }
        if ($status !== null) { $updates[] = "status = :status"; $params['status'] = $status; }
        if ($country !== null) { $updates[] = "country_code = :country"; $params['country'] = $country; }

        if (!empty($updates)) {
            $sql = "UPDATE tenants SET " . implode(', ', $updates) . " WHERE tenant_id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }

        // Handle limits update if sent inside update payload
        if (isset($data['limits']) && is_array($data['limits'])) {
            $limits = $data['limits'];
            $maxCustomers = (int)($limits['maxCustomers'] ?? $limits['max_customers'] ?? 5000);
            $maxRouters = (int)($limits['maxRouters'] ?? $limits['max_routers'] ?? 10);
            $maxUsers = (int)($limits['maxUsers'] ?? $limits['max_resellers'] ?? 50);

            $stmtLim = $db->prepare("INSERT INTO tenant_limits (tenant_id, max_customers, max_routers, max_resellers)
                VALUES (:id, :mc, :mr, :mres)
                ON DUPLICATE KEY UPDATE max_customers = VALUES(max_customers), max_routers = VALUES(max_routers), max_resellers = VALUES(max_resellers)");
            $stmtLim->execute([
                'id' => $id,
                'mc' => $maxCustomers,
                'mr' => $maxRouters,
                'mres' => $maxUsers,
            ]);
        }

        // Handle admin password update if provided
        if (!empty($data['adminPassword'])) {
            $passwordHash = password_hash($data['adminPassword'], PASSWORD_BCRYPT);
            $stmtUser = $db->prepare("UPDATE users SET password_hash = :hash WHERE tenant_id = :tid AND role = 'admin' LIMIT 1");
            $stmtUser->execute([
                'hash' => $passwordHash,
                'tid' => $id,
            ]);
        }

        Response::json(['success' => true, 'message' => 'Tenant updated']);
    }

    public static function updateLimits(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $db = Database::getConnection();

        $stmt = $db->prepare("INSERT INTO tenant_limits (tenant_id, max_customers, max_routers, max_resellers)
            VALUES (:id, :mc, :mr, :mres)
            ON DUPLICATE KEY UPDATE max_customers = VALUES(max_customers), max_routers = VALUES(max_routers), max_resellers = VALUES(max_resellers)");
        $stmt->execute([
            'id' => $id,
            'mc' => (int)($data['max_customers'] ?? $data['maxCustomers'] ?? 5000),
            'mr' => (int)($data['max_routers'] ?? $data['maxRouters'] ?? 10),
            'mres' => (int)($data['max_resellers'] ?? $data['maxUsers'] ?? 50),
        ]);

        Response::json(['success' => true, 'message' => 'Limits updated']);
    }

    public static function updateFeatures(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $db = Database::getConnection();

        $stmt = $db->prepare("INSERT INTO tenant_settings (tenant_id, setting_key, setting_value) 
            VALUES (:tid, :key, :val) 
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");

        if (isset($data['mapEnabled'])) {
            $stmt->execute(['tid' => $id, 'key' => 'map_enabled', 'val' => $data['mapEnabled'] ? '1' : '0']);
        }
        if (isset($data['monitoringEnabled'])) {
            $stmt->execute(['tid' => $id, 'key' => 'monitoring_enabled', 'val' => $data['monitoringEnabled'] ? '1' : '0']);
        }

        Response::json(['success' => true, 'message' => 'Features updated']);
    }

    public static function updatePaymentGateways(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $gateways = $data['gateways'] ?? [];
        $db = Database::getConnection();

        foreach ($gateways as $gw) {
            $name = $gw['gateway'] ?? '';
            $enabled = !empty($gw['isEnabled']) ? 1 : 0;
            $creds = $gw['credentials'] ?? [];

            $stmt = $db->prepare("SELECT id FROM payment_gateway_settings WHERE tenant_id = :tid AND gateway = :gw LIMIT 1");
            $stmt->execute(['tid' => $id, 'gw' => $name]);
            $exists = $stmt->fetch();

            if ($exists) {
                $stmtUp = $db->prepare("UPDATE payment_gateway_settings 
                    SET is_active = :act, 
                        app_key = COALESCE(:ak, app_key), 
                        app_secret = COALESCE(:as, app_secret),
                        username = COALESCE(:un, username),
                        password = COALESCE(:pw, password),
                        is_sandbox = :sb
                    WHERE id = :id");
                $stmtUp->execute([
                    'act' => $enabled,
                    'ak' => $creds['appKey'] ?? null,
                    'as' => $creds['appSecret'] ?? null,
                    'un' => $creds['username'] ?? null,
                    'pw' => $creds['password'] ?? null,
                    'sb' => !empty($creds['sandbox']) ? 1 : 0,
                    'id' => $exists['id'],
                ]);
            } else {
                $stmtIn = $db->prepare("INSERT INTO payment_gateway_settings 
                    (tenant_id, gateway, app_key, app_secret, username, password, is_sandbox, is_active)
                    VALUES (:tid, :gw, :ak, :as, :un, :pw, :sb, :act)");
                $stmtIn->execute([
                    'tid' => $id,
                    'gw' => $name,
                    'ak' => $creds['appKey'] ?? '',
                    'as' => $creds['appSecret'] ?? '',
                    'un' => $creds['username'] ?? '',
                    'pw' => $creds['password'] ?? '',
                    'sb' => !empty($creds['sandbox']) ? 1 : 0,
                    'act' => $enabled,
                ]);
            }
        }

        Response::json(['success' => true, 'message' => 'Payment gateways updated']);
    }

    public static function updateSmsGateway(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $db = Database::getConnection();

        $provider = $data['providerName'] ?? 'mim_sms';
        $enabled = !empty($data['isEnabled']) ? 1 : 0;
        $creds = $data['credentials'] ?? [];

        $stmt = $db->prepare("SELECT id FROM sms_gateway_settings WHERE tenant_id = :tid LIMIT 1");
        $stmt->execute(['tid' => $id]);
        $exists = $stmt->fetch();

        if ($exists) {
            $stmtUp = $db->prepare("UPDATE sms_gateway_settings 
                SET provider = :p, is_active = :act, api_key = COALESCE(:ak, api_key), sender_id = COALESCE(:sid, sender_id)
                WHERE id = :id");
            $stmtUp->execute([
                'p' => $provider,
                'act' => $enabled,
                'ak' => $creds['apiKey'] ?? null,
                'sid' => $creds['senderId'] ?? null,
                'id' => $exists['id'],
            ]);
        } else {
            $stmtIn = $db->prepare("INSERT INTO sms_gateway_settings (tenant_id, provider, api_key, sender_id, is_active)
                VALUES (:tid, :p, :ak, :sid, :act)");
            $stmtIn->execute([
                'tid' => $id,
                'p' => $provider,
                'ak' => $creds['apiKey'] ?? '',
                'sid' => $creds['senderId'] ?? '',
                'act' => $enabled,
            ]);
        }

        Response::json(['success' => true, 'message' => 'SMS gateway updated']);
    }

    public static function resetAdminPassword(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $newPassword = trim($data['password'] ?? '');

        if (strlen($newPassword) < 6) {
            Response::error('Password must be at least 6 characters long', 400);
        }

        $db = Database::getConnection();
        $hash = password_hash($newPassword, PASSWORD_BCRYPT);

        $stmt = $db->prepare("UPDATE users SET password_hash = :hash WHERE tenant_id = :tid AND role IN ('admin', 'isp_admin') ORDER BY user_id ASC LIMIT 1");
        $stmt->execute(['hash' => $hash, 'tid' => $id]);

        Response::json(['success' => true, 'message' => 'Admin password has been reset successfully']);
    }

    public static function delete(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare("UPDATE tenants SET status = 'terminated', terminated_at = NOW() WHERE tenant_id = :id");
        $stmt->execute(['id' => $id]);

        Response::json(['success' => true, 'message' => 'Tenant terminated']);
    }
}
