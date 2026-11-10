<?php
/**
 * NetFix ISP SaaS - MikroTik Syslog Setup & 1-Click Auto Configuration Engine
 * Endpoints:
 *  - GET  /routers/syslog-script?router_id={id}&server_host={host}
 *  - POST /routers/syslog-auto-setup (or POST /routers/syslog-script)
 *
 * Features:
 *  1. Smart Server Public IP / Host Auto-Detection (zero manual placeholders)
 *  2. Ready-to-use RouterOS CLI Script Generator
 *  3. 1-Click Direct MikroTik Router API Provisioning
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/Response.php';
require_once __DIR__ . '/../../lib/MikrotikSyncService.php';

try {
    $user = AuthMiddleware::requireAuth();
    $tenantId = AuthMiddleware::getTenantId();
    $role = strtolower(trim($user['role'] ?? ''));
    if (!in_array($role, ['saas_admin', 'admin', 'manager', 'isp_admin', 'tenant_admin', 'super_admin'], true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Access denied: Admin permissions required for router setup']);
        exit;
    }
} catch (\Throwable $e) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?: [];

$routerId = (int)($body['router_id'] ?? $_GET['router_id'] ?? $_GET['id'] ?? 0);
if ($routerId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Valid router_id is required']);
    exit;
}

$db = Database::getConnection();

// Fetch router with strict tenant isolation
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

// Generate or retrieve unique syslog token for multi-tenant and NAT resolution
$syslogToken = trim($router['syslog_token'] ?? '');
if ($syslogToken === '') {
    $syslogToken = 'RTR_' . ($router['tenant_id'] ?? 1) . '_' . $router['network_device_id'] . '_' . substr(bin2hex(random_bytes(4)), 0, 6);
    $upStmt = $db->prepare("UPDATE network_devices SET syslog_token = :token WHERE network_device_id = :id");
    $upStmt->execute(['token' => $syslogToken, 'id' => $router['network_device_id']]);
    $router['syslog_token'] = $syslogToken;
}

/**
 * Smart Server IP / Host Auto-Detection Helper
 */
function resolveServerHost(?string $customHost = null): array {
    // 1. Explicit override passed by user
    if (!empty($customHost)) {
        return ['host' => trim($customHost), 'source' => 'custom'];
    }

    // 2. Explicit Environment Variables
    $envIp = getenv('SYSLOG_PUBLIC_IP') ?: getenv('SERVER_PUBLIC_IP') ?: ($_ENV['SYSLOG_PUBLIC_IP'] ?? $_ENV['SERVER_PUBLIC_IP'] ?? '');
    if (!empty($envIp) && $envIp !== '127.0.0.1' && $envIp !== 'YOUR_SERVER_PUBLIC_IP') {
        return ['host' => trim($envIp), 'source' => 'env'];
    }

    // 3. Browser Host Header (domain or public IP where user is accessing NetFix from)
    $httpHost = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? '';
    if (!empty($httpHost)) {
        $cleanHost = preg_replace('/:[0-9]+$/', '', trim($httpHost));
        $isLocal = ($cleanHost === 'localhost' || $cleanHost === '127.0.0.1' || $cleanHost === '::1');
        $isPrivate = filter_var($cleanHost, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;

        // If it's a domain name (not an IP) or a valid public IP, use it!
        if (!$isLocal && (!filter_var($cleanHost, FILTER_VALIDATE_IP) || !$isPrivate)) {
            return ['host' => $cleanHost, 'source' => 'http_host'];
        }
    }

    // 4. Try discovering server's real public IP via fast WAN lookup (cached 1 hour)
    $cacheFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'netfix_public_ip.cache';
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 3600)) {
        $cached = trim((string)@file_get_contents($cacheFile));
        if (filter_var($cached, FILTER_VALIDATE_IP)) {
            return ['host' => $cached, 'source' => 'wan_cache'];
        }
    }

    $ctx = stream_context_create([
        'http' => ['timeout' => 1.5, 'ignore_errors' => true],
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
    ]);
    $wanIp = @file_get_contents('https://api.ipify.org', false, $ctx);
    if (!$wanIp || !filter_var(trim($wanIp), FILTER_VALIDATE_IP)) {
        $wanIp = @file_get_contents('https://ifconfig.me/ip', false, $ctx);
    }
    if ($wanIp && filter_var(trim($wanIp), FILTER_VALIDATE_IP)) {
        $cleanWan = trim($wanIp);
        @file_put_contents($cacheFile, $cleanWan);
        return ['host' => $cleanWan, 'source' => 'wan_detected'];
    }

    // 5. Fallback to SERVER_ADDR or local host
    $serverAddr = $_SERVER['SERVER_ADDR'] ?? '';
    if (!empty($serverAddr) && $serverAddr !== '127.0.0.1' && $serverAddr !== '::1') {
        return ['host' => $serverAddr, 'source' => 'server_addr'];
    }

    $fallback = !empty($httpHost) ? preg_replace('/:[0-9]+$/', '', $httpHost) : '127.0.0.1';
    return ['host' => $fallback, 'source' => 'local_fallback'];
}

$userHostInput = $body['server_host'] ?? $_GET['server_host'] ?? null;
$hostResolution = resolveServerHost($userHostInput);
$serverHost = $hostResolution['host'];
$syslogPort = (int)($body['server_port'] ?? $_GET['server_port'] ?? getenv('SYSLOG_PORT') ?: 514);

