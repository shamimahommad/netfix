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
            (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id AND nd.device_type = 'router') as total_routers,
            (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id AND nd.device_type = 'olt') as total_olts,
            (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.tenant_id) as total_users
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
                'totalCustomers' => (int)($r['total_customers'] ?? 0),
                'totalRouters' => (int)($r['total_routers'] ?? 0),
                'totalOlts' => (int)($r['total_olts'] ?? 0),
                'totalUsers' => (int)($r['total_users'] ?? 0),
                'logStorageMode' => $r['log_storage_mode'] ?? 'short_term_redis',
                'logRetentionDays' => (int)($r['log_retention_days'] ?? 1),
                'maxLiveLogs' => (int)($r['max_live_logs'] ?? 1000),
                'limits' => $limits,

                // SnakeCase backward compatibility
                'tenant_id' => (string)$r['tenant_id'],
                'tenant_code' => $r['tenant_code'],
                'tenant_name' => $r['tenant_name'],
                'tenant_slug' => $r['tenant_slug'],
                'business_email' => $r['business_email'],
                'business_phone' => $r['business_phone'],
                'business_address' => $r['business_address'],
                'log_storage_mode' => $r['log_storage_mode'] ?? 'short_term_redis',
                'log_retention_days' => (int)($r['log_retention_days'] ?? 1),
                'max_live_logs' => (int)($r['max_live_logs'] ?? 1000),
                'total_customers' => (int)($r['total_customers'] ?? 0),
                'total_routers' => (int)($r['total_routers'] ?? 0),
                'total_olts' => (int)($r['total_olts'] ?? 0),
                'total_users' => (int)($r['total_users'] ?? 0),
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
            'logStorageMode' => $tenant['log_storage_mode'] ?? 'short_term_redis',
            'logRetentionDays' => (int)($tenant['log_retention_days'] ?? 1),
            'maxLiveLogs' => (int)($tenant['max_live_logs'] ?? 1000),
            'limits' => $limits,

            // SnakeCase
            'tenant_id' => (string)$tenant['tenant_id'],
            'tenant_code' => $tenant['tenant_code'],
            'tenant_name' => $tenant['tenant_name'],
            'tenant_slug' => $tenant['tenant_slug'],
            'business_email' => $tenant['business_email'],
            'business_phone' => $tenant['business_phone'],
            'business_address' => $tenant['business_address'],
            'log_storage_mode' => $tenant['log_storage_mode'] ?? 'short_term_redis',
            'log_retention_days' => (int)($tenant['log_retention_days'] ?? 1),
            'max_live_logs' => (int)($tenant['max_live_logs'] ?? 1000),
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
            'logStorageMode' => $tenant['log_storage_mode'] ?? 'short_term_redis',
            'logRetentionDays' => (int)($tenant['log_retention_days'] ?? 1),
            'maxLiveLogs' => (int)($tenant['max_live_logs'] ?? 1000),
            'limits' => $limits,
            'tenant_id' => (string)$tenant['tenant_id'],
            'tenant_code' => $tenant['tenant_code'],
            'tenant_name' => $tenant['tenant_name'],
            'log_storage_mode' => $tenant['log_storage_mode'] ?? 'short_term_redis',
            'log_retention_days' => (int)($tenant['log_retention_days'] ?? 1),
            'max_live_logs' => (int)($tenant['max_live_logs'] ?? 1000),
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
        $realTid = (int)$tenant['tenant_id'];
        $stmtPg = $db->prepare("SELECT * FROM payment_gateway_settings WHERE tenant_id = :tid");
        $stmtPg->execute(['tid' => $realTid]);
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
                    'store_id' => $pg['app_key'] ?? '',
                    'store_passwd' => $pg['app_secret'] ?? '',
                    'apiKey' => $pg['username'] ?? '',
                    'apiSecret' => $pg['password'] ?? '',
                    'prefix' => $pg['app_key'] ?? 'NOK',
                    'sandbox' => (bool)$pg['is_sandbox'],
                ],
                'createdAt' => $pg['created_at'],
                'updatedAt' => $pg['updated_at'],
            ];
        }, $pgRows);

        if (empty($paymentGateways)) {
            $paymentGateways = [
                [
                    'paymentGatewaySettingsId' => '1',
                    'tenantId' => (string)$realTid,
                    'gateway' => 'bkash',
                    'isEnabled' => true,
                    'credentials' => [
                        'appKey' => '',
                        'appSecret' => '',
                        'username' => '',
                        'password' => '',
                        'sandbox' => true,
                    ],
                ],
                [
                    'paymentGatewaySettingsId' => '2',
                    'tenantId' => (string)$realTid,
                    'gateway' => 'surjopay',
                    'isEnabled' => false,
                    'credentials' => [
                        'username' => '',
                        'password' => '',
                        'prefix' => 'NOK',
                        'apiKey' => '',
                        'apiSecret' => '',
                        'sandbox' => true,
                    ],
                ],
                [
                    'paymentGatewaySettingsId' => '3',
                    'tenantId' => (string)$realTid,
                    'gateway' => 'ssl',
                    'isEnabled' => false,
                    'credentials' => [
                        'store_id' => '',
                        'store_passwd' => '',
                        'sandbox' => true,
                    ],
                ],
            ];
        }

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

        $tStmt = $db->prepare("SELECT tenant_name, logo_url, business_email, business_phone, support_phone, business_address FROM tenants WHERE tenant_id = :tid LIMIT 1");
        $tStmt->execute(['tid' => $tenantId]);
        $tInfo = $tStmt->fetch(PDO::FETCH_ASSOC);

        Response::json([
            'success' => true,
            'data' => [
                'settings' => [
                    'currency' => 'BDT',
                    'timezone' => 'Asia/Dhaka',
                    'companyName' => $tInfo['tenant_name'] ?? 'Star Network',
                    'logoUrl' => $tInfo['logo_url'] ?? null,
                    'companyEmail' => $tInfo['business_email'] ?? '',
                    'ownerPhone' => $tInfo['business_phone'] ?? '',
                    'supportPhone' => $tInfo['support_phone'] ?? '',
                    'address' => $tInfo['business_address'] ?? '',
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

    public static function generateUniqueTenantCode(PDO $db): string {
        $stmt = $db->query("SELECT tenant_code FROM tenants ORDER BY tenant_id DESC");
        $maxNum = 1000;
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $code = $row['tenant_code'] ?? '';
            if (preg_match('/^[0-9]+$/', $code)) {
                $num = (int)$code;
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            } elseif (preg_match('/([0-9]+)/', $code, $m)) {
                $num = (int)$m[1];
                if ($num < 1000) $num += 1000;
                if ($num > $maxNum) {
                    $maxNum = $num;
                }
            }
        }
        $nextNum = max($maxNum + 1, 1001);
        $candidate = (string)$nextNum;

        // Ensure completely collision-free
        $chk = $db->prepare("SELECT COUNT(*) FROM tenants WHERE tenant_code = :c");
        $chk->execute(['c' => $candidate]);
        while ((int)$chk->fetchColumn() > 0) {
            $nextNum++;
            $candidate = (string)$nextNum;
            $chk->execute(['c' => $candidate]);
        }

        return $candidate;
    }

    public static function nextCode(): void {
        AuthMiddleware::requireAuth();
        $db = Database::getConnection();
        $code = self::generateUniqueTenantCode($db);
        Response::json([
            'success' => true,
            'nextCode' => $code,
            'suggestedCode' => $code
        ]);
    }

    public static function lookup(string $codeOrId): void {
        AuthMiddleware::requireAuth();
        $db = Database::getConnection();
        $q = trim($codeOrId);

        // Priority 1: Check by tenant_code (ISP unique ID number)
        $stmt = $db->prepare("SELECT 
            t.*,
            tl.max_customers,
            tl.max_routers,
            tl.max_resellers,
            (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.tenant_id) as total_customers,
            (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id AND nd.device_type = 'router') as total_routers,
            (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id AND nd.device_type = 'olt') as total_olts
            FROM tenants t
            LEFT JOIN tenant_limits tl ON tl.tenant_id = t.tenant_id
            WHERE t.tenant_code = :code
            LIMIT 1");
        $stmt->execute(['code' => $q]);
        $tenant = $stmt->fetch(PDO::FETCH_ASSOC);

        // Fallback: check by tenant_id or slug if not found by code
        if (!$tenant) {
            $stmtFallback = $db->prepare("SELECT 
                t.*,
                tl.max_customers,
                tl.max_routers,
                tl.max_resellers,
                (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.tenant_id) as total_customers,
                (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id AND nd.device_type = 'router') as total_routers,
                (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id AND nd.device_type = 'olt') as total_olts
                FROM tenants t
                LEFT JOIN tenant_limits tl ON tl.tenant_id = t.tenant_id
                WHERE t.tenant_id = :tid OR t.tenant_slug = :slug
                LIMIT 1");
            $stmtFallback->execute([
                'tid' => is_numeric($q) ? (int)$q : 0,
                'slug' => $q
            ]);
            $tenant = $stmtFallback->fetch(PDO::FETCH_ASSOC);
        }

        if (!$tenant) {
            Response::json(['success' => false, 'message' => "ISP with ID or Code '{$q}' not found"], 404);
            return;
        }

        Response::json([
            'success' => true,
            'data' => [
                'tenantId' => (string)$tenant['tenant_id'],
                'tenantCode' => $tenant['tenant_code'],
                'tenantName' => $tenant['tenant_name'],
                'businessEmail' => $tenant['business_email'],
                'businessPhone' => $tenant['business_phone'],
                'status' => $tenant['status'],
                'webhookUrl' => "/api/payment/webhook?isp_id=" . $tenant['tenant_code'],
                'totalCustomers' => (int)($tenant['total_customers'] ?? 0),
                'totalRouters' => (int)($tenant['total_routers'] ?? 0),
                'totalOlts' => (int)($tenant['total_olts'] ?? 0),
            ]
        ]);
    }

    public static function create(): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $name = trim($data['tenantName'] ?? $data['tenant_name'] ?? '');
        $email = trim($data['businessEmail'] ?? $data['business_email'] ?? '');

        if (empty($name) || empty($email)) {
            Response::error('Tenant Name and Business Email are required', 400);
            return;
        }

        $db = Database::getConnection();

        // Unique ISP ID Number verification & generation (Digits Only)
        $rawCode = trim($data['tenantCode'] ?? $data['tenant_code'] ?? '');
        $code = preg_replace('/\D/', '', $rawCode);
        if (empty($code)) {
            $code = self::generateUniqueTenantCode($db);
        } else {
            // Strictly enforce unique ISP ID number
            $chk = $db->prepare("SELECT COUNT(*) FROM tenants WHERE tenant_code = :c");
            $chk->execute(['c' => $code]);
            if ((int)$chk->fetchColumn() > 0) {
                Response::error("The ISP ID number '{$code}' is already registered. Please choose a different unique ID number.", 400);
                return;
            }
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
        $rawCode = isset($data['tenantCode']) || isset($data['tenant_code']) ? ($data['tenantCode'] ?? $data['tenant_code']) : null;
        $code = null;
        if ($rawCode !== null && trim((string)$rawCode) !== '') {
            $code = preg_replace('/\D/', '', trim((string)$rawCode));
        }

        $updates = [];
        $params = ['id' => $id];

        if ($code !== null && $code !== '') {
            $chk = $db->prepare("SELECT COUNT(*) FROM tenants WHERE tenant_code = :c AND tenant_id != :id");
            $chk->execute(['c' => $code, 'id' => $id]);
            if ((int)$chk->fetchColumn() > 0) {
                Response::error("The ISP ID number '{$code}' is already registered to another ISP.", 400);
                return;
            }
            $updates[] = "tenant_code = :code";
            $params['code'] = $code;
        }

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
            
            $tStmt = $db->prepare("SELECT tenant_id FROM tenants WHERE tenant_id = :id OR tenant_code = :code OR tenant_slug = :slug LIMIT 1");
            $tStmt->execute(['id' => $id, 'code' => $id, 'slug' => $id]);
            $realTenantId = $tStmt->fetchColumn() ?: (is_numeric($id) ? (int)$id : 0);

            $stmtUser = $db->prepare("UPDATE users SET password_hash = :hash, password_changed_at = NOW(), updated_at = NOW() WHERE tenant_id = :tid AND role IN ('admin', 'isp_admin') ORDER BY user_id ASC LIMIT 1");
            $stmtUser->execute([
                'hash' => $passwordHash,
                'tid' => $realTenantId,
            ]);
            if ($stmtUser->rowCount() === 0) {
                $uCheck = $db->prepare("SELECT user_id FROM users WHERE tenant_id = :tid ORDER BY user_id ASC LIMIT 1");
                $uCheck->execute(['tid' => $realTenantId]);
                $foundUserId = $uCheck->fetchColumn();
                if ($foundUserId) {
                    $db->prepare("UPDATE users SET password_hash = :hash, password_changed_at = NOW(), updated_at = NOW() WHERE user_id = :uid")
                        ->execute(['hash' => $passwordHash, 'uid' => $foundUserId]);
                }
            }
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

        // Resolve real integer tenant_id if tenant_code or slug passed
        $tStmt = $db->prepare("SELECT tenant_id FROM tenants WHERE tenant_id = :id OR tenant_code = :code OR tenant_slug = :slug LIMIT 1");
        $tStmt->execute(['id' => $id, 'code' => $id, 'slug' => $id]);
        $realTenantId = $tStmt->fetchColumn();
        if (!$realTenantId) {
            $realTenantId = is_numeric($id) ? (int)$id : 0;
        }

        foreach ($gateways as $gw) {
            $name = strtolower(trim($gw['gateway'] ?? ''));
            if ($name === 'sslcommerz') $name = 'ssl';
            $enabled = !empty($gw['isEnabled']) ? 1 : 0;
            $creds = $gw['credentials'] ?? [];

            $appKey = '';
            $appSecret = '';
            $username = '';
            $password = '';
            $isSandbox = isset($creds['sandbox']) ? ($creds['sandbox'] ? 1 : 0) : 1;

            if ($name === 'bkash') {
                $appKey = $creds['appKey'] ?? ($creds['app_key'] ?? '');
                $appSecret = $creds['appSecret'] ?? ($creds['app_secret'] ?? '');
                $username = $creds['username'] ?? '';
                $password = $creds['password'] ?? '';
            } else if ($name === 'ssl') {
                $appKey = $creds['store_id'] ?? ($creds['storeId'] ?? ($creds['appKey'] ?? ''));
                $appSecret = $creds['store_passwd'] ?? ($creds['storePassword'] ?? ($creds['appSecret'] ?? ''));
            } else if ($name === 'surjopay') {
                $appKey = $creds['prefix'] ?? ($creds['appKey'] ?? 'NOK');
                $username = $creds['username'] ?? ($creds['apiKey'] ?? '');
                $password = $creds['password'] ?? ($creds['apiSecret'] ?? '');
            } else {
                $appKey = $creds['appKey'] ?? '';
                $appSecret = $creds['appSecret'] ?? '';
                $username = $creds['username'] ?? '';
                $password = $creds['password'] ?? '';
            }

            $stmt = $db->prepare("SELECT id FROM payment_gateway_settings WHERE tenant_id = :tid AND gateway = :gw LIMIT 1");
            $stmt->execute(['tid' => $realTenantId, 'gw' => $name]);
            $exists = $stmt->fetch();

            if ($exists) {
                $stmtUp = $db->prepare("UPDATE payment_gateway_settings 
                    SET is_active = :act, 
                        app_key = :ak, 
                        app_secret = :as,
                        username = :un,
                        password = :pw,
                        is_sandbox = :sb,
                        updated_at = NOW()
                    WHERE id = :id");
                $stmtUp->execute([
                    'act' => $enabled,
                    'ak' => $appKey,
                    'as' => $appSecret,
                    'un' => $username,
                    'pw' => $password,
                    'sb' => $isSandbox,
                    'id' => $exists['id'],
                ]);
            } else {
                $stmtIn = $db->prepare("INSERT INTO payment_gateway_settings 
                    (tenant_id, gateway, app_key, app_secret, username, password, is_sandbox, is_active)
                    VALUES (:tid, :gw, :ak, :as, :un, :pw, :sb, :act)");
                $stmtIn->execute([
                    'tid' => $realTenantId,
                    'gw' => $name,
                    'ak' => $appKey,
                    'as' => $appSecret,
                    'un' => $username,
                    'pw' => $password,
                    'sb' => $isSandbox,
                    'act' => $enabled,
                ]);
            }

            // Sync with tenant_settings table
            $settingKey = "payment_{$name}_enabled";
            $stmtSet = $db->prepare("INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, created_at, updated_at)
                VALUES (:tid, :k, :v, NOW(), NOW())
                ON DUPLICATE KEY UPDATE setting_value = :v2, updated_at = NOW()");
            $stmtSet->execute([
                'tid' => $realTenantId,
                'k' => $settingKey,
                'v' => (string)$enabled,
                'v2' => (string)$enabled,
            ]);
        }

        Response::json(['success' => true, 'message' => 'Payment gateways updated successfully']);
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

        // Resolve real integer tenant_id if tenant_code or slug passed
        $tStmt = $db->prepare("SELECT tenant_id FROM tenants WHERE tenant_id = :id OR tenant_code = :code OR tenant_slug = :slug LIMIT 1");
        $tStmt->execute(['id' => $id, 'code' => $id, 'slug' => $id]);
        $realTenantId = $tStmt->fetchColumn();
        if (!$realTenantId) {
            $realTenantId = is_numeric($id) ? (int)$id : 0;
        }

        $stmt = $db->prepare("UPDATE users SET password_hash = :hash, password_changed_at = NOW(), updated_at = NOW() WHERE tenant_id = :tid AND role IN ('admin', 'isp_admin') ORDER BY user_id ASC LIMIT 1");
        $stmt->execute(['hash' => $hash, 'tid' => $realTenantId]);

        if ($stmt->rowCount() === 0) {
            $uCheck = $db->prepare("SELECT user_id FROM users WHERE tenant_id = :tid ORDER BY user_id ASC LIMIT 1");
            $uCheck->execute(['tid' => $realTenantId]);
            $foundUserId = $uCheck->fetchColumn();
            if ($foundUserId) {
                $db->prepare("UPDATE users SET password_hash = :hash, password_changed_at = NOW(), updated_at = NOW() WHERE user_id = :uid")
                    ->execute(['hash' => $hash, 'uid' => $foundUserId]);
            }
        }

        Response::json(['success' => true, 'message' => 'Admin password has been reset successfully']);
    }

    public static function updateLogPolicy(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $callerRole = strtolower($user['role'] ?? '');
        $userType = $user['user_type'] ?? '';
        if ($callerRole !== 'saas_admin' && $userType !== 'saas' && $callerRole !== 'admin') {
            Response::json(['success' => false, 'message' => 'Unauthorized: SaaS Admin permissions required'], 403);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $mode = $data['logStorageMode'] ?? $data['log_storage_mode'] ?? 'short_term_redis';
        $retentionDays = max(1, min(365, (int)($data['logRetentionDays'] ?? $data['log_retention_days'] ?? 1)));
        $maxLiveLogs = max(100, min(50000, (int)($data['maxLiveLogs'] ?? $data['max_live_logs'] ?? 1000)));

        $allowedModes = ['short_term_redis', 'long_term_victoria', 'disabled'];
        if (!in_array($mode, $allowedModes, true)) {
            Response::json(['success' => false, 'message' => 'Invalid log_storage_mode. Allowed: short_term_redis, long_term_victoria, disabled'], 400);
            return;
        }

        $db = Database::getConnection();
        $realTid = is_numeric($id) ? (int)$id : 0;

        $stmt = $db->prepare("UPDATE tenants 
                              SET log_storage_mode = :mode, 
                                  log_retention_days = :retention, 
                                  max_live_logs = :max_logs, 
                                  updated_at = NOW() 
                              WHERE tenant_id = :tid OR tenant_code = :tcode");
        $stmt->execute([
            'mode' => $mode,
            'retention' => $retentionDays,
            'max_logs' => $maxLiveLogs,
            'tid' => $realTid,
            'tcode' => $id,
        ]);

        Response::json([
            'success' => true,
            'message' => 'Log storage policy updated successfully',
            'data' => [
                'logStorageMode' => $mode,
                'logRetentionDays' => $retentionDays,
                'maxLiveLogs' => $maxLiveLogs,
            ]
        ]);
    }

    public static function delete(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare("UPDATE tenants SET status = 'terminated', terminated_at = NOW() WHERE tenant_id = :id");
        $stmt->execute(['id' => $id]);

        Response::json(['success' => true, 'message' => 'Tenant terminated']);
    }
}
