<?php
/**
 * NetFix ISP SaaS - MikroTik Syslog Setup Script Generator
 * Endpoint: GET /api/routers/syslog_setup_script.php?router_id={id}
 *
 * Generates ready-to-copy RouterOS CLI commands pre-filled with:
 *  - SaaS Server Public IP & Port (UDP 514 / 5514)
 *  - Unique Router Prefix Token ([RTR_x_y_z]:) for NAT traversal & tenant isolation
 *  - Proper logging topics (pppoe, account, info, error)
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/Response.php';

try {
    $user = AuthMiddleware::requireAuth();
    $tenantId = AuthMiddleware::getTenantId();
    $role = strtolower(trim($user['role'] ?? ''));
    if (!in_array($role, ['saas_admin', 'admin', 'manager', 'isp_admin', 'tenant_admin', 'super_admin'], true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied: Admin permissions required to view router setup script']);
        exit;
    }
} catch (\Throwable $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$routerId = (int)($_GET['router_id'] ?? $_GET['id'] ?? 0);
if ($routerId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Valid router_id is required']);
    exit;
}

$db = Database::getConnection();

// Fetch router with strict tenant verification
if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
    $stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id AND tenant_id = :tid LIMIT 1");
    $stmt->execute(['id' => $routerId, 'tid' => $tenantId]);
} else {
    $stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id LIMIT 1");
    $stmt->execute(['id' => $routerId]);
}

$router = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$router) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Router not found or does not belong to your account']);
    exit;
}

// Generate or retrieve unique syslog token for NAT & multi-tenant resolution
$syslogToken = trim($router['syslog_token'] ?? '');
if ($syslogToken === '') {
    $syslogToken = 'RTR_' . $router['tenant_id'] . '_' . $router['network_device_id'] . '_' . substr(bin2hex(random_bytes(4)), 0, 6);
    $upStmt = $db->prepare("UPDATE network_devices SET syslog_token = :token WHERE network_device_id = :id");
    $upStmt->execute(['token' => $syslogToken, 'id' => $router['network_device_id']]);
    $router['syslog_token'] = $syslogToken;
}

// Determine NetFix server host / public IP
$serverHost = getenv('SYSLOG_PUBLIC_IP') 
           ?: getenv('SERVER_PUBLIC_IP') 
           ?: ($_SERVER['SERVER_ADDR'] ?? '');

if (empty($serverHost) || $serverHost === '127.0.0.1' || $serverHost === '::1') {
    // Check HTTP_HOST
    $rawHost = $_SERVER['HTTP_HOST'] ?? 'YOUR_SERVER_IP';
    $serverHost = preg_replace('/:[0-9]+$/', '', $rawHost);
    if ($serverHost === 'localhost' || $serverHost === '127.0.0.1') {
        $serverHost = 'YOUR_SERVER_PUBLIC_IP';
    }
}

$syslogPort = (int)(getenv('SYSLOG_PORT') ?: 514);

$cliScript = <<<ROUTEROS
# ==============================================================
# NetFix ISP SaaS - MikroTik PPPoE Syslog Streaming Configuration
# Target Router: {$router['device_name']} (ID: #{$router['network_device_id']})
# Tenant Token: [{$syslogToken}]
# ==============================================================

# 1. Create Remote Syslog Action pointing to NetFix Ingestion Server
/system logging action
add name=netfix_syslog target=remote remote={$serverHost} remote-port={$syslogPort} src-address=0.0.0.0 bsd-syslog=yes

# 2. Stream PPPoE Connection, Disconnection, and Authentication Logs with Identifier Prefix
/system logging
add topics=pppoe,account action=netfix_syslog prefix="[{$syslogToken}]:"
add topics=pppoe,info action=netfix_syslog prefix="[{$syslogToken}]:"
add topics=pppoe,error action=netfix_syslog prefix="[{$syslogToken}]:"

# Verification: You can view local generated logs on RouterOS
/log print where topics~"pppoe"
ROUTEROS;

echo json_encode([
    'success' => true,
    'router' => [
        'id' => (string)$router['network_device_id'],
        'name' => $router['device_name'],
        'ip' => $router['management_ip'],
        'syslog_token' => $syslogToken,
    ],
    'server_host' => $serverHost,
    'server_port' => $syslogPort,
    'prefix' => "[{$syslogToken}]:",
    'script' => $cliScript,
]);
