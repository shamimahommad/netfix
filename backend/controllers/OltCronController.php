<?php
/**
 * NetFix ISP SaaS - OLT Cron Scheduling & Settings Controller
 * Handles SaaS Admin configuration for OLT sync interval, live status, and manual trigger.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';
require_once __DIR__ . '/../lib/OltSyncService.php';

class OltCronController {

    /**
     * GET /saas/cron/olt/status or /cron/olt/status
     */
    public static function status(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();

        $role = strtolower($user['role'] ?? '');
        $isSaas = ($role === 'saas_admin');

        $status = OltSyncService::getStatus($isSaas ? null : ($tenantId ? (int)$tenantId : null));

        Response::json([
            'success' => true,
            'data' => $status,
        ]);
    }

    /**
     * POST /saas/cron/olt/settings
     * Save OLT sync interval and enabled state
     */
    public static function saveSettings(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $role = strtolower($user['role'] ?? '');

        $isSaas = ($role === 'saas_admin');
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $isSaas);

        if (!$isLevel0) {
            Response::error('Access restricted to System Administrator', 403);
            return;
        }

        $body = json_decode(file_get_contents('php://input'), true) ?: [];

        $targetTenant = $isSaas ? null : ($tenantId ? (int)$tenantId : null);
        OltSyncService::saveSettings($body, $targetTenant);

        Response::json([
            'success' => true,
            'message' => 'OLT automated sync schedule settings saved successfully.',
            'data' => OltSyncService::getSettings($targetTenant),
        ]);
    }

    /**
     * POST /saas/cron/olt/run
     * Trigger manual instant sync across active OLTs
     */
    public static function run(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $role = strtolower($user['role'] ?? '');

        $isSaas = ($role === 'saas_admin');
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $isSaas);

        if (!$isLevel0) {
            Response::error('Access restricted to System Administrator', 403);
            return;
        }

        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $force = !empty($body['force']);

        $targetTenant = $isSaas ? null : ($tenantId ? (int)$tenantId : null);
        $res = OltSyncService::runScheduledSync($targetTenant, 'manual', $force ?: true);

        Response::json([
            'success' => $res['success'] ?? false,
            'message' => "OLT sync completed. Total: {$res['totalOlts']} OLTs, Synced: {$res['syncedOlts']}, Failed: {$res['failedOlts']}, ONUs: {$res['totalOnus']}.",
            'data' => $res,
        ]);
    }

    /**
     * GET /cron/sync-olt or /api/cron/sync-olt
     * Public or API token authenticated cron endpoint for external cron providers
     */
    public static function webCron(): void {
        // Optional security key check
        $providedKey = $_GET['key'] ?? ($_SERVER['HTTP_X_CRON_KEY'] ?? '');
        $configuredKey = getenv('CRON_SECRET_KEY');

        if (!empty($configuredKey) && $providedKey !== $configuredKey) {
            Response::error('Invalid or missing cron authentication key', 401);
            return;
        }

        $force = !empty($_GET['force']) && $_GET['force'] === 'true';
        $res = OltSyncService::runScheduledSync(null, 'api', $force);

        Response::json([
            'success' => $res['success'] ?? false,
            'message' => "OLT cron executed via Web API. Synced: {$res['syncedOlts']}/{$res['totalOlts']} OLTs.",
            'data' => $res,
        ]);
    }
}
