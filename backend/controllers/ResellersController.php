<?php
/**
 * NetFix ISP SaaS - Resellers Controller
 * Includes Hierarchy Management and Commission % Cap Rule Enforcements
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class ResellersController {
    public static function index(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $where = ["u.role IN ('reseller', 'sub_reseller', 'agent')"];
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

        // If caller is reseller, show only own downline
        if (in_array($user['role'], ['reseller', 'sub_reseller'])) {
            $where[] = "(u.parent_id = :caller_id OR u.created_by = :caller_id)";
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
                'serverId' => $r['serverId'],
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
        if ($role === 'agent') $roleLevel = 40;

        $db = Database::getConnection();

        // Check unique username within tenant
        $stmt = $db->prepare("SELECT user_id FROM users WHERE username = :u AND tenant_id = :tid LIMIT 1");
        $stmt->execute(['u' => $username, 'tid' => $tenantId]);
        if ($stmt->fetch()) {
            Response::error('Username already taken in this tenant', 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $email = $username . '@ispnetfix.local';

        $stmt = $db->prepare("INSERT INTO users 
            (tenant_id, email, username, password_hash, first_name, last_name, phone, role, role_level, parent_id, status, metadata, created_by)
            VALUES (:tid, :email, :uname, :pwd, :fname, '', :phone, :role, :lvl, :pid, :status, :meta, :created_by)");
        
        $stmt->execute([
            'tid' => $tenantId,
            'email' => $email,
            'uname' => $username,
            'pwd' => $hash,
            'fname' => $name,
            'phone' => $data['phone'] ?? null,
            'role' => $role,
            'lvl' => $roleLevel,
            'pid' => $data['parentId'] ?? $currentUser['user_id'],
            'status' => $data['status'] ?? 'active',
            'meta' => json_encode([
                'credit_limit' => $data['credit_limit'] ?? 0,
                'network_device_id' => $data['serverId'] ?? null,
            ]),
            'created_by' => $currentUser['user_id'],
        ]);

        $userId = $db->lastInsertId();

        // If opening balance
        if (!empty($data['opening_balance']) && (float)$data['opening_balance'] > 0) {
            $stmtLedger = $db->prepare("INSERT INTO reseller_ledger (tenant_id, user_id, credit, reference_type, notes, created_by)
                VALUES (:tid, :uid, :credit, 'OPENING_BALANCE', 'Opening wallet balance', :cb)");
            $stmtLedger->execute([
                'tid' => $tenantId,
                'uid' => $userId,
                'credit' => (float)$data['opening_balance'],
                'cb' => $currentUser['user_id'],
            ]);
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

        $fields = [];
        $params = ['id' => $id, 'tid' => $tenantId];

        if (!empty($data['name'])) {
            $fields[] = "first_name = :name";
            $params['name'] = $data['name'];
        }
        if (!empty($data['phone'])) {
            $fields[] = "phone = :phone";
            $params['phone'] = $data['phone'];
        }
        if (!empty($data['password'])) {
            $fields[] = "password_hash = :pwd";
            $params['pwd'] = password_hash($data['password'], PASSWORD_BCRYPT);
        }
        if (!empty($data['status'])) {
            $fields[] = "status = :status";
            $params['status'] = $data['status'];
        }

        if (!empty($fields)) {
            $sql = "UPDATE users SET " . implode(', ', $fields) . " WHERE user_id = :id AND tenant_id = :tid";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }

        Response::json(['success' => true, 'message' => 'Reseller updated successfully']);
    }

    public static function setStatus(string $id): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $status = $data['status'] ?? 'active';

        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE users SET status = :status WHERE user_id = :id AND tenant_id = :tid");
        $stmt->execute(['status' => $status, 'id' => $id, 'tid' => $tenantId]);

        Response::json(['success' => true, 'status' => $status]);
    }

    public static function delete(string $id): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("UPDATE users SET status = 'inactive', deleted_at = NOW() WHERE user_id = :id AND tenant_id = :tid");
        $stmt->execute(['id' => $id, 'tid' => $tenantId]);

        Response::json(['success' => true]);
    }

    public static function loginAs(string $id): void {
        AuthController::impersonate($id);
    }

    public static function addBalance(): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $userId = $data['userId'] ?? null;
        $amount = (float)($data['amount'] ?? 0);
        $notes = $data['notes'] ?? 'Wallet Top-up';

        if (!$userId || $amount <= 0) {
            Response::error('User ID and positive amount are required', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO reseller_ledger 
            (tenant_id, user_id, credit, reference_type, notes, created_by)
            VALUES (:tid, :uid, :credit, 'ADMIN_TOPUP', :notes, :cb)");
        $stmt->execute([
            'tid' => $tenantId,
            'uid' => $userId,
            'credit' => $amount,
            'notes' => $notes,
            'cb' => $currentUser['user_id'],
        ]);

        // Get new balance
        $stmtBal = $db->prepare("SELECT COALESCE(SUM(credit - debit), 0) as balance FROM reseller_ledger WHERE user_id = :uid");
        $stmtBal->execute(['uid' => $userId]);
        $newBalance = (float)$stmtBal->fetchColumn();

        Response::json(['success' => true, 'balance' => $newBalance]);
    }

    public static function transferBalance(): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $fromUserId = $data['fromUserId'] ?? null;
        $toUserId = $data['toUserId'] ?? null;
        $amount = (float)($data['amount'] ?? 0);

        if (!$fromUserId || !$toUserId || $amount <= 0) {
            Response::error('From User, To User, and positive amount are required', 400);
        }

        $db = Database::getConnection();
        $db->beginTransaction();

        try {
            // Check sender balance
            $stmt = $db->prepare("SELECT COALESCE(SUM(credit - debit), 0) as balance FROM reseller_ledger WHERE user_id = :uid");
            $stmt->execute(['uid' => $fromUserId]);
            $senderBalance = (float)$stmt->fetchColumn();

            if ($senderBalance < $amount && $currentUser['role'] !== 'saas_admin' && $currentUser['role'] !== 'admin') {
                Response::error('Insufficient balance to transfer', 400);
            }

            // Debit sender
            $stmt = $db->prepare("INSERT INTO reseller_ledger (tenant_id, user_id, debit, reference_type, notes, created_by)
                VALUES (:tid, :uid, :amt, 'TRANSFER_OUT', 'Transferred to user ' :touid, :cb)");
            $stmt->execute([
                'tid' => $tenantId,
                'uid' => $fromUserId,
                'amt' => $amount,
                'cb' => $currentUser['user_id'],
            ]);

            // Credit recipient
            $stmt = $db->prepare("INSERT INTO reseller_ledger (tenant_id, user_id, credit, reference_type, notes, created_by)
                VALUES (:tid, :uid, :amt, 'TRANSFER_IN', 'Received from user ' :fromuid, :cb)");
            $stmt->execute([
                'tid' => $tenantId,
                'uid' => $toUserId,
                'amt' => $amount,
                'cb' => $currentUser['user_id'],
            ]);

            $db->commit();

            Response::json([
                'success' => true,
                'fromBalance' => $senderBalance - $amount,
                'toBalance' => 0,
            ]);
        } catch (Throwable $e) {
            $db->rollBack();
            Response::error('Balance transfer failed: ' . $e->getMessage(), 500);
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

        $db = Database::getConnection();

        // 1. Fetch target user's parent
        $stmt = $db->prepare("SELECT user_id, parent_id, role, role_level FROM users WHERE user_id = :uid LIMIT 1");
        $stmt->execute(['uid' => $userId]);
        $targetUser = $stmt->fetch();

        if (!$targetUser) {
            Response::error('Target user not found', 404);
        }

        $parentId = $targetUser['parent_id'];
        $parentPermMap = [];

        // If parent exists and is not an Admin level (100+), verify parent's commission cap
        if ($parentId) {
            $stmtParent = $db->prepare("SELECT user_id, role, role_level FROM users WHERE user_id = :pid LIMIT 1");
            $stmtParent->execute(['pid' => $parentId]);
            $parentUser = $stmtParent->fetch();

            if ($parentUser && (int)$parentUser['role_level'] < 100) {
                // Fetch parent's plan permissions
                $stmtPerms = $db->prepare("SELECT access_profile_id, pop_profit_percent FROM reseller_plan_permission WHERE user_id = :pid");
                $stmtPerms->execute(['pid' => $parentId]);
                while ($p = $stmtPerms->fetch()) {
                    $parentPermMap[(string)$p['access_profile_id']] = (float)$p['pop_profit_percent'];
                }
            }
        }

        // 2. Validate Commission % Cap
        foreach ($items as $item) {
            $pkgId = (string)($item['packageId'] ?? '');
            $childPercent = (float)($item['popProfitPercent'] ?? 0);

            if (isset($parentPermMap[$pkgId])) {
                $parentCap = $parentPermMap[$pkgId];
                if ($childPercent > $parentCap) {
                    Response::error("Commission % for package {$pkgId} ({$childPercent}%) cannot exceed parent's commission ({$parentCap}%). Lower role cannot exceed upper role commission.", 400);
                }
            }
        }

        // 3. Save or update permissions
        $db->beginTransaction();
        try {
            $stmtSave = $db->prepare("INSERT INTO reseller_plan_permission 
                (tenant_id, user_id, access_profile_id, sell_price, pop_profit, pop_profit_percent, is_allowed)
                VALUES (:tid, :uid, :pid, :price, :profit, :pct, :allowed)
                ON DUPLICATE KEY UPDATE 
                sell_price = VALUES(sell_price),
                pop_profit = VALUES(pop_profit),
                pop_profit_percent = VALUES(pop_profit_percent),
                is_allowed = VALUES(is_allowed)");

            foreach ($items as $item) {
                $stmtSave->execute([
                    'tid' => $tenantId,
                    'uid' => $userId,
                    'pid' => $item['packageId'],
                    'price' => (float)($item['sellPrice'] ?? 0),
                    'profit' => (float)($item['popProfit'] ?? 0),
                    'pct' => (float)($item['popProfitPercent'] ?? 0),
                    'allowed' => !empty($item['allowed']) ? 1 : 0,
                ]);
            }

            $db->commit();
            Response::json(['success' => true]);
        } catch (Throwable $e) {
            $db->rollBack();
            Response::error('Failed to update plan permissions: ' . $e->getMessage(), 500);
        }
    }

    public static function myPackages(): void {
        $currentUser = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $userId = $currentUser['user_id'];
        $stmt = $db->prepare("SELECT 
            ap.access_profile_id as id,
            nd.device_name as server,
            ap.protocol,
            ap.profile_name as name,
            ap.mikrotik_profile_name as mikrotik_profile,
            ap.price,
            COALESCE(rpp.sell_price, ap.price) as my_price,
            COALESCE(rpp.pop_profit, 0) as my_profit,
            COUNT(cs.customer_id) as count,
            CONCAT(ap.validity_days, ' Days') as validity,
            CASE WHEN ap.data_volume_type = 'unlimited' THEN 'Unlimited' ELSE CONCAT(ap.data_volume_gb, ' GB') END as volume,
            ap.status
            FROM access_profiles ap
            LEFT JOIN network_devices nd ON nd.network_device_id = ap.network_device_id
            LEFT JOIN reseller_plan_permission rpp ON rpp.access_profile_id = ap.access_profile_id AND rpp.user_id = :uid
            LEFT JOIN customer_services cs ON cs.access_profile_id = ap.access_profile_id AND cs.status = 'active'
            WHERE ap.tenant_id = :tid
            GROUP BY ap.access_profile_id");
        $stmt->execute(['uid' => $userId, 'tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            return [
                'id' => (string)$r['id'],
                'server' => $r['server'] ?? 'Main Core',
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
                'total' => count($data),
                'page' => 1,
                'limit' => 50,
                'totalPages' => 1,
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

    public static function loginLog(string $userId): void {
        $currentUser = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as logTime, ip, browser, os, method 
            FROM login_logs WHERE user_id = :uid ORDER BY id DESC LIMIT 50");
        $stmt->execute(['uid' => $userId]);
        $rows = $stmt->fetchAll();

        Response::json(['items' => $rows ?: []]);
    }
}

