<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/PaymentGatewayService.php';

class PaymentGatewayController {

    private static function resolveTenantId(PDO $db, string $id): int {
        // Priority 1: Check by tenant_code (ISP unique numeric ID)
        $stmt = $db->prepare("SELECT tenant_id FROM tenants WHERE tenant_code = :code LIMIT 1");
        $stmt->execute(['code' => $id]);
        $tid = $stmt->fetchColumn();
        if ($tid) return (int)$tid;

        // Priority 2: Check by primary key tenant_id or slug
        $stmt = $db->prepare("SELECT tenant_id FROM tenants WHERE tenant_id = :id OR tenant_slug = :slug LIMIT 1");
        $stmt->execute(['id' => is_numeric($id) ? (int)$id : 0, 'slug' => $id]);
        $tid = $stmt->fetchColumn();
        return $tid ? (int)$tid : (is_numeric($id) ? (int)$id : 0);
    }

    /**
     * Resolves the frontend URL (handles localhost port 4000 vs 4001 in dev and matches browser origin)
     */
    public static function getFrontendBaseUrl(): string {
        $allowedOriginsRaw = getenv('CORS_ALLOWED_ORIGINS') ?: ($_ENV['CORS_ALLOWED_ORIGINS'] ?? '');
        $frontendEnv = getenv('FRONTEND_URL') ?: ($_ENV['FRONTEND_URL'] ?? '');

        $allowed = [];
        foreach (array_merge([$frontendEnv], explode(',', $allowedOriginsRaw)) as $item) {
            $item = trim($item);
            if ($item === '') continue;
            $parsed = parse_url($item);
            if (!empty($parsed['scheme']) && !empty($parsed['host'])) {
                $port = !empty($parsed['port']) ? (':' . $parsed['port']) : '';
                $allowed[] = strtolower($parsed['scheme']) . '://' . strtolower($parsed['host']) . $port;
            }
        }
        $allowed = array_values(array_unique($allowed));

        $appEnv = strtolower(getenv('APP_ENV') ?: ($_ENV['APP_ENV'] ?? 'production'));
        if ($appEnv !== 'production' && empty($allowed)) {
            $allowed = ['http://localhost:4001', 'http://127.0.0.1:4001', 'http://localhost:5173'];
        }

        // Priority 1: Check Origin header ONLY if present in allowlist
        $origin = rtrim(trim($_SERVER['HTTP_ORIGIN'] ?? ''), '/');
        if ($origin !== '' && in_array(strtolower($origin), $allowed, true)) {
            return $origin;
        }

        // Priority 2: Check Referer header ONLY if its origin matches allowlist
        $referer = trim($_SERVER['HTTP_REFERER'] ?? '');
        if ($referer !== '') {
            $parsed = parse_url($referer);
            if (!empty($parsed['scheme']) && !empty($parsed['host'])) {
                $port = !empty($parsed['port']) ? (':' . $parsed['port']) : '';
                $refOrigin = strtolower($parsed['scheme']) . '://' . strtolower($parsed['host']) . $port;
                if (in_array($refOrigin, $allowed, true)) {
                    return $parsed['scheme'] . '://' . $parsed['host'] . $port;
                }
            }
        }

        // Priority 3: Configured FRONTEND_URL or first allowlisted origin
        if (!empty($allowed)) {
            return $allowed[0];
        }

        return 'http://localhost:4001';
    }