// Generate RouterOS CLI Script
$cliScript = <<<ROUTEROS
# ==============================================================
# NetFix ISP SaaS - MikroTik PPPoE Syslog Streaming Configuration
# Target Router: {$router['device_name']} (ID: #{$router['network_device_id']})
# Tenant Token: [{$syslogToken}]
# ==============================================================

# 1. Create or update Remote Syslog Action pointing to NetFix
/system logging action
add name=netfix_syslog target=remote remote={$serverHost} remote-port={$syslogPort} src-address=0.0.0.0 bsd-syslog=yes

# 2. Forward PPPoE Connection, Disconnection, and Auth Logs with Tenant Identifier
/system logging
add topics=pppoe,account action=netfix_syslog prefix="[{$syslogToken}]:"
add topics=pppoe,info action=netfix_syslog prefix="[{$syslogToken}]:"
add topics=pppoe,error action=netfix_syslog prefix="[{$syslogToken}]:"

# Verification: View active logs
/log print where topics~"pppoe"
ROUTEROS;

// -----------------------------------------------------------------------------------
// POST ACTION: 1-Click Automatic Remote Provisioning via MikroTik RouterOS API
// -----------------------------------------------------------------------------------
if ($method === 'POST') {
    $targetIp = trim($router['management_ip'] ?? '');
    if (empty($targetIp)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => "Router has no management IP configured. Please configure router IP and API port."
        ]);
        exit;
    }

    // Connect to router via binary API or REST
    $api = MikrotikSyncService::connect($router, 6);
    if (!$api) {
        http_response_code(502);
        echo json_encode([
            'success' => false,
            'message' => "Could not connect to MikroTik router '{$router['device_name']}' at {$targetIp}:{$router['management_port']}. Please check router power, IP reachability, and API port 8728 (or Winbox credentials).",
            'script' => $cliScript,
        ]);
        exit;
    }

    try {
        // Step 1: Check if /system/logging/action with name 'netfix_syslog' exists
        $existingActions = $api->comm('/system/logging/action/print', ['?name' => 'netfix_syslog']);
        if (!empty($existingActions) && isset($existingActions[0]['.id'])) {
            $actionId = $existingActions[0]['.id'];
            $api->comm('/system/logging/action/set', [
                '=.id' => $actionId,
                '=target' => 'remote',
                '=remote' => $serverHost,
                '=remote-port' => (string)$syslogPort,
                '=src-address' => '0.0.0.0',
                '=bsd-syslog' => 'yes',
            ]);
        } else {
            $api->comm('/system/logging/action/add', [
                '=name' => 'netfix_syslog',
                '=target' => 'remote',
                '=remote' => $serverHost,
                '=remote-port' => (string)$syslogPort,
                '=src-address' => '0.0.0.0',
                '=bsd-syslog' => 'yes',
            ]);
        }

        // Step 2: Configure logging rules for pppoe,account, pppoe,info, and pppoe,error
        $targetTopics = ['pppoe,account', 'pppoe,info', 'pppoe,error'];
        $existingRules = $api->comm('/system/logging/print', ['?action' => 'netfix_syslog']);
        if (!is_array($existingRules)) {
            $existingRules = [];
        }

        // Map existing rules by topics
        $rulesByTopics = [];
        foreach ($existingRules as $r) {
            $t = trim($r['topics'] ?? '');
            if ($t !== '') {
                $rulesByTopics[$t] = $r;
            }
        }

        foreach ($targetTopics as $topic) {
            if (isset($rulesByTopics[$topic])) {
                // Update prefix
                $ruleId = $rulesByTopics[$topic]['.id'];
                $api->comm('/system/logging/set', [
                    '=.id' => $ruleId,
                    '=action' => 'netfix_syslog',
                    '=prefix' => "[{$syslogToken}]:",
                    '=disabled' => 'no',
                ]);
            } else {
                // Add new rule
                $api->comm('/system/logging/add', [
                    '=topics' => $topic,
                    '=action' => 'netfix_syslog',
                    '=prefix' => "[{$syslogToken}]:",
                    '=disabled' => 'no',
                ]);
            }
        }

        $api->disconnect();

        // Update last synced in DB
        $db->prepare("UPDATE network_devices SET status = 'active', last_sync_at = NOW() WHERE network_device_id = :id")
           ->execute(['id' => $router['network_device_id']]);

        echo json_encode([
            'success' => true,
            'message' => "Syslog server successfully configured in MikroTik router '{$router['device_name']}'! Remote stream is active to {$serverHost}:{$syslogPort}.",
            'details' => [
                'router_id' => (string)$router['network_device_id'],
                'router_name' => $router['device_name'],
                'router_ip' => $router['management_ip'],
                'server_host' => $serverHost,
                'server_port' => $syslogPort,
                'prefix' => "[{$syslogToken}]:",
            ],
            'script' => $cliScript,
        ]);
        exit;
    } catch (\Throwable $e) {
        if ($api) {
            $api->disconnect();
        }
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error executing RouterOS configuration: ' . $e->getMessage(),
            'script' => $cliScript,
        ]);
        exit;
    }
}

// -----------------------------------------------------------------------------------
// GET: Return Script with Auto-Detected IP & Token Info
// -----------------------------------------------------------------------------------
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
    'host_source' => $hostResolution['source'],
    'prefix' => "[{$syslogToken}]:",
    'script' => $cliScript,
]);
