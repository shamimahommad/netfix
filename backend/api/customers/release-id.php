<?php
/**
 * NetFix ISP SaaS - Raw PHP Endpoint: Release Reserved Customer ID
 * POST /api/customers/release-id.php
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
if (($user['role'] ?? '') === 'customer' || ($user['user_type'] ?? '') === 'customer') {
    Response::error('Forbidden', 403);
}
$tenantId = (int)(AuthMiddleware::getTenantId() ?: 0);

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data && !empty($_POST)) {
    $data = $_POST;
}

$code = trim($data['customer_code'] ?? $data['customerCode'] ?? $_GET['customer_code'] ?? '');
$token = trim($data['lease_token'] ?? $data['session_token'] ?? $data['token'] ?? $_GET['lease_token'] ?? '');

if (empty($code) || empty($token)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'customer_code and lease_token are required to release']);
    exit;
}

$db = Database::getConnection();
if (($user['role'] ?? '') !== 'saas_admin' && $tenantId > 0) {
    $stmtOwn = $db->prepare("SELECT tenant_id FROM customer_id_reservations WHERE customer_code = :code AND lease_token = :tok LIMIT 1");
    $stmtOwn->execute(['code' => $code, 'tok' => $token]);
    $resTid = $stmtOwn->fetchColumn();
    if ($resTid !== false && (int)$resTid !== $tenantId) {
        Response::error('Forbidden', 403);
    }
}
$released = CustomerIdReservationService::release($db, $code, $token);

echo json_encode([
    'success' => true,
    'message' => $released ? 'Reservation released successfully' : 'No active reservation found or already released',
]);

