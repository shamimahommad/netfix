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

        $whereSql = implode(' AND ', $where);
        $stmt = $db->prepare("SELECT user_id, first_name, last_name, username, role 
            FROM users 
            WHERE {$whereSql}
            ORDER BY first_name ASC");
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

