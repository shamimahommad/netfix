<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';

class ResellerController {
    public static function index(string $tenantId): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT r.*, COUNT(s.id) as subscriber_count 
                               FROM resellers r 
                               LEFT JOIN subscribers s ON r.id = s.reseller_id 
                               WHERE r.tenant_id = :tenant_id 
                               GROUP BY r.id 
                               ORDER BY r.name ASC");
        $stmt->execute(['tenant_id' => $tenantId]);
        $resellers = $stmt->fetchAll();

        Response::json(['success' => true, 'resellers' => $resellers]);
    }

    public static function topup(string $tenantId, string $id): void {
        $data = json_decode(file_get_contents('php://input'), true);
        $amount = (float)($data['amount'] ?? 0);

        if ($amount <= 0) {
            Response::error('Valid topup amount required', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE resellers SET balance = balance + :amount WHERE id = :id AND tenant_id = :tenant_id");
        $stmt->execute(['amount' => $amount, 'id' => $id, 'tenant_id' => $tenantId]);

        Response::json(['success' => true, 'message' => "Recharged ৳{$amount} to reseller wallet"]);
    }
}
