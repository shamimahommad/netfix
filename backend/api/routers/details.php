<?php
/**
 * NetFix ISP SaaS - Router Real-Time Diagnostics API
 * Endpoint: GET /api/routers/details.php?id={router_id}
 * Compatible with RouterOS v6 and v7
 * Supports persistent single-login session via background live telemetry worker
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/routeros_api.class.php';

try {
    $user = AuthMiddleware::requireAuth();
    $role = strtolower(trim($user['role'] ?? ''));
    if (!in_array($role, ['saas_admin', 'admin', 'manager', 'isp_admin', 'tenant_admin', 'super_admin'], true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'status' => 'error', 'message' => 'Access denied']);
        exit;
    }
} catch (\Throwable $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'status' => 'error', 'message' => 'Unauthorized']);
    exit;
}

$routerId = (int)($_GET['id'] ?? $_GET['router_id'] ?? $_GET['device_id'] ?? 0);
if (!$routerId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'status' => 'error', 'message' => 'Router ID is required']);
    exit;
}

$tenantId = AuthMiddleware::getTenantId();
$db = Database::getConnection();

// Fetch router from network_devices or fallback to mikrotik_routers
if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
    $stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id AND tenant_id = :tid LIMIT 1");
    $stmt->execute(['id' => $routerId, 'tid' => $tenantId]);
} else {
    $stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id LIMIT 1");
    $stmt->execute(['id' => $routerId]);
}
$router = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$router && ($user['role'] === 'saas_admin' || $tenantId === null)) {
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

// -----------------------------------------------------------------
// PERSISTENT LIVE SESSION MANAGER
// Holds 1 single login session to MikroTik while modal is being viewed.
// -----------------------------------------------------------------
$cacheDir = __DIR__ . '/../../cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0777, true);
}

$touchFile = $cacheDir . '/router_' . $routerId . '_touch.json';
$cacheFile = $cacheDir . '/router_' . $routerId . '_live.json';
$hbFile    = $cacheDir . '/router_' . $routerId . '_worker_hb.txt';
$errFile   = $cacheDir . '/router_' . $routerId . '_error.json';

// 0. If recent connection error was cached (< 15 seconds), return instantly without stalling
if (file_exists($errFile) && (time() - filemtime($errFile) <= 15)) {
    $errContent = @file_get_contents($errFile);
    if (!empty($errContent)) {
        header('X-MikroTik-Session: Error-Cached');
        echo $errContent;
        exit;
    }
}

// 1. Record frontend heartbeat touch
file_put_contents($touchFile, json_encode([
    'last_touched' => time(),
    'requested_by' => $user['user_id'] ?? 0
]));

// 2. Check if background persistent session worker is alive
$isWorkerAlive = file_exists($hbFile) && ((time() - filemtime($hbFile)) < 6);

if (!$isWorkerAlive) {
    // Launch persistent worker in background (single login session)
    $phpBin = PHP_BINARY;
    $workerScript = __DIR__ . '/../../services/RouterLiveSessionWorker.php';
    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        pclose(popen("start /B \"\" \"$phpBin\" \"$workerScript\" " . (int)$routerId, "r"));
    } else {
        exec("nohup \"$phpBin\" \"$workerScript\" " . (int)$routerId . " > /dev/null 2>&1 &");
    }
}

// 3. If fresh live data exists (< 4 seconds old), return instantly without logging in again
if (file_exists($cacheFile) && (time() - filemtime($cacheFile) <= 4)) {
    $content = @file_get_contents($cacheFile);
    if (!empty($content)) {
        header('X-MikroTik-Session: Persistent-Cached');
        echo $content;
        exit;
    }
}

// 4. If worker just spawned, wait briefly (up to 200ms) for first live frame
for ($i = 0; $i < 2; $i++) {
    usleep(100000); // 100ms
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile) <= 4)) {
        $content = @file_get_contents($cacheFile);
        if (!empty($content)) {
            header('X-MikroTik-Session: Persistent-Live');
            echo $content;
            exit;
        }
    }
}

// 5. Fallback: Fast direct query if worker hasn't written yet (max 2s timeout)
require_once __DIR__ . '/../../lib/MikrotikSyncService.php';
$api = MikrotikSyncService::connect($router, 2);

if (!$api) {
    $offlinePayload = json_encode([
        'success' => false,
        'status'  => 'offline',
        'message' => 'Router unreachable or API disabled',
        'target'  => "{$ip}:{$port}"
    ]);
    @file_put_contents($errFile, $offlinePayload);
    echo $offlinePayload;
    exit;
}

try {
    $identResult = $api->comm('/system/identity/print');
    $identity = $identResult[0]['name'] ?? ($router['device_name'] ?? 'MikroTik');

    $resResult = $api->comm('/system/resource/print');
    $res = $resResult[0] ?? [];

    $activeSessions = $api->comm('/ppp/active/print');
    $activeCount = count($activeSessions);

    $totalRamBytes = (int)($res['total-memory'] ?? 0);
    $freeRamBytes = (int)($res['free-memory'] ?? 0);
    $ramUsagePercent = $totalRamBytes > 0 
        ? (int)round((($totalRamBytes - $freeRamBytes) / $totalRamBytes) * 100) 
        : 0;

    $totalHddBytes = (int)($res['total-hdd-space'] ?? 0);
    $freeHddBytes = (int)($res['free-hdd-space'] ?? 0);
    $hddUsagePercent = $totalHddBytes > 0 
        ? (int)round((($totalHddBytes - $freeHddBytes) / $totalHddBytes) * 100) 
        : 0;

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

    $outData = [
        'success' => true,
        'status'  => 'online',
        'session' => 'direct_fallback',
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
        ]
    ];

    echo json_encode($outData);
} catch (\Throwable $e) {
    echo json_encode([
        'success' => false,
        'status'  => 'offline',
        'message' => 'Failed to query diagnostic data: ' . $e->getMessage()
    ]);
} finally {
    try {
        $api->disconnect();
    } catch (\Throwable $e) {}
}
