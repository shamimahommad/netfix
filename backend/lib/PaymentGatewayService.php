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
        if ($row && !empty($row['app_key']) && $row['app_key'] !== 'sandbox_key') {
            return $row;
        }

        // Fallback: If tenant does not have active custom credentials, inherit active platform gateway settings
        $stmtFallback = $db->prepare("SELECT * FROM payment_gateway_settings WHERE gateway = :gw AND is_active = 1 AND app_key IS NOT NULL AND app_key != '' AND app_key NOT LIKE '%sandbox_key%' ORDER BY id ASC LIMIT 1");
        $stmtFallback->execute(['gw' => strtolower($gateway)]);
        $fallback = $stmtFallback->fetch();
        return $fallback ?: ($row ?: null);
    }

    /**
     * Fetch all active gateways configured for a tenant
     */
    public static function getActiveGateways(PDO $db, int $tenantId): array {
        $stmt = $db->prepare("SELECT * FROM payment_gateway_settings WHERE tenant_id = :tid AND is_active = 1");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll();
        if (!empty($rows)) {
            return $rows;
        }

        // Fallback to active platform gateways
        $stmtFallback = $db->prepare("SELECT * FROM payment_gateway_settings WHERE is_active = 1 AND app_key IS NOT NULL AND app_key != '' AND app_key NOT LIKE '%sandbox_key%' GROUP BY gateway ORDER BY id ASC");
        $stmtFallback->execute();
        return $stmtFallback->fetchAll() ?: [];
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

        $isJson = false;
        foreach ($headers as $h) {
            if (stripos($h, 'application/json') !== false) {
                $isJson = true;
                break;
            }
        }

        if (strtoupper($method) === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data !== null) {
                if (is_array($data) && !$isJson) {
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
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
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

    public static function isSandboxMode(array $settings): bool {
        if (!isset($settings['is_sandbox'])) {
            return false;
        }
        $val = $settings['is_sandbox'];
        if ($val === 0 || $val === '0' || $val === false || $val === 'false') {
            return false;
        }
        return true;
    }

    // ==========================================
    // 1. bKash Tokenized Checkout v1.2.0-beta
    // ==========================================

    public static function bkashBaseUrl(bool $isSandbox, ?string $customContextRoot = null): string {
        if (!empty($customContextRoot)) {
            $root = rtrim(trim($customContextRoot), '/');
            if (strpos($root, '/tokenized/checkout') !== false) {
                return $root;
            }
            if (strpos($root, '/v1.2.0-beta') !== false) {
                return $root . '/tokenized/checkout';
            }
            return $root . '/v1.2.0-beta/tokenized/checkout';
        }
        return $isSandbox 
            ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout' 
            : 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout';
    }

    public static function bkashGrantToken(array $settings): array {
        $isSandbox = self::isSandboxMode($settings);
        $customContextRoot = $settings['api_context_root'] ?? ($settings['credentials']['apiContextRoot'] ?? null);
        $baseUrl = self::bkashBaseUrl($isSandbox, $customContextRoot);
        $url = $baseUrl . '/token/grant';

        $appKey = trim($settings['app_key'] ?? '');
        $appSecret = trim($settings['app_secret'] ?? '');
        $username = trim($settings['username'] ?? '');
        $password = trim($settings['password'] ?? '');

        if (empty($appKey) || empty($appSecret) || empty($username) || empty($password)) {
            return [
                'success' => false,
                'message' => 'bKash credentials missing: Please provide PGW Username, Password, App Key, and App Secret in Gateway settings.',
            ];
        }

        // Token Caching: bKash id_token is valid for 1 hour (3600s).
        // Reuse cached token from Redis to prevent duplicate API requests and rate limits.
        $cacheKey = "netfix:bkash_id_token:" . md5($appKey . $username . ($isSandbox ? 'sb' : 'live'));
        try {
            if (class_exists('RedisClient')) {
                $redis = RedisClient::getInstance();
                if ($redis && $redis->isConnected()) {
                    $cached = $redis->get($cacheKey);
                    if (!empty($cached)) {
                        return [
                            'success' => true,
                            'token' => $cached,
                            'cached' => true,
                        ];
                    }
                }
            }
        } catch (\Throwable $ignored) {}

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
            $idToken = $res['data']['id_token'];
            try {
                if (isset($redis) && $redis && $redis->isConnected()) {
                    $redis->set($cacheKey, $idToken, 3000);
                }
            } catch (\Throwable $ignored) {}

            return [
                'success' => true,
                'token' => $idToken,
                'refreshToken' => $res['data']['refresh_token'] ?? '',
                'data' => $res['data'],
            ];
        }

        $httpCode = (int)($res['http_code'] ?? 0);
        $statusMsg = $res['data']['statusMessage'] ?? ($res['data']['message'] ?? ($res['data']['errorMessage'] ?? ''));
        $statusCode = $res['data']['statusCode'] ?? '';

        if ($httpCode === 401) {
            $errorMessage = "bKash Auth Failed (HTTP 401): Invalid App Key, App Secret, Username, or Password." . ($statusMsg ? " ({$statusMsg})" : "");
        } else if ($httpCode === 403) {
            $errorMessage = "bKash Access Forbidden (HTTP 403): Your server IP is likely not whitelisted in bKash Merchant Portal firewall. Please request bKash support to whitelist your live server IP.";
        } else if ($httpCode === 503) {
            $rawDetail = $statusMsg ?: (!empty($res['raw']) ? trim(substr(strip_tags($res['raw']), 0, 200)) : 'bKash service is temporarily unavailable or undergoing maintenance');
            $errorMessage = "bKash Live Service Unavailable (HTTP 503): {$rawDetail}";
        } else if ($httpCode === 0 && !empty($res['error'])) {
            $errorMessage = "bKash Connection Failed: " . $res['error'];
        } else {
            $errorMessage = $statusMsg ?: ($res['error'] ?: 'bKash token grant failed');
            if ($statusCode && $statusCode !== '0000') {
                $errorMessage = "[{$statusCode}] " . $errorMessage;
            }
        }

        return [
            'success' => false,
            'message' => $errorMessage,
            'raw' => $res,
        ];
    }

    public static function bkashCreatePayment(array $settings, float $amount, string $invoiceNumber, string $callbackUrl, ?string $payerRef = null): array {
        $tokenRes = self::bkashGrantToken($settings);
        if (!$tokenRes['success']) {
            return $tokenRes;
        }

        $idToken = $tokenRes['token'];
        $isSandbox = self::isSandboxMode($settings);
        $customContextRoot = $settings['api_context_root'] ?? ($settings['credentials']['apiContextRoot'] ?? null);
        $baseUrl = self::bkashBaseUrl($isSandbox, $customContextRoot);
        $url = $baseUrl . '/create';

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'authorization: ' . $idToken,
            'x-app-key: ' . trim($settings['app_key'] ?? ''),
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

        $statusMsg = $res['data']['statusMessage'] ?? ($res['data']['message'] ?? ($res['data']['errorMessage'] ?? ''));
        $statusCode = $res['data']['statusCode'] ?? '';
        $errorMessage = $statusMsg ?: ($res['error'] ?: 'bKash create payment failed');
        if ($statusCode && $statusCode !== '0000') {
            $errorMessage = "[{$statusCode}] " . $errorMessage;
        }

        return [
            'success' => false,
            'message' => $errorMessage,
            'raw' => $res,
        ];
    }

    public static function bkashExecutePayment(array $settings, string $paymentId): array {
        $tokenRes = self::bkashGrantToken($settings);
        if (!$tokenRes['success']) {
            return $tokenRes;
        }

        $idToken = $tokenRes['token'];
        $isSandbox = self::isSandboxMode($settings);
        $customContextRoot = $settings['api_context_root'] ?? ($settings['credentials']['apiContextRoot'] ?? null);
        $baseUrl = self::bkashBaseUrl($isSandbox, $customContextRoot);
        $url = $baseUrl . '/execute';

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'authorization: ' . $idToken,
            'x-app-key: ' . trim($settings['app_key'] ?? ''),
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

        $statusMsg = $res['data']['statusMessage'] ?? ($res['data']['message'] ?? ($res['data']['errorMessage'] ?? ''));
        $errorMessage = $statusMsg ?: ($res['error'] ?: 'bKash payment execution failed');
        if ($statusCode && $statusCode !== '0000') {
            $errorMessage = "[{$statusCode}] " . $errorMessage;
        }

        return [
            'success' => false,
            'message' => $errorMessage,
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

        $isSandbox = self::isSandboxMode($settings);
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
        $intentId = 0;
        try {
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
            $intentId = (int)$db->lastInsertId();
        } catch (\Throwable $e) {
            error_log("Failed to insert payment_intent record: " . $e->getMessage());
        }

        $redirectUrl = null;
        $paymentId = $orderRef;
        $gatewayError = null;

        // Attempt real gateway API
        if ($gw === 'bkash') {
            $bkRes = self::bkashCreatePayment($settings, $amount, $orderRef, $callbackUrl, $custInfo['phone']);
            if ($bkRes['success']) {
                $redirectUrl = $bkRes['bkashURL'];
                $paymentId = $bkRes['paymentID'];
            } else {
                $gatewayError = $bkRes['message'] ?? 'bKash API request failed';
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
            } else {
                $gatewayError = $sslRes['message'] ?? 'SSLCommerz payment initialization failed';
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
            } else {
                $gatewayError = $spRes['message'] ?? 'Shurjopay order creation failed';
            }
        }

        // Update payment ID in intent if changed
        if ($paymentId !== $orderRef && $intentId > 0) {
            try {
                $db->prepare("UPDATE payment_intents SET gateway_payment_id = :gpid WHERE id = :id")
                   ->execute(['gpid' => $paymentId, 'id' => $intentId]);
            } catch (\Throwable $e) {
                error_log("Failed to update payment_intent record: " . $e->getMessage());
            }
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

        // STRICT SANDBOX VS LIVE ENVIRONMENT POLICY:
        // The interactive simulator is strictly restricted to Sandbox mode.
        // For SaaS Admin testing in sandbox mode, fallback to simulator allows end-to-end testing.
        // In Live mode (is_sandbox = 0), simulator is NEVER shown.
        $appEnv = strtolower(getenv('APP_ENV') ?: 'development');
        $isLiveEnvironment = ($appEnv === 'production' || $appEnv === 'live');
        $isAdminTest = (($extra['flow'] ?? '') === 'saas_admin_test');

        if ($isSandbox && (!$isLiveEnvironment || $isAdminTest)) {
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

        // LIVE MODE OR PRODUCTION: Strictly return real gateway error
        return [
            'success' => false,
            'message' => $gatewayError ?: "Payment gateway ({$gw}) connection failed. Please verify API credentials and ensure your server IP is whitelisted by {$gw}.",
            'gateway' => $gw,
            'is_sandbox' => false,
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

            $intentMeta = !empty($intent['metadata']) ? json_decode($intent['metadata'], true) : [];
            if (!is_array($intentMeta)) $intentMeta = [];
            $mergedMeta = array_merge($intentMeta, ['settled' => true, 'raw' => $rawResponse]);

            if ($intent) {
                $customerId = $customerId ?: ($intent['customer_id'] ? (int)$intent['customer_id'] : null);
                $invoiceId = $invoiceId ?: ($intent['invoice_id'] ? (int)$intent['invoice_id'] : null);
                $amount = $amount > 0 ? $amount : (float)$intent['amount'];

                $db->prepare("UPDATE payment_intents SET status = 'completed', metadata = :meta WHERE id = :id")
                   ->execute([
                       'meta' => json_encode($mergedMeta),
                       'id' => $intent['id'],
                   ]);
            }

            // 2. Insert into transactions table
            $transRef = $trxId ?: ('TRX-' . strtoupper($gateway) . '-' . substr(uniqid(), -6));
            $flow = $intentMeta['flow'] ?? '';
            $topupUserId = !empty($intentMeta['user_id']) ? (int)$intentMeta['user_id'] : null;
            $isBalanceTopup = ($flow === 'balance_topup' || ($flow === 'public_topup' && ($intentMeta['type'] ?? '') === 'reseller'));

            $initiatorUid = $topupUserId ?: 0;
            $initiatorRole = $intentMeta['role'] ?? ($topupUserId ? 'reseller' : 'pgw');
            $desc = $isBalanceTopup 
                ? strtoupper($gateway) . " Online Balance Topup (Ref: {$transRef})" 
                : strtoupper($gateway) . " Online Payment (Ref: {$transRef})";

            $stmtTrx = $db->prepare("INSERT INTO transactions 
                (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, description, metadata)
                VALUES (:tid, :cid, :ref, 'GATEWAY_PAYMENT', :amt, :method, :uid, :role, :desc, :meta)");
            $stmtTrx->execute([
                'tid' => $tenantId,
                'cid' => $customerId ?: null,
                'ref' => $transRef,
                'amt' => $amount,
                'method' => $gateway,
                'uid' => $initiatorUid,
                'role' => $initiatorRole,
                'desc' => $desc,
                'meta' => json_encode($mergedMeta),
            ]);
            $transactionId = $db->lastInsertId();

            // 2b. If Balance Topup: Credit Wallet & Reseller Ledger atomically
            if ($isBalanceTopup && $topupUserId) {
                require_once __DIR__ . '/WalletLedgerService.php';
                try {
                    WalletLedgerService::topup(
                        $topupUserId,
                        $topupUserId,
                        $amount,
                        "Online balance topup via {$gateway} (Ref: {$transRef})",
                        $tenantId
                    );
                } catch (\Throwable $wle) {
                    $w = WalletLedgerService::ensureWallet($topupUserId, $tenantId);
                    $newBal = (float)($w['balance'] ?? 0) + $amount;
                    $db->prepare("UPDATE wallets SET balance = :bal, updated_at = NOW() WHERE user_id = :uid")
                       ->execute(['bal' => $newBal, 'uid' => $topupUserId]);
                    $db->prepare("INSERT INTO reseller_ledger (tenant_id, user_id, credit, debit, reference_type, reference_id, notes, created_by)
                        VALUES (:tid, :uid, :amt, 0, 'ONLINE_TOPUP', :ref, :desc, :uid)")
                       ->execute([
                           'tid' => $tenantId,
                           'uid' => $topupUserId,
                           'amt' => $amount,
                           'ref' => $transRef,
                           'desc' => "Online balance topup via {$gateway} (Ref: {$transRef})",
                       ]);
                }
            }

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

                // 4. Double-Entry Multi-Tier Margin Split Disbursement
                $splitResult = null;
                $splitTargetInvId = $invoiceId;

                // If an invoice wasn't explicitly given, check for recently settled pending invoice
                if (!$splitTargetInvId) {
                    $sInv = $db->prepare("SELECT invoice_id FROM invoices 
                        WHERE customer_id = :cid AND tenant_id = :tid AND status = 'paid' 
                          AND updated_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) 
                        ORDER BY invoice_id DESC LIMIT 1");
                    $sInv->execute(['cid' => $customerId, 'tid' => $tenantId]);
                    $splitTargetInvId = $sInv->fetchColumn() ?: null;
                }

                // If still no invoice or if the selected invoice was already split in wallet_ledger, create a new paid invoice
                $needsNewInvoice = false;
                if (!$splitTargetInvId) {
                    $needsNewInvoice = true;
                } else {
                    $stmtCheckSplit = $db->prepare("SELECT 1 FROM wallet_ledger WHERE invoice_id = :inv LIMIT 1");
                    $stmtCheckSplit->execute(['inv' => $splitTargetInvId]);
                    if ($stmtCheckSplit->fetchColumn()) {
                        $needsNewInvoice = true;
                    }
                }

                if ($needsNewInvoice) {
                    $stmtCs = $db->prepare("SELECT cs.customer_service_id, cs.access_profile_id 
                        FROM customer_services cs 
                        WHERE cs.customer_id = :cid AND cs.tenant_id = :tid 
                        ORDER BY cs.customer_service_id DESC LIMIT 1");
                    $stmtCs->execute(['cid' => $customerId, 'tid' => $tenantId]);
                    $csRow = $stmtCs->fetch(PDO::FETCH_ASSOC);

                    $invNum = 'INV-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
                    $stmtNewInv = $db->prepare("INSERT INTO invoices 
                        (tenant_id, customer_id, customer_service_id, invoice_number, invoice_date, due_date, subtotal, total_amount, paid_amount, balance_due, status, payment_method, notes, created_at, updated_at)
                        VALUES 
                        (:tid, :cid, :csid, :invnum, CURDATE(), CURDATE(), :subtotal, :total, :paid, 0.00, 'paid', :pm, :notes, NOW(), NOW())");
                    $stmtNewInv->execute([
                        'tid' => $tenantId,
                        'cid' => $customerId,
                        'csid' => $csRow['customer_service_id'] ?? null,
                        'invnum' => $invNum,
                        'subtotal' => $amount,
                        'total' => $amount,
                        'paid' => $amount,
                        'pm' => $gateway,
                        'notes' => "Online payment via {$gateway} (Txn: {$transRef})",
                    ]);
                    $splitTargetInvId = (int)$db->lastInsertId();
                }

                if ($splitTargetInvId) {
                    try {
                        require_once __DIR__ . '/../services/PaymentSplitService.php';
                        $splitEngine = new PaymentSplitService($db);
                        $splitResult = $splitEngine->processCustomerPayment($splitTargetInvId, $amount, $gateway, [
                            'trx_id' => $transRef,
                            'gateway' => $gateway,
                            'payment_id' => $gatewayPaymentId,
                        ]);
                    } catch (\Throwable $se) {
                        error_log("PaymentSplitService integration notice: " . $se->getMessage());
                    }
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
                'payment_split' => $splitResult,
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

