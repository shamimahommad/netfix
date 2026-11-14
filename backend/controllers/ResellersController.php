<?php
/**
 * NetFix ISP SaaS - Resellers Controller
 * Includes Hierarchy Management and Commission % Cap Rule Enforcements
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';
require_once __DIR__ . '/../lib/PackageAssignmentService.php';
require_once __DIR__ . '/../lib/WalletLedgerService.php';

class ResellersController {
    public static function index(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $where = ["u.role IN ('reseller', 'sub_reseller', 'dealer', 'agent')"];
        $params = [];

        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            if ($tenantId === null) {
                Response::json(['data' => []]);
                return;
            }
            $where[] = "u.tenant_id = :tid";
            $params['tid'] = $tenantId;
        }

        if (!empty($_GET['role'])) {
            $where[] = "u.role = :role";
            $params['role'] = $_GET['role'];
        }

        if (!empty($_GET['status'])) {
            $where[] = "u.status = :status";
            $params['status'] = $_GET['status'];
        }

        // Downward-Only Access Control via Materialized Path
        $callerRole = strtolower($user['role'] ?? '');
        $isLevel0 = in_array($callerRole, ['admin', 'isp_admin', 'manager', 'tenant_admin', 'saas_admin', 'super_admin'], true);
        if (!$isLevel0) {
            $userPath = $user['hierarchy_path'] ?? "/{$user['user_id']}/";
            $where[] = "(u.hierarchy_path LIKE :caller_path_like AND u.user_id != :caller_id)";
            $params['caller_path_like'] = rtrim($userPath, '/') . '/%';
            $params['caller_id'] = $user['user_id'];
        }

        $whereSql = implode(' AND ', $where);

        $stmt = $db->prepare("SELECT 
            u.user_id,
            u.first_name,
            u.last_name,
            u.username,
            u.email,
            u.role,
            u.phone,
            u.status,
            COALESCE(SUM(l.credit - l.debit), 0) as balance,
            CAST(JSON_UNQUOTE(JSON_EXTRACT(u.metadata, '$.credit_limit')) AS DECIMAL(10,2)) as credit_limit,
            CAST(JSON_UNQUOTE(JSON_EXTRACT(u.metadata, '$.network_device_id')) AS CHAR) as serverId
            FROM users u
            LEFT JOIN reseller_ledger l ON l.user_id = u.user_id
            WHERE {$whereSql}
            GROUP BY u.user_id
            ORDER BY u.role_level DESC, u.user_id DESC");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $resellers = array_map(function($r) {
            $sId = $r['serverId'];
            if (empty($sId) || $sId === '0' || $sId === 'unassigned') {
                $sId = HierarchySecurityService::getAssignedServerId((int)$r['user_id']);
            }
            return [
                'userId' => (string)$r['user_id'],
                'name' => trim($r['first_name'] . ' ' . $r['last_name']),
                'username' => $r['username'],
                'email' => $r['email'],
                'role' => $r['role'],
                'balance' => (float)$r['balance'],
                'credit_limit' => $r['credit_limit'] !== null ? (float)$r['credit_limit'] : 0.00,
                'phone' => $r['phone'],
                'status' => $r['status'],
                'serverId' => $sId ?: null,
            ];
        }, $rows);

        Response::json(['data' => $resellers]);
    }

    public static function pops(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT user_id, first_name, last_name, username 
            FROM users 
            WHERE tenant_id = :tid AND role = 'reseller' AND status = 'active'
            ORDER BY first_name ASC");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        $pops = array_map(function($r) {
            return [
                'userId' => (string)$r['user_id'],
                'name' => trim($r['first_name'] . ' ' . $r['last_name']),
                'username' => $r['username'],
            ];
        }, $rows);

        Response::json($pops);
    }

    public static function show(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT u.*, COALESCE(SUM(l.credit - l.debit), 0) as balance 
            FROM users u
            LEFT JOIN reseller_ledger l ON l.user_id = u.user_id
            WHERE u.user_id = :id AND u.tenant_id = :tid
            GROUP BY u.user_id LIMIT 1");
        $stmt->execute(['id' => $id, 'tid' => $tenantId]);
        $row = $stmt->fetch();

        if (!$row) {
            Response::error('Reseller not found', 404);
        }

        $meta = json_decode($row['metadata'] ?? '{}', true) ?: [];

        Response::json([
            'userId' => (string)$row['user_id'],
            'name' => trim($row['first_name'] . ' ' . $row['last_name']),
            'username' => $row['username'],
            'email' => $row['email'],
            'role' => $row['role'],
            'balance' => (float)$row['balance'],
            'credit_limit' => (float)($meta['credit_limit'] ?? 0),
            'phone' => $row['phone'],
            'status' => $row['status'],
            'serverId' => $meta['network_device_id'] ?? null,
        ]);
    }

    public static function create(): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $name = trim($data['name'] ?? '');
        $username = trim($data['username'] ?? '');
        $password = (string)($data['password'] ?? 'password123');
        $role = $data['role'] ?? 'reseller';

        if (empty($name) || empty($username) || empty($password)) {
            Response::error('Name, username, and password are required', 400);
        }

        $roleLevel = 80;
        if ($role === 'sub_reseller') $roleLevel = 60;
        if ($role === 'dealer') $roleLevel = 40;
        if ($role === 'agent') $roleLevel = 20;

        $db = Database::getConnection();

        // Check unique username within tenant
        $stmt = $db->prepare("SELECT user_id FROM users WHERE username = :u AND tenant_id = :tid LIMIT 1");
        $stmt->execute(['u' => $username, 'tid' => $tenantId]);
        if ($stmt->fetch()) {
            Response::error('Username already taken in this tenant', 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $email = $username . '@ispnetfix.local';
        $parentId = (int)($data['parentId'] ?? $currentUser['user_id']);
        $parentUser = HierarchySecurityService::getUser($parentId);
        $parentPath = $parentUser['hierarchy_path'] ?? "/{$parentId}/";

        // Strict Server Assignment: Resellers & Agents NEVER select a server.
        // Downlines strictly inherit their parent reseller's assigned server.
        $callerRole = strtolower($currentUser['role'] ?? '');
        $callerLevel = HierarchySecurityService::getHierarchyLevel($callerRole);
        $isLevel0 = ($callerLevel === 0 || $callerRole === 'saas_admin');

        $assignedServerId = null;
        if (!$isLevel0) {
            $assignedServerId = HierarchySecurityService::getAssignedServerId((int)$currentUser['user_id']);
            if (!$assignedServerId) {
                Response::error('Server Assignment Required: No server has been assigned to your reseller account by ISP Admin. Please contact ISP Admin before adding downlines.', 400);
            }
        } else {
            $parentLevel = HierarchySecurityService::getHierarchyLevel($parentUser['role'] ?? '');
            if ($parentLevel > 0) {
                $assignedServerId = HierarchySecurityService::getAssignedServerId($parentId);
            } else {
                $assignedServerId = !empty($data['serverId']) ? (string)$data['serverId'] : null;
            }
        }

        $stmt = $db->prepare("INSERT INTO users 
            (tenant_id, email, username, password_hash, first_name, last_name, phone, role, role_level, parent_id, hierarchy_path, status, metadata, created_by)
            VALUES (:tid, :email, :uname, :pwd, :fname, '', :phone, :role, :lvl, :pid, :path, :status, :meta, :created_by)");
        
        $stmt->execute([
            'tid' => $tenantId,
            'email' => $email,
            'uname' => $username,
            'pwd' => $hash,
            'fname' => $name,
            'phone' => $data['phone'] ?? null,
            'role' => $role,
            'lvl' => $roleLevel,
            'pid' => $parentId,
            'path' => $parentPath,
            'status' => $data['status'] ?? 'active',
            'meta' => json_encode([
                'credit_limit' => $data['credit_limit'] ?? 0,
                'network_device_id' => $assignedServerId,
            ], JSON_UNESCAPED_UNICODE),
            'created_by' => $currentUser['user_id'],
        ]);

        $userId = (int)$db->lastInsertId();

        // Compute and set exact Materialized Path: /parent/.../userId/
        $userPath = rtrim($parentPath, '/') . "/{$userId}/";
        $db->prepare("UPDATE users SET hierarchy_path = :path WHERE user_id = :uid")
            ->execute(['path' => $userPath, 'uid' => $userId]);

        // Initialize Wallet
        $openingBalance = !empty($data['opening_balance']) ? (float)$data['opening_balance'] : 0.00;
        $db->prepare("INSERT INTO wallets (tenant_id, user_id, balance, currency, status) 
            VALUES (:tid, :uid, :bal, 'BDT', 'active')
            ON DUPLICATE KEY UPDATE updated_at = NOW()")
            ->execute(['tid' => $tenantId ?: 1, 'uid' => $userId, 'bal' => $openingBalance]);

        // If opening balance, record in ledger and transactions
        if ($openingBalance > 0) {
            $stmtLedger = $db->prepare("INSERT INTO reseller_ledger (tenant_id, user_id, credit, reference_type, notes, created_by)
                VALUES (:tid, :uid, :credit, 'OPENING_BALANCE', 'Opening wallet balance', :cb)");
            $stmtLedger->execute([
                'tid' => $tenantId,
                'uid' => $userId,
                'credit' => $openingBalance,
                'cb' => $currentUser['user_id'],
            ]);

            $db->prepare("INSERT INTO wallet_transactions 
                (tenant_id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, description, created_by)
                SELECT tenant_id, wallet_id, user_id, 'credit', :amt, 0.00, :amt, 'OPENING_BALANCE', 'Opening wallet balance', :cb 
                FROM wallets WHERE user_id = :uid LIMIT 1")
                ->execute(['amt' => $openingBalance, 'cb' => $currentUser['user_id'], 'uid' => $userId]);
        }

        Response::json([
            'success' => true,
            'data' => [
                'userId' => (string)$userId,
                'username' => $username,
            ],
        ], 201);
    }

    public static function update(string $id): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $db = Database::getConnection();

        // 1. Verify user exists
        $stmt = $db->prepare("SELECT user_id, tenant_id, username, email, role, hierarchy_path, metadata FROM users WHERE user_id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $targetUser = $stmt->fetch();

        if (!$targetUser) {
            Response::error('User not found', 404);
        }

        $callerRole = $currentUser['role'] ?? '';
        $isSuperAdmin = ($callerRole === 'saas_admin');
        $isTenantAdmin = in_array($callerRole, ['admin', 'isp_admin', 'manager'], true);

        // Security check
        if (!$isSuperAdmin) {
            if ($isTenantAdmin) {
                if (!empty($targetUser['tenant_id']) && (string)$targetUser['tenant_id'] !== (string)$tenantId) {
                    Response::error('Access denied for this user', 403);
                }
            } else {
                $callerPath = $currentUser['hierarchy_path'] ?? "/{$currentUser['user_id']}/";
                $targetPath = $targetUser['hierarchy_path'] ?? '';
                if (!str_starts_with($targetPath, rtrim($callerPath, '/') . '/')) {
                    Response::error('Permission denied to update this user', 403);
                }
            }
        }

        $fields = [];
        $params = ['id' => $id];

        // First Name
        if (isset($data['name']) && trim($data['name']) !== '') {
            $fields[] = "first_name = :name";
            $params['name'] = trim($data['name']);
        }

        // Username
        if (isset($data['username']) && trim($data['username']) !== '') {
            $newUsername = trim($data['username']);
            if (strtolower($newUsername) !== strtolower($targetUser['username'])) {
                $check = $db->prepare("SELECT user_id FROM users WHERE LOWER(username) = LOWER(:u) AND user_id != :id LIMIT 1");
                $check->execute(['u' => $newUsername, 'id' => $id]);
                if ($check->fetch()) {
                    Response::error('Username already taken', 400);
                }
                $fields[] = "username = :uname";
                $params['uname'] = $newUsername;

                // Sync default generated email if applicable
                $currentEmail = $targetUser['email'] ?? '';
                if (empty($currentEmail) || str_ends_with($currentEmail, '@ispnetfix.local') || str_ends_with($currentEmail, '@reseller.local')) {
                    $fields[] = "email = :new_email";
                    $params['new_email'] = strtolower($newUsername) . '@ispnetfix.local';
                }
            }
        }

        // Email
        if (isset($data['email']) && trim($data['email']) !== '') {
            $newEmail = trim($data['email']);
            if (strtolower($newEmail) !== strtolower($targetUser['email'] ?? '')) {
                $checkEmail = $db->prepare("SELECT user_id FROM users WHERE LOWER(email) = LOWER(:e) AND user_id != :id LIMIT 1");
                $checkEmail->execute(['e' => $newEmail, 'id' => $id]);
                if ($checkEmail->fetch()) {
                    Response::error('Email already in use', 400);
                }
                $fields[] = "email = :email";
                $params['email'] = $newEmail;
            }
        }

        // Phone
        if (isset($data['phone'])) {
            $fields[] = "phone = :phone";
            $params['phone'] = trim($data['phone']) ?: null;
        }

        // Password Reset
        if (isset($data['password']) && trim((string)$data['password']) !== '') {
            $rawPassword = trim((string)$data['password']);
            if (strlen($rawPassword) < 4) {
                Response::error('Password must be at least 4 characters', 400);
            }
            $fields[] = "password_hash = :pwd";
            $fields[] = "password_changed_at = NOW()";
            $params['pwd'] = password_hash($rawPassword, PASSWORD_BCRYPT);
        }

        // Status
        if (!empty($data['status'])) {
            $fields[] = "status = :status";
            $params['status'] = $data['status'];
        }

        // Role & Role Level
        $roleLevels = [
            'admin' => 100,
            'isp_admin' => 90,
            'manager' => 85,
            'reseller' => 80,
            'sub_reseller' => 60,
            'dealer' => 40,
            'agent' => 20
        ];
        if (!empty($data['role']) && isset($roleLevels[$data['role']])) {
            $fields[] = "role = :role";
            $fields[] = "role_level = :lvl";
            $params['role'] = $data['role'];
            $params['lvl'] = $roleLevels[$data['role']];
        }

        // Metadata: credit_limit, network_device_id
        $meta = json_decode($targetUser['metadata'] ?? '{}', true) ?: [];
        $metaUpdated = false;
        if (isset($data['credit_limit']) && ($isSuperAdmin || $isTenantAdmin)) {
            $meta['credit_limit'] = (float)$data['credit_limit'];
            $metaUpdated = true;
        }

        // Server Assignment: ONLY ISP Admin (Level 0) can assign or change server!
        // Resellers and Agents can NEVER change server.
        if (($isSuperAdmin || $isTenantAdmin) && array_key_exists('serverId', $data)) {
            $newServerId = !empty($data['serverId']) ? (string)$data['serverId'] : null;
            $oldServerId = $meta['network_device_id'] ?? null;
            $meta['network_device_id'] = $newServerId;
            $metaUpdated = true;

            // Cascade to all sub-resellers, dealers, and agents under this reseller
            if ($newServerId !== $oldServerId) {
                HierarchySecurityService::cascadeServerToDescendants((int)$id, $newServerId);
            }
        }
        if ($metaUpdated) {
            $fields[] = "metadata = :meta";
            $params['meta'] = json_encode($meta);
        }

        if (!empty($fields)) {
            $fields[] = "updated_at = NOW()";
            $sql = "UPDATE users SET " . implode(', ', $fields) . " WHERE user_id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }

        Response::json([
            'success' => true,
            'message' => 'Reseller updated successfully',
            'userId' => (string)$id,
        ]);
    }

    public static function resetPassword(string $id): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $password = trim((string)($data['password'] ?? ''));

        if (empty($password)) {
            Response::error('Password is required', 400);
        }
        if (strlen($password) < 4) {
            Response::error('Password must be at least 4 characters', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT user_id, tenant_id, username, email, role, hierarchy_path FROM users WHERE user_id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $targetUser = $stmt->fetch();

        if (!$targetUser) {
            Response::error('User not found', 404);
        }

        $callerRole = $currentUser['role'] ?? '';
        $isSuperAdmin = ($callerRole === 'saas_admin');
        $isTenantAdmin = in_array($callerRole, ['admin', 'isp_admin', 'manager'], true);

        if (!$isSuperAdmin) {
            if ($isTenantAdmin) {
                if (!empty($targetUser['tenant_id']) && (string)$targetUser['tenant_id'] !== (string)$tenantId) {
                    Response::error('Access denied for this user', 403);
                }
            } else {
                $callerPath = $currentUser['hierarchy_path'] ?? "/{$currentUser['user_id']}/";
                $targetPath = $targetUser['hierarchy_path'] ?? '';
                if (!str_starts_with($targetPath, rtrim($callerPath, '/') . '/')) {
                    Response::error('Permission denied to reset password for this user', 403);
                }
            }
        }

        $newHash = password_hash($password, PASSWORD_BCRYPT);
        $upd = $db->prepare("UPDATE users SET password_hash = :hash, password_changed_at = NOW(), updated_at = NOW() WHERE user_id = :id");
        $upd->execute(['hash' => $newHash, 'id' => $id]);

        Response::json([
            'success' => true,
            'message' => 'Password reset successfully for ' . $targetUser['username'],
            'username' => $targetUser['username'],
        ]);
    }

    public static function setStatus(string $id): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $status = $data['status'] ?? 'active';

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT user_id, tenant_id FROM users WHERE user_id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $targetUser = $stmt->fetch();

        if (!$targetUser) {
            Response::error('User not found', 404);
        }

        $callerRole = $currentUser['role'] ?? '';
        if ($callerRole !== 'saas_admin' && !empty($targetUser['tenant_id']) && (string)$targetUser['tenant_id'] !== (string)$tenantId) {
            Response::error('Access denied', 403);
        }

        $upd = $db->prepare("UPDATE users SET status = :status, updated_at = NOW() WHERE user_id = :id");
        $upd->execute(['status' => $status, 'id' => $id]);

        Response::json(['success' => true, 'status' => $status]);
    }

    public static function delete(string $id): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT user_id, tenant_id FROM users WHERE user_id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $targetUser = $stmt->fetch();

        if (!$targetUser) {
            Response::error('User not found', 404);
        }

        $callerRole = $currentUser['role'] ?? '';
        if ($callerRole !== 'saas_admin' && !empty($targetUser['tenant_id']) && (string)$targetUser['tenant_id'] !== (string)$tenantId) {
            Response::error('Access denied', 403);
        }

        $upd = $db->prepare("UPDATE users SET status = 'inactive', deleted_at = NOW(), updated_at = NOW() WHERE user_id = :id");
        $upd->execute(['id' => $id]);

        Response::json(['success' => true]);
    }

    public static function loginAs(string $id): void {
        AuthController::impersonate($id);
    }

    public static function addBalance(): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $userId = (int)($data['userId'] ?? 0);
        $amount = (float)($data['amount'] ?? 0);
        $notes = $data['notes'] ?? 'Wallet Top-up';

        if (!$userId || $amount <= 0) {
            Response::error('User ID and positive amount are required', 400);
        }

        try {
            $result = WalletLedgerService::topup(
                (int)$currentUser['user_id'],
                $userId,
                $amount,
                $notes,
                $tenantId ? (int)$tenantId : null
            );
            Response::json(['success' => true, 'balance' => $result['balance_after']]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public static function transferBalance(): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $fromUserId = (int)($data['fromUserId'] ?? 0);
        $toUserId = (int)($data['toUserId'] ?? 0);
        $amount = (float)($data['amount'] ?? 0);
        $notes = $data['notes'] ?? 'Wallet Transfer';

        if (!$fromUserId || !$toUserId || $amount <= 0) {
            Response::error('From User, To User, and positive amount are required', 400);
        }

        try {
            $result = WalletLedgerService::transfer(
                (int)$currentUser['user_id'],
                $fromUserId,
                $toUserId,
                $amount,
                $notes,
                $tenantId ? (int)$tenantId : null
            );
            Response::json(['success' => true, 'data' => $result]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * CRITICAL HIERARCHY RULE:
     * Admin/Company -> Reseller -> Sub-Reseller -> Agent
     * Lower role cannot exceed upper role commission %!
     */
    public static function getPlanPermissions(string $userId): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT 
            ap.access_profile_id as packageId,
            COALESCE(rpp.sell_price, ap.price) as sellPrice,
            COALESCE(rpp.pop_profit, 0) as popProfit,
            COALESCE(rpp.pop_profit_percent, 0) as popProfitPercent,
            COALESCE(rpp.is_allowed, 1) as allowed
            FROM access_profiles ap
            LEFT JOIN reseller_plan_permission rpp ON rpp.access_profile_id = ap.access_profile_id AND rpp.user_id = :uid AND rpp.tenant_id = :tid
            WHERE ap.tenant_id = :tid
            ORDER BY ap.access_profile_id ASC");
        $stmt->execute(['uid' => $userId, 'tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        $items = array_map(function($r) {
            return [
                'packageId' => (string)$r['packageId'],
                'sellPrice' => (float)$r['sellPrice'],
                'popProfit' => (float)$r['popProfit'],
                'popProfitPercent' => (float)$r['popProfitPercent'],
                'allowed' => (bool)$r['allowed'],
            ];
        }, $rows);

        Response::json(['items' => $items]);
    }

    public static function putPlanPermissions(string $userId): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $items = $data['items'] ?? [];
        $targetUserId = (int)$userId;

        // Verify downward access
        if (!HierarchySecurityService::canAccessUser((int)$currentUser['user_id'], $targetUserId)) {
            Response::error("Access denied: You do not have permission to configure permissions for user #{$targetUserId}", 403);
            return;
        }

        try {
            foreach ($items as $item) {
                $pkgId = (int)($item['packageId'] ?? 0);
                if (!$pkgId) continue;

                $commissionRate = (float)($item['popProfitPercent'] ?? 0);
                $sellPrice = isset($item['sellPrice']) ? (float)$item['sellPrice'] : null;
                $isAllowed = !empty($item['allowed']);

                PackageAssignmentService::assignPackageToChild(
                    (int)$currentUser['user_id'],
                    $targetUserId,
                    $pkgId,
                    $commissionRate,
                    $sellPrice,
                    $isAllowed,
                    $tenantId ? (int)$tenantId : null
                );
            }

            Response::json(['success' => true, 'message' => 'Package permissions and price floors updated successfully']);
        } catch (DomainException $de) {
            Response::error($de->getMessage(), 400);
        } catch (Throwable $e) {
            Response::error("Failed to update permissions: " . $e->getMessage(), 500);
        }
    }

    public static function myPackages(): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $userId = (int)$currentUser['user_id'];
        $role = strtolower($currentUser['role'] ?? '');
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $role === 'saas_admin');

        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 25)));
        $offset = ($page - 1) * $limit;

        $where = ["ap.tenant_id = :tid"];
        $params = ['uid' => $userId, 'tid' => $tenantId];

        if (!empty($_GET['search'])) {
            $search = '%' . trim($_GET['search']) . '%';
            $where[] = "(ap.profile_name LIKE :s1 OR ap.protocol LIKE :s2 OR ap.mikrotik_profile_name LIKE :s3)";
            $params['s1'] = $search;
            $params['s2'] = $search;
            $params['s3'] = $search;
        }

        // Downward-Inclusive Hierarchy Scoping for active subscribers
        if ($isLevel0) {
            $subscribersCountSql = "(
                SELECT COUNT(DISTINCT cs_sub.customer_id)
                FROM customer_services cs_sub
                JOIN customers c_sub ON c_sub.customer_id = cs_sub.customer_id
                WHERE cs_sub.access_profile_id = ap.access_profile_id
                  AND cs_sub.status = 'active'
                  AND c_sub.tenant_id = ap.tenant_id
            )";
        } else {
            $rawPath = $currentUser['hierarchy_path'] ?? "/{$userId}/";
            $userPath = '/' . trim($rawPath, '/') . '/';
            $params['scope_uid'] = $userId;
            $params['scope_path_wildcard'] = $userPath . '%';

            $subscribersCountSql = "(
                SELECT COUNT(DISTINCT cs_sub.customer_id)
                FROM customer_services cs_sub
                JOIN customers c_sub ON c_sub.customer_id = cs_sub.customer_id
                LEFT JOIN users u_sub ON u_sub.user_id = c_sub.owner_id
                WHERE cs_sub.access_profile_id = ap.access_profile_id
                  AND cs_sub.status = 'active'
                  AND c_sub.tenant_id = ap.tenant_id
                  AND (c_sub.owner_id = :scope_uid OR u_sub.hierarchy_path LIKE :scope_path_wildcard OR c_sub.owner_path LIKE :scope_path_wildcard)
            )";
        }

        $whereSql = implode(' AND ', $where);

        // Count total packages
        $countStmt = $db->prepare("SELECT COUNT(*) FROM access_profiles ap WHERE {$whereSql}");
        foreach ($params as $k => $v) {
            if ($k !== 'scope_uid' && $k !== 'scope_path_wildcard' && $k !== 'uid') {
                $countStmt->bindValue(':' . $k, $v);
            }
        }
        $countStmt->execute();
        $total = (int)$countStmt->fetchColumn();
        $countStmt->closeCursor();

        $stmt = $db->prepare("SELECT 
            ap.access_profile_id as id,
            COALESCE(
                nd.device_name,
                (
                    SELECT nd2.device_name 
                    FROM customer_services cs2 
                    JOIN customer_network_accounts na2 ON na2.customer_id = cs2.customer_id 
                    JOIN network_devices nd2 ON nd2.network_device_id = na2.network_device_id 
                    WHERE cs2.access_profile_id = ap.access_profile_id AND nd2.device_name IS NOT NULL 
                    LIMIT 1
                ),
                (
                    SELECT nd3.device_name 
                    FROM network_devices nd3 
                    WHERE nd3.tenant_id = ap.tenant_id AND nd3.device_type = 'router' 
                    ORDER BY nd3.network_device_id DESC 
                    LIMIT 1
                ),
                'PPPoE Server'
            ) as server,
            ap.protocol,
            ap.profile_name as name,
            ap.mikrotik_profile_name as mikrotik_profile,
            ap.price,
            COALESCE(tp.cost_price, rpp.sell_price, ap.price) as my_price,
            COALESCE(NULLIF(tp.retail_price - tp.cost_price, 0), rpp.pop_profit, (ap.price - COALESCE(tp.cost_price, rpp.sell_price, ap.price)), 0) as my_profit,
            {$subscribersCountSql} as count,
            CONCAT(ap.validity_days, ' Days') as validity,
            CASE WHEN ap.data_volume_type = 'unlimited' THEN 'Unlimited' ELSE CONCAT(ap.data_volume_gb, ' GB') END as volume,
            ap.status
            FROM access_profiles ap
            LEFT JOIN network_devices nd ON nd.network_device_id = ap.network_device_id
            LEFT JOIN tier_packages tp ON tp.package_id = ap.access_profile_id AND tp.user_id = :uid AND tp.tenant_id = :tid
            LEFT JOIN reseller_plan_permission rpp ON rpp.access_profile_id = ap.access_profile_id AND rpp.user_id = :uid
            WHERE {$whereSql}
            ORDER BY ap.access_profile_id ASC
            LIMIT :lim OFFSET :off");

        foreach ($params as $k => $v) {
            $stmt->bindValue(':' . $k, $v);
        }
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            return [
                'id' => (string)$r['id'],
                'server' => !empty($r['server']) ? $r['server'] : 'PPPoE Server',
                'protocol' => $r['protocol'],
                'name' => $r['name'],
                'mikrotik_profile' => $r['mikrotik_profile'] ?? $r['name'],
                'price' => (float)$r['price'],
                'my_price' => (float)$r['my_price'],
                'my_profit' => (float)$r['my_profit'],
                'count' => (int)$r['count'],
                'validity' => $r['validity'],
                'volume' => $r['volume'],
                'status' => $r['status'],
            ];
        }, $rows);

        Response::json([
            'data' => $data,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => max(1, (int)ceil($total / $limit)),
            ],
        ]);
    }

    public static function ledger(string $userId): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM reseller_ledger WHERE user_id = :uid AND tenant_id = :tid ORDER BY ledger_id DESC");
        $stmt->execute(['uid' => $userId, 'tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        Response::json(['items' => $rows ?: []]);
    }

    public static function loginLog(?string $userId = null): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $uid = $userId ?? $_GET['userId'] ?? null;
        if (!empty($uid) && $uid !== 'all') {
            $stmt = $db->prepare("SELECT l.id, DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i:%s') as logTime, l.ip, l.browser, l.os, l.method, u.user_id, u.first_name as userName, u.username, u.role
                FROM login_logs l
                JOIN users u ON u.user_id = l.user_id
                WHERE l.user_id = :uid AND (u.tenant_id = :tid OR u.tenant_id IS NULL)
                ORDER BY l.id DESC LIMIT 100");
            $stmt->execute(['uid' => $uid, 'tid' => $tenantId]);
            $rows = $stmt->fetchAll();

            // If empty, check if user has last_login_at
            if (empty($rows)) {
                $stmtUser = $db->prepare("SELECT user_id, first_name as userName, username, role, DATE_FORMAT(last_login_at, '%Y-%m-%d %H:%i:%s') as logTime, last_login_ip as ip FROM users WHERE user_id = :uid");
                $stmtUser->execute(['uid' => $uid]);
                $u = $stmtUser->fetch();
                if ($u && !empty($u['logTime'])) {
                    $rows = [[
                        'id' => 1,
                        'logTime' => $u['logTime'],
                        'ip' => $u['ip'] ?: '127.0.0.1',
                        'browser' => 'Chrome',
                        'os' => 'Windows',
                        'method' => 'web',
                        'user_id' => $u['user_id'],
                        'userName' => $u['userName'],
                        'username' => $u['username'],
                        'role' => $u['role'],
                    ]];
                }
            }
        } else {
            // All reseller login logs for this tenant
            $stmt = $db->prepare("SELECT l.id, DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i:%s') as logTime, l.ip, l.browser, l.os, l.method, u.user_id, u.first_name as userName, u.username, u.role 
                FROM login_logs l
                JOIN users u ON u.user_id = l.user_id
                WHERE (u.tenant_id = :tid OR :tid2 IS NULL) AND u.role IN ('reseller', 'sub_reseller', 'agent', 'admin', 'manager')
                ORDER BY l.id DESC LIMIT 100");
            $stmt->execute(['tid' => $tenantId, 'tid2' => $tenantId]);
            $rows = $stmt->fetchAll();

            if (empty($rows)) {
                // Synthesize from active users with last_login_at
                $stmtUsers = $db->prepare("SELECT u.user_id, u.first_name as userName, u.username, u.role, DATE_FORMAT(u.last_login_at, '%Y-%m-%d %H:%i:%s') as logTime, u.last_login_ip as ip 
                    FROM users u
                    WHERE (u.tenant_id = :tid OR :tid2 IS NULL) AND u.role IN ('reseller', 'sub_reseller', 'agent', 'admin', 'manager') AND u.last_login_at IS NOT NULL
                    ORDER BY u.last_login_at DESC LIMIT 20");
                $stmtUsers->execute(['tid' => $tenantId, 'tid2' => $tenantId]);
                $userRows = $stmtUsers->fetchAll();
                foreach ($userRows as $idx => $ur) {
                    $rows[] = [
                        'id' => $idx + 1,
                        'logTime' => $ur['logTime'],
                        'ip' => $ur['ip'] ?: '127.0.0.1',
                        'browser' => 'Chrome',
                        'os' => 'Windows',
                        'method' => 'web',
                        'user_id' => $ur['user_id'],
                        'userName' => $ur['userName'],
                        'username' => $ur['username'],
                        'role' => $ur['role'],
                    ];
                }
            }
        }

        Response::json(['items' => $rows ?: []]);
    }
}

