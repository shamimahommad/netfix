<?php
require_once __DIR__ . '/../config/database.php';

$db = Database::getConnection();

$c1 = $db->exec("UPDATE transactions SET method = 'cash' WHERE transaction_type = 'RENEW_DEBIT' AND method = 'system'");
$c2 = $db->exec("UPDATE transactions SET transaction_type = 'GATEWAY_PAYMENT' WHERE transaction_type IS NULL OR transaction_type = ''");

echo "Updated {$c1} RENEW_DEBIT rows to method='cash'\n";
echo "Updated {$c2} rows with empty transaction_type to 'GATEWAY_PAYMENT'\n\n";

echo "Current transactions breakdown:\n";
$stmt = $db->query("SELECT transaction_type, method, count(*) as cnt, sum(amount) as total_amt FROM transactions GROUP BY transaction_type, method");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo "Type: " . str_pad($r['transaction_type'] ?? 'NULL', 18) 
       . " | Method: " . str_pad($r['method'] ?? 'NULL', 10) 
       . " | Count: " . str_pad($r['cnt'], 4) 
       . " | Total: " . number_format((float)$r['total_amt'], 2) . "\n";
}
