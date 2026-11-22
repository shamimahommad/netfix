<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../controllers/PaybillController.php';

echo "=== TEST 1: Inquiry with ISP Code and Customer Code ===\n";
$_GET = ['isp' => 'ISP002', 'q' => '100001'];
ob_start();
PaybillController::inquiry();
$out = ob_get_clean();
echo $out . "\n\n";

echo "=== TEST 2: Inquiry without ISP Code (Auto-resolved) ===\n";
$_GET = ['q' => '100001'];
ob_start();
PaybillController::inquiry();
$out = ob_get_clean();
echo $out . "\n\n";

echo "=== TEST 3: Payment Simulation (Rollback) ===\n";
$db = Database::getConnection();
$db->beginTransaction();
try {
    $_REQUEST = [
        'isp' => 'ISP002',
        'bill_account_number' => '100001',
        'amount' => 500,
        'trx_id' => 'BKS-TEST-' . bin2hex(random_bytes(4)),
        'gateway' => 'bkash_paybill',
    ];
    ob_start();
    PaybillController::payment();
    $outPay = ob_get_clean();
    echo $outPay . "\n";
    $db->rollBack();
    echo "Payment test rolled back successfully.\n";
} catch (Throwable $e) {
    $db->rollBack();
    echo "Error: " . $e->getMessage() . "\n";
}
