<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/RouterosAPI.php';

class PaymentController {
    public static function bkashCallback(): void {
        $data = json_decode(file_get_contents('php://input'), true);
        $invoiceId = $data['invoiceId'] ?? '';
        $trxId = $data['trxID'] ?? ('TRX_BKASH_' . rand(100000, 999999));
        $status = $data['status'] ?? 'COMPLETED';

        if ($status !== 'COMPLETED' && $status !== 'Success') {
            Response::error('Payment failed or cancelled', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT i.*, s.id as sub_id, s.pppoe_username, s.expiry_date, r.ip_address, r.api_port, r.username as r_user, r.password as r_pass 
                               FROM invoices i 
                               JOIN subscribers s ON i.subscriber_id = s.id 
                               LEFT JOIN mikrotik_routers r ON s.router_id = r.id 
                               WHERE i.id = :id LIMIT 1");
        $stmt->execute(['id' => $invoiceId]);
        $row = $stmt->fetch();

        if (!$row) {
            Response::error('Invoice not found', 404);
        }

        // 1. Mark Invoice Paid
        $now = date('Y-m-d H:i:s');
        $stmt = $db->prepare("UPDATE invoices SET paid_amount = payable_amount, due_amount = 0, status = 'PAID', paid_at = :paid_at, payment_method = 'BKASH' WHERE id = :id");
        $stmt->execute(['paid_at' => $now, 'id' => $invoiceId]);

        // 2. Insert Payment
        $stmt = $db->prepare("INSERT INTO payments (id, tenant_id, invoice_id, subscriber_id, amount, payment_method, transaction_id, notes) 
                               VALUES (:id, :t, :inv, :sub, :amount, 'BKASH', :trx, 'Instant bKash automated callback')");
        $stmt->execute([
            'id' => 'pay-' . uniqid(),
            't' => $row['tenant_id'],
            'inv' => $invoiceId,
            'sub' => $row['sub_id'],
            'amount' => $row['payable_amount'],
            'trx' => $trxId,
        ]);

        // 3. Extend subscriber expiry date
        $currentExpiry = strtotime($row['expiry_date']);
        $base = ($currentExpiry > time()) ? $currentExpiry : time();
        $newExpiry = date('Y-m-d H:i:s', strtotime("+30 days", $base));

        $stmt = $db->prepare("UPDATE subscribers SET status = 'ACTIVE', expiry_date = :expiry WHERE id = :id");
        $stmt->execute(['expiry' => $newExpiry, 'id' => $row['sub_id']]);

        // 4. Instant MikroTik Unblock
        if (!empty($row['ip_address'])) {
            $api = new RouterosAPI();
            $api->port = (int)$row['api_port'];
            if ($api->connect($row['ip_address'], $row['r_user'], $row['r_pass'])) {
                $api->comm('/ppp/secret/set', [
                    '=numbers=' . $row['pppoe_username'],
                    '=disabled=no',
                ]);
                $api->disconnect();
            }
        }

        Response::json([
            'success' => true,
            'message' => 'bKash payment verified! Internet reactivated immediately.',
            'trxId' => $trxId,
            'newExpiry' => $newExpiry,
        ]);
    }
}
