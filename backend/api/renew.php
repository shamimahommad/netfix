<?php
/**
 * NetFix ISP SaaS - Standalone Renew / Topup API Endpoint
 * ROS 6 & ROS 7 Compatible
 * Endpoint: POST /api/renew.php
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/MikrotikService.php';
require_once __DIR__ . '/../lib/TenantSequenceService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$user = AuthMiddleware::requireAuth();
$tenantId = AuthMiddleware::getTenantId();
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: [];

$customerId = $data['customer_id'] ?? null;
if (!$customerId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'customer_id is required']);
    exit;
}

$packageId = $data['package_id'] ?? $data['plan_id'] ?? null;
$months = max(1, (int)($data['billing_cycle_months'] ?? $data['no_of_month'] ?? 1));
$days = isset($data['selected_days']) ? (int)$data['selected_days'] : ($months * 30);

$db = Database::getConnection();
$db->beginTransaction();

try {
    // 1. Fetch package details
    if ($packageId) {
        $stmtPkg = $db->prepare("SELECT * FROM access_profiles WHERE access_profile_id = :pid");
        $stmtPkg->execute(['pid' => $packageId]);
        $package = $stmtPkg->fetch(PDO::FETCH_ASSOC);
    } else {
        $stmtPkg = $db->prepare("SELECT ap.* FROM customer_services cs JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id WHERE cs.customer_id = :cid LIMIT 1");
        $stmtPkg->execute(['cid' => $customerId]);
        $package = $stmtPkg->fetch(PDO::FETCH_ASSOC);
    }

    $profileName = $package['mikrotik_profile_name'] ?? ($package['profile_name'] ?? 'default');
    $price = (float)($data['plan_price'] ?? $package['price'] ?? 500);
    $totalAmount = $price * $months;
    $rateLimit = $package['rate_limit'] ?? '10M/10M';

    // 2. Calculate new expiry date
    $stmtCs = $db->prepare("SELECT * FROM customer_services WHERE customer_id = :cid ORDER BY customer_service_id DESC LIMIT 1");
    $stmtCs->execute(['cid' => $customerId]);
    $currentService = $stmtCs->fetch(PDO::FETCH_ASSOC);

    $baseTime = time();
    if ($currentService && strtotime($currentService['expires_at']) > time()) {
        $baseTime = strtotime($currentService['expires_at']);
    }
    $newExpireTimestamp = strtotime("+{$days} days", $baseTime);
    $newExpireDate = date('Y-m-d H:i:s', $newExpireTimestamp);

    // 3. Update customer service & customer
    if ($currentService) {
        $stmtUpdate = $db->prepare("UPDATE customer_services 
            SET expires_at = :exp, status = 'active', access_profile_id = COALESCE(:pid, access_profile_id), updated_at = NOW() 
            WHERE customer_service_id = :sid");
        $stmtUpdate->execute([
            'exp' => $newExpireDate,
            'pid' => $packageId ?: $currentService['access_profile_id'],
            'sid' => $currentService['customer_service_id'],
        ]);
    }

    $stmtCust = $db->prepare("UPDATE customers SET status = 'active', billing_status = 'Paid', updated_at = NOW() WHERE customer_id = :cid");
    $stmtCust->execute(['cid' => $customerId]);

    // 4. Create paid invoice & record transaction
    $invNumber = TenantSequenceService::generateNextCode($db, (string)$tenantId, 'invoice', 6);
    $stmtInv = $db->prepare("INSERT INTO invoices 
        (tenant_id, customer_id, customer_service_id, invoice_number, invoice_date, due_date, status, subtotal, total_amount, paid_amount, balance_due, base_price, sell_price, collected_by, renew_mode, created_by)
        VALUES (:tid, :cid, :sid, :inv_num, CURDATE(), CURDATE(), 'paid', :sub, :tot, :paid, 0.00, :base, :sell, :coll, 'RENEW', :uid)");
    $stmtInv->execute([
        'tid' => $tenantId,
        'cid' => $customerId,
        'sid' => $currentService['customer_service_id'] ?? null,
        'inv_num' => $invNumber,
        'sub' => $totalAmount,
        'tot' => $totalAmount,
        'paid' => $totalAmount,
        'base' => $totalAmount,
        'sell' => $totalAmount,
        'coll' => $user['user_id'],
        'uid' => $user['user_id'],
    ]);

    $trxRef = 'TRX-RENEW-' . strtoupper(bin2hex(random_bytes(4)));
    $stmtTrx = $db->prepare("INSERT INTO transactions 
        (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, collector_user_id, description)
        VALUES (:tid, :cid, :ref, 'RENEW_DEBIT', :amt, 'system', :uid, :role, :coll, 'Customer subscription renewal')");
    $stmtTrx->execute([
        'tid' => $tenantId,
        'cid' => $customerId,
        'ref' => $trxRef,
        'amt' => $totalAmount,
        'uid' => $user['user_id'],
        'role' => $user['role'],
        'coll' => $user['user_id'],
    ]);

    $db->commit();

    // 5. Query assigned router credentials & sync secret to MikroTik
    $stmtRouter = $db->prepare("
        SELECT nd.*, na.username as pppoe_username, na.password as pppoe_password, c.full_name, c.customer_code
        FROM customers c
        LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
        LEFT JOIN network_devices nd ON nd.network_device_id = na.network_device_id
        WHERE c.customer_id = :cid LIMIT 1
    ");
    $stmtRouter->execute(['cid' => $customerId]);
    $routerData = $stmtRouter->fetch(PDO::FETCH_ASSOC);

    $mtMessage = '';
    if ($routerData && !empty($routerData['management_ip']) && !empty($routerData['pppoe_username'])) {
        try {
            $mikrotik = new MikrotikService();
            $routerConfig = [
                'management_ip'   => $routerData['management_ip'],
                'management_port' => $routerData['management_port'] ?: 8728,
                'api_username'    => $routerData['api_username'],
                'api_password'    => $routerData['api_password'],
            ];

            $userData = [
                'username'     => $routerData['pppoe_username'],
                'password'     => $routerData['pppoe_password'] ?: '123456',
                'profile_name' => $profileName,
                'rate_limit'   => $rateLimit,
                'service'      => 'pppoe',
                'comment'      => "{$routerData['full_name']} | {$routerData['customer_code']}",
            ];

            $syncRes = $mikrotik->syncSecret($routerConfig, $userData);
            $mtMessage = ' • ' . $syncRes['message'];

            // Also update customer_network_accounts status in DB
            $db->prepare("UPDATE customer_network_accounts SET status = 'active', updated_at = NOW() WHERE customer_id = :cid")
               ->execute(['cid' => $customerId]);
        } catch (\Throwable $mtErr) {
            $mtMessage = ' • Notice: ' . $mtErr->getMessage();
            error_log("Mikrotik renew sync failed: " . $mtErr->getMessage());
        }
    }

    echo json_encode([
        'success'   => true,
        'message'   => 'Renewed and secret synchronized' . $mtMessage,
        'expire_at' => $newExpireDate,
        'data'      => [
            'customer_id'     => $customerId,
            'expire_at'       => $newExpireDate,
            'new_expire_date' => $newExpireDate,
            'total_amount'    => $totalAmount,
            'profile'         => $profileName,
        ],
    ]);
} catch (\Throwable $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to renew: ' . $e->getMessage()]);
}

