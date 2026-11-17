<?php
/**
 * NetFix ISP SaaS - Users Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class UsersController {
    public static function index(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        require_once __DIR__ . '/../lib/HierarchySecurityService.php';
        $callerRole = strtolower($user['role'] ?? '');
        $callerLevel = HierarchySecurityService::getHierarchyLevel($callerRole);
        $callerId = (int)$user['user_id'];
        $isLevel0 = ($callerLevel === 0 || $callerRole === 'saas_admin');

        $where = ["status = 'active'"];
        $params = [];

        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            if ($tenantId === null) {
                Response::json(['success' => true, 'data' => []]);
                return;
            }
            $where[] = "tenant_id = :tid";
            $params['tid'] = $tenantId;
        }

        // Downward Hierarchy Guard: Non-admins cannot see upstream or horizontal users
        if (!$isLevel0) {
            $callerPath = $user['hierarchy_path'] ?? null;
            if (empty($callerPath) || $callerPath === '/') {
                $hUser = HierarchySecurityService::getUser($callerId);
                $callerPath = $hUser['hierarchy_path'] ?? "/{$callerId}/";
            }
            $callerPathWildcard = rtrim($callerPath, '/') . '/%';

            $where[] = "(user_id = :caller_id OR hierarchy_path LIKE :caller_path_wildcard OR parent_id = :caller_pid)";
            $params['caller_id'] = $callerId;
            $params['caller_path_wildcard'] = $callerPathWildcard;
            $params['caller_pid'] = $callerId;
        }

        $whereSql = implode(' AND ', $where);
        $stmt = $db->prepare("SELECT user_id, first_name, last_name, username, email, phone, role, status 
            FROM users 
            WHERE {$whereSql}
            ORDER BY first_name ASC");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            return [
                'userId' => (string)$r['user_id'],
                'name' => trim($r['first_name'] . ' ' . $r['last_name']) ?: $r['username'],
                'username' => $r['username'],
                'email' => $r['email'],
                'phone' => $r['phone'],
                'role' => $r['role'],
                'status' => $r['status'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public static function receivedByOptions(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        require_once __DIR__ . '/../lib/HierarchySecurityService.php';
        $callerRole = strtolower($user['role'] ?? '');
        $callerLevel = HierarchySecurityService::getHierarchyLevel($callerRole);
        $callerId = (int)$user['user_id'];
        $isLevel0 = ($callerLevel === 0 || $callerRole === 'saas_admin');

        $where = ["u.status = 'active'"];
        $params = [];

        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            if ($tenantId === null) {
                Response::json(['success' => true, 'data' => []]);
                return;
            }
            $where[] = "u.tenant_id = :tid";
            $params['tid'] = $tenantId;
        }

        // STRICT RULE: No upstream users!
        // Downline callers can only view/select themselves and users strictly under them
        if (!$isLevel0) {
            $callerPath = $user['hierarchy_path'] ?? null;
            if (empty($callerPath) || $callerPath === '/') {
                $hUser = HierarchySecurityService::getUser($callerId);
                $callerPath = $hUser['hierarchy_path'] ?? "/{$callerId}/";
            }
            $callerPathWildcard = rtrim($callerPath, '/') . '/%';

            $where[] = "(u.user_id = :caller_id OR u.hierarchy_path LIKE :caller_path_wildcard OR u.parent_id = :caller_pid)";
            $params['caller_id'] = $callerId;
            $params['caller_path_wildcard'] = $callerPathWildcard;
            $params['caller_pid'] = $callerId;
        }

        $params['caller_sort_id'] = $callerId;
        $whereSql = implode(' AND ', $where);
        $stmt = $db->prepare("SELECT u.user_id, u.first_name, u.last_name, u.username, u.role, u.role_level 
            FROM users u
            WHERE {$whereSql}
            ORDER BY (u.user_id = :caller_sort_id) DESC, u.role_level ASC, u.first_name ASC");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $options = array_map(function($r) {
            return [
                'userId' => (string)$r['user_id'],
                'fullName' => trim($r['first_name'] . ' ' . $r['last_name']) ?: $r['username'],
                'username' => $r['username'],
                'roleCode' => $r['role'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $options,
        ]);
    }
}

