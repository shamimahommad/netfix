<?php
/**
 * NetFix ISP SaaS - Raw PHP Endpoint: Reserve Customer ID
 * POST /api/customers/reserve-id.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/CustomerIdReservationService.php';
require_once __DIR__ . '/../../lib/Response.php';

$user = AuthMiddleware::requireAuth();
$tenantId = AuthMiddleware::getTenantId() ?: 0;
$db = Database::getConnection();

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?: $_POST;
$sessionToken = trim($data['session_token'] ?? $data['lease_token'] ?? '');

try {
    $result = CustomerIdReservationService::reserve(
        $db,
        (int)$tenantId,
        (int)($user['user_id'] ?? 0),
        !empty($sessionToken) ? $sessionToken : null
    );

    echo json_encode($result);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

