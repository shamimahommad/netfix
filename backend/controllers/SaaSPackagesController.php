<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class SaaSPackagesController {
    private static function checkSaasAdmin(): array {
        $user = AuthMiddleware::requireAuth();
        if (($user['role'] ?? '') !== 'saas_admin' && ($user['user_type'] ?? '') !== 'saas') {
            Response::json([
                'success' => false,
                'message' => 'Access denied: SaaS Administrator privileges required'
            ], 403);
            exit;
        }
        return $user;
    }

    /**
     * GET /saas/packages
     * List all SaaS packages with assigned ISP tenants and limits
     */
    public static function list(): void {
        self::checkSaasAdmin();
        $db = Database::getConnection();

        $stmt = $db->query("SELECT * FROM saas_packages ORDER BY price ASC, id ASC");
        $packages = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Fetch tenants with their assigned package
        $tStmt = $db->query("SELECT 
            t.tenant_id,
            t.tenant_code,
            t.tenant_name,
            t.business_email,
            t.business_phone,
            t.status,
            t.saas_package_id,
            t.trial_ends_at,
            (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.tenant_id) as total_customers,
            (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id AND nd.device_type = 'router') as total_routers,
            (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id AND nd.device_type = 'olt') as total_olts
            FROM tenants t
            ORDER BY t.tenant_id ASC");
        $allTenants = $tStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Group tenants by saas_package_id
        $tenantsByPackage = [];
        $unassignedTenants = [];
        foreach ($allTenants as $t) {
            $pkgId = $t['saas_package_id'] ? (int)$t['saas_package_id'] : null;
            $formattedTenant = [
                'tenantId' => (string)$t['tenant_id'],
                'tenantCode' => $t['tenant_code'],
                'tenantName' => $t['tenant_name'],
                'businessEmail' => $t['business_email'],
                'businessPhone' => $t['business_phone'],
                'status' => $t['status'],
                'totalCustomers' => (int)($t['total_customers'] ?? 0),
                'totalRouters' => (int)($t['total_routers'] ?? 0),
                'totalOlts' => (int)($t['total_olts'] ?? 0),
                'trialEndsAt' => $t['trial_ends_at'],
            ];
            if ($pkgId) {
                if (!isset($tenantsByPackage[$pkgId])) {
                    $tenantsByPackage[$pkgId] = [];
                }
                $tenantsByPackage[$pkgId][] = $formattedTenant;
            } else {
                $unassignedTenants[] = $formattedTenant;
            }
        }

        $result = array_map(function($p) use ($tenantsByPackage) {
            $pkgId = (int)$p['id'];
            $assigned = $tenantsByPackage[$pkgId] ?? [];
            return [
                'id' => $pkgId,
                'code' => $p['code'],
                'name' => $p['name'],
                'tagline' => $p['tagline'] ?? '',
                'price' => (float)$p['price'],
                'billingCycle' => $p['billing_cycle'],
                'limits' => [
                    'maxCustomers' => (int)$p['max_customers'],
                    'maxRouters' => (int)$p['max_routers'],
                    'maxOlts' => (int)$p['max_olts'],
                    'maxUsers' => (int)$p['max_users'],
                ],
                'permissions' => [
                    'mapEnabled' => (bool)$p['map_enabled'],
                    'monitoringEnabled' => (bool)$p['monitoring_enabled'],
                    'smsEnabled' => (bool)$p['sms_enabled'],
                    'customerPortalEnabled' => (bool)$p['customer_portal_enabled'],
                    'resellerEnabled' => (bool)$p['reseller_enabled'],
                ],
                'isPopular' => (bool)$p['is_popular'],
                'status' => $p['status'],
                'assignedTenantsCount' => count($assigned),
                'assignedTenants' => $assigned,
                'createdAt' => $p['created_at'],
            ];
        }, $packages);

        Response::json([
            'success' => true,
            'data' => $result,
            'unassignedTenants' => $unassignedTenants,
            'totalPackages' => count($result)
        ]);
    }

    /**
     * POST /saas/packages
     * Create a new SaaS Package
     */
    public static function create(): void {
        self::checkSaasAdmin();
        $db = Database::getConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $name = trim($input['name'] ?? '');
        if (empty($name)) {
            Response::json(['success' => false, 'message' => 'Package name is required'], 400);
            return;
        }

        $code = trim($input['code'] ?? '');
        if (empty($code)) {
            $code = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $name));
        }

        $price = (float)($input['price'] ?? 0);
        $cycle = in_array($input['billingCycle'] ?? 'monthly', ['monthly', 'yearly']) ? $input['billingCycle'] : 'monthly';
        $tagline = trim($input['tagline'] ?? '');

        $limits = $input['limits'] ?? [];
        $maxCustomers = (int)($limits['maxCustomers'] ?? 1000);
        $maxRouters = (int)($limits['maxRouters'] ?? 5);
        $maxOlts = (int)($limits['maxOlts'] ?? 2);
        $maxUsers = (int)($limits['maxUsers'] ?? 10);

        $permissions = $input['permissions'] ?? [];
        $mapEnabled = !empty($permissions['mapEnabled']) ? 1 : 0;
        $monitoringEnabled = !empty($permissions['monitoringEnabled']) ? 1 : 0;
        $smsEnabled = !empty($permissions['smsEnabled']) ? 1 : 0;
        $customerPortalEnabled = !empty($permissions['customerPortalEnabled']) ? 1 : 0;
        $resellerEnabled = !empty($permissions['resellerEnabled']) ? 1 : 0;
        $isPopular = !empty($input['isPopular']) ? 1 : 0;

        $stmt = $db->prepare("INSERT INTO saas_packages 
            (code, name, tagline, price, billing_cycle, max_customers, max_routers, max_olts, max_users, map_enabled, monitoring_enabled, sms_enabled, customer_portal_enabled, reseller_enabled, is_popular)
            VALUES (:code, :name, :tagline, :price, :cycle, :mc, :mr, :mo, :mu, :map, :mon, :sms, :cp, :res, :pop)");
        
        $stmt->execute([
            'code' => $code,
            'name' => $name,
            'tagline' => $tagline,
            'price' => $price,
            'cycle' => $cycle,
            'mc' => $maxCustomers,
            'mr' => $maxRouters,
            'mo' => $maxOlts,
            'mu' => $maxUsers,
            'map' => $mapEnabled,
            'mon' => $monitoringEnabled,
            'sms' => $smsEnabled,
            'cp' => $customerPortalEnabled,
            'res' => $resellerEnabled,
            'pop' => $isPopular
        ]);

        Response::json([
            'success' => true,
            'message' => 'SaaS Package created successfully',
            'id' => (int)$db->lastInsertId()
        ], 201);
    }

    /**
     * PUT /saas/packages/{id}
     * Update an existing package
     */
    public static function update(string $id): void {
        self::checkSaasAdmin();
        $db = Database::getConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $pkgId = (int)$id;
        $check = $db->prepare("SELECT id FROM saas_packages WHERE id = :id");
        $check->execute(['id' => $pkgId]);
        if (!$check->fetch()) {
            Response::json(['success' => false, 'message' => 'Package not found'], 404);
            return;
        }

        $name = trim($input['name'] ?? '');
        $price = (float)($input['price'] ?? 0);
        $tagline = trim($input['tagline'] ?? '');
        $cycle = in_array($input['billingCycle'] ?? 'monthly', ['monthly', 'yearly']) ? $input['billingCycle'] : 'monthly';

        $limits = $input['limits'] ?? [];
        $maxCustomers = (int)($limits['maxCustomers'] ?? 1000);
        $maxRouters = (int)($limits['maxRouters'] ?? 5);
        $maxOlts = (int)($limits['maxOlts'] ?? 2);
        $maxUsers = (int)($limits['maxUsers'] ?? 10);

        $permissions = $input['permissions'] ?? [];
        $mapEnabled = !empty($permissions['mapEnabled']) ? 1 : 0;
        $monitoringEnabled = !empty($permissions['monitoringEnabled']) ? 1 : 0;
        $smsEnabled = !empty($permissions['smsEnabled']) ? 1 : 0;
        $customerPortalEnabled = !empty($permissions['customerPortalEnabled']) ? 1 : 0;
        $resellerEnabled = !empty($permissions['resellerEnabled']) ? 1 : 0;
        $isPopular = !empty($input['isPopular']) ? 1 : 0;

        $stmt = $db->prepare("UPDATE saas_packages SET 
            name = :name, tagline = :tagline, price = :price, billing_cycle = :cycle,
            max_customers = :mc, max_routers = :mr, max_olts = :mo, max_users = :mu,
            map_enabled = :map, monitoring_enabled = :mon, sms_enabled = :sms, 
            customer_portal_enabled = :cp, reseller_enabled = :res, is_popular = :pop
            WHERE id = :id");

        $stmt->execute([
            'id' => $pkgId,
            'name' => $name,
            'tagline' => $tagline,
            'price' => $price,
            'cycle' => $cycle,
            'mc' => $maxCustomers,
            'mr' => $maxRouters,
            'mo' => $maxOlts,
            'mu' => $maxUsers,
            'map' => $mapEnabled,
            'mon' => $monitoringEnabled,
            'sms' => $smsEnabled,
            'cp' => $customerPortalEnabled,
            'res' => $resellerEnabled,
            'pop' => $isPopular
        ]);

        Response::json([
            'success' => true,
            'message' => 'Package updated successfully'
        ]);
    }

    /**
     * DELETE /saas/packages/{id}
     * Deactivate / delete package
     */
    public static function delete(string $id): void {
        self::checkSaasAdmin();
        $db = Database::getConnection();
        $pkgId = (int)$id;

        // Check if tenants are assigned
        $stmt = $db->prepare("SELECT COUNT(*) FROM tenants WHERE saas_package_id = :id");
        $stmt->execute(['id' => $pkgId]);
        $count = (int)$stmt->fetchColumn();

        if ($count > 0) {
            Response::json([
                'success' => false,
                'message' => "Cannot delete package: {$count} active ISP tenants are currently assigned to this package. Reassign them first."
            ], 400);
            return;
        }

        $stmt = $db->prepare("DELETE FROM saas_packages WHERE id = :id");
        $stmt->execute(['id' => $pkgId]);

        Response::json([
            'success' => true,
            'message' => 'Package removed successfully'
        ]);
    }

    /**
     * POST /saas/packages/assign
     * Assign / Change package for a tenant and sync quotas/permissions
     */
    public static function assignTenantPackage(): void {
        self::checkSaasAdmin();
        $db = Database::getConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $tenantId = (int)($input['tenantId'] ?? 0);
        $packageId = (int)($input['packageId'] ?? 0);

        if (!$tenantId || !$packageId) {
            Response::json(['success' => false, 'message' => 'tenantId and packageId are required'], 400);
            return;
        }

        // Fetch package details
        $stmt = $db->prepare("SELECT * FROM saas_packages WHERE id = :id");
        $stmt->execute(['id' => $packageId]);
        $pkg = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$pkg) {
            Response::json(['success' => false, 'message' => 'Target package not found'], 404);
            return;
        }

        // Update tenant
        $db->prepare("UPDATE tenants SET saas_package_id = :pid WHERE tenant_id = :tid")
           ->execute(['pid' => $packageId, 'tid' => $tenantId]);

        // Sync tenant_limits
        $limStmt = $db->prepare("INSERT INTO tenant_limits 
            (tenant_id, max_customers, max_routers, max_resellers)
            VALUES (:tid, :mc, :mr, :mu)
            ON DUPLICATE KEY UPDATE 
            max_customers = VALUES(max_customers),
            max_routers = VALUES(max_routers),
            max_resellers = VALUES(max_resellers)");
        $limStmt->execute([
            'tid' => $tenantId,
            'mc' => (int)$pkg['max_customers'],
            'mr' => (int)$pkg['max_routers'],
            'mu' => (int)$pkg['max_users']
        ]);

        Response::json([
            'success' => true,
            'message' => "Successfully assigned {$pkg['name']} to ISP tenant",
            'package' => [
                'id' => (int)$pkg['id'],
                'name' => $pkg['name'],
                'price' => (float)$pkg['price'],
                'limits' => [
                    'maxCustomers' => (int)$pkg['max_customers'],
                    'maxRouters' => (int)$pkg['max_routers'],
                    'maxOlts' => (int)$pkg['max_olts'],
                    'maxUsers' => (int)$pkg['max_users']
                ]
            ]
        ]);
    }
}

