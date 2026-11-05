<?php
/**
 * Authentication and Tenant Isolation Middleware
 */

require_once __DIR__ . '/JWT.php';
require_once __DIR__ . '/Response.php';
require_once __DIR__ . '/../config/database.php';

class AuthMiddleware {
    private static ?array $currentUser = null;

    public static function getUser(): ?array {
        if (self::$currentUser !== null) {
            return self::$currentUser;
        }

        $token = self::getBearerToken();
        if (!$token) {
            return null;
        }

        $payload = JWT::decode($token);
        if (!$payload || empty($payload['user_id'])) {
            return null;
        }

        $db = Database::getConnection();

        // Check if customer portal subscriber token
        if ((!empty($payload['role_code']) && $payload['role_code'] === 'customer') || (!empty($payload['user_type']) && $payload['user_type'] === 'customer')) {
            $cid = $payload['customer_id'] ?? $payload['user_id'];
            $stmtCust = $db->prepare("SELECT customer_id, tenant_id, customer_code, full_name, email, phone, status FROM customers WHERE customer_id = :id AND status != 'cancelled' LIMIT 1");
            $stmtCust->execute(['id' => $cid]);
            $cust = $stmtCust->fetch();
            if (!$cust) {
                return null;
            }
            $user = [
                'user_id' => (string)$cust['customer_id'],
                'customer_id' => (string)$cust['customer_id'],
                'tenant_id' => (string)$cust['tenant_id'],
                'email' => $cust['email'] ?? ($cust['customer_code'] . '@portal.local'),
                'username' => $cust['customer_code'],
                'first_name' => $cust['full_name'],
                'last_name' => '',
                'phone' => $cust['phone'],
                'status' => $cust['status'],
                'role' => 'customer',
                'role_code' => 'customer',
                'user_type' => 'customer',
                'role_level' => 0,
                'parent_id' => null,
            ];
            self::$currentUser = $user;
            return self::$currentUser;
        }

        $stmt = $db->prepare("SELECT user_id, tenant_id, email, username, first_name, last_name, phone, status, role, role_level, parent_id FROM users WHERE user_id = :id AND status = 'active' LIMIT 1");
        $stmt->execute(['id' => $payload['user_id']]);
        $user = $stmt->fetch();

        if (!$user) {
            return null;
        }

        // Attach impersonation data if present
        if (!empty($payload['impersonated'])) {
            $user['impersonated'] = true;
            $user['impersonated_by'] = $payload['impersonated_by'] ?? null;
            $user['impersonated_by_role'] = $payload['impersonated_by_role'] ?? null;
            $user['impersonated_by_email'] = $payload['impersonated_by_email'] ?? null;
        }

        self::$currentUser = $user;
        return self::$currentUser;
    }

    public static function requireAuth(): array {
        $user = self::getUser();
        if (!$user) {
            Response::json([
                'success' => false,
                'statusCode' => 401,
                'message' => 'Unauthorized: Invalid or expired token',
            ], 401);
        }
        return $user;
    }

    public static function getTenantId(): ?string {
        $user = self::getUser();
        
        // 1. Strict Tenant User Isolation:
        // If an authenticated user belongs to an ISP/tenant (role is NOT saas_admin),
        // their tenant_id is STRICTLY derived from their database record.
        // They can NEVER switch to, view, or modify another tenant's resources!
        if ($user && $user['role'] !== 'saas_admin') {
            if (!empty($user['tenant_id'])) {
                return (string)$user['tenant_id'];
            }
            return null;
        }

        // 2. SaaS Super Admin context switching:
        // SaaS Super Admin can view/manage specific tenants via query param or header
        if ($user && $user['role'] === 'saas_admin') {
            if (isset($_GET['tenant_id']) && !empty($_GET['tenant_id']) && $_GET['tenant_id'] !== 'all') {
                return (string)$_GET['tenant_id'];
            }
            $headers = function_exists('getallheaders') ? getallheaders() : [];
            $headerTid = $headers['X-Tenant-Id'] ?? $headers['x-tenant-id'] ?? $_SERVER['HTTP_X_TENANT_ID'] ?? null;
            if (!empty($headerTid) && $headerTid !== 'all') {
                return (string)$headerTid;
            }
            return null; // Global / all tenants in SaaS view
        }

        // 3. Unauthenticated public requests (e.g. public topup / balance lookup):
        // Allow explicit tenant_id from query ONLY if provided
        if (isset($_GET['tenant_id']) && !empty($_GET['tenant_id']) && $_GET['tenant_id'] !== 'all') {
            return (string)$_GET['tenant_id'];
        }

        return null;
    }

    private static function getBearerToken(): ?string {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        if (empty($headers) && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
        }

        $authHeader = $headers['Authorization'] 
            ?? $headers['authorization'] 
            ?? $_SERVER['HTTP_AUTHORIZATION'] 
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] 
            ?? $_SERVER['AUTHORIZATION'] 
            ?? '';

        if (!empty($authHeader) && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            return $matches[1];
        }

        if (!empty($_COOKIE['access_token'])) {
            return $_COOKIE['access_token'];
        }

        if (!empty($_GET['access_token'])) {
            return $_GET['access_token'];
        }

        return null;
    }
}

