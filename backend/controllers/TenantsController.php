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
            return [
                'tenant_id' => (string)$r['tenant_id'],
                'tenant_code' => $r['tenant_code'],
                'tenant_name' => $r['tenant_name'],
                'tenant_slug' => $r['tenant_slug'],
                'business_email' => $r['business_email'],
                'business_phone' => $r['business_phone'],
                'business_address' => $r['business_address'],
                'status' => $r['status'],
                'total_customers' => (int)$r['total_customers'],
                'total_routers' => (int)$r['total_routers'],
                'max_customers' => (int)($r['max_customers'] ?? 5000),
                'max_routers' => (int)($r['max_routers'] ?? 10),
                'max_resellers' => (int)($r['max_resellers'] ?? 50),
                'created_at' => $r['created_at'],
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

        $stmt = $db->prepare("SELECT * FROM tenants WHERE tenant_id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $tenant = $stmt->fetch();

        if (!$tenant) {
            Response::error('Tenant not found', 404);
        }

        Response::json([
            'success' => true,
            'data' => $tenant,
        ]);
    }

    public static function profile(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM tenants WHERE tenant_id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $tenant = $stmt->fetch();

        if (!$tenant) {
            Response::error('Tenant not found', 404);
        }

        $stmtPg = $db->prepare("SELECT * FROM payment_gateway_settings WHERE tenant_id = :tid");
        $stmtPg->execute(['tid' => $id]);
        $pgs = $stmtPg->fetchAll() ?: [];

        $stmtSms = $db->prepare("SELECT * FROM sms_gateway_settings WHERE tenant_id = :tid LIMIT 1");
        $stmtSms->execute(['tid' => $id]);
        $sms = $stmtSms->fetch() ?: [];

        Response::json([
            'success' => true,
            'data' => [
                'tenant' => [
                    'tenantId' => (string)$tenant['tenant_id'],
                    'tenantName' => $tenant['tenant_name'],
                    'tenantCode' => $tenant['tenant_code'],
                    'businessEmail' => $tenant['business_email'],
                    'businessPhone' => $tenant['business_phone'],
                    'businessAddress' => $tenant['business_address'],
                    'currencyCode' => $tenant['currency_code'] ?? 'BDT',
                    'timezone' => $tenant['timezone'] ?? 'Asia/Dhaka',
                    'status' => $tenant['status'],
                ],
                'features' => [
                    'mikrotikSync' => true,
                    'customerPortal' => true,
                    'smsNotifications' => true,
                    'resellerCommission' => true,
                ],
                'paymentGateways' => $pgs,
                'smsGateway' => $sms,
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

        $code = 'ISP' . rand(100, 999);
        $slug = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $name)) . '-' . rand(10, 99);

        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO tenants 
            (tenant_code, tenant_name, tenant_slug, business_email, business_phone, business_address, status)
            VALUES (:code, :name, :slug, :email, :phone, :addr, 'active')");
        $stmt->execute([
            'code' => $code,
            'name' => $name,
            'slug' => $slug,
            'email' => $email,
            'phone' => $data['businessPhone'] ?? null,
            'addr' => $data['businessAddress'] ?? null,
        ]);

        $id = $db->lastInsertId();

        Response::json([
            'success' => true,
            'message' => 'Tenant created successfully',
            'data' => [
                'tenant_id' => (string)$id,
                'tenant_code' => $code,
                'tenant_name' => $name,
            ],
        ], 201);
    }

    public static function update(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $db = Database::getConnection();

        $stmt = $db->prepare("UPDATE tenants SET tenant_name = :name, business_phone = :phone, business_address = :addr WHERE tenant_id = :id");
        $stmt->execute([
            'name' => $data['tenant_name'] ?? $data['tenantName'] ?? '',
            'phone' => $data['business_phone'] ?? $data['businessPhone'] ?? null,
            'addr' => $data['business_address'] ?? $data['businessAddress'] ?? null,
            'id' => $id,
        ]);

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
            'mc' => (int)($data['max_customers'] ?? 5000),
            'mr' => (int)($data['max_routers'] ?? 10),
            'mres' => (int)($data['max_resellers'] ?? 50),
        ]);

        Response::json(['success' => true, 'message' => 'Limits updated']);
    }

    public static function delete(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare("UPDATE tenants SET status = 'terminated', terminated_at = NOW() WHERE tenant_id = :id");
        $stmt->execute(['id' => $id]);

        Response::json(['success' => true, 'message' => 'Tenant terminated']);
    }
}