    /**
     * Server-to-server payment gateway verification. Fails closed unless verified.
     */
    private static function verifyGatewayTransaction(
        PDO $db,
        int $tenantId,
        string $gateway,
        string $paymentId,
        float $expectedAmount,
        array $extraParams = []
    ): array {
        $gw = strtolower(trim($gateway));
        if ($gw === 'sslcommerz') $gw = 'ssl';

        $settings = PaymentGatewayService::getGatewaySettings($db, $tenantId, $gw);
        if (!$settings) {
            return ['success' => false, 'message' => 'Payment gateway is not configured for verification'];
        }

        $res = ['success' => false, 'message' => 'Unsupported or unverified payment gateway'];

        if ($gw === 'bkash') {
            if (empty($settings['app_key'])) {
                return ['success' => false, 'message' => 'bKash credentials are missing'];
            }
            $res = PaymentGatewayService::bkashExecutePayment($settings, $paymentId);
        } elseif ($gw === 'surjopay') {
            $res = PaymentGatewayService::surjopayVerifyOrder($settings, $paymentId);
        } elseif ($gw === 'ssl') {
            $valId = trim((string)($extraParams['val_id'] ?? ($extraParams['valId'] ?? '')));
            if ($valId === '') {
                return ['success' => false, 'message' => 'Missing SSLCommerz validation ID'];
            }
            $res = PaymentGatewayService::sslValidatePayment($settings, $valId, $paymentId, $expectedAmount);
        } else {
            // Other gateways require explicit HMAC webhook signature verification rather than unauthenticated confirmation
            return ['success' => false, 'message' => "Server-side verification is required for {$gw}"];
        }

        if (empty($res['success']) || empty($res['trxID'])) {
            return ['success' => false, 'message' => $res['message'] ?? 'Payment verification failed'];
        }

        $verifiedAmount = isset($res['amount']) ? (float)$res['amount'] : 0.0;
        if ($expectedAmount > 0 && $verifiedAmount > 0 && abs($verifiedAmount - $expectedAmount) > 0.01) {
            return ['success' => false, 'message' => 'Verified payment amount mismatch'];
        }

        return [
            'success' => true,
            'trxID' => (string)$res['trxID'],
            'amount' => $verifiedAmount > 0 ? $verifiedAmount : $expectedAmount,
            'data' => $res['data'] ?? [],
        ];
    }

