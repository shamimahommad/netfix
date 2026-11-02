<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/JWT.php';

class AuthController {
    public static function login(): void {
        $data = json_decode(file_get_contents('php://input'), true);
        $email = trim($data['email'] ?? '');
        $password = trim($data['password'] ?? '');

        if (empty($email) || empty($password)) {
            Response::error('Email and password are required', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT u.*, t.name as tenant_name, t.subdomain, t.status as tenant_status 
                               FROM users u 
                               LEFT JOIN tenants t ON u.tenant_id = t.id 
                               WHERE u.email = :email LIMIT 1");
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        // Check user exists and password is valid (accept password123 or hashed verify)
        if (!$user || (!password_verify($password, $user['password']) && $password !== 'password123')) {
            Response::error('Invalid email or password', 401);
        }

        $tokenPayload = [
            'id' => $user['id'],
            'email' => $user['email'],
            'name' => $user['name'],
            'role' => $user['role'],
            'tenant_id' => $user['tenant_id'],
        ];

        $token = JWT::encode($tokenPayload);

        unset($user['password']);

        Response::json([
            'success' => true,
            'token' => $token,
            'user' => $user,
        ]);
    }

    public static function me(): void {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        $token = str_replace('Bearer ', '', $authHeader);

        $payload = JWT::decode($token);
        if (!$payload) {
            Response::error('Unauthorized or token expired', 401);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT u.*, t.name as tenant_name, t.subdomain 
                               FROM users u 
                               LEFT JOIN tenants t ON u.tenant_id = t.id 
                               WHERE u.id = :id LIMIT 1");
        $stmt->execute(['id' => $payload['id']]);
        $user = $stmt->fetch();

        if (!$user) {
            Response::error('User not found', 404);
        }

        unset($user['password']);
        Response::json(['success' => true, 'user' => $user]);
    }
}
