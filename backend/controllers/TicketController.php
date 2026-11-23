<?php
/**
 * NetFix ISP SaaS - Support & Ticket Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';

class TicketController {
    public static function index(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        require_once __DIR__ . '/../lib/HierarchySecurityService.php';

        $status = $_GET['status'] ?? 'all';
        $priority = $_GET['priority'] ?? 'all';
        $search = trim($_GET['search'] ?? '');

        $where = ["ct.tenant_id = :tid"];
        $params = ['tid' => $tenantId];

        // Hierarchy Enforcement: Resellers only see tickets from their own customers
        $userRole = $user['role'] ?? ($user['role_code'] ?? 'isp_admin');
        $hierarchyLevel = HierarchySecurityService::getHierarchyLevel($userRole);
        if ($hierarchyLevel > 0) {
            $callerUid = (int)$user['user_id'];
            $where[] = "(c.owner_id = :owner_uid OR c.owner_path LIKE :owner_path)";
            $params['owner_uid'] = $callerUid;
            $params['owner_path'] = '%/' . $callerUid . '/%';
        }

        if ($status !== 'all' && !empty($status)) {
            $where[] = "ct.status = :status";
            $params['status'] = $status;
        }

        if ($priority !== 'all' && !empty($priority)) {
            $where[] = "ct.priority = :priority";
            $params['priority'] = $priority;
        }

        if (!empty($search)) {
            $s = '%' . $search . '%';
            $where[] = "(ct.title LIKE :s OR ct.description LIKE :s OR c.full_name LIKE :s OR c.customer_code LIKE :s OR c.phone LIKE :s)";
            $params['s'] = $s;
        }

        $whereSql = implode(' AND ', $where);

        // Fetch metrics
        $mStmt = $db->prepare("SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN ct.status = 'open' THEN 1 ELSE 0 END) as open_count,
            SUM(CASE WHEN ct.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
            SUM(CASE WHEN ct.status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
            SUM(CASE WHEN ct.status = 'closed' THEN 1 ELSE 0 END) as closed_count
            FROM customer_tickets ct
            JOIN customers c ON c.customer_id = ct.customer_id
            WHERE {$whereSql}");
        $mStmt->execute($params);
        $metrics = $mStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        // Fetch tickets
        $stmt = $db->prepare("SELECT 
            ct.ticket_id,
            ct.tenant_id,
            ct.customer_id,
            ct.title,
            ct.description,
            ct.status,
            ct.priority,
            ct.assigned_to,
            ct.created_at,
            ct.updated_at,
            c.customer_code,
            c.full_name as customer_name,
            c.phone as customer_phone,
            c.installation_address,
            c.owner_id,
            reseller.username as reseller_username,
            reseller.first_name as reseller_first_name,
            reseller.last_name as reseller_last_name,
            u.username as assigned_username,
            u.first_name as assigned_first_name,
            u.last_name as assigned_last_name
            FROM customer_tickets ct
            JOIN customers c ON c.customer_id = ct.customer_id
            LEFT JOIN users reseller ON reseller.user_id = c.owner_id
            LEFT JOIN users u ON u.user_id = ct.assigned_to
            WHERE {$whereSql}
            ORDER BY ct.ticket_id DESC
            LIMIT 200");
        $stmt->execute($params);
        $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Enhance ticket objects with formatted reseller name
        $formattedTickets = array_map(function($t) {
            $rName = trim(($t['reseller_first_name'] ?? '') . ' ' . ($t['reseller_last_name'] ?? ''));
            $t['reseller_name'] = !empty($rName) ? $rName : ($t['reseller_username'] ?? null);
            return $t;
        }, $tickets);

        Response::json([
            'success' => true,
            'tickets' => $formattedTickets,
            'metrics' => [
                'total' => (int)($metrics['total'] ?? 0),
                'open' => (int)($metrics['open_count'] ?? 0),
                'inProgress' => (int)($metrics['in_progress_count'] ?? 0),
                'resolved' => (int)($metrics['resolved_count'] ?? 0),
                'closed' => (int)($metrics['closed_count'] ?? 0),
            ],
        ]);
    }

    public static function create(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $customerId = $data['customer_id'] ?? null;
        $title = trim($data['title'] ?? '');
        $description = trim($data['description'] ?? '');
        $priority = in_array($data['priority'] ?? '', ['low', 'medium', 'high', 'critical'], true) ? $data['priority'] : 'medium';
        $assignedTo = !empty($data['assigned_to']) ? (int)$data['assigned_to'] : null;

        if (!$customerId || empty($title)) {
            Response::error('Customer ID and Title are required', 400);
            return;
        }

        $db = Database::getConnection();

        // Auto-routing: If no technician is explicitly chosen, auto-route to the customer's owner/reseller
        if (!$assignedTo && $customerId) {
            $stmtC = $db->prepare("SELECT owner_id, created_by FROM customers WHERE customer_id = :cid LIMIT 1");
            $stmtC->execute(['cid' => $customerId]);
            $cRow = $stmtC->fetch(PDO::FETCH_ASSOC);
            if ($cRow) {
                $assignedTo = !empty($cRow['owner_id']) ? (int)$cRow['owner_id'] : (!empty($cRow['created_by']) ? (int)$cRow['created_by'] : null);
            }
        }

        $stmt = $db->prepare("INSERT INTO customer_tickets 
            (tenant_id, customer_id, title, description, status, priority, assigned_to, created_at)
            VALUES (:tid, :cid, :title, :desc, 'open', :priority, :assigned_to, NOW())");
        $stmt->execute([
            'tid' => $tenantId,
            'cid' => $customerId,
            'title' => $title,
            'desc' => $description,
            'priority' => $priority,
            'assigned_to' => $assignedTo,
        ]);

        $ticketId = $db->lastInsertId();

        Response::json([
            'success' => true,
            'message' => 'Support ticket created successfully',
            'ticket_id' => $ticketId,
        ], 201);
    }

    public static function updateStatus(string $ticketId): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $status = $data['status'] ?? null;
        $assignedTo = isset($data['assigned_to']) ? (int)$data['assigned_to'] : null;

        if (!$status && $assignedTo === null) {
            Response::error('Status or assigned_to is required', 400);
            return;
        }

        $db = Database::getConnection();

        $updates = [];
        $params = ['tid' => $tenantId, 'ticket_id' => $ticketId];

        if ($status) {
            $updates[] = "status = :status";
            $params['status'] = $status;
        }
        if ($assignedTo !== null) {
            $updates[] = "assigned_to = :assigned_to";
            $params['assigned_to'] = $assignedTo > 0 ? $assignedTo : null;
        }

        $sql = "UPDATE customer_tickets SET " . implode(', ', $updates) . " WHERE ticket_id = :ticket_id AND tenant_id = :tid";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        Response::json([
            'success' => true,
            'message' => 'Ticket updated successfully',
        ]);
    }

    public static function getSupportNumbers(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT setting_value FROM tenant_settings WHERE tenant_id = :tid AND setting_key = 'support_directory' LIMIT 1");
        $stmt->execute(['tid' => $tenantId]);
        $val = $stmt->fetchColumn();

        $tStmt = $db->prepare("SELECT tenant_name, business_phone, support_phone FROM tenants WHERE tenant_id = :tid LIMIT 1");
        $tStmt->execute(['tid' => $tenantId]);
        $t = $tStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $defaultDirectory = [
            ['title' => '24/7 Helpline', 'number' => $t['support_phone'] ?: ($t['business_phone'] ?: '+880 1700-000000'), 'category' => 'helpline', 'hours' => '24 Hours / 7 Days'],
            ['title' => 'Fiber NOC / Technical Desk', 'number' => '+880 1800-000001', 'category' => 'technical', 'hours' => '9:00 AM - 11:00 PM'],
            ['title' => 'Billing & Accounts Support', 'number' => '+880 1900-000002', 'category' => 'billing', 'hours' => '10:00 AM - 7:00 PM'],
            ['title' => 'WhatsApp Support Hotline', 'number' => '+880 1700-000003', 'category' => 'whatsapp', 'hours' => 'Instant Support'],
        ];

        $directory = $val ? json_decode($val, true) : $defaultDirectory;

        Response::json([
            'success' => true,
            'supportPhone' => $t['support_phone'] ?? '',
            'directory' => $directory,
        ]);
    }

    public static function saveSupportNumbers(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $directory = $data['directory'] ?? [];
        $supportPhone = trim($data['supportPhone'] ?? '');

        $db = Database::getConnection();

        // 1. Update tenants table support_phone if provided
        if (!empty($supportPhone)) {
            $stmtT = $db->prepare("UPDATE tenants SET support_phone = :phone WHERE tenant_id = :tid");
            $stmtT->execute(['phone' => $supportPhone, 'tid' => $tenantId]);
        }

        // 2. Save directory to tenant_settings
        $stmt = $db->prepare("INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
                              VALUES (:tid, 'support_directory', :val)
                              ON DUPLICATE KEY UPDATE setting_value = :val2");
        $json = json_encode($directory);
        $stmt->execute(['tid' => $tenantId, 'val' => $json, 'val2' => $json]);

        Response::json([
            'success' => true,
            'message' => 'Support directory updated successfully',
        ]);
    }
}
