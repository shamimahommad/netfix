<?php
/**
 * NetFix ISP SaaS - Reseller Pricing Matrix Endpoint
 * Returns packages with parent cost floors and child commission rates.
 * Endpoint: GET /api/reseller/pricing_matrix.php (or GET /api/reseller/pricing_matrix)
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/Response.php';
require_once __DIR__ . '/../../lib/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/HierarchySecurityService.php';
require_once __DIR__ . '/../../lib/PackageAssignmentService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method Not Allowed', 405);
}

$currentUser = AuthMiddleware::requireAuth();
$callerId = (int)$currentUser['user_id'];
$tenantId = AuthMiddleware::getTenantId();

$childUserId = (int)($_GET['child_user_id'] ?? $_GET['user_id'] ?? 0);
if (!$childUserId) {
    Response::error('child_user_id is required', 400);
}

if (!HierarchySecurityService::canAccessUser($callerId, $childUserId)) {
    Response::error("Access Denied: User #{$childUserId} is not in your downline hierarchy.", 403);
}

$matrix = PackageAssignmentService::getPricingMatrix($callerId, $childUserId, $tenantId ? (int)$tenantId : null);
$child = HierarchySecurityService::getUser($childUserId);

Response::json([
    'success' => true,
    'child_user' => [
        'user_id' => $child['user_id'],
        'username' => $child['username'],
        'role' => $child['role'],
        'hierarchy_path' => $child['hierarchy_path'],
    ],
    'packages' => $matrix,
]);
