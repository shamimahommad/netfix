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
        
        // 1. Query parameter override (for SaaS Super Admin context switching)
        if (isset($_GET['tenant_id']) && !empty($_GET['tenant_id'])) {
            if (!$user || $user['role'] === 'saas_admin') {
                return (string)$_GET['tenant_id'];
            }
        }

        // 2. User's associated tenant_id
        if ($user && !empty($user['tenant_id'])) {
            return (string)$user['tenant_id'];
        }

        // 3. Header fallback
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        if (!empty($headers['X-Tenant-Id'])) {
            return (string)$headers['X-Tenant-Id'];
        }
        if (!empty($headers['x-tenant-id'])) {
            return (string)$headers['x-tenant-id'];
        }

        // 4. Default tenant fallback
        return '2';
    }

    private static function getBearerToken(): ?string {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';

        if (!empty($authHeader) && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            return $matches[1];
        }

        if (!empty($_COOKIE['access_token'])) {
            return $_COOKIE['access_token'];
        }

        return null;
    }
}

