<?php
/**
 * NetFix ISP SaaS - Search Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class SearchController {
    public static function customers(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $q = trim($_GET['q'] ?? $_GET['query'] ?? '');

        if (strlen($q) < 2) {
            Response::json(['success' => true, 'data' => []]);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT 
            c.customer_id as customerId,
            c.customer_code as customerCode,
            c.full_name as fullName,
            c.phone,
            c.email,
            c.status,
            na.username
            FROM customers c
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            WHERE c.tenant_id = :tid 
            AND (c.full_name LIKE :s OR c.phone LIKE :s OR c.customer_code LIKE :s OR na.username LIKE :s)
            LIMIT 15");
        $stmt->execute(['tid' => $tenantId, 's' => "%{$q}%"]);
        $rows = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'data' => $rows ?: [],
        ]);
    }
}

