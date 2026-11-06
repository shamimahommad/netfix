<?php
/**
 * NetFix ISP SaaS - Raw PHP Endpoint: Release Reserved Customer ID
 * POST /api/customers/release-id.php
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
require_once __DIR__ . '/../../lib/CustomerIdReservationService.php';

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
$released = CustomerIdReservationService::release($db, $code, $token);

echo json_encode([
    'success' => true,
    'message' => $released ? 'Reservation released successfully' : 'No active reservation found or already released',
]);

