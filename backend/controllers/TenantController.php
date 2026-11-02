<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';

class TenantController {
    /**
     * Get White-Label Info for current domain / tenant
     * Public endpoint called by frontend on load
     */
    public static function info(): void {
        $db = Database::getConnection();
        $host = $_SERVER['HTTP_HOST'] ?? '';
        
        // Strip port if present (e.g. localhost:8000 -> localhost)
        $domain = explode(':', $host)[0];
        $subdomain = explode('.', $domain)[0];

        // 1. Try matching custom domain
        $stmt = $db->prepare("SELECT * FROM tenants WHERE custom_domain = :domain LIMIT 1");
        $stmt->execute(['domain' => $domain]);
        $tenant = $stmt->fetch();

        // 2. Try matching subdomain (e.g. cloudnet.netfix.com -> cloudnet)
        if (!$tenant && $subdomain !== 'localhost' && $subdomain !== '127' && $subdomain !== 'www') {
            $stmt = $db->prepare("SELECT * FROM tenants WHERE subdomain = :subdomain LIMIT 1");
            $stmt->execute(['subdomain' => $subdomain]);
            $tenant = $stmt->fetch();
        }

        // 3. Fallback to header or default tenant
        if (!$tenant) {
            $headers = getallheaders();
            $tenantId = $headers['X-Tenant-Id'] ?? $headers['x-tenant-id'] ?? 'tenant-cloudnet-001';
            $stmt = $db->prepare("SELECT * FROM tenants WHERE id = :id LIMIT 1");
            $stmt->execute(['id' => $tenantId]);
            $tenant = $stmt->fetch();
        }

        // 4. Default fallback if nothing found
        if (!$tenant) {
            $stmt = $db->query("SELECT * FROM tenants ORDER BY created_at ASC LIMIT 1");
            $tenant = $stmt->fetch();
        }

        if (!$tenant) {
            Response::json([
                'success' => true,
                'tenant' => [
                    'id' => 'default',
                    'name' => 'NetFix ISP NOC',
                    'code' => 'NOC-01',
                    'brand_color' => '#4f46e5',
                    'currency' => '৳',
                    'support_phone' => '01700000000',
                    'logo_url' => null,
                ]
            ]);
            return;
        }

        Response::json([
            'success' => true,
            'tenant' => [
                'id' => $tenant['id'],
                'name' => $tenant['name'],
                'code' => $tenant['code'],
                'subdomain' => $tenant['subdomain'],
                'custom_domain' => $tenant['custom_domain'] ?? null,
                'logo_url' => $tenant['logo_url'] ?? null,
                'brand_color' => $tenant['brand_color'] ?? '#4f46e5',
                'currency' => $tenant['currency'] ?? '৳',
                'support_phone' => $tenant['support_phone'] ?? $tenant['contact_phone'] ?? '',
                'contact_email' => $tenant['contact_email'] ?? '',
                'subscription_plan' => $tenant['subscription_plan'] ?? 'BASIC',
                'sms_balance' => (int)($tenant['sms_balance'] ?? 0),
            ]
        ]);
    }

    /**
     * List all tenants (Super Admin only)
     */
    public static function index(): void {
        $db = Database::getConnection();
        $sql = "SELECT t.*, 
                (SELECT COUNT(*) FROM subscribers s WHERE s.tenant_id = t.id) as total_subscribers,
                (SELECT COUNT(*) FROM mikrotik_routers r WHERE r.tenant_id = t.id) as total_routers,
                (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as total_users
                FROM tenants t 
                ORDER BY t.created_at DESC";
        $stmt = $db->query($sql);
        $tenants = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'tenants' => $tenants,
            'total' => count($tenants),
        ]);
    }

    /**
     * Update Tenant Settings (Custom domain, brand color, company name, logo)
     */
    public static function updateSettings(string $tenantId): void {
        $data = json_decode(file_get_contents('php://input'), true);
        $db = Database::getConnection();

        $name = trim($data['name'] ?? '');
        $customDomain = trim($data['custom_domain'] ?? $data['customDomain'] ?? '');
        $brandColor = trim($data['brand_color'] ?? $data['brandColor'] ?? '#4f46e5');
        $currency = trim($data['currency'] ?? '৳');
        $supportPhone = trim($data['support_phone'] ?? $data['supportPhone'] ?? '');
        $logoUrl = trim($data['logo_url'] ?? $data['logoUrl'] ?? '');

        $sql = "UPDATE tenants SET 
                name = COALESCE(NULLIF(:name, ''), name),
                custom_domain = NULLIF(:custom_domain, ''),
                brand_color = :brand_color,
                currency = :currency,
                support_phone = NULLIF(:support_phone, ''),
                logo_url = NULLIF(:logo_url, '')
                WHERE id = :id";

        $stmt = $db->prepare($sql);
        $stmt->execute([
            'name' => $name,
            'custom_domain' => $customDomain,
            'brand_color' => $brandColor,
            'currency' => $currency,
            'support_phone' => $supportPhone,
            'logo_url' => $logoUrl,
            'id' => $tenantId,
        ]);

        Response::json([
            'success' => true,
            'message' => 'Tenant white-label settings updated successfully',
        ]);
    }
}

