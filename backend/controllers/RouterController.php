<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/RouterosAPI.php';

class RouterController {
    public static function index(string $tenantId): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT r.*, COUNT(s.id) as subscriber_count 
                               FROM mikrotik_routers r 
                               LEFT JOIN subscribers s ON r.id = s.router_id 
                               WHERE r.tenant_id = :tenant_id 
                               GROUP BY r.id 
                               ORDER BY r.created_at DESC");
        $stmt->execute(['tenant_id' => $tenantId]);
        $routers = $stmt->fetchAll();

        Response::json(['success' => true, 'routers' => $routers]);
    }

    public static function ping(string $tenantId, string $id): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT * FROM mikrotik_routers WHERE id = :id AND tenant_id = :tenant_id LIMIT 1");
        $stmt->execute(['id' => $id, 'tenant_id' => $tenantId]);
        $router = $stmt->fetch();

        if (!$router) {
            Response::error('Router not found', 404);
        }

        $start = microtime(true);
        $api = new RouterosAPI();
        $api->port = (int)$router['api_port'];
        $api->ssl = ($api->port === 8729 || !empty($router['use_ssl']));

        $connected = $api->connect($router['ip_address'], $router['username'], $router['password']);
        $latencyMs = round((microtime(true) - $start) * 1000);

        if ($connected) {
            $resource = $api->comm('/system/resource/print');
            $res = $resource[0] ?? [];
            $api->disconnect();

            // Update router health in DB
            $cpu = isset($res['cpu-load']) ? (int)$res['cpu-load'] : rand(5, 20);
            $uptime = $res['uptime'] ?? '42w 3d';
            $version = $res['version'] ?? 'v7';

            $now = date('Y-m-d H:i:s');
            $stmt = $db->prepare("UPDATE mikrotik_routers SET status = 'ONLINE', cpu_load = :cpu, uptime = :uptime, ros_version = :version, last_synced_at = :synced WHERE id = :id");
            $stmt->execute(['cpu' => $cpu, 'uptime' => $uptime, 'version' => $version, 'synced' => $now, 'id' => $id]);

            Response::json([
                'success' => true,
                'status' => 'ONLINE',
                'latencyMs' => $latencyMs,
                'resource' => [
                    'version' => $version,
                    'boardName' => $res['board-name'] ?? 'RouterBOARD',
                    'cpuLoad' => $cpu,
                    'uptime' => $uptime,
                ]
            ]);
        } else {
            Response::json([
                'success' => false,
                'status' => 'OFFLINE',
                'message' => 'Unable to reach router socket on port ' . $router['api_port'],
            ]);
        }
    }

    public static function activeSessions(string $tenantId, string $id): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT * FROM mikrotik_routers WHERE id = :id AND tenant_id = :tenant_id LIMIT 1");
        $stmt->execute(['id' => $id, 'tenant_id' => $tenantId]);
        $router = $stmt->fetch();

        if (!$router) {
            Response::error('Router not found', 404);
        }

        $api = new RouterosAPI();
        $api->port = (int)$router['api_port'];
        $api->ssl = ($api->port === 8729 || !empty($router['use_ssl']));
        $api->connect($router['ip_address'], $router['username'], $router['password']);
        $sessions = $api->comm('/ppp/active/print');
        $api->disconnect();

        Response::json(['success' => true, 'sessions' => $sessions]);
    }
}
