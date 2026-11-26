<?php
/**
 * NetFix ISP SaaS - Authentication Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/JWT.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/RateLimiter.php';
require_once __DIR__ . '/../lib/TokenRevocationService.php';

class AuthController {
    private const ACCESS_TOKEN_TTL = 900;     // 15 minutes
    private const REFRESH_TOKEN_TTL = 604800; // 7 days

    private static function isHttpsRequest(): bool {
        return (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https')
            || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (!empty($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443);
    }

    private static function issueSessionCookies(array $payload, bool $isCustomer = false): void {
        $accessToken = JWT::encode($payload, self::ACCESS_TOKEN_TTL);
        $refreshToken = bin2hex(random_bytes(32));
        TokenRevocationService::storeRefreshToken($refreshToken, [
            'payload' => $payload,
            'is_customer' => $isCustomer,
        ], self::REFRESH_TOKEN_TTL);

        $secure = self::isHttpsRequest();
        setcookie('access_token', $accessToken, [
            'expires' => time() + self::ACCESS_TOKEN_TTL,
            'path' => '/',
            'httponly' => true,
            'secure' => $secure,
            'samesite' => 'Lax',
        ]);
        setcookie('refresh_token', $refreshToken, [
            'expires' => time() + self::REFRESH_TOKEN_TTL,
            'path' => '/',
            'httponly' => true,
            'secure' => $secure,
            'samesite' => 'Lax',
        ]);
    }

    private static function clearSessionCookies(): void {
        $secure = self::isHttpsRequest();
        setcookie('access_token', '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'secure' => $secure,
            'samesite' => 'Lax',
        ]);
        setcookie('refresh_token', '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'secure' => $secure,
            'samesite' => 'Lax',
        ]);
    }

    public static function refresh(): void {
        RateLimiter::enforce('auth_refresh', RateLimiter::getClientIp(), 30, 300);

        $refreshToken = trim((string)($_COOKIE['refresh_token'] ?? ''));
        if ($refreshToken === '') {
            self::clearSessionCookies();
            Response::error('Refresh token missing', 401);
        }

        $record = TokenRevocationService::consumeRefreshToken($refreshToken);
        if (!$record || empty($record['payload']) || empty($record['payload']['user_id'])) {
            self::clearSessionCookies();
            Response::error('Invalid or expired refresh token', 401);
        }

        $payload = $record['payload'];
        $isCustomer = !empty($record['is_customer']) || (($payload['user_type'] ?? '') === 'customer');
        $db = Database::getConnection();

        if ($isCustomer) {
            $cid = $payload['customer_id'] ?? $payload['user_id'];
            $stmt = $db->prepare("SELECT customer_id FROM customers WHERE customer_id = :id AND status != 'cancelled' LIMIT 1");
            $stmt->execute(['id' => $cid]);
            if (!$stmt->fetch()) {
                self::clearSessionCookies();
                Response::error('Account inactive', 401);
            }
        } else {
            $stmt = $db->prepare("SELECT user_id FROM users WHERE user_id = :id AND status = 'active' LIMIT 1");
            $stmt->execute(['id' => $payload['user_id']]);
            if (!$stmt->fetch()) {
                self::clearSessionCookies();
                Response::error('Account inactive', 401);
            }
        }

        // Rotate refresh & access tokens cleanly
        self::issueSessionCookies($payload, $isCustomer);

        Response::json([
            'success' => true,
            'authenticated' => true,
        ]);
    }

    public static function logout(): void {
        $accessToken = AuthMiddleware::getRequestToken();
        if ($accessToken) {
            $payload = JWT::decode($accessToken);
            if ($payload && !empty($payload['jti']) && !empty($payload['exp'])) {
                $ttl = max(1, (int)$payload['exp'] - time());
                TokenRevocationService::revokeJti((string)$payload['jti'], $ttl);
            }
        }

        $refreshToken = trim((string)($_COOKIE['refresh_token'] ?? ''));
        if ($refreshToken !== '') {
            TokenRevocationService::revokeRefreshToken($refreshToken);
        }

        self::clearSessionCookies();

        Response::json([
            'success' => true,
            'message' => 'Logged out successfully',
        ]);
    }

    public static function login(): void {
        RateLimiter::enforce('auth_login_ip', RateLimiter::getClientIp(), 20, 300);

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $login = trim($data['login'] ?? $data['email'] ?? $data['username'] ?? '');
        $password = (string)($data['password'] ?? '');

        if (empty($login) || empty($password)) {
            Response::error('Email/username and password are required', 400);
        }

        RateLimiter::enforce('auth_login_acct', RateLimiter::getClientIp() . ':' . strtolower($login), 10, 300);

        try {
            $db = Database::getConnection();
            $stmt = $db->prepare("SELECT * FROM users WHERE (LOWER(email) = LOWER(:login1) OR LOWER(username) = LOWER(:login2)) LIMIT 1");
            $stmt->execute(['login1' => $login, 'login2' => $login]);
            $user = $stmt->fetch();
        } catch (Throwable $e) {
            error_log("AuthController error: " . $e->getMessage());
            Response::error('Service temporarily unavailable. Please try again later.', 500);
        }

        if (!$user) {
            try {
                require_once __DIR__ . '/../lib/ActivityLogger.php';
                ActivityLogger::log([
                    'tenant_id' => 1,
                    'user_id' => null,
                    'log_type' => 'security',
                    'action' => 'failed_login',
                    'module' => 'auth',
                    'description' => "Failed login attempt for unknown identifier '{$login}'",
                    'metadata' => ['portal' => 'web', 'login' => $login],
                ]);
            } catch (Throwable $ignored) {}
            Response::error('Invalid login credentials', 401);
        }

        // Check account active status
        if (($user['status'] ?? 'active') !== 'active') {
            Response::error('This account is ' . htmlspecialchars($user['status']) . '. Please contact your administrator.', 403);
        }

        // Verify password strictly against bcrypt/argon2 hash (no plaintext or demo fallbacks)
        if (empty($user['password_hash']) || !password_verify($password, (string)$user['password_hash'])) {
            try {
                require_once __DIR__ . '/../lib/ActivityLogger.php';
                ActivityLogger::log([
                    'tenant_id' => $user['tenant_id'] ? (int)$user['tenant_id'] : 1,
                    'user_id' => (int)$user['user_id'],
                    'log_type' => 'security',
                    'action' => 'failed_login',
                    'module' => 'auth',
                    'description' => "Failed login attempt (wrong password) for user {$user['username']}",
                    'metadata' => ['portal' => 'web', 'login' => $login],
                ]);
            } catch (Throwable $ignored) {}
            Response::error('Invalid login credentials', 401);
        }

        // Determine user_type
        $userType = 'isp';
        if ($user['role'] === 'saas_admin' || empty($user['tenant_id'])) {
            $userType = 'saas';
        }

        $payload = [
            'user_id' => (string)$user['user_id'],
            'email' => $user['email'],
            'role_code' => $user['role'],
            'tenant_id' => $user['tenant_id'] ? (string)$user['tenant_id'] : null,
            'user_type' => $userType,
        ];

        self::issueSessionCookies($payload, false);

        // Update last login
        try {
            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            $update = $db->prepare("UPDATE users SET last_login_at = NOW(), last_login_ip = :ip WHERE user_id = :id");
            $update->execute([
                'ip' => $ip,
                'id' => $user['user_id'],
            ]);

            // Record in login_logs
            $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
            $browser = 'Chrome';
            if (str_contains($ua, 'Edg')) $browser = 'Edge';
            elseif (str_contains($ua, 'Firefox')) $browser = 'Firefox';
            elseif (str_contains($ua, 'Safari') && !str_contains($ua, 'Chrome')) $browser = 'Safari';
            elseif (str_contains($ua, 'Opera') || str_contains($ua, 'OPR')) $browser = 'Opera';

            $os = 'Windows';
            if (str_contains($ua, 'Macintosh') || str_contains($ua, 'Mac OS')) $os = 'macOS';
            elseif (str_contains($ua, 'Android')) $os = 'Android';
            elseif (str_contains($ua, 'iPhone') || str_contains($ua, 'iPad')) $os = 'iOS';
            elseif (str_contains($ua, 'Linux')) $os = 'Linux';

            $stmtLog = $db->prepare("INSERT INTO login_logs (user_id, ip, browser, os, method, created_at) VALUES (:uid, :ip, :browser, :os, 'web', NOW())");
            $stmtLog->execute([
                'uid' => $user['user_id'],
                'ip' => $ip,
                'browser' => $browser,
                'os' => $os,
            ]);

            require_once __DIR__ . '/../lib/ActivityLogger.php';
            ActivityLogger::log([
                'tenant_id' => $user['tenant_id'] ?? 1,
                'user_id' => $user['user_id'],
                'log_type' => 'login',
                'action' => 'user_login',
                'module' => 'auth',
                'description' => "User {$user['username']} logged in via web portal",
                'ip_address' => $ip,
                'browser' => $browser,
                'platform' => $os,
            ]);
        } catch (Throwable $e) {}

        // Resolve assigned server and permissions for user
        require_once __DIR__ . '/../lib/HierarchySecurityService.php';
        $assignedServer = null;
        if ($userType !== 'saas' && !in_array(strtolower($user['role'] ?? ''), ['admin', 'isp_admin', 'manager', 'saas_admin'], true)) {
            $assignedServer = HierarchySecurityService::getAssignedServer((int)$user['user_id']);
        }

        $permCodesStmt = $db->query("SELECT permission_code FROM permissions");
        $allPermCodes = $permCodesStmt ? $permCodesStmt->fetchAll(PDO::FETCH_COLUMN) : [];
        $permissions = [];
        foreach ($allPermCodes as $pCode) {
            $permissions[$pCode] = HierarchySecurityService::hasPermission((int)$user['user_id'], $pCode);
        }

        Response::json([
            'authenticated' => true,
            'user' => [
                'user_id' => (string)$user['user_id'],
                'email' => $user['email'],
                'first_name' => $user['first_name'],
                'last_name' => $user['last_name'],
                'tenant_id' => $user['tenant_id'] ? (string)$user['tenant_id'] : null,
                'user_type' => $userType,
                'role_code' => $user['role'],
                'assigned_server_id' => $assignedServer ? $assignedServer['id'] : null,
                'assigned_server_name' => $assignedServer ? $assignedServer['name'] : null,
                'permissions' => $permissions,
            ],
            'redirect_url' => $userType === 'saas' ? '/saas/dashboard' : '/dashboard',
        ]);
    }

    public static function customerLogin(): void {
        RateLimiter::enforce('cust_login_ip', RateLimiter::getClientIp(), 20, 300);

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $login = trim($data['login'] ?? '');
        $phone = trim($data['phone'] ?? $data['password'] ?? '');

        if (empty($login) || empty($phone)) {
            Response::error('Customer ID/email and mobile number or password are required', 400);
        }

        RateLimiter::enforce('cust_login_acct', RateLimiter::getClientIp() . ':' . strtolower($login), 10, 300);

        $db = Database::getConnection();
        // Support login by customer_code, email, phone, OR PPPoE username
        $stmt = $db->prepare("
            SELECT c.*, na.username as pppoe_username, na.password as pppoe_password 
            FROM customers c
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            WHERE (c.customer_code = :l1 OR c.email = :l2 OR c.phone = :l3 OR na.username = :l4) 
              AND c.status != 'cancelled' 
            LIMIT 1
        ");
        $stmt->execute([
            'l1' => $login,
            'l2' => $login,
            'l3' => $login,
            'l4' => $login,
        ]);
        $customer = $stmt->fetch();

        if (!$customer) {
            try {
                require_once __DIR__ . '/../lib/ActivityLogger.php';
                ActivityLogger::log([
                    'tenant_id' => 1,
                    'user_id' => null,
                    'log_type' => 'security',
                    'action' => 'failed_login',
                    'module' => 'auth',
                    'description' => "Failed customer portal login for unknown identifier '{$login}'",
                    'metadata' => ['portal' => 'customer', 'login' => $login],
                ]);
            } catch (Throwable $ignored) {}
            Response::error('Customer not found with provided credentials', 401);
        }

        // Credentials check:
        // 1. Phone number (last 10 digits match)
        // 2. PPPoE network password match (constant-time comparison)
        $cleanInputPhone = preg_replace('/[^\d]/', '', $phone);
        $cleanDbPhone = preg_replace('/[^\d]/', '', $customer['phone'] ?? '');
        $isPhoneMatch = strlen($cleanInputPhone) >= 10 && strlen($cleanDbPhone) >= 10 && hash_equals(substr($cleanDbPhone, -10), substr($cleanInputPhone, -10));
        $pppoePass = (string)($customer['pppoe_password'] ?? '');
        $isPppoePasswordMatch = $pppoePass !== '' && hash_equals($pppoePass, $phone);

        if (!$isPhoneMatch && !$isPppoePasswordMatch) {
            try {
                require_once __DIR__ . '/../lib/ActivityLogger.php';
                ActivityLogger::log([
                    'tenant_id' => (int)($customer['tenant_id'] ?? 1),
                    'user_id' => null,
                    'log_type' => 'security',
                    'action' => 'failed_login',
                    'module' => 'auth',
                    'target_id' => (string)$customer['customer_id'],
                    'target_type' => 'customer',
                    'description' => "Failed customer portal login (wrong credential) for {$customer['customer_code']}",
                    'metadata' => ['portal' => 'customer', 'login' => $login],
                ]);
            } catch (Throwable $ignored) {}
            Response::error('Invalid mobile number or password', 401);
        }

        $payload = [
            'user_id' => (string)$customer['customer_id'],
            'customer_id' => (string)$customer['customer_id'],
            'email' => $customer['email'] ?? ($customer['customer_code'] . '@portal.local'),
            'role_code' => 'customer',
            'tenant_id' => (string)$customer['tenant_id'],
            'user_type' => 'customer',
        ];

        self::issueSessionCookies($payload, true);

        // Fetch company / tenant profile for customer branding
        $tenantId = (int)$customer['tenant_id'];
        $stmtTenant = $db->prepare("SELECT tenant_id, tenant_code, tenant_name, business_email, business_phone, support_phone, business_address, logo_url FROM tenants WHERE tenant_id = :tid LIMIT 1");
        $stmtTenant->execute(['tid' => $tenantId]);
        $tenant = $stmtTenant->fetch();

        $companyInfo = [
            'tenantId' => (string)($tenant['tenant_id'] ?? $tenantId),
            'name' => $tenant['tenant_name'] ?: 'Broadband ISP',
            'logoUrl' => !empty($tenant['logo_url']) ? $tenant['logo_url'] : null,
            'supportPhone' => $tenant['support_phone'] ?: ($tenant['business_phone'] ?: null),
            'email' => $tenant['business_email'] ?: null,
        ];

        Response::json([
            'authenticated' => true,
            'user' => [
                'user_id' => (string)$customer['customer_id'],
                'email' => $customer['email'] ?? ($customer['customer_code'] . '@customer.local'),
                'first_name' => $customer['full_name'],
                'last_name' => '',
                'tenant_id' => (string)$customer['tenant_id'],
                'user_type' => 'customer',
                'role_code' => 'customer',
                'company' => $companyInfo,
            ],
            'company' => $companyInfo,
            'redirect_url' => '/customer/dashboard',
        ]);
    }

    public static function me(): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        // Calculate balance from wallets table (primary) or reseller_ledger with auto self-healing
        $balance = 0.00;
        if (!empty($user['user_id'])) {
            $uid = (int)$user['user_id'];
            $stmt = $db->prepare("SELECT balance FROM wallets WHERE user_id = :uid LIMIT 1");
            $stmt->execute(['uid' => $uid]);
            $wBal = $stmt->fetchColumn();
            $stmt->closeCursor();

            $stmtLedger = $db->prepare("SELECT COALESCE(SUM(credit - debit), 0) as balance FROM reseller_ledger WHERE user_id = :uid");
            $stmtLedger->execute(['uid' => $uid]);
            $lBal = (float)($stmtLedger->fetchColumn() ?: 0.00);

            if ($wBal !== false) {
                $walletBal = (float)$wBal;
                // If wallet is at 0.00 but ledger has credit, heal wallet to match
                if ($walletBal == 0.00 && $lBal != 0.00) {
                    $balance = $lBal;
                    $db->prepare("UPDATE wallets SET balance = :bal, updated_at = NOW() WHERE user_id = :uid")
                       ->execute(['bal' => $balance, 'uid' => $uid]);
                } else {
                    $balance = $walletBal;
                }
            } else {
                $balance = $lBal;
                require_once __DIR__ . '/../lib/WalletLedgerService.php';
                WalletLedgerService::ensureWallet($uid, (int)($user['tenant_id'] ?? 1));
                $db->prepare("UPDATE wallets SET balance = :bal, updated_at = NOW() WHERE user_id = :uid")
                   ->execute(['bal' => $balance, 'uid' => $uid]);
            }
        }

        $userType = 'isp';
        if ($user['role'] === 'saas_admin' || empty($user['tenant_id'])) {
            $userType = 'saas';
        } elseif ($user['role'] === 'customer') {
            $userType = 'customer';
        }

        require_once __DIR__ . '/../lib/HierarchySecurityService.php';
        $uid = (int)$user['user_id'];
        $role = $user['role'] ?? '';
        $level = HierarchySecurityService::getHierarchyLevel($role);

        // Fetch all granular action permissions from permissions table
        $permCodesStmt = $db->query("SELECT permission_code FROM permissions");
        $allPermCodes = $permCodesStmt ? $permCodesStmt->fetchAll(PDO::FETCH_COLUMN) : [];
        if (empty($allPermCodes)) {
            $allPermCodes = [
                'can_create_customer',
                'can_edit_customer',
                'can_delete_customer',
                'can_view_invoice',
                'can_recharge',
                'can_partial_renew',
                'can_manage_sub_tier',
                'can_assign_package',
                'can_transfer_balance'
            ];
        }
        $permissions = [];
        foreach ($allPermCodes as $pCode) {
            $permissions[$pCode] = HierarchySecurityService::hasPermission($uid, $pCode);
        }

        // Fetch hierarchy_path and parent_id
        $hStmt = $db->prepare("SELECT hierarchy_path, parent_id FROM users WHERE user_id = :uid LIMIT 1");
        $hStmt->execute(['uid' => $uid]);
        $hRow = $hStmt->fetch(PDO::FETCH_ASSOC);
        $hStmt->closeCursor();

        $tenantId = $user['tenant_id'] ? (string)$user['tenant_id'] : null;
        $tenantName = null;
        $tenantLogo = null;
        if ($tenantId) {
            $tStmt = $db->prepare("SELECT tenant_name, logo_url FROM tenants WHERE tenant_id = :tid LIMIT 1");
            $tStmt->execute(['tid' => $tenantId]);
            $tRow = $tStmt->fetch(PDO::FETCH_ASSOC);
            if ($tRow) {
                $tenantName = $tRow['tenant_name'];
                $tenantLogo = $tRow['logo_url'];
            }
        }

        // Resolve assigned server for non-admin downlines
        $assignedServer = null;
        if ($level > 0) {
            $assignedServer = HierarchySecurityService::getAssignedServer($uid);
        }

        Response::json([
            'user_id' => (string)$user['user_id'],
            'tenant_id' => $tenantId,
            'tenant_name' => $tenantName,
            'tenant_logo' => $tenantLogo,
            'user_type' => $userType,
            'role_code' => $user['role'],
            'role' => $user['role'],
            'role_level' => (int)($user['role_level'] ?? 100),
            'hierarchy_level' => $level,
            'hierarchy_path' => $hRow['hierarchy_path'] ?? "/{$uid}/",
            'parent_id' => $hRow['parent_id'] ?? null,
            'balance' => $balance,
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'email' => $user['email'],
            'username' => $user['username'] ?? '',
            'assigned_server_id' => $assignedServer ? $assignedServer['id'] : null,
            'assigned_server_name' => $assignedServer ? $assignedServer['name'] : null,
            'permissions' => $permissions,
            'impersonated' => !empty($user['impersonated']),
            'impersonated_by' => $user['impersonated_by'] ?? null,
            'impersonated_by_role' => $user['impersonated_by_role'] ?? null,
            'impersonated_by_email' => $user['impersonated_by_email'] ?? null,
        ]);
    }

    public static function updateProfile(): void {
        $user = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $db = Database::getConnection();

        $userId = $user['user_id'];
        $firstName = trim($data['first_name'] ?? $data['firstName'] ?? '');
        $lastName = trim($data['last_name'] ?? $data['lastName'] ?? '');
        $fullName = trim($data['full_name'] ?? $data['fullName'] ?? $data['name'] ?? '');

        if (!empty($fullName) && empty($firstName) && empty($lastName)) {
            $parts = explode(' ', $fullName, 2);
            $firstName = $parts[0];
            $lastName = $parts[1] ?? '';
        }

        if (empty($firstName)) {
            Response::error('First name or full name is required', 400);
        }

        $email = isset($data['email']) ? trim($data['email']) : null;
        $phone = isset($data['phone']) ? trim($data['phone']) : null;

        // If email is changing, ensure uniqueness
        if (!empty($email) && $email !== $user['email']) {
            $checkStmt = $db->prepare("SELECT user_id FROM users WHERE email = :email AND user_id != :uid LIMIT 1");
            $checkStmt->execute(['email' => $email, 'uid' => $userId]);
            if ($checkStmt->fetch()) {
                Response::error('Email is already registered by another user', 409);
            }
        }

        $fields = ["first_name = :fn", "last_name = :ln"];
        $params = [
            'fn' => $firstName,
            'ln' => $lastName,
            'uid' => $userId,
        ];

        if ($email !== null) {
            $fields[] = "email = :email";
            $params['email'] = $email;
        }
        if ($phone !== null) {
            $fields[] = "phone = :phone";
            $params['phone'] = $phone;
        }

        $sql = "UPDATE users SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE user_id = :uid";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        // Fetch refreshed user
        $fetchStmt = $db->prepare("SELECT user_id, tenant_id, email, username, first_name, last_name, phone, role FROM users WHERE user_id = :uid LIMIT 1");
        $fetchStmt->execute(['uid' => $userId]);
        $updatedUser = $fetchStmt->fetch();

        Response::json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'user' => [
                'user_id' => (string)$updatedUser['user_id'],
                'tenant_id' => $updatedUser['tenant_id'] ? (string)$updatedUser['tenant_id'] : null,
                'email' => $updatedUser['email'],
                'username' => $updatedUser['username'],
                'first_name' => $updatedUser['first_name'],
                'last_name' => $updatedUser['last_name'],
                'phone' => $updatedUser['phone'],
                'role_code' => $updatedUser['role'],
            ]
        ]);
    }

    public static function changePassword(): void {
        $user = AuthMiddleware::requireAuth();
        RateLimiter::enforce('auth_change_pw', (string)$user['user_id'], 5, 300);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $currentPassword = (string)($data['current_password'] ?? '');
        $newPassword = (string)($data['new_password'] ?? '');

        if (empty($newPassword) || strlen($newPassword) < 8) {
            Response::error('New password must be at least 8 characters long', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT password_hash FROM users WHERE user_id = :id LIMIT 1");
        $stmt->execute(['id' => $user['user_id']]);
        $row = $stmt->fetch();

        if (!$row) {
            Response::error('User not found', 404);
        }

        if (empty($row['password_hash']) || !password_verify($currentPassword, (string)$row['password_hash'])) {
            Response::error('Current password is incorrect', 400);
        }

        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        $update = $db->prepare("UPDATE users SET password_hash = :hash, password_changed_at = NOW(), updated_at = NOW() WHERE user_id = :id");
        $update->execute(['hash' => $hash, 'id' => $user['user_id']]);

        Response::json([
            'success' => true,
            'message' => 'Password updated successfully',
        ]);
    }

    public static function canImpersonate(string $targetUserId): void {
        $user = AuthMiddleware::requireAuth();
        require_once __DIR__ . '/../lib/HierarchySecurityService.php';
        $allowed = HierarchySecurityService::canImpersonateUser($user, (int)$targetUserId);
        Response::json(['allowed' => $allowed]);
    }

    public static function canImpersonateBatch(): void {
        $user = AuthMiddleware::requireAuth();
        require_once __DIR__ . '/../lib/HierarchySecurityService.php';

        $rawIds = $_GET['ids'] ?? '';
        if (empty($rawIds)) {
            Response::json(['allowed' => (object)[]]);
            return;
        }

        $idList = array_filter(array_map('trim', explode(',', (string)$rawIds)));
        $allowedMap = [];

        foreach ($idList as $idStr) {
            $tId = (int)$idStr;
            if ($tId > 0) {
                $allowedMap[(string)$tId] = HierarchySecurityService::canImpersonateUser($user, $tId);
            }
        }

        Response::json(['allowed' => (object)$allowedMap]);
    }

    public static function impersonate(string $targetUserId): void {
        $currentUser = AuthMiddleware::requireAuth();
        $targetId = (int)$targetUserId;

        if (!empty($currentUser['impersonated'])) {
            Response::error('Cannot switch accounts while currently impersonating. Please exit impersonation first.', 400);
        }

        require_once __DIR__ . '/../lib/HierarchySecurityService.php';
        if (!HierarchySecurityService::canImpersonateUser($currentUser, $targetId)) {
            Response::error('Permission denied to impersonate this user', 403);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT * FROM users WHERE user_id = :id AND status = 'active' LIMIT 1");
        $stmt->execute(['id' => $targetId]);
        $targetUser = $stmt->fetch();

        if (!$targetUser) {
            Response::error('Target user not found or is inactive', 404);
        }

        $userType = $targetUser['tenant_id'] ? 'isp' : 'saas';
        $payload = [
            'user_id' => (string)$targetUser['user_id'],
            'email' => $targetUser['email'],
            'role_code' => $targetUser['role'],
            'tenant_id' => $targetUser['tenant_id'] ? (string)$targetUser['tenant_id'] : null,
            'user_type' => $userType,
            'impersonated' => true,
            'impersonated_by' => (string)$currentUser['user_id'],
            'impersonated_by_role' => $currentUser['role'],
            'impersonated_by_email' => $currentUser['email'],
        ];

        self::issueSessionCookies($payload, false);

        Response::json([
            'authenticated' => true,
            'redirect_url' => '/dashboard',
        ]);
    }

    public static function exitImpersonate(): void {
        $currentUser = AuthMiddleware::requireAuth();
        if (empty($currentUser['impersonated']) || empty($currentUser['impersonated_by'])) {
            Response::error('Not currently impersonating', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT * FROM users WHERE user_id = :id LIMIT 1");
        $stmt->execute(['id' => $currentUser['impersonated_by']]);
        $originalUser = $stmt->fetch();

        if (!$originalUser) {
            Response::error('Original user not found', 404);
        }

        $userType = $originalUser['tenant_id'] ? 'isp' : 'saas';
        $payload = [
            'user_id' => (string)$originalUser['user_id'],
            'email' => $originalUser['email'],
            'role_code' => $originalUser['role'],
            'tenant_id' => $originalUser['tenant_id'] ? (string)$originalUser['tenant_id'] : null,
            'user_type' => $userType,
        ];

        self::issueSessionCookies($payload, false);

        Response::json([
            'authenticated' => true,
            'redirect_url' => $userType === 'saas' ? '/saas/dashboard' : '/dashboard',
        ]);
    }
}
