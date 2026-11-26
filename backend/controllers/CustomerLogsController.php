<?php
/**
 * NetFix ISP SaaS - Unified Customer Logs Controller
 * Provides full-featured, functional logs for:
 * 1. MAC Logs (mac)
 * 2. SMS Logs (sms)
 * 3. Call Logs (calls)
 * 4. Task Logs (tasks)
 * 5. Sessions (sessions)
 * 6. Recharge History (recharge)
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';
require_once __DIR__ . '/../lib/MacVendorService.php';

class CustomerLogsController {

    private static function formatBytes(float $bytes): string {
        if ($bytes <= 0) return '0 B';
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $power = min((int)floor(log($bytes, 1024)), count($units) - 1);
        $value = $bytes / pow(1024, $power);
        return round($value, 2) . ' ' . $units[$power];
    }

    private static function formatDuration(int $seconds): string {
        if ($seconds <= 0) return '0s';
        $h = floor($seconds / 3600);
        $m = floor(($seconds % 3600) / 60);
        $s = $seconds % 60;
        $parts = [];
        if ($h > 0) $parts[] = "{$h}h";
        if ($m > 0) $parts[] = "{$m}m";
        if ($s > 0 || empty($parts)) $parts[] = "{$s}s";
        return implode(' ', $parts);
    }

    public static function getLogs(string $customerId): void {
        $user = AuthMiddleware::requireAuth();
        if (($user['role'] ?? '') === 'customer' || ($user['user_type'] ?? '') === 'customer') {
            Response::error('Forbidden', 403);
        }
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        HierarchySecurityService::canViewCustomer((int)$user['user_id'], (int)$customerId, $tenantId ? (int)$tenantId : null);

        $tab = strtolower(trim($_GET['tab'] ?? 'mac'));
        if (!in_array($tab, ['mac', 'sms', 'calls', 'tasks', 'sessions', 'recharge', 'all'], true)) {
            $tab = 'mac';
        }

        // 1. Fetch customer basic profile & network account
        $stmtC = $db->prepare("
            SELECT 
                c.customer_id, c.customer_code, c.full_name, c.phone, c.alternate_phone,
                c.status, c.billing_status, c.credit_limit,
                na.username as pppoe_username, na.mac_address as current_mac,
                na.current_ip, na.device_vendor, na.is_online, na.uptime_seconds,
                na.upload_bytes, na.download_bytes, na.last_online_at, na.last_offline_at,
                ap.profile_name as package_name, ap.price as package_price
            FROM customers c
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            WHERE c.customer_id = :cid AND c.tenant_id = :tid
            ORDER BY cs.customer_service_id DESC
            LIMIT 1
        ");
        $stmtC->execute(['cid' => $customerId, 'tid' => $tenantId]);
        $customer = $stmtC->fetch(PDO::FETCH_ASSOC);

        if (!$customer) {
            Response::error('Customer not found', 404);
            return;
        }

        // 2. Fetch current balance
        $stmtBal = $db->prepare("
            SELECT balance_due FROM invoices 
            WHERE customer_id = :cid AND tenant_id = :tid 
            ORDER BY invoice_id DESC LIMIT 1
        ");
        $stmtBal->execute(['cid' => $customerId, 'tid' => $tenantId]);
        $currentBalance = (float)($stmtBal->fetchColumn() ?: 0);

        $customerHeader = [
            'customerId' => (string)$customer['customer_id'],
            'customerCode' => $customer['customer_code'] ?? '',
            'fullName' => $customer['full_name'] ?? '',
            'phone' => $customer['phone'] ?? '',
            'alternatePhone' => $customer['alternate_phone'] ?? '',
            'pppoeUsername' => $customer['pppoe_username'] ?? '',
            'currentMac' => $customer['current_mac'] ?? '',
            'currentIp' => $customer['current_ip'] ?? '',
            'deviceVendor' => $customer['device_vendor'] ?: MacVendorService::resolveVendor($customer['current_mac'] ?? '', $db),
            'status' => $customer['status'] ?? 'active',
            'isOnline' => (bool)($customer['is_online'] ?? false),
            'packageName' => $customer['package_name'] ?? 'N/A',
            'packagePrice' => (float)($customer['package_price'] ?? 0),
            'balance' => $currentBalance,
        ];

        $response = [
            'success' => true,
            'customer' => $customerHeader,
            'activeTab' => $tab,
            'data' => []
        ];

        $pppoeUsername = trim($customer['pppoe_username'] ?? '');
        $currentMac = trim($customer['current_mac'] ?? '');
        $liveAccount = [
            'username' => $pppoeUsername,
            'is_online' => !empty($customer['is_online']),
            'uptime_seconds' => (int)($customer['uptime_seconds'] ?? 0),
            'upload_bytes' => (float)($customer['upload_bytes'] ?? 0),
            'download_bytes' => (float)($customer['download_bytes'] ?? 0),
            'current_ip' => $customer['current_ip'] ?? '',
            'mac_address' => $customer['current_mac'] ?? '',
            'last_online_at' => $customer['last_online_at'] ?? null,
            'last_offline_at' => $customer['last_offline_at'] ?? null,
        ];

        // 3. Tab Data Gathering
        switch ($tab) {
            case 'mac':
                $response['data'] = self::getMacLogs($db, $tenantId, $customerId, $pppoeUsername, $currentMac);
                break;

            case 'sms':
                $response['data'] = self::getSmsLogs($db, $tenantId, $customer['phone'] ?? '', $customer['alternate_phone'] ?? '');
                break;

            case 'calls':
                $response['data'] = self::getCallLogs($db, $tenantId, $customerId);
                break;

            case 'tasks':
                $response['data'] = self::getTaskLogs($db, $tenantId, $customerId);
                break;

            case 'sessions':
                $response['data'] = self::getSessionLogs($db, $tenantId, $pppoeUsername, $currentMac, $liveAccount);
                break;

            case 'recharge':
                $response['data'] = self::getRechargeLogs($db, $tenantId, $customerId, $currentBalance);
                break;

            case 'all':
                $response['data'] = [
                    'mac' => self::getMacLogs($db, $tenantId, $customerId, $pppoeUsername, $currentMac),
                    'sms' => self::getSmsLogs($db, $tenantId, $customer['phone'] ?? '', $customer['alternate_phone'] ?? ''),
                    'calls' => self::getCallLogs($db, $tenantId, $customerId),
                    'tasks' => self::getTaskLogs($db, $tenantId, $customerId),
                    'sessions' => self::getSessionLogs($db, $tenantId, $pppoeUsername, $currentMac, $liveAccount),
                    'recharge' => self::getRechargeLogs($db, $tenantId, $customerId, $currentBalance),
                ];
                break;
        }

        Response::json($response);
    }

    private static function getMacLogs(PDO $db, int $tenantId, string $customerId, string $username, string $currentMac): array {
        $rows = [];
        $uniqueMacs = [];

        if (!empty($username) || !empty($currentMac)) {
            $stmt = $db->prepare("
                SELECT 
                    caller_mac as mac,
                    assigned_ip as ip,
                    MIN(logged_at) as first_seen,
                    MAX(logged_at) as last_seen,
                    COUNT(*) as hits
                FROM pppoe_connection_logs
                WHERE tenant_id = :tid 
                  AND (:uname != '' AND username = :uname2 OR :cmac != '' AND caller_mac = :cmac2)
                  AND caller_mac IS NOT NULL AND caller_mac != ''
                GROUP BY caller_mac, assigned_ip
                ORDER BY last_seen DESC
                LIMIT 50
            ");
            $stmt->execute([
                'tid' => $tenantId,
                'uname' => $username,
                'uname2' => $username,
                'cmac' => $currentMac,
                'cmac2' => $currentMac,
            ]);
            $dbRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($dbRows as $r) {
                $mac = strtoupper(trim($r['mac'] ?? ''));
                if (!$mac) continue;
                $uniqueMacs[$mac] = true;
                $isCurr = (!empty($currentMac) && strtoupper($currentMac) === $mac);
                $device = MacVendorService::resolveVendor($mac, $db);

                $rows[] = [
                    'mac' => $mac,
                    'device' => $device ?: 'Unknown Vendor',
                    'ip' => $r['ip'] ?: '—',
                    'firstSeen' => $r['first_seen'] ?: '—',
                    'lastSeen' => $r['last_seen'] ?: '—',
                    'hits' => (int)$r['hits'],
                    'isCurrent' => $isCurr,
                ];
            }
        }

        // If no connection log rows but customer has a current MAC, inject it
        if (empty($rows) && !empty($currentMac)) {
            $macUpper = strtoupper($currentMac);
            $uniqueMacs[$macUpper] = true;
            $device = MacVendorService::resolveVendor($macUpper, $db);
            $rows[] = [
                'mac' => $macUpper,
                'device' => $device ?: 'Unknown Vendor',
                'ip' => '—',
                'firstSeen' => '—',
                'lastSeen' => '—',
                'hits' => 1,
                'isCurrent' => true,
            ];
        }

        return [
            'currentMac' => $currentMac ? strtoupper($currentMac) : null,
            'total' => count($rows),
            'unique' => count($uniqueMacs),
            'rows' => $rows,
        ];
    }

    private static function getSmsLogs(PDO $db, int $tenantId, string $phone, string $altPhone): array {
        $phones = array_filter(array_unique([
            trim($phone),
            trim($altPhone),
            preg_replace('/[^0-9]/', '', $phone),
            preg_replace('/[^0-9]/', '', $altPhone),
        ]));

        if (empty($phones)) {
            return [
                'totals' => ['total' => 0, 'delivered' => 0, 'pending' => 0, 'failed' => 0],
                'rows' => []
            ];
        }

        // Build IN placeholders
        $inQuery = implode(',', array_fill(0, count($phones), '?'));
        $params = array_merge([$tenantId], array_values($phones));

        $stmt = $db->prepare("
            SELECT 
                sms_log_id as id,
                to_number,
                message,
                provider_name as gateway,
                status,
                sms_type,
                trxn_id,
                error_message,
                created_at
            FROM sms_log
            WHERE tenant_id = ? AND to_number IN ($inQuery)
            ORDER BY sms_log_id DESC
            LIMIT 100
        ");
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $total = count($rawRows);
        $delivered = 0;
        $pending = 0;
        $failed = 0;

        $rows = [];
        foreach ($rawRows as $r) {
            $st = strtolower(trim($r['status'] ?? 'sent'));
            if (in_array($st, ['delivered', 'sent', 'success', 'ok'], true)) {
                $delivered++;
                $statusCode = 1; // Delivered / Sent
            } elseif (in_array($st, ['pending', 'queued', 'processing'], true)) {
                $pending++;
                $statusCode = 3; // Pending
            } else {
                $failed++;
                $statusCode = 4; // Failed
            }

            // Estimate SMS count (parts) based on message length (160 for ASCII, 70 for Unicode)
            $msg = $r['message'] ?? '';
            $isUnicode = (strlen($msg) !== mb_strlen($msg, 'UTF-8'));
            $maxLen = $isUnicode ? 70 : 160;
            $count = max(1, (int)ceil(mb_strlen($msg, 'UTF-8') / $maxLen));

            $rows[] = [
                'id' => (string)$r['id'],
                'created_at' => $r['created_at'] ?: '—',
                'to' => $r['to_number'] ?? '',
                'message' => $msg,
                'gateway' => $r['gateway'] ?: 'Default Gateway',
                'status' => $statusCode,
                'statusLabel' => ucfirst($st),
                'count' => $count,
                'generatedBy' => !empty($r['sms_type']) ? ucfirst($r['sms_type']) : 'System',
                'response' => $r['error_message'] ?: ($r['trxn_id'] ? "TrxID: {$r['trxn_id']}" : 'OK: Sent successfully'),
            ];
        }

        return [
            'totals' => [
                'total' => $total,
                'delivered' => $delivered,
                'pending' => $pending,
                'failed' => $failed,
            ],
            'rows' => $rows,
        ];
    }

    private static function getCallLogs(PDO $db, int $tenantId, string $customerId): array {
        // Voice / IVR logs stub with full structure matching the UI
        return [
            'totals' => [
                'total' => 0,
                'delivered' => 0,
                'pending' => 0,
                'failed' => 0,
            ],
            'rows' => []
        ];
    }

    private static function getTaskLogs(PDO $db, int $tenantId, string $customerId): array {
        $rows = [];

        // 1. Fetch from client_task_logs
        try {
            $stmt1 = $db->prepare("
                SELECT 
                    ctl.task_id as id,
                    ctl.action,
                    ctl.description,
                    ctl.status,
                    ctl.created_at,
                    u.username as operator_username,
                    u.first_name, u.last_name
                FROM client_task_logs ctl
                LEFT JOIN users u ON u.user_id = ctl.created_by
                WHERE ctl.customer_id = :cid AND ctl.tenant_id = :tid
                ORDER BY ctl.task_id DESC
                LIMIT 50
            ");
            $stmt1->execute(['cid' => $customerId, 'tid' => $tenantId]);
            $tRows = $stmt1->fetchAll(PDO::FETCH_ASSOC);

            foreach ($tRows as $t) {
                $opName = trim(($t['first_name'] ?? '') . ' ' . ($t['last_name'] ?? ''));
                if (!$opName) $opName = $t['operator_username'] ?: 'System';

                $rows[] = [
                    'id' => 'ctl_' . $t['id'],
                    'created_at' => $t['created_at'] ?: '—',
                    'policy' => strtolower($t['action'] ?? 'task'),
                    'ip' => '—',
                    'name' => $opName,
                    'action' => $t['description'] ?: $t['action'],
                    'status' => $t['status'] ?: 'success',
                ];
            }
        } catch (\Throwable $e) {}

        // 2. Fetch from activity_logs
        try {
            $stmt2 = $db->prepare("
                SELECT 
                    al.id,
                    al.action,
                    al.module,
                    al.description,
                    al.ip_address,
                    al.created_at,
                    u.username as operator_username,
                    u.first_name, u.last_name
                FROM activity_logs al
                LEFT JOIN users u ON u.user_id = al.user_id
                WHERE al.tenant_id = :tid 
                  AND (al.target_id = :cid OR al.metadata LIKE :metaPattern)
                ORDER BY al.id DESC
                LIMIT 50
            ");
            $stmt2->execute([
                'tid' => $tenantId,
                'cid' => $customerId,
                'metaPattern' => '%"customer_id":' . $customerId . '%',
            ]);
            $aRows = $stmt2->fetchAll(PDO::FETCH_ASSOC);

            foreach ($aRows as $a) {
                $opName = trim(($a['first_name'] ?? '') . ' ' . ($a['last_name'] ?? ''));
                if (!$opName) $opName = $a['operator_username'] ?: 'System / Admin';

                $rows[] = [
                    'id' => 'act_' . $a['id'],
                    'created_at' => $a['created_at'] ?: '—',
                    'policy' => strtolower($a['action'] ?? ($a['module'] ?? 'activity')),
                    'ip' => $a['ip_address'] ?: '—',
                    'name' => $opName,
                    'action' => $a['description'] ?: $a['action'],
                    'status' => 'completed',
                ];
            }
        } catch (\Throwable $e) {}

        // Sort combined rows by created_at DESC
        usort($rows, function ($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        return [
            'total' => count($rows),
            'rows' => array_slice($rows, 0, 60),
        ];
    }

    private static function getSessionLogs(PDO $db, int $tenantId, string $username, string $currentMac, array $liveAccount = []): array {
        if (empty($username) && empty($currentMac)) {
            return [
                'stats' => [
                    'today' => '0 B',
                    'week' => '0 B',
                    'month' => '0 B',
                    'lastMonth' => '0 B',
                    'rangeTotal' => '0 B',
                    'rangeDownload' => '0 B',
                    'rangeUpload' => '0 B',
                    'rangeUptime' => '0m',
                    'assignedIps' => [],
                    'dailyBreakdown' => [],
                ],
                'rows' => []
            ];
        }

        // Date range filtering parameters
        $preset = strtolower(trim($_GET['preset'] ?? 'all'));
        $dateFromParam = trim($_GET['date_from'] ?? $_GET['startDate'] ?? '');
        $dateToParam = trim($_GET['date_to'] ?? $_GET['endDate'] ?? '');

        $rangeStart = null;
        $rangeEnd = null;

        switch ($preset) {
            case 'today':
                $rangeStart = date('Y-m-d 00:00:00');
                $rangeEnd = date('Y-m-d 23:59:59');
                break;
            case 'yesterday':
                $rangeStart = date('Y-m-d 00:00:00', strtotime('-1 day'));
                $rangeEnd = date('Y-m-d 23:59:59', strtotime('-1 day'));
                break;
            case 'this_week':
            case 'thisweek':
                $rangeStart = date('Y-m-d 00:00:00', strtotime('monday this week'));
                $rangeEnd = date('Y-m-d 23:59:59');
                break;
            case 'last_week':
            case 'lastweek':
                $rangeStart = date('Y-m-d 00:00:00', strtotime('monday last week'));
                $rangeEnd = date('Y-m-d 23:59:59', strtotime('sunday last week'));
                break;
            case 'this_month':
            case 'thismonth':
                $rangeStart = date('Y-m-01 00:00:00');
                $rangeEnd = date('Y-m-d 23:59:59');
                break;
            case 'last_month':
            case 'lastmonth':
                $rangeStart = date('Y-m-01 00:00:00', strtotime('first day of last month'));
                $rangeEnd = date('Y-m-t 23:59:59', strtotime('last day of last month'));
                break;
            case 'custom':
                if (!empty($dateFromParam)) {
                    $rangeStart = date('Y-m-d 00:00:00', strtotime($dateFromParam));
                }
                if (!empty($dateToParam)) {
                    $rangeEnd = date('Y-m-d 23:59:59', strtotime($dateToParam));
                }
                break;
            default:
                if (!empty($dateFromParam) && !empty($dateToParam)) {
                    $preset = 'custom';
                    $rangeStart = date('Y-m-d 00:00:00', strtotime($dateFromParam));
                    $rangeEnd = date('Y-m-d 23:59:59', strtotime($dateToParam));
                }
                break;
        }

        // Fetch full recent connection event history so connects & disconnects pair cleanly even across range boundaries
        $stmt = $db->prepare("
            SELECT 
                id,
                username,
                event_type,
                assigned_ip,
                caller_mac,
                session_time_seconds,
                bytes_uploaded,
                bytes_downloaded,
                disconnect_reason,
                logged_at,
                created_at
            FROM pppoe_connection_logs
            WHERE tenant_id = :tid AND (:uname != '' AND username = :uname2 OR :cmac != '' AND caller_mac = :cmac2)
            ORDER BY id DESC
            LIMIT 1000
        ");
        $stmt->execute([
            'tid' => $tenantId,
            'uname' => $username,
            'uname2' => $username,
            'cmac' => $currentMac,
            'cmac2' => $currentMac,
        ]);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        require_once __DIR__ . '/../lib/SessionLogHelper.php';
        $allSessions = SessionLogHelper::reconstructSessions($rawRows, $liveAccount);

        // Stats tracking
        $now = time();
        $todayStart = strtotime('today midnight');
        $weekStart = strtotime('-7 days');
        $monthStart = strtotime('first day of this month midnight');
        $lastMonthStart = strtotime('first day of last month midnight');
        $lastMonthEnd = strtotime('last day of last month 23:59:59');

        $rangeStartTs = $rangeStart !== null ? strtotime($rangeStart) : null;
        $rangeEndTs = $rangeEnd !== null ? strtotime($rangeEnd) : null;

        $bytesToday = 0.0;
        $bytesWeek = 0.0;
        $bytesMonth = 0.0;
        $bytesLastMonth = 0.0;

        $rangeDown = 0.0;
        $rangeUp = 0.0;
        $rangeSeconds = 0;
        $distinctIps = [];
        $dailyMap = [];
        $rows = [];

        foreach ($allSessions as $s) {
            $up = (float)$s['uploadBytes'];
            $down = (float)$s['downloadBytes'];
            $tot = $up + $down;
            $durationSec = (int)$s['durationSeconds'];
            $ip = trim((string)$s['ip']);
            $refTs = $s['isOngoing'] ? $now : ((int)($s['endTs'] ?: $s['startTs']));

            // Overall historical KPI buckets (unaffected by range filter)
            if ($refTs >= $todayStart) $bytesToday += $tot;
            if ($refTs >= $weekStart) $bytesWeek += $tot;
            if ($refTs >= $monthStart) $bytesMonth += $tot;
            if ($refTs >= $lastMonthStart && $refTs <= $lastMonthEnd) $bytesLastMonth += $tot;

            // Apply date range filter against session window
            $sessionEndCheck = $s['isOngoing'] ? $now : ((int)($s['endTs'] ?: $s['startTs']));
            if ($rangeStartTs !== null && $sessionEndCheck < $rangeStartTs) {
                continue;
            }
            if ($rangeEndTs !== null && (int)$s['startTs'] > $rangeEndTs) {
                continue;
            }

            $rangeDown += $down;
            $rangeUp += $up;
            $rangeSeconds += $durationSec;
            if ($ip !== '' && !in_array($ip, $distinctIps, true)) {
                $distinctIps[] = $ip;
            }

            // Daily tracking (attributed to session end date or today if ongoing)
            $dayKey = date('Y-m-d', $refTs);
            if (!isset($dailyMap[$dayKey])) {
                $dailyMap[$dayKey] = [
                    'date' => $dayKey,
                    'downloadBytes' => 0,
                    'uploadBytes' => 0,
                    'totalBytes' => 0,
                    'uptimeSeconds' => 0,
                    'assignedIps' => [],
                    'sessionCount' => 0,
                    'disconnectCount' => 0,
                ];
            }
            $dailyMap[$dayKey]['downloadBytes'] += $down;
            $dailyMap[$dayKey]['uploadBytes'] += $up;
            $dailyMap[$dayKey]['totalBytes'] += $tot;
            $dailyMap[$dayKey]['uptimeSeconds'] += $durationSec;
            $dailyMap[$dayKey]['sessionCount'] += 1;
            if (!$s['isOngoing']) {
                $dailyMap[$dayKey]['disconnectCount'] += 1;
            }
            if ($ip !== '' && !in_array($ip, $dailyMap[$dayKey]['assignedIps'], true)) {
                $dailyMap[$dayKey]['assignedIps'][] = $ip;
            }

            if (count($rows) < 200) {
                $rows[] = [
                    'id' => (string)$s['id'],
                    'start' => $s['start'] ?: '—',
                    'end' => $s['isOngoing'] ? 'Ongoing' : ($s['end'] ?: '—'),
                    'duration' => self::formatDuration($durationSec),
                    'durationSeconds' => $durationSec,
                    'upload' => self::formatBytes($up),
                    'download' => self::formatBytes($down),
                    'total' => self::formatBytes($tot),
                    'totalBytes' => $tot,
                    'ip' => $ip !== '' ? $ip : '—',
                    'mac' => $s['mac'] !== '' ? $s['mac'] : '—',
                    'reason' => $s['reason'] ?: ($s['isOngoing'] ? 'Active Session' : 'Session Ended'),
                    'isOngoing' => (bool)$s['isOngoing'],
                ];
            }
        }

        // Format daily breakdown
        $dailyBreakdown = [];
        foreach ($dailyMap as $dayItem) {
            $dailyBreakdown[] = [
                'date' => $dayItem['date'],
                'downloadBytes' => $dayItem['downloadBytes'],
                'uploadBytes' => $dayItem['uploadBytes'],
                'totalBytes' => $dayItem['totalBytes'],
                'downloadGb' => round($dayItem['downloadBytes'] / (1024 * 1024 * 1024), 2),
                'uploadGb' => round($dayItem['uploadBytes'] / (1024 * 1024 * 1024), 2),
                'totalGb' => round($dayItem['totalBytes'] / (1024 * 1024 * 1024), 2),
                'uptimeSeconds' => $dayItem['uptimeSeconds'],
                'uptimeFormatted' => self::formatDuration($dayItem['uptimeSeconds']),
                'sessionCount' => $dayItem['sessionCount'],
                'disconnectCount' => $dayItem['disconnectCount'],
                'assignedIps' => $dayItem['assignedIps'],
            ];
        }

        return [
            'stats' => [
                'today' => self::formatBytes($bytesToday),
                'week' => self::formatBytes($bytesWeek),
                'month' => self::formatBytes($bytesMonth),
                'lastMonth' => self::formatBytes($bytesLastMonth),
                'preset' => $preset,
                'rangeTotal' => self::formatBytes($rangeDown + $rangeUp),
                'rangeDownload' => self::formatBytes($rangeDown),
                'rangeUpload' => self::formatBytes($rangeUp),
                'rangeUptime' => self::formatDuration($rangeSeconds),
                'assignedIps' => $distinctIps,
                'dailyBreakdown' => $dailyBreakdown,
            ],
            'rows' => $rows,
        ];
    }

    private static function getRechargeLogs(PDO $db, int $tenantId, string $customerId, float $currentBalance): array {
        $stmt = $db->prepare("
            SELECT 
                t.transaction_id as id,
                t.transaction_ref as ref,
                t.transaction_type as type,
                t.amount,
                t.method,
                t.running_balance_after_transaction as balance,
                t.description,
                t.created_at as time,
                t.initiator_role,
                u.username as operator_username,
                u.first_name, u.last_name
            FROM transactions t
            LEFT JOIN users u ON u.user_id = t.initiator_user_id
            WHERE t.customer_id = :cid AND t.tenant_id = :tid
            ORDER BY t.transaction_id DESC
            LIMIT 100
        ");
        $stmt->execute(['cid' => $customerId, 'tid' => $tenantId]);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalRecharged = 0.0;
        $totalPaid = 0.0;

        $rows = [];
        foreach ($rawRows as $r) {
            $amt = (float)($r['amount'] ?? 0);
            $type = strtoupper(trim($r['type'] ?? ''));

            $isDebit = in_array($type, ['RENEW_DEBIT', 'DEBIT', 'BILL_DEBIT', 'PENALTY'], true);
            $debit = $isDebit ? number_format($amt, 2, '.', '') : '-';
            $credit = !$isDebit ? number_format($amt, 2, '.', '') : '-';

            if ($isDebit) {
                $totalRecharged += $amt;
            } else {
                $totalPaid += $amt;
            }

            $opName = trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? ''));
            if (!$opName) $opName = $r['operator_username'] ?: ($r['initiator_role'] ? ucfirst($r['initiator_role']) : 'Admin');

            $bal = ($r['balance'] !== null) ? number_format((float)$r['balance'], 2, '.', '') : '0.00';

            $rows[] = [
                'id' => (string)$r['id'],
                'ref' => $r['ref'] ?: "TXN-{$r['id']}",
                'type' => $type,
                'debit' => $debit,
                'credit' => $credit,
                'balance' => $bal,
                'method' => $r['method'] ?: 'Cash',
                'time' => $r['time'] ?: '—',
                'by' => $opName,
                'description' => $r['description'] ?: 'Transaction',
            ];
        }

        return [
            'stats' => [
                'totalRecharged' => number_format($totalRecharged, 2, '.', ''),
                'totalPaid' => number_format($totalPaid, 2, '.', ''),
                'currentBalance' => number_format($currentBalance, 2, '.', ''),
                'totalTransactions' => count($rows),
            ],
            'rows' => $rows,
        ];
    }
}
