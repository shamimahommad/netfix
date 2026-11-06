<?php
/**
 * NetFix ISP SaaS - Assign Package with Cascading Price Floor Validation
 * Validates: Child Cost Price >= Parent Cost Price (Never trust frontend input).
 * Endpoint: POST /api/reseller/assign_package.php (or POST /api/reseller/assign_package)
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/Response.php';
require_once __DIR__ . '/../../lib/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/HierarchySecurityService.php';
require_once __DIR__ . '/../../lib/PackageAssignmentService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method Not Allowed', 405);
}

$currentUser = AuthMiddleware::requireAuth();
$callerId = (int)$currentUser['user_id'];
$tenantId = AuthMiddleware::getTenantId();

// Verify permission
HierarchySecurityService::requirePermission($callerId, 'can_assign_package');

$data = json_decode(file_get_contents('php://input'), true) ?: [];

$childUserId = (int)($data['child_user_id'] ?? $data['user_id'] ?? 0);
$packageId   = (int)($data['package_id'] ?? 0);
$commissionRate = isset($data['commission_rate']) ? (float)$data['commission_rate'] : (float)($data['pop_profit_percent'] ?? 0);
$costPrice   = isset($data['cost_price']) ? (float)$data['cost_price'] : (isset($data['sell_price']) ? (float)$data['sell_price'] : null);
$isAllowed   = isset($data['is_allowed']) ? (bool)$data['is_allowed'] : true;

if (!$childUserId || !$packageId) {
    Response::error('child_user_id and package_id are required.', 400);
}

try {
    $result = PackageAssignmentService::assignPackageToChild(
        $callerId,
        $childUserId,
        $packageId,
        $commissionRate,
        $costPrice,
        $isAllowed,
        $tenantId ? (int)$tenantId : null
    );

    Response::json(array_merge([
        'success' => true,
        'message' => 'Package pricing and commission assigned successfully with floor validation.',
    ], $result));
} catch (DomainException $de) {
    Response::error($de->getMessage(), 400);
} catch (InvalidArgumentException $ie) {
    Response::error($ie->getMessage(), 400);
} catch (Throwable $e) {
    Response::error("Internal server error: " . $e->getMessage(), 500);
}
