<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';

class BillingController {
    public static function invoices(string $tenantId): void {
        $db = Database::getConnection();
        $status = $_GET['status'] ?? 'ALL';
        $search = trim($_GET['search'] ?? '');

        $sql = "SELECT i.*, s.customer_code, s.name as subscriber_name, s.mobile, s.pppoe_username, p.name as package_name 
                FROM invoices i 
                JOIN subscribers s ON i.subscriber_id = s.id 
                LEFT JOIN packages p ON i.package_id = p.id 
                WHERE i.tenant_id = :tenant_id";
        $params = ['tenant_id' => $tenantId];

        if ($status !== 'ALL') {
            $sql .= " AND i.status = :status";
            $params['status'] = $status;
        }

        if (!empty($search)) {
            $sql .= " AND (i.invoice_no LIKE :search OR s.name LIKE :search OR s.mobile LIKE :search OR s.customer_code LIKE :search)";
            $params['search'] = "%$search%";
        }

        $sql .= " ORDER BY i.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $invoices = $stmt->fetchAll();

        Response::json(['success' => true, 'invoices' => $invoices]);
    }

    public static function collectPayment(string $tenantId, string $invoiceId): void {
        $data = json_decode(file_get_contents('php://input'), true);
        $amount = (float)($data['amount'] ?? 0);
        $method = $data['paymentMethod'] ?? 'CASH';

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT * FROM invoices WHERE id = :id AND tenant_id = :tenant_id LIMIT 1");
        $stmt->execute(['id' => $invoiceId, 'tenant_id' => $tenantId]);
        $inv = $stmt->fetch();

        if (!$inv) {
            Response::error('Invoice not found', 404);
        }

        $payAmount = ($amount > 0) ? $amount : (float)$inv['due_amount'];
        $newPaid = (float)$inv['paid_amount'] + $payAmount;
        $newDue = max(0, (float)$inv['payable_amount'] - $newPaid);
        $newStatus = ($newDue == 0) ? 'PAID' : 'PARTIAL';

        // 1. Update Invoice
        $now = date('Y-m-d H:i:s');
        $stmt = $db->prepare("UPDATE invoices SET paid_amount = :paid, due_amount = :due, status = :status, paid_at = :paid_at, payment_method = :method WHERE id = :id");
        $stmt->execute(['paid' => $newPaid, 'due' => $newDue, 'status' => $newStatus, 'paid_at' => $now, 'method' => $method, 'id' => $invoiceId]);

        // 2. Insert Payment
        $stmt = $db->prepare("INSERT INTO payments (id, tenant_id, invoice_id, subscriber_id, amount, payment_method, notes) 
                               VALUES (:id, :tenant_id, :invoice_id, :subscriber_id, :amount, :method, 'Direct payment collection')");
        $stmt->execute([
            'id' => 'pay-' . uniqid(),
            'tenant_id' => $tenantId,
            'invoice_id' => $invoiceId,
            'subscriber_id' => $inv['subscriber_id'],
            'amount' => $payAmount,
            'method' => $method,
        ]);

        Response::json([
            'success' => true,
            'message' => "Payment of ৳{$payAmount} received successfully",
            'newStatus' => $newStatus,
            'newDue' => $newDue,
        ]);
    }

    public static function generateMonthlyBills(string $tenantId): void {
        $db = Database::getConnection();
        $month = date('Y-m');

        $stmt = $db->prepare("SELECT id, customer_code, package_id, monthly_fee, discount 
                               FROM subscribers 
                               WHERE tenant_id = :tenant_id AND status IN ('ACTIVE', 'EXPIRED')");
        $stmt->execute(['tenant_id' => $tenantId]);
        $subscribers = $stmt->fetchAll();

        $count = 0;
        foreach ($subscribers as $sub) {
            // Check if bill exists
            $chk = $db->prepare("SELECT id FROM invoices WHERE tenant_id = :t AND subscriber_id = :s AND billing_month = :m LIMIT 1");
            $chk->execute(['t' => $tenantId, 's' => $sub['id'], 'm' => $month]);
            if (!$chk->fetch()) {
                $payable = (float)$sub['monthly_fee'] - (float)$sub['discount'];
                $invNo = 'INV-' . date('Ym') . '-' . substr($sub['customer_code'], -4);
                $dueDate = date('Y-m-d H:i:s', strtotime('+10 days'));
                $ins = $db->prepare("INSERT INTO invoices 
                    (id, tenant_id, invoice_no, subscriber_id, package_id, billing_month, amount, discount, payable_amount, paid_amount, due_amount, status, due_date) 
                    VALUES (:id, :tenant_id, :inv_no, :sub_id, :pkg_id, :month, :amount, :discount, :payable, 0, :payable, 'UNPAID', :due_date)");
                
                $ins->execute([
                    'id' => 'inv-' . uniqid(),
                    'tenant_id' => $tenantId,
                    'inv_no' => $invNo,
                    'sub_id' => $sub['id'],
                    'pkg_id' => $sub['package_id'],
                    'month' => $month,
                    'amount' => $sub['monthly_fee'],
                    'discount' => $sub['discount'],
                    'payable' => $payable,
                    'due_date' => $dueDate,
                ]);
                $count++;
            }
        }

        Response::json(['success' => true, 'message' => "Generated {$count} monthly invoices for {$month}"]);
    }
}
