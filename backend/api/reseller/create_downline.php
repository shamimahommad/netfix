<?php
/**
 * NetFix ISP SaaS - Create Downline User Endpoint
 * Strict Tier Chain Enforcement:
 * Level 0 (ISP Admin) -> Level 1 (Reseller)
 * Level 1 (Reseller) -> Level 2 (Sub-Reseller)
 * Level 2 (Sub-Reseller) -> Level 3 (Dealer)
 * Level 3 (Dealer) -> Level 4 (Agent)
 * Endpoint: POST /api/reseller/create_downline.php (or POST /api/reseller/create_downline)
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/Response.php';
require_once __DIR__ . '/../../lib/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/HierarchySecurityService.php';
require_once __DIR__ . '/../../lib/WalletLedgerService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method Not Allowed', 405);
}

$currentUser = AuthMiddleware::requireAuth();
$callerId = (int)$currentUser['user_id'];
$tenantId = AuthMiddleware::getTenantId();

// Verify permission
HierarchySecurityService::requirePermission($callerId, 'can_manage_sub_tier');

$data = json_decode(file_get_contents('php://input'), true) ?: [];

$username   = trim($data['username'] ?? '');
$password   = trim($data['password'] ?? '');
$firstName  = trim($data['first_name'] ?? $data['name'] ?? '');
$lastName   = trim($data['last_name'] ?? '');
$email      = trim($data['email'] ?? '');
$phone      = trim($data['phone'] ?? '');
$notes      = trim($data['notes'] ?? '');
$requestedRole = trim($data['role'] ?? '');

if (empty($username) || empty($password) || empty($firstName)) {
    Response::error('Username, password, and first name are required.', 400);
}

if (strlen($password) < 6) {
    Response::error('Password must be at least 6 characters.', 400);
}

// Hierarchy Chain Validation
$callerRole = $currentUser['role'] ?? '';
$callerLevel = HierarchySecurityService::getHierarchyLevel($callerRole);
$expectedRole = HierarchySecurityService::getAllowedChildRole($callerRole);

if ($expectedRole === null) {
    Response::error("Access Denied: Users with role '{$callerRole}' (Level {$callerLevel}) cannot create downlines.", 403);
}

// If caller is ISP Admin (Level 0), they may optionally specify 'reseller' or let it default
$targetRole = $expectedRole;
if ($callerLevel === 0 && !empty($requestedRole)) {
    if ($requestedRole !== HierarchySecurityService::ROLE_RESELLER) {
        Response::error("ISP Admin can only create Level 1 'reseller'.", 400);
    }
    $targetRole = HierarchySecurityService::ROLE_RESELLER;
}

$roleLevels = [
    HierarchySecurityService::ROLE_RESELLER     => 80,
    HierarchySecurityService::ROLE_SUB_RESELLER => 60,
    HierarchySecurityService::ROLE_DEALER       => 40,
    HierarchySecurityService::ROLE_AGENT        => 20,
];
$targetRoleLevel = $roleLevels[$targetRole] ?? 20;

$effectiveTenantId = $tenantId ? (int)$tenantId : (int)($currentUser['tenant_id'] ?? 1);

$db = Database::getConnection();

// Check unique username
$uStmt = $db->prepare("SELECT user_id FROM users WHERE username = :uname LIMIT 1");
$uStmt->execute(['uname' => $username]);
if ($uStmt->fetchColumn()) {
    Response::error("Username '{$username}' is already taken.", 409);
}
$uStmt->closeCursor();

// Generate default email if empty
if (empty($email)) {
    $email = strtolower($username) . '@reseller.local';
}

$db->beginTransaction();
try {
    $pwdHash = password_hash($password, PASSWORD_BCRYPT);
    $parentPath = $currentUser['hierarchy_path'] ?? "/{$callerId}/";

    // 1. Insert user with placeholder path
    $insStmt = $db->prepare("INSERT INTO users 
        (tenant_id, email, username, password_hash, first_name, last_name, phone, role, role_level, parent_id, hierarchy_path, status, notes, created_by)
        VALUES (:tid, :email, :uname, :pwd, :fname, :lname, :phone, :role, :lvl, :pid, :path, 'active', :notes, :cb)");
    $insStmt->execute([
        'tid' => $effectiveTenantId,
        'email' => $email,
        'uname' => $username,
        'pwd' => $pwdHash,
        'fname' => $firstName,
        'lname' => $lastName,
        'phone' => $phone,
        'role' => $targetRole,
        'lvl' => $targetRoleLevel,
        'pid' => $callerId,
        'path' => $parentPath, // updated immediately below
        'notes' => $notes,
        'cb' => $callerId,
    ]);
    $newUserId = (int)$db->lastInsertId();
    $insStmt->closeCursor();

    // 2. Compute and update exact Materialized Path: /parent/chain/newUserId/
    $newPath = rtrim($parentPath, '/') . "/{$newUserId}/";
    $upPathStmt = $db->prepare("UPDATE users SET hierarchy_path = :path WHERE user_id = :uid");
    $upPathStmt->execute(['path' => $newPath, 'uid' => $newUserId]);
    $upPathStmt->closeCursor();

    // 3. Initialize Wallet
    $db->prepare("INSERT INTO wallets (tenant_id, user_id, balance, currency, status) 
        VALUES (:tid, :uid, 0.00, 'BDT', 'active')
        ON DUPLICATE KEY UPDATE updated_at = NOW()")
        ->execute(['tid' => $effectiveTenantId, 'uid' => $newUserId]);

    // 4. Assign default granular permissions
    $permCodes = [
        'can_create_customer', 'can_view_invoice', 'can_recharge'
    ];
    if (in_array($targetRole, [HierarchySecurityService::ROLE_RESELLER, HierarchySecurityService::ROLE_SUB_RESELLER, HierarchySecurityService::ROLE_DEALER], true)) {
        $permCodes[] = 'can_edit_customer';
        $permCodes[] = 'can_manage_sub_tier';
        $permCodes[] = 'can_assign_package';
        $permCodes[] = 'can_transfer_balance';
    }

    $allPermsStmt = $db->query("SELECT permission_id, permission_code FROM permissions");
    $allPerms = $allPermsStmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $allPermsStmt->closeCursor();

    $pIns = $db->prepare("INSERT IGNORE INTO user_permissions (user_id, permission_id, granted) VALUES (:uid, :pid, 1)");
    foreach ($permCodes as $code) {
        if (isset($allPerms[$code])) {
            $pIns->execute(['uid' => $newUserId, 'pid' => $allPerms[$code]]);
        }
    }

    $db->commit();

    Response::json([
        'success' => true,
        'message' => "Downline {$targetRole} '{$username}' created successfully.",
        'data' => [
            'user_id' => $newUserId,
            'username' => $username,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'phone' => $phone,
            'role' => $targetRole,
            'role_level' => $targetRoleLevel,
            'parent_id' => $callerId,
            'hierarchy_path' => $newPath,
            'wallet_balance' => 0.00,
        ],
    ], 201);
} catch (Throwable $e) {
    $db->rollBack();
    Response::error("Failed to create downline: " . $e->getMessage(), 500);
}

