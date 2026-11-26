<?php
/**
 * NetFix ISP SaaS - Raw PHP Endpoint: Reserve Customer ID
 * POST /api/customers/reserve-id.php
 */

require_once __DIR__ . '/../../config/cors.php';
handleCors();
header('Content-Type: application/json; charset=utf-8');

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
    error_log('reserve-id.php fallback: ' . $e->getMessage());
    require_once __DIR__ . '/../../lib/TenantSequenceService.php';
    $fallbackCode = TenantSequenceService::peekNextCode($db, (string)$tenantId, 'customer', 6);
    echo json_encode([
        'success' => true,
        'customer_code' => $fallbackCode,
        'lease_token' => $sessionToken ?: ('fallback_' . time()),
        'expires_in' => 900,
        'fallback' => true,
    ]);
}

