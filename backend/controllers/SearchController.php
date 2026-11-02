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

        // SaaS Admin / Super Admin can search globally across all tenants
        $isGlobalAdmin = in_array($user['role'] ?? '', ['saas_admin', 'super_admin']) || ($user['role_level'] ?? 0) >= 1000;

        $where = [];
        $params = [];

        if (!$isGlobalAdmin) {
            $where[] = "c.tenant_id = :tid";
            $params['tid'] = $tenantId;
        }

        // Fast B-tree index path: if query is exact numeric ID (e.g. 100001) or phone
        if (is_numeric($q)) {
            $where[] = "(c.customer_code = :exact_code OR c.phone = :exact_phone OR c.phone LIKE :prefix)";
            $params['exact_code'] = $q;
            $params['exact_phone'] = $q;
            $params['prefix'] = "%{$q}%";
        } else {
            $where[] = "(c.full_name LIKE :s OR c.phone LIKE :s OR c.customer_code = :s_exact OR na.username LIKE :s)";
            $params['s'] = "%{$q}%";
            $params['s_exact'] = $q;
        }

        $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

        $stmt = $db->prepare("SELECT 
            c.customer_id as customerId,
            c.customer_code as customerCode,
            c.full_name as fullName,
            c.phone,
            c.email,
            c.status,
            c.tenant_id as tenantId,
            na.username
            FROM customers c
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            {$whereClause}
            ORDER BY c.customer_id DESC
            LIMIT 15");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'data' => $rows ?: [],
        ]);
    }
}