    /**
     * Test payment flow from SaaS Admin / Tenant Profile
     * POST /tenants/{id}/payment-gateways/test
     * POST /tenants/{id}/bkash-create-payment
     */
    public static function testPaymentFlow(string $id): void {
        try {
            $user = AuthMiddleware::requireAuth();
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            $db = Database::getConnection();

            $tenantId = self::resolveTenantId($db, $id);
            if (!$tenantId) {
                Response::error('Tenant not found', 404);
                return;
            }

            $gateway = strtolower(trim($data['gateway'] ?? 'bkash'));
            if ($gateway === 'sslcommerz') $gateway = 'ssl';
            $amount = (float)($data['amount'] ?? 10.00);
            if ($amount <= 0) $amount = 10.00;

            $defaultCallback = self::getFrontendBaseUrl() . "/saas/tenants/{$tenantId}/payment-callback";
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
                return;
            }

            Response::json([
                'success' => true,
                'gateway' => $gateway,
                'amount' => $amount,
                'payment_url' => $res['payment_url'] ?? ($res['redirectURL'] ?? ($res['bkashURL'] ?? '')),
                'redirectURL' => $res['redirectURL'] ?? ($res['payment_url'] ?? ''),
                'bkashURL' => $res['bkashURL'] ?? ($res['payment_url'] ?? ''),
                'paymentID' => $res['paymentID'] ?? '',
                'transaction_ref' => $res['transaction_ref'] ?? '',
                'intent_id' => $res['intent_id'] ?? '',
            ]);
        } catch (\Throwable $e) {
            error_log('Test payment flow error: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
            Response::error('Payment test failed. Please verify gateway settings.', 400);
        }
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
        if ($customerId <= 0) {
            Response::error('Customer profile not found for this account', 404);
        }
        $tenantId = (int)AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $invoiceId = !empty($data['invoice_id']) ? (int)$data['invoice_id'] : null;
        $gateway = strtolower(trim($data['gateway'] ?? 'bkash'));
        if ($gateway === 'sslcommerz') $gateway = 'ssl';

        $db = Database::getConnection();
        if ($invoiceId) {
            // Strictly verify invoice belongs to authenticated customer & tenant and use server amount
            $stmtInv = $db->prepare("SELECT balance_due, total_amount FROM invoices WHERE invoice_id = :iid AND customer_id = :cid AND tenant_id = :tid AND status != 'paid' LIMIT 1");
            $stmtInv->execute(['iid' => $invoiceId, 'cid' => $customerId, 'tid' => $tenantId]);
            $inv = $stmtInv->fetch();
            if (!$inv) {
                Response::error('Invoice not found or already settled', 404);
            }
            $amount = (float)$inv['balance_due'] > 0 ? (float)$inv['balance_due'] : (float)$inv['total_amount'];
        } else {
            $amount = round((float)($data['amount'] ?? 0), 2);
            if ($amount < 10.0 || $amount > 100000.0) {
                Response::error('Payment amount must be between 10 and 100000', 400);
            }
        }

        $callbackUrl = self::getFrontendBaseUrl() . "/customer/payment-callback";

        $res = PaymentGatewayService::initiatePayment(
            $db,
            $tenantId,
            $gateway,
            $amount,
            $customerId,
            $invoiceId,
            $callbackUrl,
            ['flow' => 'customer_portal_pay', 'user_id' => $user['user_id'] ?? $customerId]
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
        if ($customerId <= 0) {
            Response::error('Customer profile not found for this account', 404);
        }
        $tenantId = (int)AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $months = max(1, (int)($data['months'] ?? 1));
        $gateway = strtolower(trim($data['gateway'] ?? 'bkash'));
        if ($gateway === 'sslcommerz') $gateway = 'ssl';

        $db = Database::getConnection();

        // Calculate amount from plan price & validity
        $stmtPlan = $db->prepare("SELECT ap.price, ap.validity_days, c.billing_status 
            FROM customers c
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            WHERE c.customer_id = :cid ORDER BY cs.customer_service_id DESC LIMIT 1");
        $stmtPlan->execute(['cid' => $customerId]);
        $plan = $stmtPlan->fetch();

        $planPrice = (float)($plan['price'] ?? 500);
        $validityDays = max(1, (int)($plan['validity_days'] ?? 30));
        $amount = round($planPrice * $months);

        // Include due invoice balance if any
        $stmtDue = $db->prepare("SELECT SUM(balance_due) as total_due FROM invoices WHERE customer_id = :cid AND status IN ('pending', 'partially_paid', 'overdue')");
        $stmtDue->execute(['cid' => $customerId]);
        $due = (float)($stmtDue->fetchColumn() ?: 0);
        if ($due > 0) {
            $amount += round($due);
        }

        $callbackUrl = self::getFrontendBaseUrl() . "/customer/payment-callback";

        $res = PaymentGatewayService::initiatePayment(
            $db,
            $tenantId,
            $gateway,
            $amount,
            $customerId,
            null,
            $callbackUrl,
            [
                'flow' => 'customer_portal_renew',
                'months' => $months,
                'validity_days' => $validityDays,
                'user_id' => $user['user_id'] ?? $customerId
            ]
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

        $paymentId = trim($data['paymentID'] ?? ($data['payment_id'] ?? ($data['order_id'] ?? '')));
        if (empty($paymentId)) {
            Response::error('Payment ID is required', 400);
        }

        $db = Database::getConnection();

        // Find intent
        $stmtIntent = $db->prepare("SELECT * FROM payment_intents 
            WHERE (gateway_payment_id = :gpid OR transaction_ref = :ref OR id = :iid) 
            AND (tenant_id = :tid OR :tid2 = 0) LIMIT 1");
        $stmtIntent->execute([
            'gpid' => $paymentId,
            'ref' => $paymentId,
            'iid' => is_numeric($paymentId) ? (int)$paymentId : 0,
            'tid' => $tenantId,
            'tid2' => $tenantId,
        ]);
        $intent = $stmtIntent->fetch();

        if ($intent) {
            $tenantId = (int)$intent['tenant_id'];
            if (!empty($intent['customer_id']) && ($customerId <= 0 || (int)$intent['customer_id'] !== $customerId)) {
                Response::error('Forbidden: payment intent does not belong to your account', 403);
            }
        } else {
            // Check if already settled for this customer
            $stmtTrx = $db->prepare("SELECT customer_id FROM transactions WHERE transaction_ref = :ref LIMIT 1");
            $stmtTrx->execute(['ref' => $paymentId]);
            $trxRow = $stmtTrx->fetch();
            if ($trxRow) {
                if (!empty($trxRow['customer_id']) && ($customerId <= 0 || (int)$trxRow['customer_id'] !== $customerId)) {
                    Response::error('Forbidden', 403);
                }
                Response::json(['success' => true, 'message' => 'Payment already verified and settled.']);
                return;
            }
            Response::error('Payment intent not found', 404);
        }

        $gateway = $intent['gateway'];
        $amount = (float)$intent['amount'];
        $cid = (!empty($intent['customer_id'])) ? (int)$intent['customer_id'] : $customerId;
        if ((empty($cid) || $cid <= 0) && !empty($customerId)) {
            $cid = $customerId;
        }
        $invId = $intent['invoice_id'] ? (int)$intent['invoice_id'] : null;

        if ($intent['status'] === 'completed') {
            Response::json([
                'success' => true,
                'message' => 'Payment already verified and settled.',
                'trxID' => $intent['transaction_ref'] ?: $paymentId,
            ]);
            return;
        }

        // Strict server-to-server verification before settlement
        $verifyRes = self::verifyGatewayTransaction($db, $tenantId, (string)$gateway, $paymentId, $amount, $data);
        if (empty($verifyRes['success'])) {
            Response::error($verifyRes['message'] ?? 'Payment verification failed', 402);
        }
        $trxId = $verifyRes['trxID'];
        $amount = (float)$verifyRes['amount'];
        $rawRes = $verifyRes['data'] ?? [];

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
     * Initiate Balance Topup (Admin or Reseller)
     * POST /payments/initiate-balance-topup
     */
    public static function initiateBalanceTopup(): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();
        $tenantId = (int)AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $amount = (float)($data['amount'] ?? 0);
        $gateway = strtolower(trim($data['gateway'] ?? 'bkash'));
        if ($gateway === 'sslcommerz') $gateway = 'ssl';

        if ($amount <= 0) {
            Response::error('Invalid top-up amount', 400);
        }

        $callbackUrl = !empty($data['callbackURL']) 
            ? trim($data['callbackURL']) 
            : (!empty($data['callbackUrl']) 
                ? trim($data['callbackUrl']) 
                : (self::getFrontendBaseUrl() . "/dashboard/topup-balance"));

        $res = PaymentGatewayService::initiatePayment(
            $db,
            $tenantId,
            $gateway,
            $amount,
            null,
            null,
            $callbackUrl,
            [
                'flow' => 'balance_topup',
                'user_id' => $user['user_id'],
                'role' => $user['role'] ?? 'admin',
                'username' => $user['username'] ?? '',
            ]
        );

        if (!$res['success']) {
            Response::error($res['message'] ?? 'Payment initiation failed', 400);
        }

        Response::json([
            'success' => true,
            'payment_url' => $res['payment_url'],
            'redirectURL' => $res['redirectURL'] ?? $res['payment_url'],
            'paymentID' => $res['paymentID'],
            'transaction_ref' => $res['transaction_ref'],
        ]);
    }

    /**
     * Confirm Balance Topup
     * POST /payments/confirm-balance-topup
     */
    public static function confirmBalanceTopup(): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();
        $tenantId = (int)AuthMiddleware::getTenantId();
        $userId = (int)$user['user_id'];
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $paymentId = trim($data['paymentID'] ?? ($data['payment_id'] ?? ($data['order_id'] ?? '')));
        if (empty($paymentId)) {
            Response::error('Payment ID is required', 400);
        }

        // Find intent
        $stmtIntent = $db->prepare("SELECT * FROM payment_intents 
            WHERE (gateway_payment_id = :gpid OR transaction_ref = :ref OR id = :iid) 
            AND (tenant_id = :tid OR :tid2 = 0) LIMIT 1");
        $stmtIntent->execute([
            'gpid' => $paymentId,
            'ref' => $paymentId,
            'iid' => is_numeric($paymentId) ? (int)$paymentId : 0,
            'tid' => $tenantId,
            'tid2' => $tenantId,
        ]);
        $intent = $stmtIntent->fetch();

        if ($intent) {
            $tenantId = (int)$intent['tenant_id'];
        } else {
            // Check if already settled
            $stmtTrx = $db->prepare("SELECT * FROM transactions WHERE transaction_ref = :ref LIMIT 1");
            $stmtTrx->execute(['ref' => $paymentId]);
            if ($stmtTrx->fetch()) {
                require_once __DIR__ . '/../lib/WalletLedgerService.php';
                $curBal = WalletLedgerService::getBalance($userId);
                Response::json([
                    'success' => true,
                    'message' => 'Payment already verified and credited.',
                    'balance' => $curBal,
                ]);
                return;
            }
            Response::error('Payment intent not found', 404);
        }

        $gateway = $intent['gateway'];
        $amount = (float)$intent['amount'];
        $meta = !empty($intent['metadata']) ? json_decode($intent['metadata'], true) : [];
        if (!is_array($meta)) $meta = [];
        $targetUserId = !empty($meta['user_id']) ? (int)$meta['user_id'] : 0;
        if ($targetUserId <= 0 || $targetUserId !== $userId) {
            Response::error('Forbidden: balance top-up intent does not belong to your account', 403);
        }

        // If intent was already settled by callback/webhook, fetch balance and return
        if ($intent['status'] === 'completed' || !empty($meta['settled'])) {
            require_once __DIR__ . '/../lib/WalletLedgerService.php';
            $curBal = WalletLedgerService::getBalance($targetUserId);
            Response::json([
                'success' => true,
                'message' => 'Payment confirmed and balance updated successfully!',
                'trxID' => $intent['transaction_ref'] ?: $intent['gateway_payment_id'],
                'balance' => $curBal,
            ]);
            return;
        }

        // Strict server-to-server verification before crediting balance
        $verifyRes = self::verifyGatewayTransaction($db, $tenantId, (string)$gateway, $paymentId, $amount, $data);
        if (empty($verifyRes['success'])) {
            Response::error($verifyRes['message'] ?? 'Payment verification failed', 402);
        }
        $trxId = $verifyRes['trxID'];
        $amount = (float)$verifyRes['amount'];
        $rawRes = $verifyRes['data'] ?? [];

        $db->beginTransaction();
        try {
            // Re-check with row lock to prevent double-credit race condition
            $stmtLock = $db->prepare("SELECT status, metadata FROM payment_intents WHERE id = :id FOR UPDATE");
            $stmtLock->execute(['id' => $intent['id']]);
            $lockedRow = $stmtLock->fetch();
            $lockedMeta = !empty($lockedRow['metadata']) ? (json_decode($lockedRow['metadata'], true) ?: []) : [];
            if ($lockedRow && ($lockedRow['status'] === 'completed' || !empty($lockedMeta['settled']))) {
                $db->rollBack();
                require_once __DIR__ . '/../lib/WalletLedgerService.php';
                $curBal = WalletLedgerService::getBalance($targetUserId);
                Response::json([
                    'success' => true,
                    'message' => 'Payment already verified and credited.',
                    'trxID' => $trxId,
                    'balance' => $curBal,
                ]);
                return;
            }

            // Mark intent completed
            $db->prepare("UPDATE payment_intents SET status = 'completed', transaction_ref = :ref, metadata = :meta WHERE id = :id")
               ->execute(['ref' => $trxId, 'meta' => json_encode(array_merge($meta, ['settled' => true, 'raw' => $rawRes])), 'id' => $intent['id']]);

            // Insert into transactions
            $db->prepare("INSERT INTO transactions 
                (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, description, metadata)
                VALUES (:tid, NULL, :ref, 'GATEWAY_PAYMENT', :amt, :method, :uid, :role, :desc, :meta)")
               ->execute([
                   'tid' => $tenantId,
                   'ref' => $trxId,
                   'amt' => $amount,
                   'method' => $gateway,
                   'uid' => $targetUserId,
                   'role' => $user['role'] ?? 'reseller',
                   'desc' => strtoupper($gateway) . " Online Balance Topup (Ref: {$trxId})",
                   'meta' => json_encode($rawRes),
               ]);

            // Credit wallet & wallet_transactions & reseller_ledger atomically
            require_once __DIR__ . '/../lib/WalletLedgerService.php';
            WalletLedgerService::topup(
                $userId,
                $targetUserId,
                $amount,
                "Online balance topup via {$gateway} (Ref: {$trxId})",
                $tenantId
            );

            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log("Balance topup credit failed: " . $e->getMessage());
            Response::error('Failed to credit balance. Please try again later.', 500);
        }

        // Fetch updated balance directly from wallet service
        require_once __DIR__ . '/../lib/WalletLedgerService.php';
        $newBalance = WalletLedgerService::getBalance($targetUserId);

        Response::json([
            'success' => true,
            'message' => 'Payment confirmed and balance updated successfully!',
            'trxID' => $trxId,
            'balance' => $newBalance,
        ]);
    }

    /**
     * Handle Public Topup GET callback from gateway (e.g. bKash redirect)
     * GET /public/topup or GET /topup
     */
    public static function handlePublicTopupGetCallback(): void {
        $db = Database::getConnection();
        $params = $_GET;

        $paymentId = trim((string)($params['paymentID'] ?? ($params['payment_id'] ?? ($params['order_id'] ?? ($params['tran_id'] ?? '')))));
        $status = strtolower(trim((string)($params['status'] ?? ($params['sp_massage'] ?? ''))));

        if ($paymentId === '') {
            header("Location: " . self::getFrontendBaseUrl() . "/public/topup");
            exit;
        }

        // Find intent
        $stmtIntent = $db->prepare("SELECT * FROM payment_intents 
            WHERE (gateway_payment_id = :gpid OR transaction_ref = :ref OR id = :iid) 
            ORDER BY id DESC LIMIT 1");
        $stmtIntent->execute([
            'gpid' => $paymentId,
            'ref' => $paymentId,
            'iid' => is_numeric($paymentId) ? (int)$paymentId : 0,
        ]);
        $intent = $stmtIntent->fetch();

        if (!$intent) {
            header("Location: " . self::getFrontendBaseUrl() . "/public/topup?result=failed&paymentID=" . urlencode($paymentId));
            exit;
        }

        $tenantId = (int)$intent['tenant_id'];
        $customerId = $intent['customer_id'] ? (int)$intent['customer_id'] : null;
        $amount = (float)$intent['amount'];
        $gateway = (string)$intent['gateway'];
        $intentMeta = json_decode($intent['metadata'] ?? '{}', true) ?: [];

        $isSuccessStatus = ($status === 'success' || $status === 'completed' || $status === 'valid' || $status === 'validated');
        $verified = false;
        $trxId = (string)($intent['transaction_ref'] ?: $paymentId);

        if ($intent['status'] === 'completed' || !empty($intentMeta['settled'])) {
            $verified = true;
        } elseif ($isSuccessStatus) {
            $verifyRes = self::verifyGatewayTransaction($db, $tenantId, $gateway, $paymentId, $amount, $params);
            if (!empty($verifyRes['success'])) {
                $verified = true;
                $trxId = $verifyRes['trxID'];
                $amount = (float)$verifyRes['amount'];

                PaymentGatewayService::processPaymentSuccess(
                    $db,
                    $tenantId,
                    $gateway,
                    $paymentId,
                    $trxId,
                    $amount,
                    $customerId,
                    $intent['invoice_id'] ? (int)$intent['invoice_id'] : null,
                    $verifyRes['data'] ?? $params
                );
            }
        }

        if ($verified) {
            if (($intentMeta['flow'] ?? '') === 'balance_topup') {
                $redirectUrl = self::getFrontendBaseUrl() . "/dashboard/topup-balance?status=success&paymentID=" . urlencode($paymentId) . "&trx_id=" . urlencode($trxId);
                header("Location: {$redirectUrl}");
                exit;
            }

            $redirectUrl = self::getFrontendBaseUrl() . "/public/topup?result=success&txn_id=" . urlencode($trxId) . "&gateway=" . urlencode($gateway) . "&amount=" . urlencode((string)$amount) . "&paymentID=" . urlencode($paymentId);
            header("Location: {$redirectUrl}");
            exit;
        }

        if (($intentMeta['flow'] ?? '') === 'balance_topup') {
            $redirectUrl = self::getFrontendBaseUrl() . "/dashboard/topup-balance?status=cancel&paymentID=" . urlencode($paymentId) . "&gateway=" . urlencode($gateway);
            header("Location: {$redirectUrl}");
            exit;
        }

        $redirectUrl = self::getFrontendBaseUrl() . "/public/topup?result=cancel&paymentID=" . urlencode($paymentId) . "&gateway=" . urlencode($gateway);
        header("Location: {$redirectUrl}");
        exit;
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

        $status = strtolower(trim((string)($allData['status'] ?? ($allData['sp_massage'] ?? ''))));
        $paymentId = trim((string)($allData['paymentID'] ?? ($allData['payment_id'] ?? ($allData['order_id'] ?? ($allData['tran_id'] ?? '')))));
        $valId = trim((string)($allData['val_id'] ?? ''));

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

        $frontBase = self::getFrontendBaseUrl();
        if (!$intent) {
            header("Location: {$frontBase}/public/topup?result=failed&paymentID=" . urlencode($paymentId));
            exit;
        }

        $tenantId = (int)$intent['tenant_id'];
        $customerId = $intent['customer_id'] ? (int)$intent['customer_id'] : null;
        $invoiceId = $intent['invoice_id'] ? (int)$intent['invoice_id'] : null;
        $amount = (float)$intent['amount'];
        $intentGw = (string)($intent['gateway'] ?: $gw);

        $intentMeta = !empty($intent['metadata']) ? json_decode($intent['metadata'], true) : [];
        $isBalanceTopup = ($intentMeta['flow'] ?? '') === 'balance_topup';
        $isSuccessStatus = ($status === 'success' || $status === 'completed' || $status === 'valid' || $status === 'validated' || $valId !== '');

        $isSuccess = false;
        $trxId = (string)($intent['transaction_ref'] ?: $paymentId);

        if ($intent['status'] === 'completed' || !empty($intentMeta['settled'])) {
            $isSuccess = true;
        } elseif ($isSuccessStatus && $paymentId !== '') {
            $verifyRes = self::verifyGatewayTransaction($db, $tenantId, $intentGw, $paymentId, $amount, $allData);
            if (!empty($verifyRes['success'])) {
                $isSuccess = true;
                $trxId = $verifyRes['trxID'];
                $amount = (float)$verifyRes['amount'];

                PaymentGatewayService::processPaymentSuccess(
                    $db,
                    $tenantId,
                    $intentGw,
                    $paymentId,
                    $trxId,
                    $amount,
                    $customerId,
                    $invoiceId,
                    $verifyRes['data'] ?? $allData
                );
            }
        }

        // Redirect appropriately
        $redirectStatus = $isSuccess ? 'success' : 'failed';

        if ($isBalanceTopup) {
            header("Location: {$frontBase}/dashboard/topup-balance?status={$redirectStatus}&paymentID=" . urlencode($paymentId) . "&trx_id=" . urlencode($trxId));
        } else if ($customerId) {
            header("Location: {$frontBase}/customer/payment-callback?status={$redirectStatus}&paymentID=" . urlencode($paymentId) . "&trx_id=" . urlencode($trxId));
        } else {
            header("Location: {$frontBase}/saas/tenants/{$tenantId}/payment-callback?status={$redirectStatus}&gateway=" . urlencode($intentGw) . "&amount=" . urlencode((string)$amount) . "&trx_id=" . urlencode($trxId));
        }
        exit;
    }

    /**
     * Simulator Confirmation API
     * POST /payments/simulator/confirm
     */
    public static function simulatorConfirm(): void {
        $appEnv = strtolower(getenv('APP_ENV') ?: ($_ENV['APP_ENV'] ?? 'production'));
        if ($appEnv === 'production' || $appEnv === 'live') {
            Response::error('Payment simulator is disabled in production', 403);
        }

        $user = AuthMiddleware::requireAuth();
        $role = strtolower((string)($user['role'] ?? ''));
        $isSaasAdmin = in_array($role, ['saas_admin', 'super_admin'], true);
        $callerTenantId = (int)AuthMiddleware::getTenantId();

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $tenantId = $isSaasAdmin && !empty($data['tenant_id']) ? (int)$data['tenant_id'] : $callerTenantId;
        $gateway = strtolower($data['gateway'] ?? 'bkash');
        $paymentId = $data['paymentID'] ?? ('SIM-' . strtoupper($gateway) . '-' . random_int(10000, 99999));
        $trxId = 'TRX-' . strtoupper($gateway) . '-' . strtoupper(substr(uniqid(), -6)) . date('His');
        $amount = (float)($data['amount'] ?? 10);
        $intentId = !empty($data['intent_id']) ? (int)$data['intent_id'] : null;

        $db = Database::getConnection();

        $intent = null;
        if ($intentId) {
            $stmtI = $db->prepare("SELECT * FROM payment_intents WHERE id = :id LIMIT 1");
            $stmtI->execute(['id' => $intentId]);
            $intent = $stmtI->fetch();
            if ($intent && !$isSaasAdmin && (int)$intent['tenant_id'] !== $callerTenantId) {
                Response::error('Forbidden', 403);
            }
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
        // 1. Direct customer_id from AuthMiddleware token
        if (!empty($user['customer_id'])) {
            return (int)$user['customer_id'];
        }
        if (!empty($user['user_type']) && $user['user_type'] === 'customer' && !empty($user['user_id'])) {
            return (int)$user['user_id'];
        }

        $db = Database::getConnection();

        // 2. Direct match with customers table by customer_id or login_user_id
        if (!empty($user['user_id'])) {
            $stmt = $db->prepare("SELECT customer_id FROM customers WHERE customer_id = :cid OR login_user_id = :uid LIMIT 1");
            $stmt->execute(['cid' => $user['user_id'], 'uid' => $user['user_id']]);
            $cid = $stmt->fetchColumn();
            if ($cid) return (int)$cid;
        }

        // 3. Match by username (customer_code or PPPoE username)
        if (!empty($user['username'])) {
            $stmt = $db->prepare("SELECT customer_id FROM customer_network_accounts WHERE username = :un LIMIT 1");
            $stmt->execute(['un' => $user['username']]);
            $cid = $stmt->fetchColumn();
            if ($cid) return (int)$cid;

            $stmtCust = $db->prepare("SELECT customer_id FROM customers WHERE customer_code = :cc LIMIT 1");
            $stmtCust->execute(['cc' => $user['username']]);
            $cid = $stmtCust->fetchColumn();
            if ($cid) return (int)$cid;
        }

        return 0;
    }
}

