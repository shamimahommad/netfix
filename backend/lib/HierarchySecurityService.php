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
     * IDOR Security Guard: Verify whether a user can view or manage a customer record.
     * Enforces strict downward-inclusive hierarchy isolation:
     * - A user can access their OWN direct customers.
     * - A user can access any DESCENDANT customer belonging to sub-tiers beneath them.
     * - Returns HTTP 403 Forbidden if unauthorized (when $enforceHttp403 = true).
     */
    public static function canViewCustomer(
        int $currentUserId, 
        int $customerId, 
        ?int $tenantId = null, 
        bool $enforceHttp403 = true
    ): bool {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT 
            c.customer_id, 
            c.tenant_id, 
            c.owner_id, 
            c.owner_path, 
            u.hierarchy_path as owner_user_hierarchy_path, 
            u.role as owner_role 
            FROM customers c 
            LEFT JOIN users u ON u.user_id = c.owner_id 
            WHERE c.customer_id = :cid 
            LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt->closeCursor();

        $authorized = false;

        if ($customer) {
            // 1. Cross-tenant isolation check
            $tenantMismatch = ($tenantId !== null && (int)$customer['tenant_id'] !== (int)$tenantId);

            if (!$tenantMismatch) {
                $currentUser = self::getUser($currentUserId);
                if ($currentUser) {
                    $currentUserRole = $currentUser['role'] ?? '';
                    $isLevel0 = (self::getHierarchyLevel($currentUserRole) === 0 || $currentUserRole === 'saas_admin');

                    // 2. Level 0 ISP Admin has authority over all customers within their tenant
                    if ($isLevel0) {
                        $authorized = true;
                    } else {
                        $ownerId = (int)($customer['owner_id'] ?? 0);

                        // 3. Direct Ownership check (user owns this customer directly)
                        if ($ownerId === $currentUserId) {
                            $authorized = true;
                        } else {
                            $rawUserPath = $currentUser['hierarchy_path'] ?? "/{$currentUserId}/";
                            $userPath = '/' . trim($rawUserPath, '/') . '/';

                            $ownerPath = (string)($customer['owner_path'] ?? '');
                            $ownerUserPath = (string)($customer['owner_user_hierarchy_path'] ?? '');

                            // 4. Materialized Path Check: Does customer's owner path start with current user's path?
                            if (!empty($ownerPath) && $ownerPath !== '/') {
                                $normOwnerPath = '/' . trim($ownerPath, '/') . '/';
                                if (str_starts_with($normOwnerPath, $userPath)) {
                                    $authorized = true;
                                }
                            }

                            // 5. Check owner user's hierarchy path
                            if (!$authorized && !empty($ownerUserPath) && $ownerUserPath !== '/') {
                                $normOwnerUserPath = '/' . trim($ownerUserPath, '/') . '/';
                                if (str_starts_with($normOwnerUserPath, $userPath)) {
                                    $authorized = true;
                                }
                            }

                            // 6. Fallback: check if ownerId is a verified descendant user
                            if (!$authorized && $ownerId > 0) {
                                $authorized = self::canAccessUser($currentUserId, $ownerId);
                            }
                        }
                    }
                }
            }
        }

        if (!$authorized) {
            if ($enforceHttp403) {
                Response::error('Access Denied: You do not have permission to view or manage this customer record.', 403);
                exit;
            }
            return false;
        }

        return true;
    }

    /**
     * Backward-compatible boolean check for customer access.
     */
    public static function canAccessCustomer(int $currentUserId, int $customerId, ?int $tenantId = null): bool {
        return self::canViewCustomer($currentUserId, $customerId, $tenantId, false);
    }

    /**
     * Build Downward-Inclusive Hierarchy Scoping SQL Clause
     * Generates strictly parameterized SQL where clause ensuring zero horizontal leakage.
     * Pattern:
     * WHERE c.tenant_id = :scope_tenant_id 
     *   AND (c.owner_id = :scope_uid OR u.hierarchy_path LIKE :scope_path_wildcard OR c.owner_path LIKE :scope_path_wildcard)
     */
    public static function getDownwardScopeClause(
        int $currentUserId,
        ?int $tenantId = null,
        string $customerAlias = 'c',
        ?string $userAlias = 'u'
    ): array {
        $currentUser = self::getUser($currentUserId);
        $role = $currentUser['role'] ?? '';
        $isLevel0 = (self::getHierarchyLevel($role) === 0 || $role === 'saas_admin');

        $where = [];
        $params = [];

        if ($tenantId !== null) {
            $where[] = "{$customerAlias}.tenant_id = :scope_tenant_id";
            $params['scope_tenant_id'] = $tenantId;
        }

        if (!$isLevel0) {
            $rawPath = $currentUser['hierarchy_path'] ?? "/{$currentUserId}/";
            $userPath = '/' . trim($rawPath, '/') . '/';
            $pathWildcard = $userPath . '%';

            $scopeClauses = ["{$customerAlias}.owner_id = :scope_uid"];
            if (!empty($userAlias)) {
                $scopeClauses[] = "{$userAlias}.hierarchy_path LIKE :scope_path_wildcard";
            }
            $scopeClauses[] = "{$customerAlias}.owner_path LIKE :scope_path_wildcard";

            $where[] = '(' . implode(' OR ', $scopeClauses) . ')';
            $params['scope_uid'] = $currentUserId;
            $params['scope_path_wildcard'] = $pathWildcard;
        }

        return [
            'whereSql' => implode(' AND ', $where),
            'params' => $params,
            'user' => $currentUser,
            'isLevel0' => $isLevel0,
        ];
    }

    /**
     * Enforce downward-only scope SQL snippet for customer queries
     */
    public static function enforceDownwardScope(
        int $currentUserId,
        ?int $tenantId,
        string $ownerIdCol = 'c.owner_id',
        string $ownerPathCol = 'c.owner_path'
    ): array {
        $custAlias = explode('.', $ownerIdCol)[0] ?? 'c';
        return self::getDownwardScopeClause($currentUserId, $tenantId, $custAlias, 'u');
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

    /**
     * Resolve the assigned network device (server/router) ID for any user.
     * Enforces strict hierarchy inheritance:
     * - Checks user's direct metadata->network_device_id
     * - If empty, walks upward along hierarchy_path to find ancestor reseller's assigned server
     * - Automatically syncs/heals the resolved server into this user's metadata for performance
     */
    public static function getAssignedServerId(int $userId): ?string {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT user_id, tenant_id, role, parent_id, hierarchy_path, metadata FROM users WHERE user_id = :uid LIMIT 1");
        $stmt->execute(['uid' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt->closeCursor();

        if (!$user) {
            return null;
        }

        // 1. Direct check
        $meta = json_decode($user['metadata'] ?? '{}', true) ?: [];
        $directServerId = $meta['network_device_id'] ?? $meta['serverId'] ?? null;
        if (!empty($directServerId) && (string)$directServerId !== '0' && (string)$directServerId !== 'unassigned') {
            return (string)$directServerId;
        }

        // 2. Upward hierarchy walk (Sub-resellers and Agents inherit from parent Reseller)
        $path = trim($user['hierarchy_path'] ?? '', '/');
        if (!empty($path)) {
            $ancestorIds = array_filter(array_map('intval', explode('/', $path)));
            // Exclude self and sort closest ancestor first (reverse order)
            $ancestorIds = array_values(array_filter($ancestorIds, fn($id) => $id !== (int)$userId));
            $ancestorIds = array_reverse($ancestorIds);

            foreach ($ancestorIds as $aId) {
                $aStmt = $db->prepare("SELECT user_id, role, metadata FROM users WHERE user_id = :uid LIMIT 1");
                $aStmt->execute(['uid' => $aId]);
                $aUser = $aStmt->fetch(PDO::FETCH_ASSOC);
                $aStmt->closeCursor();

                if ($aUser) {
                    $aMeta = json_decode($aUser['metadata'] ?? '{}', true) ?: [];
                    $aServerId = $aMeta['network_device_id'] ?? $aMeta['serverId'] ?? null;
                    if (!empty($aServerId) && (string)$aServerId !== '0' && (string)$aServerId !== 'unassigned') {
                        // Heal child metadata
                        try {
                            $meta['network_device_id'] = (string)$aServerId;
                            $db->prepare("UPDATE users SET metadata = :m WHERE user_id = :uid")
                               ->execute(['m' => json_encode($meta, JSON_UNESCAPED_UNICODE), 'uid' => $userId]);
                        } catch (\Throwable $e) {}

                        return (string)$aServerId;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Resolve full details of the assigned server/router for a user.
     */
    public static function getAssignedServer(int $userId): ?array {
        $serverId = self::getAssignedServerId($userId);
        if (!$serverId) {
            return null;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT network_device_id as id, device_name as name, device_type as type, vendor, status, management_ip 
            FROM network_devices 
            WHERE network_device_id = :did LIMIT 1");
        $stmt->execute(['did' => $serverId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt->closeCursor();

        if (!$row) {
            return null;
        }

        return [
            'id' => (string)$row['id'],
            'name' => $row['name'],
            'type' => $row['type'],
            'vendor' => $row['vendor'],
            'status' => $row['status'],
            'management_ip' => $row['management_ip'],
        ];
    }

    /**
     * Cascade server reassignment to all downstream users (sub-resellers, dealers, agents)
     * when ISP Admin updates a Reseller's server.
     */
    public static function cascadeServerToDescendants(int $parentUserId, ?string $newServerId): int {
        $db = Database::getConnection();
        $parentUser = self::getUser($parentUserId);
        if (!$parentUser) {
            return 0;
        }

        $parentPath = rtrim($parentUser['hierarchy_path'] ?? "/{$parentUserId}/", '/') . '/';
        $stmt = $db->prepare("SELECT user_id, metadata FROM users WHERE hierarchy_path LIKE :p_like AND user_id != :pid");
        $stmt->execute([
            'p_like' => $parentPath . '%',
            'pid' => $parentUserId
        ]);
        $descendants = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $stmt->closeCursor();

        $count = 0;
        $upStmt = $db->prepare("UPDATE users SET metadata = :m WHERE user_id = :uid");
        foreach ($descendants as $d) {
            $dMeta = json_decode($d['metadata'] ?? '{}', true) ?: [];
            $dMeta['network_device_id'] = $newServerId;
            $upStmt->execute([
                'm' => json_encode($dMeta, JSON_UNESCAPED_UNICODE),
                'uid' => $d['user_id']
            ]);
            $count++;
        }

        return $count;
    }
}

