<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';

class TicketController {
    public static function index(string $tenantId): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT t.*, s.customer_code, s.name as subscriber_name, s.mobile, s.address, u.name as assigned_to_name 
                               FROM tickets t 
                               JOIN subscribers s ON t.subscriber_id = s.id 
                               LEFT JOIN users u ON t.assigned_to_id = u.id 
                               WHERE t.tenant_id = :tenant_id 
                               ORDER BY t.created_at DESC");
        $stmt->execute(['tenant_id' => $tenantId]);
        $tickets = $stmt->fetchAll();

        Response::json(['success' => true, 'tickets' => $tickets]);
    }

    public static function create(string $tenantId): void {
        $data = json_decode(file_get_contents('php://input'), true);
        $subscriberId = trim($data['subscriberId'] ?? $data['subscriber_id'] ?? '');
        $subject = trim($data['subject'] ?? '');
        $description = trim($data['description'] ?? '');
        $category = $data['category'] ?? 'FIBER_CUT';
        $priority = $data['priority'] ?? 'MEDIUM';
        $assignedToId = $data['assignedToId'] ?? $data['assigned_to_id'] ?? null;

        if (empty($subscriberId) || empty($subject)) {
            Response::error('Subscriber ID and Subject are required', 400);
        }

        $db = Database::getConnection();
        $id = 'tkt-' . uniqid();
        $ticketNo = 'TKT-' . rand(100000, 999999);

        $stmt = $db->prepare("INSERT INTO tickets (id, tenant_id, ticket_no, subscriber_id, category, subject, description, priority, status, assigned_to_id)
                              VALUES (:id, :tenant_id, :ticket_no, :subscriber_id, :category, :subject, :description, :priority, 'OPEN', :assigned_to_id)");
        $stmt->execute([
            'id' => $id,
            'tenant_id' => $tenantId,
            'ticket_no' => $ticketNo,
            'subscriber_id' => $subscriberId,
            'category' => $category,
            'subject' => $subject,
            'description' => $description,
            'priority' => $priority,
            'assigned_to_id' => $assignedToId,
        ]);

        Response::json([
            'success' => true,
            'message' => 'Support ticket created successfully',
            'ticketId' => $id,
            'ticketNo' => $ticketNo,
        ], 201);
    }

    public static function updateStatus(string $tenantId, string $id): void {
        $data = json_decode(file_get_contents('php://input'), true);
        $status = $data['status'] ?? 'IN_PROGRESS';
        $notes = $data['resolutionNotes'] ?? '';
        $now = date('Y-m-d H:i:s');

        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE tickets SET status = :status, resolution_notes = :notes, 
                               resolved_at = CASE WHEN :status IN ('RESOLVED', 'CLOSED') THEN :now ELSE resolved_at END 
                               WHERE id = :id AND tenant_id = :tenant_id");
        $stmt->execute([
            'status' => $status, 
            'notes' => $notes, 
            'now' => $now, 
            'id' => $id, 
            'tenant_id' => $tenantId
        ]);

        Response::json(['success' => true, 'message' => "Ticket marked as {$status}"]);
    }
}
