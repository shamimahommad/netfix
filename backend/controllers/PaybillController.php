<?php
/**
 * NetFix ISP SaaS - Standard MFS Pay Bill Engine (bKash, Nagad, Rocket, Upay)
 * 
 * Provides standard Biller Solution API endpoints:
 * 1. Bill Inquiry API:  GET/POST /api/paybill/inquiry
 * 2. Bill Payment API:  POST     /api/paybill/payment
 * 
 * Supports both explicit tenant scoping (via ?isp=TENANT_CODE or header X-Biller-Code)
 * and global auto-scoping across multi-tenant pure numeric customer sequences.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/MikrotikSyncService.php';
require_once __DIR__ . '/../lib/PaymentSplitService.php';

class PaybillController {

    /**
     * Resolve Tenant from request params, headers, or customer code
     */
    private static function resolveTenant(PDO $db, array $data, string $accountNo = ''): ?array {
        $ispIdentifier = trim(
            $data['isp'] ?? 
            ($data['isp_id'] ?? 
            ($data['tenant_code'] ?? 
            ($data['biller_id'] ?? 
            ($_GET['isp'] ?? 
            ($_GET['isp_id'] ?? 
            ($_SERVER['HTTP_X_BILLER_CODE'] ?? ''))))))
        );

        if (!empty($ispIdentifier)) {
            $stmt = $db->prepare("SELECT * FROM tenants WHERE tenant_code = :code OR tenant_id = :tid OR tenant_slug = :slug LIMIT 1");
            $stmt->execute([
                'code' => $ispIdentifier,
                'tid' => is_numeric($ispIdentifier) ? (int)$ispIdentifier : 0,
                'slug' => $ispIdentifier,
            ]);
            $tenant = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($tenant) {
                return $tenant;
            }
        }

        // Fallback: If customer account number is provided, deduce tenant from customer ownership
        if (!empty($accountNo)) {
            $stmt = $db->prepare("SELECT t.* FROM customers c 
                JOIN tenants t ON t.tenant_id = c.tenant_id 
                LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
                WHERE (c.customer_code = :q1 OR c.customer_id = :q2 OR c.phone = :q3 OR na.username = :q4)
                LIMIT 1");
            $stmt->execute([
                'q1' => $accountNo,
                'q2' => is_numeric($accountNo) ? (int)$accountNo : 0,
                'q3' => $accountNo,
                'q4' => $accountNo,
            ]);
            $tenant = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($tenant) {
                return $tenant;
            }
        }

        return null;
    }

    /**
     * Standard MFS Bill Inquiry API
     * GET/POST /api/paybill/inquiry
     * 
     * Called by bKash, Nagad, Rocket, Upay when customer enters their ID in MFS App.
     */
    public static function inquiry(): void {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true) ?: [];
        if (empty($data)) {
            $data = $_REQUEST;
        }

        $accountNo = trim(
            $data['bill_account_number'] ?? 
            ($data['customer_id'] ?? 
            ($data['customer_code'] ?? 
            ($data['account_no'] ?? 
            ($data['account_number'] ?? 
            ($data['username'] ?? 
            ($data['phone'] ?? 
            ($data['q'] ?? 
            ($_GET['q'] ?? ''))))))))
        );

        if ($accountNo === '') {
            http_response_code(400);
            echo json_encode([
                'status' => '1001',
                'message' => 'Bill account number / Customer ID is required',
            ]);
            return;
        }

        $db = Database::getConnection();
        $tenant = self::resolveTenant($db, $data, $accountNo);

        $params = [
            'q1' => $accountNo,
            'q2' => is_numeric($accountNo) ? (int)$accountNo : 0,
            'q3' => $accountNo,
            'q4' => $accountNo,
        ];

        $tenantClause = "";
        if ($tenant) {
            $tenantClause = "AND c.tenant_id = :tid";
            $params['tid'] = (int)$tenant['tenant_id'];
        }

        $sql = "SELECT c.*, t.tenant_name, t.tenant_code,
                       cs.customer_service_id, cs.expires_at, cs.status AS service_status,
                       ap.profile_name, ap.price,
                       na.username AS pppoe_username
                FROM customers c
                JOIN tenants t ON t.tenant_id = c.tenant_id
                LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id AND cs.status != 'cancelled'
                LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
                LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
                WHERE (c.customer_code = :q1 OR c.customer_id = :q2 OR c.phone = :q3 OR na.username = :q4)
                {$tenantClause}
                LIMIT 1";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $cust = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$cust) {
            http_response_code(404);
            echo json_encode([
                'status' => '2001',
                'message' => 'Customer account not found for account number: ' . $accountNo,
                'bill_account_number' => $accountNo,
            ]);
            return;
        }

        $cid = (int)$cust['customer_id'];
        $tid = (int)$cust['tenant_id'];

        // Query pending invoice due or package price
        $stmtDue = $db->prepare("SELECT COALESCE(SUM(balance_due), 0) FROM invoices 
            WHERE customer_id = :cid AND tenant_id = :tid AND status IN ('pending', 'partially_paid')");
        $stmtDue->execute(['cid' => $cid, 'tid' => $tid]);
        $dueAmount = (float)$stmtDue->fetchColumn();

        $monthlyBill = (float)($cust['price'] ?? 500.00);
        $payableAmount = $dueAmount > 0 ? $dueAmount : $monthlyBill;

        // Current & Projected Expiry
        $currentExpires = $cust['expires_at'];
        $baseTime = $currentExpires ? strtotime($currentExpires) : time();
        if ($baseTime < time()) {
            $baseTime = time();
        }
        $newExpires = date('Y-m-d H:i:s', strtotime('+30 days', $baseTime));

        http_response_code(200);
        echo json_encode([
            'status' => '0000',
            'message' => 'Bill inquiry successful',
            'biller_id' => $cust['tenant_code'],
            'tenant_name' => $cust['tenant_name'],
            'bill_account_number' => $cust['customer_code'] ?: (string)$cust['customer_id'],
            'customer_id' => (string)$cust['customer_id'],
            'customer_code' => (string)$cust['customer_code'],
            'customer_name' => $cust['full_name'],
            'username' => $cust['pppoe_username'] ?: $cust['customer_code'],
            'phone' => $cust['phone'],
            'package_name' => $cust['profile_name'] ?: 'Broadband Internet',
            'bill_amount' => $monthlyBill,
            'due_amount' => $dueAmount,
            'total_payable' => $payableAmount,
            'bill_month' => date('F Y'),
            'due_date' => date('Y-m-t'),
            'current_expiry' => $currentExpires,
            'new_expiry' => $newExpires,
            'billing_status' => $cust['billing_status'],
            'account_status' => $cust['status'],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    /**
     * Standard MFS Bill Payment API
     * POST /api/paybill/payment
     * 
     * Called by bKash, Nagad, Rocket, Upay upon customer PIN confirmation.
     */
    public static function payment(): void {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true) ?: [];
        if (empty($data)) {
            $data = $_REQUEST;
        }

        $accountNo = trim(
            $data['bill_account_number'] ?? 
            ($data['customer_id'] ?? 
            ($data['customer_code'] ?? 
            ($data['account_no'] ?? 
            ($data['account_number'] ?? 
            ($data['username'] ?? '')))))
        );

        $amount = (float)($data['amount'] ?? 0);
        $trxId = trim($data['trx_id'] ?? ($data['transaction_id'] ?? ($data['trxID'] ?? ($data['payment_id'] ?? ''))));
        $gateway = strtolower(trim($data['gateway'] ?? ($data['provider'] ?? 'paybill')));
        if ($gateway === 'paybill' || empty($gateway)) {
            $gateway = 'paybill';
        }

        if (empty($accountNo) || $amount <= 0) {
            http_response_code(400);
            echo json_encode([
                'status' => '1002',
                'message' => 'Invalid payment parameters. Account number and positive amount are required.',
            ]);
            return;
        }

        $finalTrxId = !empty($trxId) ? $trxId : ('TRX-PB-' . strtoupper(bin2hex(random_bytes(5))));
        $db = Database::getConnection();

        // 1. Idempotency Check: Don't double charge if already settled
        $stmtCheck = $db->prepare("SELECT * FROM transactions WHERE transaction_ref = :ref LIMIT 1");
        $stmtCheck->execute(['ref' => $finalTrxId]);
        $existingTx = $stmtCheck->fetch(PDO::FETCH_ASSOC);
        if ($existingTx) {
            http_response_code(200);
            echo json_encode([
                'status' => '0000',
                'message' => 'Payment already verified and credited previously.',
                'trx_id' => $finalTrxId,
                'amount' => (float)$existingTx['amount'],
            ]);
            return;
        }

        // 2. Resolve Tenant & Customer
        $tenant = self::resolveTenant($db, $data, $accountNo);
        $tenantClause = $tenant ? "AND c.tenant_id = :tid" : "";
        $params = [
            'q1' => $accountNo,
            'q2' => is_numeric($accountNo) ? (int)$accountNo : 0,
            'q3' => $accountNo,
            'q4' => $accountNo,
        ];
        if ($tenant) {
            $params['tid'] = (int)$tenant['tenant_id'];
        }

        $stmtCust = $db->prepare("SELECT c.*, t.tenant_name, t.tenant_code,
            cs.customer_service_id, cs.expires_at, cs.access_profile_id,
            na.username AS pppoe_username
            FROM customers c
            JOIN tenants t ON t.tenant_id = c.tenant_id
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id AND cs.status != 'cancelled'
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            WHERE (c.customer_code = :q1 OR c.customer_id = :q2 OR c.phone = :q3 OR na.username = :q4)
            {$tenantClause}
            LIMIT 1");
        $stmtCust->execute($params);
        $cust = $stmtCust->fetch(PDO::FETCH_ASSOC);

        if (!$cust) {
            http_response_code(404);
            echo json_encode([
                'status' => '2001',
                'message' => 'Customer account not found for payment settlement',
            ]);
            return;
        }

        $customerId = (int)$cust['customer_id'];
        $tenantId = (int)$cust['tenant_id'];

        // 3. Find pending invoice or create invoice record
        $stmtInv = $db->prepare("SELECT invoice_id FROM invoices 
            WHERE customer_id = :cid AND tenant_id = :tid AND status IN ('pending', 'partially_paid') 
            ORDER BY invoice_id ASC LIMIT 1");
        $stmtInv->execute(['cid' => $customerId, 'tid' => $tenantId]);
        $invId = (int)$stmtInv->fetchColumn();

        $isNested = $db->inTransaction();
        if (!$isNested) {
            $db->beginTransaction();
        }
        try {
            // Settle invoice if exists
            if ($invId > 0) {
                $db->prepare("UPDATE invoices SET status = 'paid', paid_amount = :amt, balance_due = 0.00, payment_method = :pm, paid_at = NOW(), updated_at = NOW() WHERE invoice_id = :id")
                   ->execute(['amt' => $amount, 'pm' => $gateway, 'id' => $invId]);
            }

            // Extend customer subscription by 30 days
            $db->prepare("UPDATE customer_services 
                SET expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, NOW()), NOW()), INTERVAL 30 DAY),
                    status = 'active',
                    updated_at = NOW()
                WHERE customer_id = :cid AND tenant_id = :tid")
               ->execute(['cid' => $customerId, 'tid' => $tenantId]);

            // Reactivate customer status
            $db->prepare("UPDATE customers 
                SET status = 'active', billing_status = 'Paid', updated_at = NOW() 
                WHERE customer_id = :cid AND tenant_id = :tid")
               ->execute(['cid' => $customerId, 'tid' => $tenantId]);

            // Insert into transactions (Classified as Online Gateway Collection)
            $db->prepare("INSERT INTO transactions 
                (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, description, metadata)
                VALUES (:tid, :cid, :ref, 'GATEWAY_PAYMENT', :amt, :method, 0, 'paybill', :desc, :meta)")
               ->execute([
                   'tid' => $tenantId,
                   'cid' => $customerId,
                   'ref' => $finalTrxId,
                   'amt' => $amount,
                   'method' => $gateway,
                   'desc' => strtoupper($gateway) . " MFS Paybill Payment (Ref: {$finalTrxId})",
                   'meta' => json_encode($data),
               ]);

            // Execute Multi-Tier Split if invoice exists
            if ($invId > 0) {
                try {
                    $splitService = new PaymentSplitService($db);
                    $splitService->processCustomerPayment($invId, $amount, $gateway, ['trx_id' => $finalTrxId]);
                } catch (\Throwable $se) {
                    error_log("Paybill Split Service Note: " . $se->getMessage());
                }
            }

            if (!$isNested) {
                $db->commit();
            }
        } catch (\Throwable $e) {
            if (!$isNested && $db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode([
                'status' => '5001',
                'message' => 'Payment transaction failed: ' . $e->getMessage(),
            ]);
            return;
        }

        // 4. Instant MikroTik router unblock / reactivation
        $mtMsg = 'Reconnected';
        try {
            $mtRes = MikrotikSyncService::renewCustomer($db, $customerId);
            if (!empty($mtRes['message'])) {
                $mtMsg = $mtRes['message'];
            }
        } catch (\Throwable $me) {
            $mtMsg = 'Mikrotik sync queued: ' . $me->getMessage();
        }

        // Fetch updated expiry date
        $stmtExp = $db->prepare("SELECT expires_at FROM customer_services WHERE customer_id = :cid ORDER BY customer_service_id DESC LIMIT 1");
        $stmtExp->execute(['cid' => $customerId]);
        $newExpires = $stmtExp->fetchColumn();

        http_response_code(200);
        echo json_encode([
            'status' => '0000',
            'message' => 'Payment accepted and internet subscription renewed successfully',
            'biller_id' => $cust['tenant_code'],
            'customer_id' => (string)$cust['customer_code'],
            'customer_name' => $cust['full_name'],
            'trx_id' => $finalTrxId,
            'amount' => $amount,
            'new_expiry' => $newExpires,
            'mikrotik' => $mtMsg,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
}
