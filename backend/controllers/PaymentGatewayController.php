<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/PaymentGatewayService.php';

class PaymentGatewayController {

    private static function resolveTenantId(PDO $db, string $id): int {
        $stmt = $db->prepare("SELECT tenant_id FROM tenants WHERE tenant_id = :id OR tenant_code = :code OR tenant_slug = :slug LIMIT 1");
        $stmt->execute(['id' => $id, 'code' => $id, 'slug' => $id]);
        $tid = $stmt->fetchColumn();
        return $tid ? (int)$tid : (is_numeric($id) ? (int)$id : 0);
    }

    /**
     * Test payment flow from SaaS Admin / Tenant Profile
     * POST /tenants/{id}/payment-gateways/test
     * POST /tenants/{id}/bkash-create-payment
     */
    public static function testPaymentFlow(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $db = Database::getConnection();

        $tenantId = self::resolveTenantId($db, $id);
        if (!$tenantId) {
            Response::error('Tenant not found', 404);
        }

        $gateway = strtolower(trim($data['gateway'] ?? 'bkash'));
        if ($gateway === 'sslcommerz') $gateway = 'ssl';
        $amount = (float)($data['amount'] ?? 10.00);
        if ($amount <= 0) $amount = 10.00;

        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:4001';
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $defaultCallback = $protocol . $host . "/saas/tenants/{$tenantId}/payment-callback";
        $callbackUrl = !empty($data['callbackURL']) ? $data['callbackURL'] : $defaultCallback;

        $res = PaymentGatewayService::initiatePayment(
            $db,
            $tenantId,
            $gateway,
            $amount,
            null, // No specific customer for admin test
            null,
            $callbackUrl,
            ['flow' => 'saas_admin_test', 'user_id' => $user['user_id'] ?? null]
        );

        if (!$res['success']) {
            Response::error($res['message'] ?? 'Failed to initiate test payment', 400);
        }

        Response::json([
            'success' => true,
            'gateway' => $gateway,
            'amount' => $amount,
            'payment_url' => $res['payment_url'],
            'redirectURL' => $res['redirectURL'],
            'bkashURL' => $res['bkashURL'],
            'paymentID' => $res['paymentID'],
            'transaction_ref' => $res['transaction_ref'],
            'intent_id' => $res['intent_id'],
        ]);
    }

    /**
     * Get available active payment methods for customer portal
     * GET /customer/payment-methods
     */
    public static function getCustomerPaymentMethods(): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();
        $tenantId = (int)AuthMiddleware::getTenantId();

        $gateways = PaymentGatewayService::getActiveGateways($db, $tenantId);
        $methods = [];

        // If no gateways saved yet in table, return defaults
        if (empty($gateways)) {
            $methods = [
                [
                    'gateway' => 'bkash',
                    'label' => 'bKash Direct',
                    'description' => 'Instant recharge via bKash mobile wallet or QR code',
                    'isEnabled' => true,
                    'icon' => 'bkash',
                ],
                [
                    'gateway' => 'surjopay',
                    'label' => 'SurjoPay PGW',
                    'description' => 'Fast payment via SurjoPay gateway (Cards & MFS)',
                    'isEnabled' => true,
                    'icon' => 'surjopay',
                ],
                [
                    'gateway' => 'ssl',
                    'label' => 'SSLCommerz',
                    'description' => 'Visa, MasterCard, Amex, Rocket & Internet Banking',
                    'isEnabled' => true,
                    'icon' => 'ssl',
                ],
            ];
        } else {
            foreach ($gateways as $gw) {
                $code = $gw['gateway'];
                $isBkash = ($code === 'bkash');
                $isSurjo = ($code === 'surjopay');
                $isSsl = ($code === 'ssl' || $code === 'sslcommerz');

                $methods[] = [
                    'gateway' => $isSsl ? 'ssl' : $code,
                    'label' => $isBkash ? 'bKash Direct' : ($isSurjo ? 'SurjoPay PGW' : 'SSLCommerz Gateway'),
                    'description' => $isBkash 
                        ? 'Instant recharge via bKash mobile wallet or QR code' 
                        : ($isSurjo 
                            ? 'Cards, MFS & NetBanking checkout via SurjoPay' 
                            : 'Visa, MasterCard, Amex, Rocket & Internet Banking'),
                    'isEnabled' => (bool)$gw['is_active'],
                    'icon' => $code,
                ];
            }
        }

