<?php
/**
 * NetFix ISP SaaS - Public Customer & Reseller Topup Controller
 * Unauthenticated endpoints for instant recharge and payment processing
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/PaymentGatewayService.php';
require_once __DIR__ . '/PaymentGatewayController.php';

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
                'tenant_name' => $cust['tenant_name'] ?: 'Broadband Network',
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
                'name' => trim(($reseller['first_name'] ?? '') . ' ' . ($reseller['last_name'] ?? '')) ?: ($reseller['username'] ?? 'Reseller'),
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
        $tenantId = isset($_GET['tenant_id']) ? (int)$_GET['tenant_id'] : 2;
        $db = Database::getConnection();

        $activeGws = PaymentGatewayService::getActiveGateways($db, $tenantId);
        if (empty($activeGws)) {
            Response::json([
                [
                    'gateway' => 'bkash',
                    'label' => 'bKash Direct',
                    'description' => 'Instant recharge via bKash mobile wallet or QR code',
                ],
                [
                    'gateway' => 'surjopay',
                    'label' => 'SurjoPay PGW',
                    'description' => 'Fast payment via SurjoPay gateway (Cards & MFS)',
                ],
                [
                    'gateway' => 'sslcommerz',
                    'label' => 'Cards & NetBanking',
                    'description' => 'Visa, MasterCard, Amex, Rocket & Internet Banking',
                ],
            ]);
            return;
        }

        $list = [];
        foreach ($activeGws as $gw) {
            $code = $gw['gateway'];
            $isBkash = ($code === 'bkash');
            $isSurjo = ($code === 'surjopay');
            $isSsl = ($code === 'ssl' || $code === 'sslcommerz');

            $list[] = [
                'gateway' => $isSsl ? 'sslcommerz' : $code,
                'label' => $isBkash ? 'bKash Direct' : ($isSurjo ? 'SurjoPay PGW' : 'Cards & NetBanking (SSLCommerz)'),
                'description' => $isBkash 
                    ? 'Instant recharge via bKash mobile wallet or QR code' 
                    : ($isSurjo 
                        ? 'Fast checkout via SurjoPay multi-channel' 
                        : 'Visa, MasterCard, Amex, Rocket & Internet Banking'),
            ];
        }

        Response::json($list);
    }

    /**
     * Initiate payment transaction
     * POST /public/topup/initiate
     */
    public static function initiate(): void {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $tenantId = isset($body['tenant_id']) ? (int)$body['tenant_id'] : null;
        $amount = (float)($body['amount'] ?? 0);
        $gateway = strtolower(trim($body['gateway'] ?? 'bkash'));
        if ($gateway === 'sslcommerz') $gateway = 'ssl';

        $type = $body['type'] ?? 'customer';
        $customerId = !empty($body['customer_id']) ? (int)$body['customer_id'] : null;
        $userId = !empty($body['user_id']) ? (int)$body['user_id'] : null;

        if (!$tenantId || $amount <= 0) {
            Response::error('Invalid tenant ID or amount', 400);
        }

        $db = Database::getConnection();

        $callbackUrl = PaymentGatewayController::getFrontendBaseUrl() . "/public/topup";

        $res = PaymentGatewayService::initiatePayment(
            $db,
            $tenantId,
            $gateway,
            $amount,
            $customerId,
            null,
            $callbackUrl,
            ['flow' => 'public_topup', 'type' => $type, 'user_id' => $userId]
        );

        if (!$res['success']) {
            Response::error($res['message'] ?? 'Payment initiation failed', 400);
        }

        Response::json([
            'success' => true,
            'payment_url' => $res['payment_url'],
            'transaction_ref' => $res['transaction_ref'],
        ]);
    }
}

