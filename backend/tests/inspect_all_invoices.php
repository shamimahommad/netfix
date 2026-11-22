<?php
require_once __DIR__ . '/../config/database.php';
$db = Database::getConnection();

$stmt = $db->query("SELECT invoice_id, tenant_id, customer_id, invoice_number, total_amount, paid_amount, status, created_at FROM invoices ORDER BY invoice_id ASC");
while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "ID: {$r['invoice_id']} | Number: {$r['invoice_number']} | Cust: {$r['customer_id']} | Status: {$r['status']} | Date: {$r['created_at']}\n";
}
