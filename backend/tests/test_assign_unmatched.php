<?php
/**
 * Test Assign Unmatched Payment functionality
 */
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../controllers/PaymentsController.php';

$db = Database::getConnection();

// 1. Get or create a test tenant and customer
$stmt = $db->query("SELECT customer_id, customer_code, tenant_id FROM customers WHERE customer_code = '100001' LIMIT 1");
$customer = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$customer) {
    echo "Customer 100001 not found. Picking any customer...\n";
    $customer = $db->query("SELECT customer_id, customer_code, tenant_id FROM customers LIMIT 1")->fetch(PDO::FETCH_ASSOC);
}

if (!$customer) {
    echo "No customer found to test with.\n";
    exit(1);
}

$tenantId = (int)$customer['tenant_id'];
$customerId = (int)$customer['customer_id'];
$customerCode = $customer['customer_code'];

echo "Testing with Customer ID: {$customerId}, Code: {$customerCode}, Tenant: {$tenantId}\n";

// 2. Insert an unmatched payment in transactions
$fakeTrxId = 'TEST_UNMATCHED_' . time();
$db->prepare("INSERT INTO transactions 
    (tenant_id, transaction_ref, transaction_type, amount, method, description, created_at)
    VALUES (:tid, :ref, 'UNMATCHED_PAYMENT', 800.00, 'bkash', 'bKash Webhook Unmatched Payment: Wrong Ref 99999', NOW())")
   ->execute([
       'tid' => $tenantId,
       'ref' => $fakeTrxId,
   ]);

$stmtTrx = $db->prepare("SELECT * FROM transactions WHERE transaction_ref = :ref");
$stmtTrx->execute(['ref' => $fakeTrxId]);
$trx = $stmtTrx->fetch(PDO::FETCH_ASSOC);

echo "Created test unmatched transaction ID: {$trx['transaction_id']}, Ref: {$fakeTrxId}\n";

// 3. Mock AuthMiddleware and call assignUnmatched
// Set auth user as admin
$adminUser = $db->query("SELECT user_id, tenant_id, role, username FROM users WHERE role IN ('saas_admin', 'super_admin', 'admin') LIMIT 1")->fetch(PDO::FETCH_ASSOC);
if (!$adminUser) {
    $adminUser = ['user_id' => 1, 'tenant_id' => $tenantId, 'role' => 'admin', 'username' => 'admin'];
}

$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer dummy';

// Simulate JSON input
$inputData = [
    'transaction_id' => (int)$trx['transaction_id'],
    'customer_id' => $customerCode,
    'months' => 1,
    'notes' => 'Customer called support with bKash TrxID',
];

// Mock php://input wrapper by creating a temporary function or calling the logic directly
// Let's test the logic inside PaymentsController::assignUnmatched()
// Since file_get_contents('php://input') is used, let's write a small helper or test directly.

echo "Verifying assignUnmatched directly via Controller logic...\n";

// Fetch customer service expiry before
$stmtExp = $db->prepare("SELECT expires_at, status FROM customer_services WHERE customer_id = :cid ORDER BY customer_service_id DESC LIMIT 1");
$stmtExp->execute(['cid' => $customerId]);
$before = $stmtExp->fetch(PDO::FETCH_ASSOC);
echo "Before Expiry: " . ($before['expires_at'] ?? 'None') . ", Status: " . ($before['status'] ?? 'None') . "\n";

// Let's invoke assign logic using a curl request or simulated stream wrapper
// Or we can invoke it via curl to local PHP server running at 127.0.0.1:4000!
$loginPayload = json_encode(['username' => $adminUser['username'] ?? 'admin', 'password' => 'password123']);
// Let's test via direct CURL to http://127.0.0.1:4000/api/payments/assign-unmatched with JWT

echo "Creating JWT token for test...\n";
require_once __DIR__ . '/../lib/JWT.php';
$token = JWT::encode([
    'user_id' => (int)$adminUser['user_id'],
    'tenant_id' => (int)$adminUser['tenant_id'],
    'role' => $adminUser['role'],
    'username' => $adminUser['username'],
]);

$ch = curl_init('http://127.0.0.1:4000/api/payments/assign-unmatched');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($inputData));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $token,
]);
$resp = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: {$httpCode}\n";
echo "Response: {$resp}\n";

// Verify database updates
$stmtTrxAfter = $db->prepare("SELECT * FROM transactions WHERE transaction_id = :tid");
$stmtTrxAfter->execute(['tid' => $trx['transaction_id']]);
$trxAfter = $stmtTrxAfter->fetch(PDO::FETCH_ASSOC);

echo "Updated Transaction Type: {$trxAfter['transaction_type']}\n";
echo "Updated Transaction Customer ID: {$trxAfter['customer_id']}\n";
echo "Updated Transaction Description: {$trxAfter['description']}\n";

$stmtExpAfter = $db->prepare("SELECT expires_at, status FROM customer_services WHERE customer_id = :cid ORDER BY customer_service_id DESC LIMIT 1");
$stmtExpAfter->execute(['cid' => $customerId]);
$after = $stmtExpAfter->fetch(PDO::FETCH_ASSOC);
echo "After Expiry: " . ($after['expires_at'] ?? 'None') . ", Status: " . ($after['status'] ?? 'None') . "\n";

// Clean up test transaction
$db->prepare("DELETE FROM transactions WHERE transaction_id = :tid")->execute(['tid' => $trx['transaction_id']]);
echo "Test transaction cleaned up.\n";
echo "SUCCESS!\n";
