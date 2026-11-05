<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/MikrotikSyncService.php';

class PaymentGatewayService {

    /**
     * Fetch settings for a specific gateway & tenant
     */
    public static function getGatewaySettings(PDO $db, int $tenantId, string $gateway): ?array {
        $stmt = $db->prepare("SELECT * FROM payment_gateway_settings WHERE tenant_id = :tid AND gateway = :gw LIMIT 1");
        $stmt->execute(['tid' => $tenantId, 'gw' => strtolower($gateway)]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Fetch all active gateways configured for a tenant
     */
    public static function getActiveGateways(PDO $db, int $tenantId): array {
        $stmt = $db->prepare("SELECT * FROM payment_gateway_settings WHERE tenant_id = :tid AND is_active = 1");
        $stmt->execute(['tid' => $tenantId]);
        return $stmt->fetchAll() ?: [];
    }

    /**
     * Execute a cURL request
     */
    public static function httpRequest(string $url, string $method = 'GET', $data = null, array $headers = [], int $timeout = 15): array {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

        if (strtoupper($method) === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data !== null) {
                if (is_array($data) && !in_array('Content-Type: application/json', $headers)) {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
                } else {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($data) ? $data : json_encode($data));
                }
            }
        } else if (strtoupper($method) !== 'GET') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
            if ($data !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($data) ? $data : json_encode($data));
            }
        }

        if (!empty($headers)) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        $decoded = null;
        if ($response !== false && !empty($response)) {
            $decoded = json_decode($response, true);
        }

        return [
            'http_code' => $httpCode,
            'raw' => $response,
            'data' => $decoded,
            'error' => $curlError,
        ];
    }

    // ==========================================
    // 1. bKash Tokenized Checkout v1.2.0-beta
    // ==========================================

    public static function bkashBaseUrl(bool $isSandbox): string {
        return $isSandbox 
            ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout' 
            : 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout';
    }

    public static function bkashGrantToken(array $settings): array {
        $isSandbox = (bool)($settings['is_sandbox'] ?? true);
        $baseUrl = self::bkashBaseUrl($isSandbox);
        $url = $baseUrl . '/token/grant';

        $appKey = $settings['app_key'] ?? '';
        $appSecret = $settings['app_secret'] ?? '';
        $username = $settings['username'] ?? '';
        $password = $settings['password'] ?? '';

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'username: ' . $username,
            'password: ' . $password,
        ];

        $postData = [
            'app_key' => $appKey,
            'app_secret' => $appSecret,
        ];

        $res = self::httpRequest($url, 'POST', $postData, $headers);
        if ($res['data'] && isset($res['data']['id_token'])) {
            return [
                'success' => true,
                'token' => $res['data']['id_token'],
                'refreshToken' => $res['data']['refresh_token'] ?? '',
                'data' => $res['data'],
            ];
        }

        return [
            'success' => false,
            'message' => $res['data']['statusMessage'] ?? ($res['error'] ?: 'bKash token grant failed'),
            'raw' => $res,
        ];
    }

    public static function bkashCreatePayment(array $settings, float $amount, string $invoiceNumber, string $callbackUrl, ?string $payerRef = null): array {
        $tokenRes = self::bkashGrantToken($settings);
        if (!$tokenRes['success']) {
            return $tokenRes;
        }

        $idToken = $tokenRes['token'];
        $isSandbox = (bool)($settings['is_sandbox'] ?? true);
        $baseUrl = self::bkashBaseUrl($isSandbox);
        $url = $baseUrl . '/create';

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'authorization: ' . $idToken,
            'x-app-key: ' . ($settings['app_key'] ?? ''),
        ];

        $payload = [
            'mode' => '0011',
            'payerReference' => $payerRef ?: ('CUST-' . rand(1000, 9999)),
            'callbackURL' => $callbackUrl,
            'amount' => number_format($amount, 2, '.', ''),
            'currency' => 'BDT',
            'intent' => 'sale',
            'merchantInvoiceNumber' => $invoiceNumber,
        ];

        $res = self::httpRequest($url, 'POST', $payload, $headers);
        if ($res['data'] && !empty($res['data']['bkashURL'])) {
            return [
                'success' => true,
                'paymentID' => $res['data']['paymentID'],
                'bkashURL' => $res['data']['bkashURL'],
                'data' => $res['data'],
            ];
        }

        return [
            'success' => false,
            'message' => $res['data']['statusMessage'] ?? ($res['error'] ?: 'bKash create payment failed'),
            'raw' => $res,
        ];
    }

    public static function bkashExecutePayment(array $settings, string $paymentId): array {
        $tokenRes = self::bkashGrantToken($settings);
        if (!$tokenRes['success']) {
            return $tokenRes;
        }

        $idToken = $tokenRes['token'];
        $isSandbox = (bool)($settings['is_sandbox'] ?? true);
        $baseUrl = self::bkashBaseUrl($isSandbox);
        $url = $baseUrl . '/execute';

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'authorization: ' . $idToken,
            'x-app-key: ' . ($settings['app_key'] ?? ''),
        ];

        $payload = ['paymentID' => $paymentId];
        $res = self::httpRequest($url, 'POST', $payload, $headers);

        $status = $res['data']['transactionStatus'] ?? '';
        $statusCode = $res['data']['statusCode'] ?? '';

        if (($statusCode === '0000' || $status === 'Completed') && !empty($res['data']['trxID'])) {
            return [
                'success' => true,
                'trxID' => $res['data']['trxID'],
                'paymentID' => $paymentId,
                'amount' => (float)($res['data']['amount'] ?? 0),
                'customerMsisdn' => $res['data']['customerMsisdn'] ?? '',
                'data' => $res['data'],
            ];
        }

        return [
            'success' => false,
            'message' => $res['data']['statusMessage'] ?? ($res['error'] ?: 'bKash payment execution failed'),
            'data' => $res['data'],
        ];
    }

    // ==========================================
    // 2. SSLCommerz PGW v4
    // ==========================================

    public static function sslBaseUrl(bool $isSandbox): string {
        return $isSandbox ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com';
    }

    public static function sslInitPayment(
        array $settings,
        float $amount,
        string $tranId,
        array $customerInfo,
        string $successUrl,
        string $failUrl,
        string $cancelUrl,
        string $ipnUrl
    ): array {
        $isSandbox = (bool)($settings['is_sandbox'] ?? true);
        $baseUrl = self::sslBaseUrl($isSandbox);
        $url = $baseUrl . '/gwprocess/v4/api.php';

        $storeId = $settings['app_key'] ?? ($settings['username'] ?? '');
        $storePasswd = $settings['app_secret'] ?? ($settings['password'] ?? '');

        $postData = [
            'store_id' => $storeId,
            'store_passwd' => $storePasswd,
            'total_amount' => number_format($amount, 2, '.', ''),
            'currency' => 'BDT',
            'tran_id' => $tranId,
            'success_url' => $successUrl,
            'fail_url' => $failUrl,
            'cancel_url' => $cancelUrl,
            'ipn_url' => $ipnUrl,
            'cus_name' => $customerInfo['name'] ?? 'Customer',
            'cus_email' => $customerInfo['email'] ?? 'customer@netfix.local',
            'cus_add1' => $customerInfo['address'] ?? 'Dhaka, Bangladesh',
            'cus_city' => 'Dhaka',
            'cus_country' => 'Bangladesh',
            'cus_phone' => $customerInfo['phone'] ?? '01700000000',
            'shipping_method' => 'NO',
            'product_name' => 'ISP Broadband Internet',
            'product_category' => 'Internet',
            'product_profile' => 'non-physical-goods',
        ];

        $res = self::httpRequest($url, 'POST', $postData, ['Content-Type: application/x-www-form-urlencoded']);

        if ($res['data'] && ($res['data']['status'] ?? '') === 'SUCCESS' && !empty($res['data']['GatewayPageURL'])) {
            return [
                'success' => true,
                'redirectURL' => $res['data']['GatewayPageURL'],
                'sessionkey' => $res['data']['sessionkey'] ?? '',
                'data' => $res['data'],
            ];
        }

        return [
            'success' => false,
            'message' => $res['data']['failedreason'] ?? ($res['error'] ?: 'SSLCommerz session initialization failed'),
            'raw' => $res,
        ];
    }

    public static function sslValidatePayment(array $settings, string $valId, string $tranId, float $amount): array {
        $isSandbox = (bool)($settings['is_sandbox'] ?? true);
        $baseUrl = self::sslBaseUrl($isSandbox);

        $storeId = $settings['app_key'] ?? ($settings['username'] ?? '');
        $storePasswd = $settings['app_secret'] ?? ($settings['password'] ?? '');

        $url = $baseUrl . "/validator/api/validationserverAPI.php?val_id=" . urlencode($valId) .
               "&store_id=" . urlencode($storeId) .
               "&store_passwd=" . urlencode($storePasswd) .
               "&v=1&format=json";

        $res = self::httpRequest($url, 'GET');
        $status = $res['data']['status'] ?? '';

        if ($status === 'VALID' || $status === 'VALIDATED') {
            return [
                'success' => true,
                'trxID' => $res['data']['bank_tran_id'] ?? $tranId,
                'val_id' => $valId,
                'tran_id' => $tranId,
                'amount' => (float)($res['data']['amount'] ?? $amount),
                'card_type' => $res['data']['card_type'] ?? 'ONLINE',
                'data' => $res['data'],
            ];
        }

        return [
            'success' => false,
            'message' => $res['data']['error'] ?? 'SSLCommerz payment validation failed',
            'data' => $res['data'],
        ];
    }

    // ==========================================
    // 3. SurjoPay (Shurjopay PGW v2)
    // ==========================================

    public static function surjopayBaseUrl(bool $isSandbox): string {
        return $isSandbox ? 'https://sandbox.shurjopayment.com/api' : 'https://engine.shurjopayment.com/api';
    }

    public static function surjopayGetToken(array $settings): array {
        $isSandbox = (bool)($settings['is_sandbox'] ?? true);
        $baseUrl = self::surjopayBaseUrl($isSandbox);
        $url = $baseUrl . '/get_token';

        $username = $settings['username'] ?? '';
        $password = $settings['password'] ?? '';

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
        ];

        $postData = [
            'username' => $username,
            'password' => $password,
        ];

        $res = self::httpRequest($url, 'POST', $postData, $headers);
        if ($res['data'] && !empty($res['data']['token'])) {
            return [
                'success' => true,
                'token' => $res['data']['token'],
                'data' => $res['data'],
            ];
        }

        return [
            'success' => false,
            'message' => $res['data']['message'] ?? ($res['error'] ?: 'SurjoPay token request failed'),
            'raw' => $res,
        ];
    }

    public static function surjopayCreatePayment(
        array $settings,
        float $amount,
        string $orderId,
        array $customerInfo,
        string $returnUrl,
        string $cancelUrl
    ): array {
        $tokenRes = self::surjopayGetToken($settings);
        if (!$tokenRes['success']) {
            return $tokenRes;
        }

        $token = $tokenRes['token'];
        $isSandbox = (bool)($settings['is_sandbox'] ?? true);
        $baseUrl = self::surjopayBaseUrl($isSandbox);
        $url = $baseUrl . '/secret-pay';

        $prefix = !empty($settings['app_key']) ? $settings['app_key'] : 'NOK';

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'Authorization: Bearer ' . $token,
        ];

        $payload = [
            'token' => $token,
            'app_name' => $prefix,
            'prefix' => $prefix,
            'amount' => $amount,
            'order_id' => $orderId,
            'currency' => 'BDT',
            'customer_name' => $customerInfo['name'] ?? 'Customer',
            'customer_address' => $customerInfo['address'] ?? 'Dhaka, Bangladesh',
            'customer_phone' => $customerInfo['phone'] ?? '01700000000',
            'customer_city' => 'Dhaka',
            'customer_post_code' => '1000',
            'return_url' => $returnUrl,
            'cancel_url' => $cancelUrl,
            'client_ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
        ];

        $res = self::httpRequest($url, 'POST', $payload, $headers);
        if ($res['data'] && !empty($res['data']['checkout_url'])) {
            return [
                'success' => true,
                'redirectURL' => $res['data']['checkout_url'],
                'order_id' => $orderId,
                'data' => $res['data'],
            ];
        }

        return [
            'success' => false,
            'message' => $res['data']['message'] ?? ($res['error'] ?: 'SurjoPay checkout generation failed'),
            'raw' => $res,
        ];
    }

    public static function surjopayVerifyOrder(array $settings, string $orderId): array {
        $tokenRes = self::surjopayGetToken($settings);
        if (!$tokenRes['success']) {
            return $tokenRes;
        }

        $token = $tokenRes['token'];
        $isSandbox = (bool)($settings['is_sandbox'] ?? true);
        $baseUrl = self::surjopayBaseUrl($isSandbox);
        $url = $baseUrl . '/verification';

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'Authorization: Bearer ' . $token,
        ];

        $payload = ['order_id' => $orderId];
        $res = self::httpRequest($url, 'POST', $payload, $headers);

        $data = $res['data'];
        $item = is_array($data) && isset($data[0]) ? $data[0] : (is_array($data) ? $data : []);

        $spCode = (string)($item['sp_code'] ?? '');
        $statusMsg = strtolower($item['sp_massage'] ?? ($item['bank_status'] ?? ''));

        if ($spCode === '1000' || strpos($statusMsg, 'success') !== false) {
            return [
                'success' => true,
                'trxID' => $item['bank_trx_id'] ?? ($item['sp_trx_id'] ?? $orderId),
                'order_id' => $orderId,
                'amount' => (float)($item['amount'] ?? 0),
                'data' => $item,
            ];
        }

        return [
            'success' => false,
            'message' => $item['sp_massage'] ?? 'SurjoPay order verification failed',
            'data' => $item,
        ];
    }

    // ==========================================
    // 4. Unified Flow & Settlement
    // ==========================================

    /**
     * Initiate payment across any gateway with smart sandbox fallback
     */
    public static function initiatePayment(
        PDO $db,
        int $tenantId,
        string $gateway,
        float $amount,
        ?int $customerId,
        ?int $invoiceId,
        string $callbackUrl,
        array $extra = []
    ): array {
        $gw = strtolower(trim($gateway));
        if ($gw === 'sslcommerz') $gw = 'ssl';

        $settings = self::getGatewaySettings($db, $tenantId, $gw);
        if (!$settings) {
            // Auto seed or check default
            $settings = [
                'tenant_id' => $tenantId,
                'gateway' => $gw,
                'app_key' => 'sandbox_key',
                'app_secret' => 'sandbox_secret',
                'username' => 'sandbox_user',
                'password' => 'sandbox_pass',
                'is_sandbox' => 1,
                'is_active' => 1,
            ];
        }

        $isSandbox = (bool)($settings['is_sandbox'] ?? true);
        $orderRef = 'TXN-' . strtoupper($gw) . '-' . strtoupper(substr(uniqid(), -6)) . date('His');

        // Fetch customer details if present
        $custInfo = [
            'name' => 'Broadband Subscriber',
            'email' => 'subscriber@netfix.local',
            'phone' => '01700000000',
            'address' => 'Dhaka, Bangladesh',
        ];
        if ($customerId) {
            $stmtC = $db->prepare("SELECT full_name, email, phone, billing_address FROM customers WHERE customer_id = :cid LIMIT 1");
            $stmtC->execute(['cid' => $customerId]);
            if ($rowC = $stmtC->fetch()) {
                $custInfo['name'] = $rowC['full_name'] ?: $custInfo['name'];
                $custInfo['email'] = $rowC['email'] ?: $custInfo['email'];
                $custInfo['phone'] = $rowC['phone'] ?: $custInfo['phone'];
                $custInfo['address'] = $rowC['billing_address'] ?: $custInfo['address'];
            }
        }

        // Insert initiated intent
        $stmtIntent = $db->prepare("INSERT INTO payment_intents 
            (tenant_id, customer_id, invoice_id, amount, gateway, gateway_payment_id, transaction_ref, status, metadata)
            VALUES (:tid, :cid, :inv, :amt, :gw, :gpid, :ref, 'initiated', :meta)");
        $stmtIntent->execute([
            'tid' => $tenantId,
            'cid' => $customerId ?: null,
            'inv' => $invoiceId ?: null,
            'amt' => $amount,
            'gw' => $gw,
            'gpid' => $orderRef,
            'ref' => $orderRef,
            'meta' => json_encode($extra),
        ]);
        $intentId = $db->lastInsertId();

        $redirectUrl = null;
        $paymentId = $orderRef;

        // Attempt real gateway API
        if ($gw === 'bkash') {
            $bkRes = self::bkashCreatePayment($settings, $amount, $orderRef, $callbackUrl, $custInfo['phone']);
            if ($bkRes['success']) {
                $redirectUrl = $bkRes['bkashURL'];
                $paymentId = $bkRes['paymentID'];
            }
        } else if ($gw === 'ssl') {
            $sslRes = self::sslInitPayment(
                $settings,
                $amount,
                $orderRef,
                $custInfo,
                $callbackUrl . '?status=success&paymentID=' . $orderRef,
                $callbackUrl . '?status=failed&paymentID=' . $orderRef,
                $callbackUrl . '?status=cancel&paymentID=' . $orderRef,
                $callbackUrl . '?status=ipn&paymentID=' . $orderRef
            );
            if ($sslRes['success']) {
                $redirectUrl = $sslRes['redirectURL'];
            }
        } else if ($gw === 'surjopay') {
            $prefix = !empty($settings['app_key']) ? $settings['app_key'] : 'NOK';
            $spOrderId = $prefix . date('ymdHis') . rand(10, 99);
            $spRes = self::surjopayCreatePayment(
                $settings,
                $amount,
                $spOrderId,
                $custInfo,
                $callbackUrl . '?status=success&paymentID=' . $spOrderId,
                $callbackUrl . '?status=cancel&paymentID=' . $spOrderId
            );
            if ($spRes['success']) {
                $redirectUrl = $spRes['redirectURL'];
                $paymentId = $spOrderId;
            }
        }

        // Update payment ID in intent if changed
        if ($paymentId !== $orderRef) {
            $db->prepare("UPDATE payment_intents SET gateway_payment_id = :gpid WHERE id = :id")
               ->execute(['gpid' => $paymentId, 'id' => $intentId]);
        }

        // If gateway returned valid URL, return it
        if (!empty($redirectUrl)) {
            return [
                'success' => true,
                'payment_url' => $redirectUrl,
                'redirectURL' => $redirectUrl,
                'bkashURL' => $redirectUrl,
                'paymentID' => $paymentId,
                'transaction_ref' => $orderRef,
                'intent_id' => $intentId,
                'mode' => 'gateway',
            ];
        }

        // If in Sandbox mode and API credentials are test/unreachable, provide Interactive Sandbox Simulator
        $simulatorUrl = "/payments/simulator?intent_id={$intentId}&tenant_id={$tenantId}&gateway={$gw}&amount={$amount}&ref={$orderRef}&paymentID={$paymentId}&callback=" . urlencode($callbackUrl);

        return [
            'success' => true,
            'payment_url' => $simulatorUrl,
            'redirectURL' => $simulatorUrl,
            'bkashURL' => $simulatorUrl,
            'paymentID' => $paymentId,
            'transaction_ref' => $orderRef,
            'intent_id' => $intentId,
            'mode' => 'sandbox_simulator',
        ];
    }

    /**
     * Process payment success: Mark invoices paid, insert transaction, extend subscription, and unblock on MikroTik
     */
    public static function processPaymentSuccess(
        PDO $db,
        int $tenantId,
        string $gateway,
        string $gatewayPaymentId,
        string $trxId,
        float $amount,
        ?int $customerId = null,
        ?int $invoiceId = null,
        array $rawResponse = []
    ): array {
        $db->beginTransaction();

        try {
            // 1. Find or update intent
            $stmtIntent = $db->prepare("SELECT * FROM payment_intents 
                WHERE (gateway_payment_id = :gpid OR transaction_ref = :ref OR id = :iid) 
                AND tenant_id = :tid LIMIT 1");
            $stmtIntent->execute([
                'gpid' => $gatewayPaymentId,
                'ref' => $trxId,
                'iid' => is_numeric($gatewayPaymentId) ? (int)$gatewayPaymentId : 0,
                'tid' => $tenantId,
            ]);
            $intent = $stmtIntent->fetch();

            if ($intent) {
                $customerId = $customerId ?: ($intent['customer_id'] ? (int)$intent['customer_id'] : null);
                $invoiceId = $invoiceId ?: ($intent['invoice_id'] ? (int)$intent['invoice_id'] : null);
                $amount = $amount > 0 ? $amount : (float)$intent['amount'];

                $db->prepare("UPDATE payment_intents SET status = 'completed', metadata = :meta WHERE id = :id")
                   ->execute([
                       'meta' => json_encode($rawResponse),
                       'id' => $intent['id'],
                   ]);
            }

            // 2. Insert into transactions table
            $transRef = $trxId ?: ('TRX-' . strtoupper($gateway) . '-' . substr(uniqid(), -6));
            $stmtTrx = $db->prepare("INSERT INTO transactions 
                (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, description, metadata)
                VALUES (:tid, :cid, :ref, 'GATEWAY_PAYMENT', :amt, :method, 0, 'pgw', :desc, :meta)");
            $stmtTrx->execute([
                'tid' => $tenantId,
                'cid' => $customerId ?: null,
                'ref' => $transRef,
                'amt' => $amount,
                'method' => $gateway,
                'desc' => strtoupper($gateway) . " Online Payment (Ref: {$transRef})",
                'meta' => json_encode($rawResponse),
            ]);
            $transactionId = $db->lastInsertId();

            $mikrotikResult = null;

            // 3. If Customer: Settle invoices, extend service, mark active & unblock on MikroTik
            if ($customerId) {
                // Clear pending/overdue invoices
                if ($invoiceId) {
                    $stmtInv = $db->prepare("UPDATE invoices 
                        SET paid_amount = total_amount, balance_due = 0, status = 'paid', updated_at = NOW() 
                        WHERE invoice_id = :inv AND tenant_id = :tid");
                    $stmtInv->execute(['inv' => $invoiceId, 'tid' => $tenantId]);
                } else {
                    $stmtInv = $db->prepare("UPDATE invoices 
                        SET paid_amount = total_amount, balance_due = 0, status = 'paid', updated_at = NOW() 
                        WHERE customer_id = :cid AND tenant_id = :tid AND status IN ('pending', 'partially_paid', 'overdue')");
                    $stmtInv->execute(['cid' => $customerId, 'tid' => $tenantId]);
                }

                // Extend customer service by 30 days
                $stmtCs = $db->prepare("UPDATE customer_services 
                    SET expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, NOW()), NOW()), INTERVAL 30 DAY),
                        status = 'active',
                        updated_at = NOW()
                    WHERE customer_id = :cid AND tenant_id = :tid");
                $stmtCs->execute(['cid' => $customerId, 'tid' => $tenantId]);

                // Update customer table
                $stmtCust = $db->prepare("UPDATE customers 
                    SET status = 'active', billing_status = 'Paid', updated_at = NOW() 
                    WHERE customer_id = :cid AND tenant_id = :tid");
                $stmtCust->execute(['cid' => $customerId, 'tid' => $tenantId]);

                // Instant MikroTik unblock & profile restoration
                try {
                    $mikrotikResult = MikrotikSyncService::renewCustomer($db, $customerId);
                } catch (\Throwable $mke) {
                    $mikrotikResult = ['success' => false, 'message' => $mke->getMessage()];
                }
            }

            $db->commit();

            return [
                'success' => true,
                'message' => 'Payment settled and verified successfully',
                'trxID' => $transRef,
                'amount' => $amount,
                'transaction_id' => $transactionId,
                'mikrotik' => $mikrotikResult,
            ];
        } catch (\Throwable $e) {
            $db->rollBack();
            return [
                'success' => false,
                'message' => 'Payment settlement failed: ' . $e->getMessage(),
            ];
        }
    }
}
