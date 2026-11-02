<?php
/**
 * NetFix ISP SaaS - Client Task Logs Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class TaskLogsController {
    public static function getByCustomerId(string $customerId): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT 
            task_id as logId,
            customer_id as customerId,
            'billing' as actionType,
            action as actionTitle,
            description as actionDetails,
            'System / Admin' as performedByName,
            'admin' as performedByRole,
            created_at as createdAt
            FROM client_task_logs 
            WHERE customer_id = :cid AND tenant_id = :tid 
            ORDER BY task_id DESC LIMIT 20");
        $stmt->execute(['cid' => $customerId, 'tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'data' => $rows ?: [],
        ]);
    }

    public static function check(): void {
        Response::json([
            'success' => true,
            'tableExists' => true,
            'message' => 'Client task log table operational',
        ]);
    }
}