        Response::json($methods);
    }

    /**
     * Customer initiate payment
     * POST /customer/initiate-payment
     */
    public static function customerInitiatePayment(): void {
        $user = AuthMiddleware::requireAuth();
        $customerId = self::getCustomerIdFromUser($user);
        $tenantId = (int)AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $amount = (float)($data['amount'] ?? 0);
        $invoiceId = !empty($data['invoice_id']) ? (int)$data['invoice_id'] : null;
        $gateway = strtolower(trim($data['gateway'] ?? 'bkash'));
        if ($gateway === 'sslcommerz') $gateway = 'ssl';

        if ($amount <= 0) {
            Response::error('Invalid payment amount', 400);
        }

        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:4001';
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $callbackUrl = $protocol . $host . "/customer/payment-callback";

        $db = Database::getConnection();
        $res = PaymentGatewayService::initiatePayment(
            $db,
            $tenantId,
            $gateway,
            $amount,
            $customerId,
            $invoiceId,
            $callbackUrl,
            ['flow' => 'customer_portal_pay', 'user_id' => $user['user_id']]
        );

        if (!$res['success']) {
            Response::error($res['message'] ?? 'Could not initiate payment', 400);
        }

        Response::json([
            'success' => true,
            'payment_url' => $res['payment_url'],
            'redirectURL' => $res['redirectURL'],
            'paymentID' => $res['paymentID'],
            'transaction_ref' => $res['transaction_ref'],
        ]);
    }

    /**
     * Customer initiate renewal payment
     * POST /customer/initiate-renew-payment
     */
    public static function customerInitiateRenewPayment(): void {
        $user = AuthMiddleware::requireAuth();
        $customerId = self::getCustomerIdFromUser($user);
        $tenantId = (int)AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $months = max(1, (int)($data['months'] ?? 1));
        $gateway = strtolower(trim($data['gateway'] ?? 'bkash'));
        if ($gateway === 'sslcommerz') $gateway = 'ssl';

        $db = Database::getConnection();

        // Calculate amount from plan price
        $stmtPlan = $db->prepare("SELECT ap.price, c.billing_status 
            FROM customers c
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            WHERE c.customer_id = :cid LIMIT 1");
        $stmtPlan->execute(['cid' => $customerId]);
        $plan = $stmtPlan->fetch();

        $planPrice = (float)($plan['price'] ?? 500);
        $amount = round($planPrice * $months);

        // Include due invoice balance if any
        $stmtDue = $db->prepare("SELECT SUM(balance_due) as total_due FROM invoices WHERE customer_id = :cid AND status IN ('pending', 'partially_paid', 'overdue')");
        $stmtDue->execute(['cid' => $customerId]);
        $due = (float)($stmtDue->fetchColumn() ?: 0);
        if ($due > 0) {
            $amount += round($due);
        }

        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:4001';
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $callbackUrl = $protocol . $host . "/customer/payment-callback";

        $res = PaymentGatewayService::initiatePayment(
            $db,
            $tenantId,
            $gateway,
            $amount,
            $customerId,
            null,
            $callbackUrl,
            ['flow' => 'customer_portal_renew', 'months' => $months, 'user_id' => $user['user_id']]
        );

        if (!$res['success']) {
            Response::error($res['message'] ?? 'Could not initiate renewal payment', 400);
        }

        Response::json([
            'success' => true,
            'payment_url' => $res['payment_url'],
            'redirectURL' => $res['redirectURL'],
            'paymentID' => $res['paymentID'],
            'transaction_ref' => $res['transaction_ref'],
            'amount' => $amount,
        ]);
    }

    /**
     * Customer confirm payment from callback page
     * POST /customer/confirm-payment
     */
    public static function customerConfirmPayment(): void {
        $user = AuthMiddleware::requireAuth();
        $customerId = self::getCustomerIdFromUser($user);
        $tenantId = (int)AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $paymentId = trim($data['paymentID'] ?? ($data['payment_id'] ?? ''));
        if (empty($paymentId)) {
            Response::error('Payment ID is required', 400);
        }

        $db = Database::getConnection();

        // Find intent
        $stmtIntent = $db->prepare("SELECT * FROM payment_intents 
            WHERE (gateway_payment_id = :gpid OR transaction_ref = :ref OR id = :iid) 
            AND tenant_id = :tid LIMIT 1");
        $stmtIntent->execute([
            'gpid' => $paymentId,
            'ref' => $paymentId,
            'iid' => is_numeric($paymentId) ? (int)$paymentId : 0,
            'tid' => $tenantId,
        ]);
        $intent = $stmtIntent->fetch();

        if (!$intent) {
            // Check if already settled
            $stmtTrx = $db->prepare("SELECT * FROM transactions WHERE transaction_ref = :ref AND tenant_id = :tid LIMIT 1");
            $stmtTrx->execute(['ref' => $paymentId, 'tid' => $tenantId]);
            if ($stmtTrx->fetch()) {
                Response::json(['success' => true, 'message' => 'Payment already verified and settled.']);
                return;
            }
            Response::error('Payment intent not found', 404);
        }

        $gateway = $intent['gateway'];
        $amount = (float)$intent['amount'];
        $cid = $intent['customer_id'] ? (int)$intent['customer_id'] : $customerId;
        $invId = $intent['invoice_id'] ? (int)$intent['invoice_id'] : null;

        $settings = PaymentGatewayService::getGatewaySettings($db, $tenantId, $gateway);
        $trxId = 'TRX-' . strtoupper($gateway) . '-' . substr(uniqid(), -6) . date('His');
        $rawRes = [];

        // Verify with Gateway API if credentials exist
        if ($settings && !empty($settings['app_key'])) {
            if ($gateway === 'bkash') {
                $execRes = PaymentGatewayService::bkashExecutePayment($settings, $paymentId);
                if ($execRes['success']) {
                    $trxId = $execRes['trxID'];
                    $rawRes = $execRes['data'] ?? [];
                }
            } else if ($gateway === 'surjopay') {
                $verRes = PaymentGatewayService::surjopayVerifyOrder($settings, $paymentId);
                if ($verRes['success']) {
                    $trxId = $verRes['trxID'];
                    $rawRes = $verRes['data'] ?? [];
                }
            }
        }

        // Settle payment and unblock on MikroTik
        $settleRes = PaymentGatewayService::processPaymentSuccess(
            $db,
            $tenantId,
            $gateway,
            $paymentId,
            $trxId,
            $amount,
            $cid,
            $invId,
            $rawRes
        );

        if (!$settleRes['success']) {
            Response::error($settleRes['message'], 500);
        }

        Response::json([
            'success' => true,
            'message' => 'Payment confirmed! Internet connection reactivated immediately.',
            'trxID' => $trxId,
            'mikrotik' => $settleRes['mikrotik'] ?? null,
        ]);
    }

    /**
     * Unified Gateway Callback (GET/POST)
     * e.g. /payments/callback/{gateway}
     */
    public static function handleGatewayCallback(string $gateway): void {
        $db = Database::getConnection();
        $gw = strtolower(trim($gateway));
        if ($gw === 'sslcommerz') $gw = 'ssl';

        // Read query parameters & body
        $params = $_GET;
        $postData = $_POST;
        if (empty($postData)) {
            $rawInput = file_get_contents('php://input');
            $json = json_decode($rawInput, true);
            if (is_array($json)) $postData = $json;
        }

        $allData = array_merge($params, $postData);

        $status = strtolower($allData['status'] ?? ($allData['sp_massage'] ?? ''));
        $paymentId = $allData['paymentID'] ?? ($allData['payment_id'] ?? ($allData['order_id'] ?? ($allData['tran_id'] ?? '')));
        $valId = $allData['val_id'] ?? null;
        $trxId = $allData['bank_tran_id'] ?? ($allData['trxID'] ?? ('TRX-' . strtoupper($gw) . '-' . substr(uniqid(), -6)));

        // Locate intent
        $stmtIntent = $db->prepare("SELECT * FROM payment_intents 
            WHERE (gateway_payment_id = :gpid OR transaction_ref = :ref OR id = :iid) 
            ORDER BY id DESC LIMIT 1");
        $stmtIntent->execute([
            'gpid' => $paymentId,
            'ref' => $paymentId,
            'iid' => is_numeric($paymentId) ? (int)$paymentId : 0,
        ]);
        $intent = $stmtIntent->fetch();

        $tenantId = $intent ? (int)$intent['tenant_id'] : 2;
        $customerId = $intent && $intent['customer_id'] ? (int)$intent['customer_id'] : null;
        $invoiceId = $intent && $intent['invoice_id'] ? (int)$intent['invoice_id'] : null;
        $amount = $intent ? (float)$intent['amount'] : (float)($allData['amount'] ?? 0);

        $isSuccess = ($status === 'success' || $status === 'completed' || $status === 'valid' || $status === 'validated' || !empty($valId));

        if ($isSuccess) {
            PaymentGatewayService::processPaymentSuccess(
                $db,
                $tenantId,
                $gw,
                $paymentId,
                $trxId,
                $amount,
                $customerId,
                $invoiceId,
                $allData
            );
        }

        // Redirect appropriately
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:4001';
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';

        $redirectStatus = $isSuccess ? 'success' : 'failed';
        if ($customerId) {
            header("Location: {$protocol}{$host}/customer/payment-callback?status={$redirectStatus}&paymentID={$paymentId}&trx_id={$trxId}");
        } else {
            header("Location: {$protocol}{$host}/saas/tenants/{$tenantId}/payment-callback?status={$redirectStatus}&gateway={$gw}&amount={$amount}&trx_id={$trxId}");
        }
        exit;
    }

    /**
     * Simulator Confirmation API
     * POST /payments/simulator/confirm
     */
    public static function simulatorConfirm(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $tenantId = (int)($data['tenant_id'] ?? 2);
        $gateway = strtolower($data['gateway'] ?? 'bkash');
        $paymentId = $data['paymentID'] ?? ('SIM-' . strtoupper($gateway) . '-' . rand(10000, 99999));
        $trxId = 'TRX-' . strtoupper($gateway) . '-' . strtoupper(substr(uniqid(), -6)) . date('His');
        $amount = (float)($data['amount'] ?? 10);
        $intentId = !empty($data['intent_id']) ? (int)$data['intent_id'] : null;

        $db = Database::getConnection();

        $intent = null;
        if ($intentId) {
            $stmtI = $db->prepare("SELECT * FROM payment_intents WHERE id = :id LIMIT 1");
            $stmtI->execute(['id' => $intentId]);
            $intent = $stmtI->fetch();
        }

        $customerId = $intent && $intent['customer_id'] ? (int)$intent['customer_id'] : (!empty($data['customer_id']) ? (int)$data['customer_id'] : null);
        $invoiceId = $intent && $intent['invoice_id'] ? (int)$intent['invoice_id'] : null;

        $res = PaymentGatewayService::processPaymentSuccess(
            $db,
            $tenantId,
            $gateway,
            $paymentId,
            $trxId,
            $amount,
            $customerId,
            $invoiceId,
            ['simulation' => true, 'timestamp' => date('Y-m-d H:i:s')]
        );

        Response::json([
            'success' => true,
            'message' => 'Simulated sandbox payment completed and settled.',
            'trxID' => $trxId,
            'paymentID' => $paymentId,
            'mikrotik' => $res['mikrotik'] ?? null,
        ]);
    }

    private static function getCustomerIdFromUser(array $user): int {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT customer_id FROM customers WHERE login_user_id = :uid LIMIT 1");
        $stmt->execute(['uid' => $user['user_id']]);
        $cid = $stmt->fetchColumn();
        if ($cid) return (int)$cid;

        // Try customer_network_accounts
        $stmt = $db->prepare("SELECT customer_id FROM customer_network_accounts WHERE username = :un LIMIT 1");
        $stmt->execute(['un' => $user['username']]);
        $cid = $stmt->fetchColumn();
        return $cid ? (int)$cid : 3;
    }
}
