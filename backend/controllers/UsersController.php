<?php
/**
 * NetFix ISP SaaS - Users Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class UsersController {
    public static function receivedByOptions(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT user_id, first_name, last_name, role 
            FROM users 
            WHERE tenant_id = :tid AND status = 'active'
            ORDER BY first_name ASC");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        $options = array_map(function($r) {
            return [
                'userId' => (string)$r['user_id'],
                'fullName' => trim($r['first_name'] . ' ' . $r['last_name']),
                'roleCode' => $r['role'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $options,
        ]);
    }
}

