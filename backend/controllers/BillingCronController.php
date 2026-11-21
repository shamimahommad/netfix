<?php
/**
 * NetFix ISP SaaS - Billing Cron & Auto-Cutoff Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';
require_once __DIR__ . '/../lib/BillingCronService.php';

class BillingCronController {
    /**
     * GET /billing/cutoff/status
     */
    public static function status(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();

        $res = BillingCronService::getStatus($tenantId ? (int)$tenantId : null);
        Response::json([
            'success' => true,
            'data' => $res,
        ]);
    }

    /**
     * POST /billing/cutoff/run
     * Trigger instant manual auto-cutoff routine
     */
    public static function run(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $role = strtolower($user['role'] ?? '');
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $role === 'saas_admin');

        if (!$isLevel0) {
            Response::error('Access restricted to ISP Administrator', 403);
            return;
        }

        $res = BillingCronService::runAutoCutoff($tenantId ? (int)$tenantId : null, 'manual');
        Response::json([
            'success' => $res['success'] ?? false,
            'message' => "Auto-cutoff executed successfully. Processed: " . ($res['expiredProcessed'] ?? 0) . " subscribers, MikroTik cutoffs: " . ($res['mikrotikDisabled'] ?? 0) . ".",
            'data' => $res,
        ]);
    }

    /**
     * POST /billing/cutoff/settings
     */
    public static function saveSettings(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $role = strtolower($user['role'] ?? '');
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $role === 'saas_admin');

        if (!$isLevel0) {
            Response::error('Access restricted to ISP Administrator', 403);
            return;
        }

        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $tid = $tenantId ? (int)$tenantId : 1;

        BillingCronService::saveSettings($tid, $body);

        Response::json([
            'success' => true,
            'message' => 'Auto-cutoff & billing engine settings saved successfully',
            'data' => BillingCronService::getSettings($tid),
        ]);
    }
}
