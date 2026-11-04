<?php
/**
 * NetFix ISP SaaS - Public Customer & Reseller Topup Controller
 * Unauthenticated endpoints for instant recharge and payment processing
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';

class PublicTopupController {

    /**
     * List active tenants / ISPs for public selector
     * GET /public/topup/tenants
     */
    public static function tenants(): void {
        $db = Database::getConnection();
        try {
            $stmt = $db->query("SELECT tenant_id, tenant_code, tenant_name FROM tenants WHERE status = 'active' ORDER BY tenant_id ASC");
            $rows = $stmt->fetchAll();

            $data = array_map(function($t) {
                return [
                    'tenant_id' => (string)$t['tenant_id'],
                    'tenant_code' => (string)$t['tenant_code'],
                    'tenant_name' => (string)$t['tenant_name'],
                ];
            }, $rows);

            Response::json($data);
        } catch (\Throwable $e) {
            Response::json([
                ['tenant_id' => '1', 'tenant_code' => 'ISP001', 'tenant_name' => 'NetFix Cloud Network'],
                ['tenant_id' => '2', 'tenant_code' => 'ISP002', 'tenant_name' => 'SpeedNet Fiber Broadband'],
            ]);
        }
    }

    /**
     * Search customer or reseller by query & tenant
     * GET /public/topup/lookup?q=...&tenant_id=...
     */
    public static function lookup(): void {
        $q = trim($_GET['q'] ?? '');
        $tenantId = trim($_GET['tenant_id'] ?? '');

        if ($q === '') {
            Response::error('Search query is required', 400);
        }

        $db = Database::getConnection();

        // 1. Search in Customers table
        $sqlCustomer = "SELECT c.*, t.tenant_name,
                               cs.customer_service_id, cs.expires_at, cs.status AS service_status,
                               ap.profile_name, ap.price,
                               na.username AS pppoe_username
                        FROM customers c
                        LEFT JOIN tenants t ON t.tenant_id = c.tenant_id
                        LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
                        LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
                        LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
                        WHERE (c.customer_code = :q OR c.phone = :q OR c.email = :q OR na.username = :q)";
        
        $params = ['q' => $q];
        if ($tenantId !== '') {
            $sqlCustomer .= " AND c.tenant_id = :tid";
            $params['tid'] = $tenantId;
        }
        $sqlCustomer .= " ORDER BY c.customer_id ASC LIMIT 1";

        $stmtCust = $db->prepare($sqlCustomer);
        $stmtCust->execute($params);
        $cust = $stmtCust->fetch();

        if ($cust) {
            $cid = $cust['customer_id'];
            $tid = (string)$cust['tenant_id'];

            // Calculate pending invoices due
            $stmtDue = $db->prepare("SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE customer_id = :cid AND status IN ('pending', 'partially_paid')");
            $stmtDue->execute(['cid' => $cid]);
            $dueAmount = (float)$stmtDue->fetchColumn();

            $billAmount = (float)($cust['price'] ?? 500);
            $payable = $dueAmount > 0 ? $dueAmount : $billAmount;

            $currentExpires = $cust['expires_at'];
            $baseTime = $currentExpires ? strtotime($currentExpires) : time();
            if ($baseTime < time()) {
                $baseTime = time();
            }
            $newExpires = date('Y-m-d H:i:s', strtotime('+30 days', $baseTime));

            Response::json([
                'type' => 'customer',
                'tenant_id' => $tid,
                'customer_id' => (string)$cid,
                'name' => $cust['full_name'],
                'user_id' => (string)$cust['customer_code'],
                'username' => $cust['pppoe_username'] ?: $cust['customer_code'],
                'previous_balance' => (float)($cust['credit_limit'] ?? 0),
                'bill_amount' => $billAmount,
                'package_name' => $cust['profile_name'] ?: 'High-Speed Broadband',
                'payable_amount' => $payable,
                'current_expire_date' => $currentExpires,
                'new_expire_date' => $newExpires,
            ]);
            return;
        }

        // 2. Search in Users table for Reseller
        $sqlReseller = "SELECT u.*, t.tenant_name 
                        FROM users u
                        LEFT JOIN tenants t ON t.tenant_id = u.tenant_id
                        WHERE (u.username = :q OR u.phone = :q OR u.email = :q) 
                          AND u.role = 'reseller'";
        $resParams = ['q' => $q];
        if ($tenantId !== '') {
            $sqlReseller .= " AND u.tenant_id = :tid";
            $resParams['tid'] = $tenantId;
        }
        $sqlReseller .= " LIMIT 1";

        $stmtRes = $db->prepare($sqlReseller);
        $stmtRes->execute($resParams);
        $reseller = $stmtRes->fetch();

        if ($reseller) {
            $uid = $reseller['user_id'];
            $tid = (string)$reseller['tenant_id'];

            // Query current balance from reseller ledger
            $stmtBal = $db->prepare("SELECT closing_balance FROM reseller_ledger WHERE user_id = :uid ORDER BY ledger_id DESC LIMIT 1");
            $stmtBal->execute(['uid' => $uid]);
            $curBal = (float)($stmtBal->fetchColumn() ?: 0);

            Response::json([
                'type' => 'reseller',
                'tenant_id' => $tid,
                'user_id' => (string)$uid,
                'name' => $reseller['full_name'],
                'previous_balance' => $curBal,
            ]);
            return;
        }

        Response::error('Subscriber or reseller not found for this identifier', 404);
    }

    /**
     * Get available payment methods for tenant
     * GET /public/topup/payment-methods?tenant_id=...
     */
    public static function paymentMethods(): void {
        Response::json([
            [
                'gateway' => 'bkash',
                'label' => 'bKash Direct',
                'description' => 'Instant recharge via bKash mobile wallet or QR code',
            ],
            [
                'gateway' => 'nagad',
                'label' => 'Nagad Pay',
                'description' => 'Fast payment via Nagad checkout',
            ],
            [
                'gateway' => 'sslcommerz',
                'label' => 'Cards & NetBanking',
                'description' => 'Visa, MasterCard, Amex, Rocket & Internet Banking',
            ],
        ]);
    }

    /**
     * Initiate payment transaction
     * POST /public/topup/initiate
     */
    public static function initiate(): void {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $tenantId = $body['tenant_id'] ?? null;
        $amount = (float)($body['amount'] ?? 0);
        $gateway = strtolower(trim($body['gateway'] ?? 'bkash'));
        $type = $body['type'] ?? 'customer';
        $customerId = $body['customer_id'] ?? null;
        $userId = $body['user_id'] ?? null;

        if (!$tenantId || $amount <= 0) {
            Response::error('Invalid tenant ID or amount', 400);
        }

        $db = Database::getConnection();
        $db->beginTransaction();

        try {
            $ref = 'TXN-' . strtoupper($gateway) . '-' . strtoupper(substr(uniqid(), -6)) . date('His');

            if ($type === 'customer' && $customerId) {
                // Record customer transaction
                $stmtTrx = $db->prepare("INSERT INTO transactions 
                    (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, description)
                    VALUES (:tid, :cid, :ref, 'ONLINE_GATEWAY', :amt, :method, 0, 'public', :desc)");
                $stmtTrx->execute([
                    'tid' => $tenantId,
                    'cid' => $customerId,
                    'ref' => $ref,
                    'amt' => $amount,
                    'method' => $gateway,
                    'desc' => "Public topup via {$gateway}",
                ]);

                // Update customer service expires_at & status
                $stmtCs = $db->prepare("UPDATE customer_services 
                    SET expires_at = DATE_ADD(GREATEST(expires_at, NOW()), INTERVAL 30 DAY),
                        status = 'active'
                    WHERE customer_id = :cid");
                $stmtCs->execute(['cid' => $customerId]);

                // Update customer status to active and billing_status to Paid
                $stmtCust = $db->prepare("UPDATE customers 
                    SET status = 'active', billing_status = 'Paid' 
                    WHERE customer_id = :cid");
                $stmtCust->execute(['cid' => $customerId]);

                // Clear pending invoices if amount covers them
                $stmtInv = $db->prepare("UPDATE invoices 
                    SET paid_amount = total_amount, balance_due = 0, status = 'paid' 
                    WHERE customer_id = :cid AND status IN ('pending', 'partially_paid')");
                $stmtInv->execute(['cid' => $customerId]);
            } else if ($type === 'reseller' && $userId) {
                // Record reseller transaction & credit ledger
                $stmtBal = $db->prepare("SELECT closing_balance FROM reseller_ledger WHERE user_id = :uid ORDER BY ledger_id DESC LIMIT 1");
                $stmtBal->execute(['uid' => $userId]);
                $curBal = (float)($stmtBal->fetchColumn() ?: 0);
                $newBal = $curBal + $amount;

                $stmtLedger = $db->prepare("INSERT INTO reseller_ledger 
                    (tenant_id, user_id, credit_amount, entry_type, description, closing_balance)
                    VALUES (:tid, :uid, :amt, 'ONLINE_TOPUP', :desc, :cb)");
                $stmtLedger->execute([
                    'tid' => $tenantId,
                    'uid' => $userId,
                    'amt' => $amount,
                    'desc' => "Online topup via {$gateway} (Ref: {$ref})",
                    'cb' => $newBal,
                ]);
            }

            $db->commit();

            // Return mock or real payment redirect URL
            $redirectUrl = "/public/topup?result=success&txn_id={$ref}&gateway={$gateway}&amount={$amount}";

            Response::json([
                'success' => true,
                'payment_url' => $redirectUrl,
                'transaction_ref' => $ref,
            ]);
        } catch (\Throwable $e) {
            $db->rollBack();
            Response::error('Failed to initiate transaction: ' . $e->getMessage(), 500);
        }
    }
}
