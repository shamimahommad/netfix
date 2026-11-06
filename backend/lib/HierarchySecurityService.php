<?php
/**
 * NetFix ISP SaaS - Hierarchy & Downward-Only Access Control Security Service
 * Implements strict Materialized Path access control (RBAC & ABAC),
 * IDOR prevention, and granular permissions enforcement.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/Response.php';

class HierarchySecurityService {
    public const ROLE_ISP_ADMIN    = 'isp_admin';
    public const ROLE_RESELLER     = 'reseller';
    public const ROLE_SUB_RESELLER = 'sub_reseller';
    public const ROLE_DEALER       = 'dealer';
    public const ROLE_AGENT        = 'agent';

    /**
     * Strict Tier Level Mapping
     * Level 0: ISP Admin (Company)
     * Level 1: Reseller
     * Level 2: Sub-Reseller
     * Level 3: Dealer
     * Level 4: Agent
     */
    public static function getHierarchyLevel(string $role): int {
        $r = strtolower(trim($role));
        if (in_array($r, ['isp_admin', 'admin', 'manager', 'tenant_admin', 'saas_admin', 'super_admin'], true)) {
            return 0;
        }
        return match ($r) {
            self::ROLE_RESELLER     => 1,
            self::ROLE_SUB_RESELLER => 2,
            self::ROLE_DEALER       => 3,
            self::ROLE_AGENT        => 4,
            default                 => 99,
        };
    }

    /**
     * Strict Allowed Downline Child Role per Tier
     * Level 0 (ISP Admin) -> Level 1 (Reseller)
     * Level 1 (Reseller) -> Level 2 (Sub-Reseller)
     * Level 2 (Sub-Reseller) -> Level 3 (Dealer)
     * Level 3 (Dealer) -> Level 4 (Agent)
     * Level 4 (Agent) -> Cannot create downline
     */
    public static function getAllowedChildRole(string $parentRole): ?string {
        $level = self::getHierarchyLevel($parentRole);
        return match ($level) {
            0 => self::ROLE_RESELLER,
            1 => self::ROLE_SUB_RESELLER,
            2 => self::ROLE_DEALER,
            3 => self::ROLE_AGENT,
            default => null,
        };
    }

    /**
     * Fetch user record by ID with hierarchy details
     */
    public static function getUser(int $userId): ?array {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT user_id, tenant_id, email, username, first_name, last_name, 
            phone, status, role, role_level, parent_id, hierarchy_path 
            FROM users WHERE user_id = :uid LIMIT 1");
        $stmt->execute(['uid' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt->closeCursor();
        return $user ?: null;
    }

    /**
     * Check if a user can access a target user (target is self or descendant)
     * Prevents horizontal and upward leaks.
     */
    public static function canAccessUser(int $currentUserId, int $targetUserId): bool {
        if ($currentUserId === $targetUserId) {
            return true;
        }

        $currentUser = self::getUser($currentUserId);
        $targetUser = self::getUser($targetUserId);

        if (!$currentUser || !$targetUser) {
            return false;
        }

        // Cross-tenant protection
        if (!empty($currentUser['tenant_id']) && !empty($targetUser['tenant_id'])) {
            if ((int)$currentUser['tenant_id'] !== (int)$targetUser['tenant_id'] && $currentUser['role'] !== 'saas_admin') {
                return false;
            }
        }

        // Level 0 ISP Admin has downward visibility over all users in the tenant
        if (self::getHierarchyLevel($currentUser['role']) === 0) {
            return true;
        }

        $parentPath = $currentUser['hierarchy_path'] ?? '';
        $targetPath = $targetUser['hierarchy_path'] ?? '';

        if (empty($parentPath) || empty($targetPath)) {
            return false;
        }

        // Target path MUST strictly start with current user's path + be longer
        return str_starts_with($targetPath, $parentPath) && $targetPath !== $parentPath;
    }

    /**
     * Verify whether a user can access a customer (self-owned or owned by descendant)
     * IDOR protection for all customer CRUD operations.
     */
    public static function canAccessCustomer(int $currentUserId, int $customerId, ?int $tenantId = null): bool {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT customer_id, tenant_id, owner_id, owner_path FROM customers WHERE customer_id = :cid LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt->closeCursor();

        if (!$customer) {
            return false;
        }

        if ($tenantId !== null && (int)$customer['tenant_id'] !== (int)$tenantId) {
            return false;
        }

        $currentUser = self::getUser($currentUserId);
        if (!$currentUser) {
            return false;
        }

        // ISP Admin / SaaS Admin has access to all customers in tenant
        if (self::getHierarchyLevel($currentUser['role']) === 0 || $currentUser['role'] === 'saas_admin') {
            return true;
        }

        $ownerId = (int)($customer['owner_id'] ?? 0);
        if ($ownerId === $currentUserId) {
            return true;
        }

        $ownerPath = (string)($customer['owner_path'] ?? '');
        $userPath = (string)($currentUser['hierarchy_path'] ?? '');

        if (!empty($ownerPath) && !empty($userPath)) {
            return str_starts_with($ownerPath, $userPath);
        }

        // Fallback: check if ownerId is descendant
        if ($ownerId > 0) {
            return self::canAccessUser($currentUserId, $ownerId);
        }

        return false;
    }

    /**
     * Enforce downward-only scope SQL snippet for customer queries
     * Injects strictly parameterized WHERE clause:
     * WHERE tenant_id = :tenant_id AND (owner_id = :current_user_id OR owner_path LIKE :user_path_wildcard)
     */
    public static function enforceDownwardScope(
        int $currentUserId,
        ?int $tenantId,
        string $ownerIdCol = 'c.owner_id',
        string $ownerPathCol = 'c.owner_path'
    ): array {
        $currentUser = self::getUser($currentUserId);
        $role = $currentUser['role'] ?? '';
        $isLevel0 = self::getHierarchyLevel($role) === 0 || $role === 'saas_admin';

        $where = [];
        $params = [];

        if ($tenantId !== null) {
            $where[] = "c.tenant_id = :scope_tenant_id";
            $params['scope_tenant_id'] = $tenantId;
        }

        // If not Level 0 ISP admin, restrict strictly to self + descendants
        if (!$isLevel0) {
            $userPath = $currentUser['hierarchy_path'] ?? "/{$currentUserId}/";
            $where[] = "({$ownerIdCol} = :scope_uid OR {$ownerPathCol} LIKE :scope_path_wildcard)";
            $params['scope_uid'] = $currentUserId;
            $params['scope_path_wildcard'] = rtrim($userPath, '/') . '/%';
        }

        return [
            'whereSql' => implode(' AND ', $where),
            'params' => $params,
        ];
    }

    /**
     * Compute new child hierarchy path based on parent path and new user ID
     */
    public static function buildChildHierarchyPath(int $parentUserId, int $newUserId): string {
        $parent = self::getUser($parentUserId);
        $parentPath = $parent['hierarchy_path'] ?? "/{$parentUserId}/";
        return rtrim($parentPath, '/') . "/{$newUserId}/";
    }

    /**
     * Check if user has specific granular action permission
     */
    public static function hasPermission(int $userId, string $permissionCode): bool {
        $user = self::getUser($userId);
        if (!$user) {
            return false;
        }

        // Level 0 has full authority
        if (self::getHierarchyLevel($user['role']) === 0 || $user['role'] === 'saas_admin') {
            return true;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT up.granted 
            FROM user_permissions up
            JOIN permissions p ON p.permission_id = up.permission_id
            WHERE up.user_id = :uid AND p.permission_code = :pcode
            LIMIT 1");
        $stmt->execute(['uid' => $userId, 'pcode' => $permissionCode]);
        $val = $stmt->fetchColumn();
        $stmt->closeCursor();

        if ($val !== false) {
            return (bool)$val;
        }

        // Default role permissions if not explicitly stored
        $role = strtolower($user['role'] ?? '');
        $defaults = [
            self::ROLE_RESELLER => [
                'can_create_customer', 'can_edit_customer', 'can_view_invoice', 
                'can_recharge', 'can_manage_sub_tier', 'can_assign_package', 'can_transfer_balance'
            ],
            self::ROLE_SUB_RESELLER => [
                'can_create_customer', 'can_edit_customer', 'can_view_invoice', 
                'can_recharge', 'can_manage_sub_tier', 'can_assign_package', 'can_transfer_balance'
            ],
            self::ROLE_DEALER => [
                'can_create_customer', 'can_edit_customer', 'can_view_invoice', 
                'can_recharge', 'can_manage_sub_tier', 'can_assign_package', 'can_transfer_balance'
            ],
            self::ROLE_AGENT => [
                'can_create_customer', 'can_view_invoice', 'can_recharge'
            ],
        ];

        return in_array($permissionCode, $defaults[$role] ?? [], true);
    }

    /**
     * Require permission or fail with HTTP 403 Forbidden
     */
    public static function requirePermission(int $userId, string $permissionCode): void {
        if (!self::hasPermission($userId, $permissionCode)) {
            Response::error("Forbidden: You do not have the required permission '{$permissionCode}'", 403);
            exit;
        }
    }

    /**
     * Get all direct and indirect downline users for a user
     */
    public static function getDownlineUsers(int $currentUserId, ?int $tenantId = null): array {
        $currentUser = self::getUser($currentUserId);
        if (!$currentUser) {
            return [];
        }

        $db = Database::getConnection();
        $isLevel0 = self::getHierarchyLevel($currentUser['role']) === 0 || $currentUser['role'] === 'saas_admin';

        $where = ["u.user_id != :cuid"];
        $params = ['cuid' => $currentUserId];

        if ($tenantId !== null) {
            $where[] = "u.tenant_id = :tid";
            $params['tid'] = $tenantId;
        }

        if (!$isLevel0) {
            $userPath = $currentUser['hierarchy_path'] ?? "/{$currentUserId}/";
            $where[] = "u.hierarchy_path LIKE :path_like";
            $params['path_like'] = rtrim($userPath, '/') . '/%';
        } else {
            $where[] = "u.role IN ('reseller', 'sub_reseller', 'dealer', 'agent')";
        }

        $whereSql = implode(' AND ', $where);

        $stmt = $db->prepare("SELECT 
            u.user_id,
            u.tenant_id,
            u.username,
            u.email,
            u.first_name,
            u.last_name,
            u.phone,
            u.role,
            u.role_level,
            u.parent_id,
            u.hierarchy_path,
            u.status,
            COALESCE(w.balance, 0.00) as wallet_balance,
            (SELECT COUNT(*) FROM customers c WHERE c.owner_id = u.user_id) as direct_customers_count,
            (SELECT COUNT(*) FROM users sub WHERE sub.parent_id = u.user_id) as direct_downlines_count
            FROM users u
            LEFT JOIN wallets w ON w.user_id = u.user_id
            WHERE {$whereSql}
            ORDER BY u.role_level DESC, u.user_id ASC");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $stmt->closeCursor();

        return $rows ?: [];
    }

    /**
     * Build nested recursive tree structure for downline visualization
     */
    public static function getDownlineTree(int $rootUserId, ?int $tenantId = null): array {
        $downlines = self::getDownlineUsers($rootUserId, $tenantId);
        $rootUser = self::getUser($rootUserId);
        if (!$rootUser) {
            return [];
        }

        // Add wallet balance to root user
        $db = Database::getConnection();
        $balStmt = $db->prepare("SELECT balance FROM wallets WHERE user_id = :uid LIMIT 1");
        $balStmt->execute(['uid' => $rootUserId]);
        $rootUser['wallet_balance'] = (float)($balStmt->fetchColumn() ?: 0.00);
        $balStmt->closeCursor();

        // Index children by parent_id
        $childrenByParent = [];
        foreach ($downlines as $node) {
            $pid = (int)($node['parent_id'] ?? 0);
            $childrenByParent[$pid][] = $node;
        }

        $buildSubtree = function(array $node) use (&$buildSubtree, &$childrenByParent): array {
            $uid = (int)$node['user_id'];
            $children = $childrenByParent[$uid] ?? [];
            $node['children'] = array_map($buildSubtree, $children);
            return $node;
        };

        $rootNode = [
            'user_id' => $rootUser['user_id'],
            'username' => $rootUser['username'],
            'first_name' => $rootUser['first_name'],
            'last_name' => $rootUser['last_name'],
            'phone' => $rootUser['phone'],
            'role' => $rootUser['role'],
            'role_level' => $rootUser['role_level'],
            'hierarchy_path' => $rootUser['hierarchy_path'],
            'wallet_balance' => (float)$rootUser['wallet_balance'],
            'parent_id' => $rootUser['parent_id'],
            'status' => $rootUser['status'],
        ];

        return $buildSubtree($rootNode);
    }
}

