<?php
/**
 * NetFix ISP SaaS - Router Real-Time Diagnostics API
 * Endpoint: GET /api/routers/details.php?id={router_id}
 * Compatible with RouterOS v6 and v7
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/routeros_api.class.php';

try {
    $user = AuthMiddleware::requireAuth();
} catch (\Throwable $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'status' => 'error', 'message' => 'Unauthorized']);
    exit;
}

$routerId = $_GET['id'] ?? $_GET['router_id'] ?? $_GET['device_id'] ?? null;
if (!$routerId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'status' => 'error', 'message' => 'Router ID is required']);
    exit;
}

$db = Database::getConnection();

// Fetch router from network_devices or fallback to mikrotik_routers
$stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id LIMIT 1");
$stmt->execute(['id' => $routerId]);
$router = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$router) {
    $stmt2 = $db->prepare("SELECT * FROM mikrotik_routers WHERE id = :id LIMIT 1");
    $stmt2->execute(['id' => $routerId]);
    $router = $stmt2->fetch(PDO::FETCH_ASSOC);
}

if (!$router) {
    http_response_code(404);
    echo json_encode(['success' => false, 'status' => 'error', 'message' => 'Router not found in database']);
    exit;
}

$ip = trim($router['management_ip'] ?? $router['ip_address'] ?? '');
$port = (int)($router['management_port'] ?? $router['api_port'] ?? 8728);
$user = $router['api_username'] ?? $router['username'] ?? 'admin';
$pass = $router['api_password'] ?? $router['password'] ?? '';

if (empty($ip)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'status' => 'offline', 'message' => 'Router IP address is missing']);
    exit;
}

$api = new RouterosAPI();
$api->timeout = 4;
$api->attempts = 1;

$connected = false;
try {
    $connected = $api->connect($ip, $user, $pass, $port);
} catch (\Throwable $err) {
    $connected = false;
}

if (!$connected) {
    // Graceful offline response
    echo json_encode([
        'success' => false,
        'status'  => 'offline',
        'message' => 'Router unreachable or API disabled',
        'target'  => "{$ip}:{$port}"
    ]);
    exit;
}

try {
    // 1. Identity
    $identResult = $api->comm('/system/identity/print');
    $identity = $identResult[0]['name'] ?? ($router['device_name'] ?? 'MikroTik');

    // 2. Resource Stats
    $resResult = $api->comm('/system/resource/print');
    $res = $resResult[0] ?? [];

    // 3. Count Active PPPoE Sessions
    $activeSessions = $api->comm('/ppp/active/print');
    $activeCount = count($activeSessions);

    // RAM calculation
    $totalRamBytes = (int)($res['total-memory'] ?? 0);
    $freeRamBytes = (int)($res['free-memory'] ?? 0);
    $ramUsagePercent = $totalRamBytes > 0 
        ? (int)round((($totalRamBytes - $freeRamBytes) / $totalRamBytes) * 100) 
        : 0;

    // HDD calculation
    $totalHddBytes = (int)($res['total-hdd-space'] ?? 0);
    $freeHddBytes = (int)($res['free-hdd-space'] ?? 0);
    $hddUsagePercent = $totalHddBytes > 0 
        ? (int)round((($totalHddBytes - $freeHddBytes) / $totalHddBytes) * 100) 
        : 0;

    // Format bytes helper
    $formatBytes = function (int $bytes): string {
        if ($bytes >= 1073741824) {
            return round($bytes / 1073741824, 1) . ' GB';
        }
        return round($bytes / 1048576) . ' MB';
    };

    $model = $res['board-name'] ?? ($res['platform'] ?? 'MikroTik Router');
    $version = $res['version'] ?? 'RouterOS';
    $uptime = $res['uptime'] ?? '0s';
    $cpuLoad = (int)($res['cpu-load'] ?? 0);
    $cpuCores = (int)($res['cpu-count'] ?? 1);
    $cpuArch = $res['cpu'] ?? ($res['architecture-name'] ?? 'Generic');

    echo json_encode([
        'success' => true,
        'status'  => 'online',
        'data'    => [
            'identity'           => $identity,
            'model'              => $model,
            'version'            => $version,
            'uptime'             => $uptime,
            'cpu_load'           => $cpuLoad,
            'cpu_cores'          => $cpuCores,
            'cpu_arch'           => $cpuArch,
            'total_ram'          => $formatBytes($totalRamBytes),
            'free_ram'           => $formatBytes($freeRamBytes),
            'ram_usage_percent'  => $ramUsagePercent,
            'total_hdd'          => $formatBytes($totalHddBytes),
            'free_hdd'           => $formatBytes($freeHddBytes),
            'hdd_usage_percent'  => $hddUsagePercent,
            'active_pppoe_users' => $activeCount,
            'latency_ms'         => null
        ]
    ]);
} catch (\Throwable $e) {
    echo json_encode([
        'success' => false,
        'status'  => 'offline',
        'message' => 'Failed to query diagnostic data: ' . $e->getMessage()
    ]);
} finally {
    $api->disconnect();
}
