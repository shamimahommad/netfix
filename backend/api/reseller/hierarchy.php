<?php
/**
 * NetFix ISP SaaS - Reseller Hierarchy & Downline Tree Endpoint
 * Returns downward-scoped downline tree and flat list for UI visualization.
 * Endpoint: GET /api/reseller/hierarchy.php (or GET /api/reseller/hierarchy)
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/Response.php';
require_once __DIR__ . '/../../lib/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/HierarchySecurityService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method Not Allowed', 405);
}

$currentUser = AuthMiddleware::requireAuth();
$callerId = (int)$currentUser['user_id'];
$tenantId = AuthMiddleware::getTenantId();

$tree = HierarchySecurityService::getDownlineTree($callerId, $tenantId ? (int)$tenantId : null);
$flat = HierarchySecurityService::getDownlineUsers($callerId, $tenantId ? (int)$tenantId : null);

Response::json([
    'success' => true,
    'current_user' => [
        'user_id' => $callerId,
        'username' => $currentUser['username'],
        'role' => $currentUser['role'],
        'hierarchy_path' => $currentUser['hierarchy_path'] ?? "/{$callerId}/",
        'hierarchy_level' => HierarchySecurityService::getHierarchyLevel($currentUser['role']),
        'can_create_downline' => HierarchySecurityService::getAllowedChildRole($currentUser['role']) !== null,
        'allowed_child_role' => HierarchySecurityService::getAllowedChildRole($currentUser['role']),
    ],
    'tree' => $tree,
    'downlines' => $flat,
    'total_downlines' => count($flat),
]);

