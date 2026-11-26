<?php
/**
 * NetFix ISP SaaS - PPPoE Logs Handler (Default: Redis In-Memory Tier)
 * Routes:
 *   GET /logs/pppoe
 *   GET /logs/pppoe.php
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/Response.php';
require_once __DIR__ . '/../../lib/RedisClient.php';
require_once __DIR__ . '/../../controllers/NetworkController.php';

try {
    $user = AuthMiddleware::requireAuth();
    require_once __DIR__ . '/../../lib/HierarchySecurityService.php';
    HierarchySecurityService::requirePermission((int)$user['user_id'], 'pppoe_manage');
    $tenantId = AuthMiddleware::getTenantId();
    $db = Database::getConnection();

    $userId = (int)$user['user_id'];
    $callerRole = strtolower($user['role'] ?? '');
    $isLevel0 = in_array($callerRole, ['admin', 'isp_admin', 'manager', 'tenant_admin', 'saas_admin', 'super_admin'], true);
    $hierarchyUser = HierarchySecurityService::getUser($userId);
    $userHierarchyPath = $hierarchyUser['hierarchy_path'] ?? "/{$userId}/";

    // Build known customer map for this tenant & caller scope (strictly excludes unknown/unregistered router logs)
    $custSql = "SELECT na.tenant_id as acct_tenant_id, na.username, na.mac_address as registered_mac, na.network_device_id,
                       c.customer_id, c.customer_code, c.full_name, c.phone, c.status as customer_status,
                       c.billing_status, c.metadata,
                       cs.expires_at, cs.status as service_status,
                       cs.profile_name as package_name, cs.price as package_price,
                       cs.download_speed_kbps, cs.upload_speed_kbps,
                       sa.name as area_name, sub.name as sub_area_name,
                       nd.device_name as allowed_mik,
                       c.owner_id, c.owner_role,
                       u.username as owner_username, u.first_name as owner_first_name, u.last_name as owner_last_name
                FROM customer_network_accounts na
                JOIN customers c ON c.customer_id = na.customer_id
                LEFT JOIN network_devices nd ON nd.network_device_id = na.network_device_id
                LEFT JOIN (
                    SELECT cs1.customer_id, cs1.expires_at, cs1.status,
                           ap.profile_name, ap.price, ap.download_speed_kbps, ap.upload_speed_kbps
                    FROM customer_services cs1
                    JOIN access_profiles ap ON ap.access_profile_id = cs1.access_profile_id
                    WHERE cs1.customer_service_id = (
                        SELECT MAX(cs2.customer_service_id) FROM customer_services cs2 WHERE cs2.customer_id = cs1.customer_id
                    )
                ) cs ON cs.customer_id = c.customer_id
                LEFT JOIN service_areas sa ON sa.service_area_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.service_area_id')) AS UNSIGNED)
                LEFT JOIN sub_areas sub ON sub.sub_area_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.sub_area_id')) AS UNSIGNED)
                LEFT JOIN users u ON u.user_id = c.owner_id
                WHERE na.username IS NOT NULL AND na.username != ''";
    $custParams = [];
    if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
        $custSql .= " AND na.tenant_id = :tid";
        $custParams['tid'] = $tenantId;
    }
    if (!$isLevel0) {
        $custSql .= " AND (c.owner_id = :user_owner_id OR c.owner_path LIKE :user_path_like)";
        $custParams['user_owner_id'] = $userId;
        $custParams['user_path_like'] = rtrim($userHierarchyPath, '/') . '/%';
    }

    $customerMap = [];
    $cStmt = $db->prepare($custSql);
    $cStmt->execute($custParams);
    while ($crow = $cStmt->fetch(PDO::FETCH_ASSOC)) {
        $unameKey = strtolower(trim($crow['username']));
        if ($unameKey !== '') {
            $customerMap[$unameKey] = $crow;
        }
    }

    // 1. Check Redis for high-throughput live syslog records (Default storage mode)
    $redis = null;
    $redisLogs = [];
    try {
        $redis = RedisClient::getInstance();
        if ($redis && $redis->isConnected() && $tenantId !== null) {
            $redisKey = "logs:tenant:{$tenantId}";
            $rawList = $redis->lrange($redisKey, 0, 999);
            if (!empty($rawList)) {
                foreach ($rawList as $itemStr) {
                    $item = json_decode($itemStr, true);
                    if ($item && is_array($item)) {
                        $redisLogs[] = $item;
                    }
                }
            }
        }
    } catch (\Throwable $ignored) {}

    // 1.5 If Redis has no logs, query MySQL pppoe_connection_logs table joined strictly to registered software customers
    $hasDbRows = false;
    $force = !empty($_GET['force']);
    if (empty($redisLogs)) {
        try {
            if (!$force) {
                $cntStmt = ($user['role'] !== 'saas_admin' || $tenantId !== null)
                    ? $db->prepare("SELECT 1 FROM pppoe_connection_logs WHERE tenant_id = :tid LIMIT 1")
                    : $db->query("SELECT 1 FROM pppoe_connection_logs LIMIT 1");
                if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
                    $cntStmt->execute(['tid' => $tenantId]);
                }
                $hasDbRows = (bool)$cntStmt->fetchColumn();

                if ($hasDbRows) {
                    $dbSql = "SELECT l.* FROM pppoe_connection_logs l
                              INNER JOIN customer_network_accounts na
                                ON na.tenant_id = l.tenant_id AND LOWER(na.username) = LOWER(l.username)
                              INNER JOIN customers c
                                ON c.customer_id = na.customer_id
                              WHERE 1=1";
                    $dbParams = [];
                    if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
                        $dbSql .= " AND l.tenant_id = :tid";
                        $dbParams['tid'] = $tenantId;
                    }
                    if (!$isLevel0) {
                        $dbSql .= " AND (c.owner_id = :user_owner_id OR c.owner_path LIKE :user_path_like)";
                        $dbParams['user_owner_id'] = $userId;
                        $dbParams['user_path_like'] = rtrim($userHierarchyPath, '/') . '/%';
                    }
                    $dbSql .= " ORDER BY l.logged_at DESC LIMIT 1000";

                    $dbLogsStmt = $db->prepare($dbSql);
                    $dbLogsStmt->execute($dbParams);
                    $dbRows = $dbLogsStmt->fetchAll(PDO::FETCH_ASSOC);
                    if (!empty($dbRows)) {
                        foreach ($dbRows as $row) {
                            $redisLogs[] = [
                                'id' => (string)$row['id'],
                                'time' => $row['logged_at'],
                                'logged_at' => $row['logged_at'],
                                'event_type' => $row['event_type'],
                                'action' => $row['event_type'] === 'connected' ? 'login' : ($row['event_type'] === 'disconnected' ? 'logout' : 'failed'),
                                'username' => $row['username'],
                                'assigned_ip' => $row['assigned_ip'],
                                'caller_mac' => $row['caller_mac'],
                                'interface_name' => $row['interface_name'],
                                'disconnect_reason' => $row['disconnect_reason'],
                                'raw_message' => $row['raw_message'],
                                'message' => $row['raw_message'],
                                'router_id' => (string)$row['router_id'],
                            ];
                        }
                    }
                }
            }
        } catch (\Throwable $ignored) {}
    }

    // 2. If Redis or MySQL has ingested logs (even if all raw logs were unknown and filtered out), serve known customer logs cleanly
    if (!empty($redisLogs) || ($hasDbRows && !$force)) {
        // Fetch routers for switcher dropdown
        if ($user['role'] !== 'saas_admin' || $tenantId !== null) {
            $rStmt = $db->prepare("SELECT network_device_id, device_name, management_ip, status FROM network_devices WHERE tenant_id = :tid AND device_type = 'router' ORDER BY network_device_id ASC");
            $rStmt->execute(['tid' => $tenantId]);
        } else {
            $rStmt = $db->query("SELECT network_device_id, device_name, management_ip, status FROM network_devices WHERE device_type = 'router' ORDER BY network_device_id ASC");
        }
        $routers = $rStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Apply filters (known customer ownership, search, username, event type, router, date range)
        $search = strtolower(trim($_GET['search'] ?? ''));
        $usernameFilter = strtolower(trim($_GET['username'] ?? ''));
        $eventType = strtolower(trim($_GET['event_type'] ?? ''));
        $targetRouterId = $_GET['router_id'] ?? null;
        $dateFrom = trim($_GET['date_from'] ?? '');
        $dateTo = trim($_GET['date_to'] ?? '');

        $filtered = array_filter($redisLogs, function ($log) use ($customerMap, $search, $usernameFilter, $eventType, $targetRouterId, $dateFrom, $dateTo) {
            $uname = strtolower(trim($log['username'] ?? ''));
            if ($uname === '' || !isset($customerMap[$uname])) {
                return false;
            }
            if ($usernameFilter !== '' && $uname !== $usernameFilter) {
                return false;
            }
            if ($targetRouterId && $targetRouterId !== 'all') {
                if ((string)($log['router_id'] ?? '') !== (string)$targetRouterId) {
                    return false;
                }
            }
            if (!empty($eventType) && $eventType !== 'all') {
                if (strtolower($log['event_type'] ?? '') !== $eventType) {
                    return false;
                }
            }
            if (!empty($dateFrom)) {
                $logDate = substr($log['time'] ?? ($log['logged_at'] ?? ''), 0, 10);
                if ($logDate && $logDate < $dateFrom) {
                    return false;
                }
            }
            if (!empty($dateTo)) {
                $logDate = substr($log['time'] ?? ($log['logged_at'] ?? ''), 0, 10);
                if ($logDate && $logDate > $dateTo) {
                    return false;
                }
            }
            if (!empty($search)) {
                $cRow = $customerMap[$uname];
                $haystack = strtolower(
                    ($log['username'] ?? '') . ' ' .
                    ($cRow['full_name'] ?? '') . ' ' .
                    ($cRow['customer_code'] ?? '') . ' ' .
                    ($log['raw_message'] ?? '') . ' ' .
                    ($log['assigned_ip'] ?? '') . ' ' .
                    ($log['caller_mac'] ?? '')
                );
                if (!str_contains($haystack, $search)) {
                    return false;
                }
            }
            return true;
        });

        // Compute metrics strictly on matched software customers
        $connected = 0;
        $disconnected = 0;
        $authFailed = 0;
        foreach ($filtered as $l) {
            $et = strtolower($l['event_type'] ?? '');
            if ($et === 'connected') $connected++;
            elseif ($et === 'disconnected') $disconnected++;
            elseif ($et === 'auth_failed') $authFailed++;
        }

        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = max(1, min(200, (int)($_GET['per_page'] ?? 50)));
        $total = count($filtered);
        $paginated = array_slice(array_values($filtered), ($page - 1) * $perPage, $perPage);

        $enrichedPaginated = [];
        foreach ($paginated as $item) {
            $uname = strtolower(trim($item['username'] ?? ''));
            $cRow = $customerMap[$uname] ?? null;
            if (!$cRow) {
                continue;
            }
            $evType = strtolower($item['event_type'] ?? $item['action'] ?? '');
            
            $isExpired = false;
            $remarks = ($evType === 'auth_failed' || $evType === 'failed') ? 'Auth Failed' : (($evType === 'disconnected' || $evType === 'logout') ? 'Disconnected' : 'OK');
            $packageLabel = '';
            $zoneCode = 'ZONE-01';
            $allowedMik = $item['router_name'] ?? 'PPPoE-Server';
            $vlanMik = '@ ' . ($item['router_name'] ?? 'PPPoE-Server');
            $customerData = null;

            if ($cRow) {
                $statusLabel = $cRow['customer_status'] ?? 'Active';
                $serviceStatus = $cRow['service_status'] ?? 'active';
                $expiresAt = $cRow['expires_at'] ?? null;
                $isExpired = ($statusLabel === 'Expired' || $serviceStatus === 'expired' || ($expiresAt && strtotime($expiresAt) < time()));
                if ($isExpired) {
                    $statusLabel = 'Expired';
                    $remarks = 'Expired';
                } elseif ($statusLabel === 'Suspended' || $serviceStatus === 'suspended') {
                    $remarks = 'Suspended';
                }

                $meta = [];
                if (!empty($cRow['metadata'])) {
                    $meta = is_array($cRow['metadata']) ? $cRow['metadata'] : (@json_decode($cRow['metadata'], true) ?: []);
                }
                $zoneCode = trim($meta['zone'] ?? $meta['sdt_zone'] ?? $meta['area_code'] ?? $cRow['sub_area_name'] ?? $cRow['area_name'] ?? 'ZONE-01');

                $speed = $cRow['download_speed_kbps'] ? round($cRow['download_speed_kbps'] / 1024) . 'Mb' : '';
                $price = $cRow['package_price'] ? round($cRow['package_price']) . 'TK' : '';
                $packageLabel = trim(($speed ? $speed . '-' : '') . ($price ?: ($cRow['package_name'] ?? 'Standard')));

                $allowedMik = $cRow['allowed_mik'] ?? ($item['router_name'] ?? 'PPPoE-Server');
                $vlanMik = '@ ' . ($item['router_name'] ?? 'PPPoE-Server');

                $ownerFullName = trim(($cRow['owner_first_name'] ?? '') . ' ' . ($cRow['owner_last_name'] ?? ''));
                if (empty($ownerFullName)) {
                    $ownerFullName = $cRow['owner_username'] ?? '';
                }

                $customerData = [
                    'customer_id' => (string)$cRow['customer_id'],
                    'customer_code' => $cRow['customer_code'],
                    'full_name' => $cRow['full_name'],
                    'phone' => $cRow['phone'] ?? null,
                    'status' => $statusLabel,
                    'is_expired' => $isExpired,
                    'remarks' => $remarks,
                    'expires_at' => $expiresAt,
                    'billing_status' => $cRow['billing_status'] ?? null,
                    'caller_id' => $cRow['registered_mac'] ?? null,
                    'package_info' => $packageLabel,
                    'zone' => $zoneCode,
                    'owner_id' => (string)($cRow['owner_id'] ?? ''),
                    'owner_name' => $ownerFullName,
                    'owner_role' => $cRow['owner_role'] ?? 'admin',
                ];
            }

            $item['remarks'] = $item['remarks'] ?? $remarks;
            $item['is_expired'] = $item['is_expired'] ?? $isExpired;
            $item['customer'] = $item['customer'] ?? $customerData;
            $item['package_info'] = $item['package_info'] ?? $packageLabel;
            $item['zone'] = $item['zone'] ?? $zoneCode;
            $item['allowed_mik'] = $item['allowed_mik'] ?? $allowedMik;
            $item['vlan_mik'] = $item['vlan_mik'] ?? $vlanMik;
            $item['pool_queue'] = $item['pool_queue'] ?? null;
            $item['time'] = $item['time'] ?? $item['logged_at'] ?? date('Y-m-d H:i:s');
            $item['mac'] = $item['mac'] ?? $item['caller_mac'] ?? null;
            $item['ip'] = $item['ip'] ?? $item['assigned_ip'] ?? null;

            $enrichedPaginated[] = $item;
        }
        $paginated = $enrichedPaginated;

        Response::json([
            'success' => true,
            'data' => $paginated,
            'logs' => $paginated,
            'total' => $total,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'total_pages' => max(1, ceil($total / $perPage)),
            ],
            'routers' => $routers,
            'metrics' => [
                'connected' => $connected,
                'disconnected' => $disconnected,
                'auth_failed' => $authFailed,
            ],
            'tier' => [
                'mode' => 'short_term_redis',
                'label' => 'Short-Term Live (Redis)',
                'badge' => 'Redis In-Memory Tier',
                'retention' => '24 Hours',
                'engine' => 'Redis In-Memory Tier',
                'max_live_logs' => 1000,
            ],
        ]);
        exit;
    }

    // 3. Fallback: Delegate seamlessly to NetworkController::pppoeLogs (fetches live & caches in Redis)
    if (!defined('NETFIX_PPPOE_LOGS_FALLBACK')) {
        define('NETFIX_PPPOE_LOGS_FALLBACK', true);
    }
    NetworkController::pppoeLogs();
} catch (\Throwable $e) {
    error_log('PPPoE logs error: ' . $e->getMessage());
    Response::error('Failed to load PPPoE logs.', 500);
}
