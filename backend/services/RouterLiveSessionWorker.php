<?php
/**
 * NetFix ISP SaaS - Persistent MikroTik Live Telemetry Worker
 * Holds 1 continuous login session to MikroTik while admin has the diagnostics modal open.
 * Automatically terminates cleanly when modal is closed or after timeout.
 */

// CLI only
if (php_sapi_name() !== 'cli') {
    exit("CLI only\n");
}

$routerId = isset($argv[1]) ? (int)$argv[1] : 0;
if (!$routerId) {
    exit("Usage: php RouterLiveSessionWorker.php <router_id>\n");
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/routeros_api.class.php';

$cacheDir = __DIR__ . '/../cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0777, true);
}

$touchFile = $cacheDir . '/router_' . $routerId . '_touch.json';
$cacheFile = $cacheDir . '/router_' . $routerId . '_live.json';
$hbFile    = $cacheDir . '/router_' . $routerId . '_worker_hb.txt';
$pidFile   = $cacheDir . '/router_' . $routerId . '_worker.pid';

file_put_contents($pidFile, getmypid());

$db = Database::getConnection();

// Fetch router credentials
$stmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :id LIMIT 1");
$stmt->execute(['id' => $routerId]);
$router = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$router) {
    $stmt2 = $db->prepare("SELECT * FROM mikrotik_routers WHERE id = :id LIMIT 1");
    $stmt2->execute(['id' => $routerId]);
    $router = $stmt2->fetch(PDO::FETCH_ASSOC);
}

if (!$router) {
    @unlink($pidFile);
    exit("Router ID $routerId not found in database\n");
}

$ip   = trim($router['management_ip'] ?? $router['ip_address'] ?? '');
$port = (int)($router['management_port'] ?? $router['api_port'] ?? 8728);
$user = $router['api_username'] ?? $router['username'] ?? 'admin';
$pass = $router['api_password'] ?? $router['password'] ?? '';

if (empty($ip)) {
    @unlink($pidFile);
    exit("Router IP missing\n");
}

$api = new RouterosAPI();
$api->timeout = 4;
$api->attempts = 1;

// CONNECT ONCE
if (!$api->connect($ip, $user, $pass, $port)) {
    $offlinePayload = [
        'success' => false,
        'status'  => 'offline',
        'message' => 'Router unreachable or API disabled',
        'target'  => "{$ip}:{$port}",
        'updated_at' => microtime(true)
    ];
    file_put_contents($cacheFile, json_encode($offlinePayload));
    @unlink($pidFile);
    exit("Failed to connect to router $ip:$port\n");
}

// Fetch Identity once
$identResult = $api->comm('/system/identity/print');
$identity = $identResult[0]['name'] ?? ($router['device_name'] ?? 'MikroTik');

$formatBytes = function (int $bytes): string {
    if ($bytes >= 1073741824) {
        return round($bytes / 1073741824, 1) . ' GB';
    }
    return round($bytes / 1048576) . ' MB';
};

$maxIdleSeconds = 8; // If no touch from frontend for 8 seconds, disconnect and exit

while (true) {
    // Check if frontend has touched within last 8 seconds
    if (!file_exists($touchFile)) {
        break;
    }
    $touchData = json_decode(@file_get_contents($touchFile), true) ?: [];
    $lastTouched = (int)($touchData['last_touched'] ?? 0);
    if (time() - $lastTouched > $maxIdleSeconds) {
        // Frontend closed or stopped polling
        break;
    }

    // Update worker heartbeat file
    file_put_contents($hbFile, (string)time());

    try {
        // Query resources
        $resResult = $api->comm('/system/resource/print');
        if (empty($resResult)) {
            break;
        }
        $res = $resResult[0] ?? [];

        // Query active PPPoE count
        $activeSessions = $api->comm('/ppp/active/print');
        $activeCount = count($activeSessions);

        $totalRamBytes = (int)($res['total-memory'] ?? 0);
        $freeRamBytes  = (int)($res['free-memory'] ?? 0);
        $ramUsagePercent = $totalRamBytes > 0 
            ? (int)round((($totalRamBytes - $freeRamBytes) / $totalRamBytes) * 100) 
            : 0;

        $totalHddBytes = (int)($res['total-hdd-space'] ?? 0);
        $freeHddBytes  = (int)($res['free-hdd-space'] ?? 0);
        $hddUsagePercent = $totalHddBytes > 0 
            ? (int)round((($totalHddBytes - $freeHddBytes) / $totalHddBytes) * 100) 
            : 0;

        $model = $res['board-name'] ?? ($res['platform'] ?? 'MikroTik Router');
        $version = $res['version'] ?? 'RouterOS';
        $uptime = $res['uptime'] ?? '0s';
        $cpuLoad = (int)($res['cpu-load'] ?? 0);
        $cpuCores = (int)($res['cpu-count'] ?? 1);
        $cpuArch = $res['cpu'] ?? ($res['architecture-name'] ?? 'Generic');

        $liveData = [
            'success' => true,
            'status'  => 'online',
            'session' => 'persistent_live',
            'updated_at' => microtime(true),
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

        // Atomic write to cache
        $tmp = $cacheFile . '.tmp.' . uniqid();
        file_put_contents($tmp, json_encode($liveData));
        @rename($tmp, $cacheFile);

    } catch (\Throwable $e) {
        break;
    }

    // Tick every 2 seconds
    sleep(2);
}

// LOG OUT ONCE when exiting
try {
    $api->disconnect();
} catch (\Throwable $e) {}

@unlink($hbFile);
@unlink($pidFile);
@unlink($touchFile);
