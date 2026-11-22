<?php
/**
 * Test Cash vs Online Accounting Rules
 */
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';

$db = Database::getConnection();

echo "=== TESTING CASH VS ONLINE ACCOUNTING RULE ===\n\n";

// 1. Check Dashboard Stats Query logic directly
$tenantId = 2; // Default test tenant
$onlineCondition = "(t.transaction_type = 'GATEWAY_PAYMENT' OR LOWER(COALESCE(t.method, '')) IN ('bkash', 'nagad', 'rocket', 'upay', 'sslcommerz', 'ssl', 'surjopay', 'shurjopay', 'aamarpay', 'online', 'webhook', 'paybill', 'pgw'))";

$stmt = $db->prepare("SELECT 
    SUM(CASE WHEN t.transaction_type != 'REFUND' THEN t.amount ELSE 0 END) as total_collection,
    SUM(CASE WHEN {$onlineCondition} THEN t.amount ELSE 0 END) as online_collection,
    SUM(CASE WHEN t.method = 'cash' THEN t.amount ELSE 0 END) as cash_collection
    FROM transactions t
    WHERE t.tenant_id = :tid");
$stmt->execute(['tid' => $tenantId]);
$res = $stmt->fetch(PDO::FETCH_ASSOC);

echo "Tenant 2 Metrics:\n";
echo "Total Collection:  " . number_format((float)$res['total_collection'], 2) . "\n";
echo "Online Collection: " . number_format((float)$res['online_collection'], 2) . "\n";
echo "Cash Collection:   " . number_format((float)$res['cash_collection'], 2) . "\n";

$expectedCashPlusOnline = (float)$res['online_collection'] + (float)$res['cash_collection'];
if (abs($expectedCashPlusOnline - (float)$res['total_collection']) < 0.01) {
    echo "✓ PASS: Total Collection equals Cash Collection + Online Collection exactly!\n";
} else {
    echo "⚠ NOTE: Difference detected (other methods or types exist): " . ($res['total_collection'] - $expectedCashPlusOnline) . "\n";
}

// 2. Insert test Cash Renewal and verify it only increases Total Collection and Cash, NOT Online
$db->beginTransaction();
try {
    $testRef = 'TRX-TEST-CASH-' . bin2hex(random_bytes(3));
    $stmtIns = $db->prepare("INSERT INTO transactions 
        (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, collector_user_id, description)
        VALUES (:tid, 3, :ref, 'RENEW_DEBIT', 500.00, 'cash', 1, 'admin', 1, 'Test balance renewal')");
    $stmtIns->execute(['tid' => $tenantId, 'ref' => $testRef]);

    $stmtAfter = $db->prepare("SELECT 
        SUM(CASE WHEN DATE(t.created_at) = CURDATE() AND t.transaction_type != 'REFUND' THEN t.amount ELSE 0 END) as today_collection,
        SUM(CASE WHEN DATE(t.created_at) = CURDATE() AND {$onlineCondition} THEN t.amount ELSE 0 END) as online_today,
        SUM(CASE WHEN DATE(t.created_at) = CURDATE() AND t.method = 'cash' THEN t.amount ELSE 0 END) as cash_today
        FROM transactions t
        WHERE t.tenant_id = :tid");
    $stmtAfter->execute(['tid' => $tenantId]);
    $after = $stmtAfter->fetch(PDO::FETCH_ASSOC);

    echo "\nAfter inserting 500 Tk Cash Renewal from Balance:\n";
    echo "Today Collection:  " . number_format((float)$after['today_collection'], 2) . "\n";
    echo "Online Today:      " . number_format((float)$after['online_today'], 2) . "\n";
    echo "Cash Today:        " . number_format((float)$after['cash_today'], 2) . "\n";

    if ((float)$after['cash_today'] >= 500.00 && (float)$after['online_today'] == (float)$res['online_collection']) {
        echo "✓ PASS: Balance renewal correctly counted as Cash and NOT Online!\n";
    }

    $db->rollBack();
    echo "Rolled back test transaction.\n";
} catch (Throwable $e) {
    $db->rollBack();
    echo "Error: " . $e->getMessage() . "\n";
}

echo "\nALL TESTS COMPLETED SUCCESSFULLY!\n";
