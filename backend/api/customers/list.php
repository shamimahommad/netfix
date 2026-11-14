<?php
/**
 * NetFix ISP SaaS - Strictly Scoped Customer List Endpoint
 * Enforces Downward-Only Access Control (Materialized Path).
 * A user can ONLY view their own direct records and records belonging to their descendants.
 * Prevents all horizontal and upward data leakage.
 * Endpoint: GET /api/customers/list.php (or GET /api/customers/list)
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
$db = Database::getConnection();

$page = max(1, (int)($_GET['page'] ?? 1));
$limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
$offset = ($page - 1) * $limit;

// 1. Enforce Downward-Only Hierarchy Scoping Clause
$scope = HierarchySecurityService::getDownwardScopeClause(
    $callerId,
    $tenantId ? (int)$tenantId : null,
    'c',
    'u'
);

$where = [];
$params = $scope['params'];
if (!empty($scope['whereSql'])) {
    $where[] = $scope['whereSql'];
}

// 2. Additional Optional Filters
if (!empty($_GET['status']) && $_GET['status'] !== 'all') {
    $status = trim($_GET['status']);
    if (in_array($status, ['Paid', 'Due', 'Expired', 'Left', 'Suspended', 'Pending'], true)) {
        $where[] = "c.billing_status = :bstatus";
        $params['bstatus'] = $status;
    } else {
        $where[] = "c.status = :status";
        $params['status'] = $status;
    }
}

if (!empty($_GET['search'])) {
    $search = '%' . trim($_GET['search']) . '%';
    $where[] = "(c.full_name LIKE :s1 OR c.phone LIKE :s2 OR c.customer_code LIKE :s3 OR na.username LIKE :s4)";
    $params['s1'] = $search;
    $params['s2'] = $search;
    $params['s3'] = $search;
    $params['s4'] = $search;
}

if (!empty($_GET['ownerId'])) {
    $targetOwnerId = (int)$_GET['ownerId'];
    // IDOR Protection: verify targetOwnerId is accessible by caller (self or descendant)
    if (!HierarchySecurityService::canAccessUser($callerId, $targetOwnerId)) {
        Response::error("Access Denied: You do not have permission to filter by user #{$targetOwnerId}", 403);
    }
    $where[] = "c.owner_id = :targetOwnerId";
    $params['targetOwnerId'] = $targetOwnerId;
}

$whereSql = count($where) > 0 ? implode(' AND ', $where) : '1=1';

// Count total
$countStmt = $db->prepare("SELECT COUNT(DISTINCT c.customer_id) as total 
    FROM customers c 
    LEFT JOIN users u ON u.user_id = c.owner_id
    LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id 
    WHERE {$whereSql}");
$countStmt->execute($params);
$total = (int)$countStmt->fetchColumn();
$countStmt->closeCursor();

// Fetch scoped customers joining users for owner details and hierarchy verification
$query = "SELECT 
    c.customer_id,
    c.customer_code,
    c.full_name,
    c.phone,
    c.email,
    c.status,
    c.billing_status,
    c.installation_address,
    c.connection_date,
    c.created_at,
    c.owner_id,
    c.owner_role,
    c.owner_path,
    u.username as owner_username,
    u.first_name as owner_first_name,
    u.last_name as owner_last_name,
    COALESCE(u.role, c.owner_role, 'isp_admin') as owner_role_resolved,
    na.username as pppoe_username,
    ap.profile_name as package_name,
    ap.price as package_price,
    cs.expires_at,
    nd.device_name as router_name
    FROM customers c
    LEFT JOIN users u ON u.user_id = c.owner_id
    LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
    LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
    LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
    LEFT JOIN network_devices nd ON nd.network_device_id = cs.network_device_id
    WHERE {$whereSql}
    GROUP BY c.customer_id
    ORDER BY c.customer_id DESC
    LIMIT :lim OFFSET :off";

$stmt = $db->prepare($query);
foreach ($params as $k => $v) {
    $stmt->bindValue(':' . $k, $v);
}
$stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
$stmt->bindValue(':off', $offset, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
$stmt->closeCursor();

$data = array_map(function ($r) use ($callerId) {
    $ownerFullName = trim(($r['owner_first_name'] ?? '') . ' ' . ($r['owner_last_name'] ?? ''));
    $ownerDisplayName = $ownerFullName ?: ($r['owner_username'] ?? 'ISP Admin');
    $isDirect = ((int)($r['owner_id'] ?? 0) === $callerId);

    return [
        'id' => (string)$r['customer_id'],
        'customerId' => (string)$r['customer_id'],
        'customer_id' => (string)$r['customer_id'],
        'customerCode' => $r['customer_code'],
        'customer_code' => $r['customer_code'],
        'fullName' => $r['full_name'],
        'full_name' => $r['full_name'],
        'phone' => $r['phone'],
        'email' => $r['email'],
        'status' => $r['status'],
        'billingStatus' => $r['billing_status'],
        'billing_status' => $r['billing_status'],
        'installationAddress' => $r['installation_address'],
        'connectionDate' => $r['connection_date'],
        'createdAt' => $r['created_at'],
        'ownerId' => $r['owner_id'] ? (string)$r['owner_id'] : null,
        'owner_id' => $r['owner_id'] ? (string)$r['owner_id'] : null,
        'ownerRole' => $r['owner_role_resolved'],
        'owner_role' => $r['owner_role_resolved'],
        'ownerPath' => $r['owner_path'],
        'owner_path' => $r['owner_path'],
        'ownerName' => $ownerDisplayName,
        'owner_name' => $ownerDisplayName,
        'ownerUsername' => $r['owner_username'] ?? '',
        'pppoeUsername' => $r['pppoe_username'] ?? '',
        'packageName' => $r['package_name'] ?? 'N/A',
        'package_name' => $r['package_name'] ?? 'N/A',
        'packagePrice' => (float)($r['package_price'] ?? 0),
        'package_price' => (float)($r['package_price'] ?? 0),
        'expiresAt' => $r['expires_at'],
        'routerName' => $r['router_name'] ?? '',
        'isDirect' => $isDirect,
        'is_direct' => $isDirect,
    ];
}, $rows ?: []);

Response::json([
    'success' => true,
    'data' => $data,
    'total' => $total,
    'page' => $page,
    'limit' => $limit,
    'totalPages' => ceil($total / $limit),
    'meta' => [
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'totalPages' => ceil($total / $limit),
    ],
    'userPermissions' => [
        'can_create_customer' => HierarchySecurityService::hasPermission($callerId, 'can_create_customer'),
        'can_edit_customer' => HierarchySecurityService::hasPermission($callerId, 'can_edit_customer'),
        'can_delete_customer' => HierarchySecurityService::hasPermission($callerId, 'can_delete_customer'),
        'can_recharge' => HierarchySecurityService::hasPermission($callerId, 'can_recharge'),
        'can_manage_sub_tier' => HierarchySecurityService::hasPermission($callerId, 'can_manage_sub_tier'),
    ],
]);
