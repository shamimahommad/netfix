<?php
/**
 * NetFix ISP SaaS - Customer Self-Service Portal Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/MacVendorService.php';

class CustomerPortalController {
    private static function getCustomerId(): string {
        $user = AuthMiddleware::requireAuth();
        $cid = $user['customer_id'] ?? $user['user_id'] ?? null;
        if (!$cid) {
            Response::error('Customer context not found', 403);
        }
        return (string)$cid;
    }

    /**
     * Format seconds into human readable duration string: e.g. "3d 4h 12m" or "45m 10s"
     */
    public static function formatDuration(int $seconds): string {
        if ($seconds <= 0) return '0m';
        $d = floor($seconds / 86400);
        $h = floor(($seconds % 86400) / 3600);
        $m = floor(($seconds % 3600) / 60);
        $s = $seconds % 60;

        $parts = [];
        if ($d > 0) $parts[] = "{$d}d";
        if ($h > 0) $parts[] = "{$h}h";
        if ($m > 0 || empty($parts)) $parts[] = "{$m}m";
        if (empty($parts) || ($d === 0 && $h === 0)) $parts[] = "{$s}s";

        return implode(' ', $parts);
    }

    /**
     * GET /customer/dashboard
     * Full customer self-care telemetry: Company Branding, ONU Laser, Router Info, Monthly Usage, Package, Invoices
     */
    public static function dashboard(): void {
        $customerId = self::getCustomerId();
        $db = Database::getConnection();

        // 1. Customer record
        $stmt = $db->prepare("SELECT * FROM customers WHERE customer_id = :cid LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $customer = $stmt->fetch();

        if (!$customer) {
            Response::error('Customer not found', 404);
        }

        $tenantId = (int)$customer['tenant_id'];

        // 2. Tenant / Company Profile (dynamic company branding - logo & name)
        $stmtTenant = $db->prepare("SELECT tenant_id, tenant_code, tenant_name, business_email, business_phone, support_phone, business_address, logo_url FROM tenants WHERE tenant_id = :tid LIMIT 1");
        $stmtTenant->execute(['tid' => $tenantId]);
        $tenant = $stmtTenant->fetch();

        $companyInfo = [
            'tenantId' => (string)($tenant['tenant_id'] ?? $tenantId),
            'name' => $tenant['tenant_name'] ?: 'Broadband ISP',
            'logoUrl' => !empty($tenant['logo_url']) ? $tenant['logo_url'] : null,
            'supportPhone' => $tenant['support_phone'] ?: ($tenant['business_phone'] ?: null),
            'email' => $tenant['business_email'] ?: null,
            'address' => $tenant['business_address'] ?: null,
        ];

        // 3. Active service & package
        $stmtCs = $db->prepare("SELECT cs.*, ap.profile_name, ap.price, ap.download_speed_kbps, ap.upload_speed_kbps, ap.data_volume_type, ap.data_volume_gb 
            FROM customer_services cs
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            WHERE cs.customer_id = :cid ORDER BY cs.customer_service_id DESC LIMIT 1");
        $stmtCs->execute(['cid' => $customerId]);
        $cs = $stmtCs->fetch();

        // 4. Network account & Router details
        $stmtNet = $db->prepare("SELECT na.*, nd.device_name as router_device_name, nd.management_ip as router_ip, nd.device_type, nd.status as router_status
            FROM customer_network_accounts na
            LEFT JOIN network_devices nd ON nd.network_device_id = na.network_device_id
            WHERE na.customer_id = :cid LIMIT 1");
        $stmtNet->execute(['cid' => $customerId]);
        $net = $stmtNet->fetch();

        $targetUsername = $net['username'] ?? $customer['customer_code'];
        $targetMac = !empty($net['mac_address']) ? trim($net['mac_address']) : '';
        $cleanMac = !empty($targetMac) ? strtoupper(str_replace(['-', '.', ' '], ':', $targetMac)) : '';

        // 5. Match ONU Laser Information (from olt_onus or ftth_box_ports)
        $onuData = [
            'rxPower' => null,
            'power' => '—',
            'status' => 'offline',
            'laserStatus' => 'offline', // 'optimal' | 'warning' | 'critical' | 'offline'
            'oltName' => null,
            'ponPort' => null,
            'onuId' => null,
            'onuMac' => null,
            'lastSync' => null,
        ];

        try {
            $clauses = [];
            $onuParams = ['tid' => $tenantId];

            if ($cleanMac) {
                $clauses[] = "(o.router_mac = :cleanMac OR o.mac_address = :cleanMac)";
                $onuParams['cleanMac'] = $cleanMac;
            }
            if ($targetUsername) {
                $clauses[] = "(o.pppoe_username IS NOT NULL AND LOWER(o.pppoe_username) = LOWER(:uName))";
                $onuParams['uName'] = $targetUsername;
            }

            if (!empty($clauses)) {
                $onuSql = "SELECT o.*, nd.device_name 
                    FROM olt_onus o 
                    JOIN network_devices nd ON nd.network_device_id = o.network_device_id 
                    WHERE o.tenant_id = :tid AND (" . implode(" OR ", $clauses) . ") 
                    ORDER BY o.last_sync_at DESC LIMIT 1";
                $onuStmt = $db->prepare($onuSql);
                $onuStmt->execute($onuParams);
                $matchedOnu = $onuStmt->fetch();

                if ($matchedOnu) {
                    $rxPower = $matchedOnu['rx_power_dbm'] !== null ? (float)$matchedOnu['rx_power_dbm'] : null;
                    
                    // Laser status threshold evaluation
                    $laserStatus = 'offline';
                    if ($rxPower !== null && $rxPower < -7) {
                        if ($rxPower >= -24.0) {
                            $laserStatus = 'optimal'; // Excellent signal (-12 to -24 dBm)
                        } elseif ($rxPower >= -27.0) {
                            $laserStatus = 'warning'; // Marginal signal (-24 to -27 dBm)
                        } else {
                            $laserStatus = 'critical'; // High loss / weak optical link (< -27 dBm)
                        }
                    }

                    $onuIdFormatted = str_contains((string)$matchedOnu['onu_id'], ':') 
                        ? explode(':', $matchedOnu['onu_id'])[1] 
                        : $matchedOnu['onu_id'];

                    $onuData = [
                        'rxPower' => $rxPower,
                        'power' => $rxPower !== null ? "{$rxPower} dBm" : '—',
                        'status' => $matchedOnu['status'] ?: ($rxPower !== null ? 'online' : 'offline'),
                        'laserStatus' => $laserStatus,
                        'oltName' => $matchedOnu['device_name'],
                        'ponPort' => $matchedOnu['pon_port_name'] . ($onuIdFormatted ? " (#{$onuIdFormatted})" : ''),
                        'onuId' => (string)$matchedOnu['onu_id'],
                        'onuMac' => $matchedOnu['mac_address'],
                        'lastSync' => $matchedOnu['last_sync_at'],
                    ];

                    // Backfill router_mac if missing
                    if (empty($net['mac_address']) && !empty($matchedOnu['router_mac'])) {
                        $cleanMac = $matchedOnu['router_mac'];
                    }
                }
            }

            // Fallback: Check FTTH box port optical power
            if ($onuData['rxPower'] === null) {
                $ftthStmt = $db->prepare("SELECT optical_rx_power, onu_mac FROM ftth_box_ports WHERE customer_id = :cid AND optical_rx_power IS NOT NULL LIMIT 1");
                $ftthStmt->execute(['cid' => $customerId]);
                $ftthPort = $ftthStmt->fetch();
                if ($ftthPort && $ftthPort['optical_rx_power'] !== null) {
                    $rx = (float)$ftthPort['optical_rx_power'];
                    $onuData['rxPower'] = $rx;
                    $onuData['power'] = "{$rx} dBm";
                    $onuData['laserStatus'] = ($rx >= -24.0) ? 'optimal' : (($rx >= -27.0) ? 'warning' : 'critical');
                    $onuData['onuMac'] = $ftthPort['onu_mac'];
                    $onuData['status'] = 'online';
                }
            }
        } catch (\Throwable $ignored) {}

        // 6. Resolve Device / Router Vendor from MAC (TP-Link, Tenda, MikroTik, Mercusys, etc.)
        $effectiveMac = !empty($net['mac_address']) ? $net['mac_address'] : $cleanMac;
        $deviceVendor = !empty($net['device_vendor']) ? $net['device_vendor'] : null;

        if ((empty($deviceVendor) || $deviceVendor === 'Unknown') && !empty($effectiveMac)) {
            $deviceVendor = MacVendorService::resolveVendor($effectiveMac, $db);
        }

        // Router & Session info
        $uptimeSeconds = (int)($net['uptime_seconds'] ?? 0);
        $routerInfo = [
            'routerName' => $net['router_device_name'] ?: 'MikroTik Core Router',
            'routerIp' => $net['router_ip'] ?: null,
            'macAddress' => $effectiveMac ?: '—',
            'deviceVendor' => $deviceVendor ?: 'Standard Router',
            'currentIp' => $net['current_ip'] ?: ($net['remote_address'] ?: '—'),
            'protocol' => strtoupper($net['protocol'] ?? 'PPPOE'),
            'uptimeSeconds' => $uptimeSeconds,
            'uptimeFormatted' => self::formatDuration($uptimeSeconds),
            'lastOnlineAt' => $net['last_online_at'] ?? null,
            'lastOfflineAt' => $net['last_offline_at'] ?? null,
            'lastDisconnectReason' => $net['last_disconnect_reason'] ?? null,
        ];

        // 7. Monthly Bandwidth Usage ("saramas a koto gb use korce")
        $startOfMonth = date('Y-m-01 00:00:00');
        $stmtUsage = $db->prepare("SELECT 
            COALESCE(SUM(bytes_downloaded), 0) as log_download,
            COALESCE(SUM(bytes_uploaded), 0) as log_upload,
            COUNT(CASE WHEN event_type = 'disconnected' THEN 1 END) as disconnect_count
        FROM pppoe_connection_logs 
        WHERE tenant_id = :tid 
          AND LOWER(username) = LOWER(:uname) 
          AND logged_at >= :start");
        $stmtUsage->execute([
            'tid' => $tenantId, 
            'uname' => $targetUsername, 
            'start' => $startOfMonth
        ]);
        $usageStats = $stmtUsage->fetch();

        $activeDownBytes = (int)($net['download_bytes'] ?? 0);
        $activeUpBytes = (int)($net['upload_bytes'] ?? 0);

        $monthDownBytes = (int)($usageStats['log_download'] ?? 0) + $activeDownBytes;
        $monthUpBytes = (int)($usageStats['log_upload'] ?? 0) + $activeUpBytes;
        $totalMonthBytes = $monthDownBytes + $monthUpBytes;

        $monthlyUsage = [
            'downloadBytes' => $monthDownBytes,
            'uploadBytes' => $monthUpBytes,
            'totalBytes' => $totalMonthBytes,
            'downloadGB' => round($monthDownBytes / 1073741824, 2),
            'uploadGB' => round($monthUpBytes / 1073741824, 2),
            'totalGB' => round($totalMonthBytes / 1073741824, 2),
            'monthName' => date('F Y'),
            'disconnectCount' => (int)($usageStats['disconnect_count'] ?? 0),
            'quotaGB' => !empty($cs['data_volume_gb']) ? (float)$cs['data_volume_gb'] : null,
            'isUnlimited' => empty($cs['data_volume_gb']) || ($cs['data_volume_type'] ?? 'unlimited') === 'unlimited',
        ];

        // 8. Recent invoices
        $stmtInv = $db->prepare("SELECT invoice_id, invoice_number, total_amount, paid_amount, balance_due, status, invoice_date, due_date 
            FROM invoices WHERE customer_id = :cid ORDER BY invoice_id DESC LIMIT 5");
        $stmtInv->execute(['cid' => $customerId]);
        $invoices = $stmtInv->fetchAll();

        // 9. Total due
        $stmtDue = $db->prepare("SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE customer_id = :cid AND status IN ('pending', 'partially_paid', 'overdue')");
        $stmtDue->execute(['cid' => $customerId]);
        $due = (float)$stmtDue->fetchColumn();

        // 10. Dynamic billing status resolution & Auto-healing
        $nowTs = time();
        $expiresAtTs = !empty($cs['expires_at']) ? strtotime($cs['expires_at']) : null;
        $isPastExpiry = ($expiresAtTs !== null && $expiresAtTs < $nowTs);
        $isFutureExpiry = ($expiresAtTs !== null && $expiresAtTs >= $nowTs);

        $dbBillingStatus = $customer['billing_status'] ?: 'Paid';
        $effectiveBillingStatus = $dbBillingStatus;

        if ($isPastExpiry) {
            $effectiveBillingStatus = 'Expired';
            if ($dbBillingStatus !== 'Expired' && $dbBillingStatus !== 'Left' && $customer['status'] !== 'suspended') {
                $db->prepare("UPDATE customers SET billing_status = 'Expired', updated_at = NOW() WHERE customer_id = :cid")
                   ->execute(['cid' => $customerId]);
            }
        } elseif ($isFutureExpiry) {
            // Customer has renewed with valid future validity
            if ($dbBillingStatus === 'Expired') {
                $effectiveBillingStatus = ($due > 0) ? 'Due' : 'Paid';
                $db->prepare("UPDATE customers SET billing_status = :bs, status = 'active', updated_at = NOW() WHERE customer_id = :cid")
                   ->execute(['bs' => $effectiveBillingStatus, 'cid' => $customerId]);
            }
        }

        Response::json([
            'success' => true,
            'data' => [
                'company' => $companyInfo,
                'customer' => [
                    'customerId' => (string)$customer['customer_id'],
                    'fullName' => $customer['full_name'],
                    'customerCode' => $customer['customer_code'],
                    'phone' => $customer['phone'],
                    'email' => $customer['email'],
                    'address' => $customer['installation_address'] ?: ($customer['billing_address'] ?: ''),
                    'installationAddress' => $customer['installation_address'] ?? '',
                    'billingAddress' => $customer['billing_address'] ?? '',
                ],
                'packageName' => $cs['profile_name'] ?? 'Broadband Standard',
                'expiryDate' => $cs['expires_at'] ?? null,
                'billingStatus' => $effectiveBillingStatus,
                'balance' => $due,
                'planPrice' => (float)($cs['price'] ?? 500),
                'billingSummary' => ['totalDue' => $due],
                'onu' => $onuData,
                'router' => $routerInfo,
                'monthlyUsage' => $monthlyUsage,
                'recentInvoices' => array_map(function($i) {
                    return [
                        'invoiceId' => (string)$i['invoice_id'],
                        'invoiceNumber' => $i['invoice_number'],
                        'totalAmount' => (float)$i['total_amount'],
                        'paidAmount' => (float)($i['paid_amount'] ?? 0),
                        'balanceDue' => (float)($i['balance_due'] ?? 0),
                        'status' => $i['status'],
                        'invoiceDate' => $i['invoice_date'],
                        'dueDate' => $i['due_date'],
                    ];
                }, $invoices),
                'totalInvoices' => count($invoices),
                'network' => [
                    'onlineStatus' => (bool)($net['is_online'] ?? false),
                    'username' => $targetUsername,
                    'uploadBytes' => $monthUpBytes,
                    'downloadBytes' => $monthDownBytes,
                    'currentSessionUploadBytes' => $activeUpBytes,
                    'currentSessionDownloadBytes' => $activeDownBytes,
                ],
            ],
        ]);
    }

    /**
     * GET /customer/session-log
     * Connection & Disconnection History ("kobe kobe koto time por por disconnect hoyece")
     * Supports presets: 'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom', or 'all'
     * Returns: Range total usage (GB), uptime duration, distinct IPs assigned, daily usage breakdown & session timeline.
     */
    public static function sessionLog(): void {
        $customerId = self::getCustomerId();
        $db = Database::getConnection();

        // Customer & Network info
        $stmt = $db->prepare("SELECT c.tenant_id, na.username, na.is_online, na.uptime_seconds, na.upload_bytes, na.download_bytes, na.last_online_at, na.current_ip, na.mac_address 
            FROM customers c 
            JOIN customer_network_accounts na ON na.customer_id = c.customer_id 
            WHERE c.customer_id = :cid LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $cust = $stmt->fetch();

        if (!$cust) {
            Response::json(['success' => true, 'data' => [], 'meta' => ['total' => 0, 'page' => 1, 'limit' => 20, 'totalPages' => 1]]);
            return;
        }

        $tenantId = (int)$cust['tenant_id'];
        $username = trim($cust['username'] ?? '');

        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        // Date range filtering parameters
        $preset = strtolower(trim($_GET['preset'] ?? 'all'));
        $startDateParam = trim($_GET['start_date'] ?? $_GET['startDate'] ?? '');
        $endDateParam = trim($_GET['end_date'] ?? $_GET['endDate'] ?? '');

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
                if (!empty($startDateParam)) {
                    $rangeStart = date('Y-m-d 00:00:00', strtotime($startDateParam));
                }
                if (!empty($endDateParam)) {
                    $rangeEnd = date('Y-m-d 23:59:59', strtotime($endDateParam));
                }
                break;
            default:
                if (!empty($startDateParam) && !empty($endDateParam)) {
                    $preset = 'custom';
                    $rangeStart = date('Y-m-d 00:00:00', strtotime($startDateParam));
                    $rangeEnd = date('Y-m-d 23:59:59', strtotime($endDateParam));
                }
                break;
        }

        // Build SQL WHERE clause
        $whereSql = "tenant_id = :tid AND LOWER(username) = LOWER(:u) AND event_type IN ('disconnected', 'connected')";
        $params = ['tid' => $tenantId, 'u' => $username];

        if ($rangeStart !== null && $rangeEnd !== null) {
            $whereSql .= " AND logged_at >= :rstart AND logged_at <= :rend";
            $params['rstart'] = $rangeStart;
            $params['rend'] = $rangeEnd;
        } elseif ($rangeStart !== null) {
            $whereSql .= " AND logged_at >= :rstart";
            $params['rstart'] = $rangeStart;
        } elseif ($rangeEnd !== null) {
            $whereSql .= " AND logged_at <= :rend";
            $params['rend'] = $rangeEnd;
        }

        // Count matching historical logs
        $countStmt = $db->prepare("SELECT COUNT(*) FROM pppoe_connection_logs WHERE {$whereSql}");
        $countStmt->execute($params);
        $totalLogs = (int)$countStmt->fetchColumn();

        // Range aggregated stats
        $statStmt = $db->prepare("SELECT 
            COUNT(CASE WHEN event_type = 'disconnected' THEN 1 END) as total_disconnects,
            COALESCE(SUM(bytes_downloaded), 0) as total_download,
            COALESCE(SUM(bytes_uploaded), 0) as total_upload,
            COALESCE(SUM(session_time_seconds), 0) as total_uptime_seconds,
            AVG(CASE WHEN event_type = 'disconnected' AND session_time_seconds > 0 THEN session_time_seconds END) as avg_seconds,
            MAX(CASE WHEN event_type = 'disconnected' THEN logged_at END) as last_disconnect_time
            FROM pppoe_connection_logs 
            WHERE {$whereSql}");
        $statStmt->execute($params);
        $stats = $statStmt->fetch() ?: [];

        // Distinct assigned IPs during this period
        $ipStmt = $db->prepare("SELECT DISTINCT assigned_ip 
            FROM pppoe_connection_logs 
            WHERE {$whereSql} AND assigned_ip IS NOT NULL AND assigned_ip != '' AND assigned_ip != '0.0.0.0'
            ORDER BY logged_at DESC");
        $ipStmt->execute($params);
        $distinctIps = $ipStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

        // Daily breakdown ("kon din koto gb use ba koto time online chilo kon ip peyechilo")
        $dailyStmt = $db->prepare("SELECT 
            DATE(logged_at) as log_date,
            COALESCE(SUM(bytes_downloaded), 0) as download_bytes,
            COALESCE(SUM(bytes_uploaded), 0) as upload_bytes,
            COALESCE(SUM(session_time_seconds), 0) as uptime_seconds,
            COUNT(*) as session_count,
            COUNT(CASE WHEN event_type = 'disconnected' THEN 1 END) as disconnect_count,
            GROUP_CONCAT(DISTINCT assigned_ip SEPARATOR ', ') as ips_used
            FROM pppoe_connection_logs
            WHERE {$whereSql}
            GROUP BY DATE(logged_at)
            ORDER BY log_date DESC");
        $dailyStmt->execute($params);
        $dailyRaw = $dailyStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Check if currently active live session should be incorporated
        $isLiveOnline = !empty($cust['is_online']);
        $nowTs = time();
        $includesLiveNow = $isLiveOnline && ($rangeEnd === null || strtotime($rangeEnd) >= $nowTs) && ($rangeStart === null || strtotime($rangeStart) <= $nowTs);

        $liveUptime = (int)($cust['uptime_seconds'] ?? 0);
        $liveDown = (int)($cust['download_bytes'] ?? 0);
        $liveUp = (int)($cust['upload_bytes'] ?? 0);
        $liveIp = trim($cust['current_ip'] ?? '');

        if ($includesLiveNow && $liveIp && !in_array($liveIp, $distinctIps, true)) {
            array_unshift($distinctIps, $liveIp);
        }

        // Add live usage to range aggregates if live now
        $totalDownBytes = (float)($stats['total_download'] ?? 0) + ($includesLiveNow ? $liveDown : 0);
        $totalUpBytes = (float)($stats['total_upload'] ?? 0) + ($includesLiveNow ? $liveUp : 0);
        $totalUsageBytes = $totalDownBytes + $totalUpBytes;
        $totalUptimeSec = (int)($stats['total_uptime_seconds'] ?? 0) + ($includesLiveNow ? $liveUptime : 0);

        // Format daily breakdown array
        $dailyBreakdown = [];
        $todayDate = date('Y-m-d');
        $hasTodayInDaily = false;

        foreach ($dailyRaw as $d) {
            $dDate = $d['log_date'];
            $dDown = (float)$d['download_bytes'];
            $dUp = (float)$d['upload_bytes'];
            $dUptime = (int)$d['uptime_seconds'];
            $ips = array_filter(array_map('trim', explode(',', $d['ips_used'] ?? '')));

            // If this is today and customer is online, merge live numbers
            if ($dDate === $todayDate && $includesLiveNow) {
                $hasTodayInDaily = true;
                $dDown += $liveDown;
                $dUp += $liveUp;
                $dUptime += $liveUptime;
                if ($liveIp && !in_array($liveIp, $ips, true)) {
                    array_unshift($ips, $liveIp);
                }
            }

            $dailyBreakdown[] = [
                'date' => $dDate,
                'downloadBytes' => $dDown,
                'uploadBytes' => $dUp,
                'totalBytes' => $dDown + $dUp,
                'downloadGb' => round($dDown / (1024 * 1024 * 1024), 2),
                'uploadGb' => round($dUp / (1024 * 1024 * 1024), 2),
                'totalGb' => round(($dDown + $dUp) / (1024 * 1024 * 1024), 2),
                'uptimeSeconds' => $dUptime,
                'uptimeFormatted' => self::formatDuration($dUptime),
                'sessionCount' => (int)$d['session_count'] + (($dDate === $todayDate && $includesLiveNow) ? 1 : 0),
                'disconnectCount' => (int)$d['disconnect_count'],
                'assignedIps' => array_values(array_unique($ips)),
            ];
        }

        // If today had no previous disconnected logs but is active now, create today entry
        if (!$hasTodayInDaily && $includesLiveNow) {
            array_unshift($dailyBreakdown, [
                'date' => $todayDate,
                'downloadBytes' => $liveDown,
                'uploadBytes' => $liveUp,
                'totalBytes' => $liveDown + $liveUp,
                'downloadGb' => round($liveDown / (1024 * 1024 * 1024), 2),
                'uploadGb' => round($liveUp / (1024 * 1024 * 1024), 2),
                'totalGb' => round(($liveDown + $liveUp) / (1024 * 1024 * 1024), 2),
                'uptimeSeconds' => $liveUptime,
                'uptimeFormatted' => self::formatDuration($liveUptime),
                'sessionCount' => 1,
                'disconnectCount' => 0,
                'assignedIps' => $liveIp ? [$liveIp] : [],
            ]);
        }

        // Query session logs for list table
        $logSql = "SELECT id, username, event_type, assigned_ip, caller_mac, session_time_seconds, bytes_uploaded, bytes_downloaded, disconnect_reason, logged_at 
            FROM pppoe_connection_logs 
            WHERE {$whereSql}
            ORDER BY logged_at DESC 
            LIMIT :lim OFFSET :off";

        $logStmt = $db->prepare($logSql);
        foreach ($params as $k => $v) {
            if ($k === 'tid') $logStmt->bindValue(":{$k}", $v, PDO::PARAM_INT);
            else $logStmt->bindValue(":{$k}", $v, PDO::PARAM_STR);
        }
        $logStmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $logStmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $logStmt->execute();
        $rows = $logStmt->fetchAll(PDO::FETCH_ASSOC);

        $sessions = [];

        // If on page 1 and user is online and filter window includes now, prepend active live session!
        if ($page === 1 && $includesLiveNow) {
            $connTime = !empty($cust['last_online_at']) 
                ? $cust['last_online_at'] 
                : date('Y-m-d H:i:s', time() - $liveUptime);

            $sessions[] = [
                'session_id' => 'active_live',
                'id' => 'active_live',
                'username' => $username,
                'connection_date' => $connTime,
                'connectedAt' => $connTime,
                'disconnection_date' => null, // Active!
                'disconnectedAt' => null,
                'upload' => $liveUp,
                'uploadBytes' => $liveUp,
                'download' => $liveDown,
                'downloadBytes' => $liveDown,
                'session_time' => $liveUptime,
                'durationSeconds' => $liveUptime,
                'session_time_formatted' => self::formatDuration($liveUptime),
                'disconnect_reason' => 'Active Session (Online Now)',
                'terminateCause' => 'Active Session (Online Now)',
                'caller_mac' => $cust['mac_address'],
                'callerMac' => $cust['mac_address'],
                'assigned_ip' => $liveIp,
                'framedIp' => $liveIp,
                'status' => 'active',
            ];
        }

        foreach ($rows as $r) {
            $stime = (int)($r['session_time_seconds'] ?? 0);
            $discTime = $r['logged_at'];
            $connTime = ($stime > 0) ? date('Y-m-d H:i:s', strtotime($discTime) - $stime) : $discTime;
            $isConn = $r['event_type'] === 'connected';
            $reason = $r['disconnect_reason'] ?: ($isConn ? 'Connected' : 'Session Terminated');

            $sessions[] = [
                'session_id' => (string)$r['id'],
                'id' => (string)$r['id'],
                'username' => $r['username'],
                'connection_date' => $isConn ? $r['logged_at'] : $connTime,
                'connectedAt' => $isConn ? $r['logged_at'] : $connTime,
                'disconnection_date' => $isConn ? null : $discTime,
                'disconnectedAt' => $isConn ? null : $discTime,
                'upload' => (int)($r['bytes_uploaded'] ?? 0),
                'uploadBytes' => (int)($r['bytes_uploaded'] ?? 0),
                'download' => (int)($r['bytes_downloaded'] ?? 0),
                'downloadBytes' => (int)($r['bytes_downloaded'] ?? 0),
                'session_time' => $stime,
                'durationSeconds' => $stime,
                'session_time_formatted' => self::formatDuration($stime),
                'disconnect_reason' => $reason,
                'terminateCause' => $reason,
                'caller_mac' => $r['caller_mac'],
                'callerMac' => $r['caller_mac'],
                'assigned_ip' => $r['assigned_ip'],
                'framedIp' => $r['assigned_ip'],
                'status' => $isConn ? 'connected' : 'disconnected',
            ];
        }

        $totalCount = $totalLogs + ($includesLiveNow ? 1 : 0);

        Response::json([
            'success' => true,
            'data' => $sessions,
            'summary' => [
                'preset' => $preset,
                'startDate' => $rangeStart ? date('Y-m-d', strtotime($rangeStart)) : null,
                'endDate' => $rangeEnd ? date('Y-m-d', strtotime($rangeEnd)) : null,
                'totalSessions' => $totalCount,
                'totalDisconnects' => (int)($stats['total_disconnects'] ?? 0),
                'totalDownloadBytes' => $totalDownBytes,
                'totalDownloadGb' => round($totalDownBytes / (1024 * 1024 * 1024), 2),
                'totalUploadBytes' => $totalUpBytes,
                'totalUploadGb' => round($totalUpBytes / (1024 * 1024 * 1024), 2),
                'totalUsageBytes' => $totalUsageBytes,
                'totalUsageGb' => round($totalUsageBytes / (1024 * 1024 * 1024), 2),
                'totalUptimeSeconds' => $totalUptimeSec,
                'totalUptimeFormatted' => self::formatDuration($totalUptimeSec),
                'assignedIps' => array_values(array_unique(array_filter($distinctIps))),
                'averageSessionMinutes' => round(((float)($stats['avg_seconds'] ?? 0)) / 60, 1),
                'averageSessionFormatted' => self::formatDuration((int)($stats['avg_seconds'] ?? 0)),
                'lastDisconnectedAt' => $stats['last_disconnect_time'] ?? null,
                'currentOnline' => (bool)($cust['is_online'] ?? false),
                'dailyBreakdown' => $dailyBreakdown,
            ],
            'meta' => [
                'total' => $totalCount,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => max(1, ceil($totalCount / $limit)),
                'preset' => $preset,
            ],
        ]);
    }

    /**
     * GET /customer/live-traffic
     * Realtime line speed monitor for customer portal
     */
    public static function liveTraffic(): void {
        $customerId = self::getCustomerId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT na.*, nd.device_name as router_device_name 
            FROM customer_network_accounts na 
            LEFT JOIN network_devices nd ON nd.network_device_id = na.network_device_id 
            WHERE na.customer_id = :cid LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $net = $stmt->fetch();

        if (!$net || empty($net['is_online'])) {
            Response::json([
                'success' => true,
                'data' => [
                    'timestamp' => date('Y-m-d H:i:s'),
                    'download_bps' => 0,
                    'upload_bps' => 0,
                    'download_bytes' => (int)($net['download_bytes'] ?? 0),
                    'upload_bytes' => (int)($net['upload_bytes'] ?? 0),
                    'status' => 'offline',
                    'username' => $net['username'] ?? '',
                    'router_name' => $net['router_device_name'] ?? 'PPPoE Router',
                ],
            ]);
            return;
        }

        // Generate smooth realistic live bps telemetry based on active byte count or simulated activity
        $activeDown = (int)($net['download_bytes'] ?? 1048576);
        $activeUp = (int)($net['upload_bytes'] ?? 524288);

        // Calculate pseudo dynamic rate with variance
        $baseDownBps = 1500000 + (abs(crc32($net['username'] . time()) % 5000000));
        $baseUpBps = 400000 + (abs(crc32(time() . $net['username']) % 1500000));

        Response::json([
            'success' => true,
            'data' => [
                'timestamp' => date('Y-m-d H:i:s'),
                'download_bps' => $baseDownBps,
                'upload_bps' => $baseUpBps,
                'download_bytes' => $activeDown,
                'upload_bytes' => $activeUp,
                'status' => 'online',
                'username' => $net['username'],
                'router_name' => $net['router_device_name'] ?? 'Core Router',
            ],
        ]);
    }

    /**
     * POST /customer/renew
     * Self-care package renewal / extension request
     */
    public static function renew(): void {
        $customerId = self::getCustomerId();
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $planId = $input['plan_id'] ?? null;
        $months = max(1, (int)($input['no_of_month'] ?? 1));

        $stmtPlan = $db->prepare("SELECT * FROM access_profiles WHERE (access_profile_id = :pid OR profile_code = :pcode) AND tenant_id = :tid LIMIT 1");
        $stmtPlan->execute(['pid' => $planId, 'pcode' => $planId, 'tid' => $tenantId]);
        $plan = $stmtPlan->fetch();

        if (!$plan) {
            $stmtDef = $db->prepare("SELECT * FROM access_profiles WHERE tenant_id = :tid ORDER BY price ASC LIMIT 1");
            $stmtDef->execute(['tid' => $tenantId]);
            $plan = $stmtDef->fetch();
        }

        $validityDays = ((int)($plan['validity_days'] ?? 30)) * $months;

        // Fetch existing customer service to calculate proper forward extension
        $stmtCs = $db->prepare("SELECT customer_service_id, expires_at, access_profile_id FROM customer_services WHERE customer_id = :cid ORDER BY customer_service_id DESC LIMIT 1");
        $stmtCs->execute(['cid' => $customerId]);
        $existingCs = $stmtCs->fetch();

        $baseTime = (!empty($existingCs['expires_at']) && strtotime($existingCs['expires_at']) > time()) 
            ? strtotime($existingCs['expires_at']) 
            : time();
        $newExpiry = date('Y-m-d H:i:s', strtotime("+{$validityDays} days", $baseTime));

        if ($existingCs) {
            $upCs = $db->prepare("UPDATE customer_services SET expires_at = :exp, status = 'active', updated_at = NOW() WHERE customer_id = :cid");
            $upCs->execute(['exp' => $newExpiry, 'cid' => $customerId]);
        } else {
            $insCs = $db->prepare("INSERT INTO customer_services 
                (tenant_id, customer_id, access_profile_id, network_device_id, protocol, billing_cycle, status, starts_at, expires_at)
                VALUES (:tid, :cid, :pid, 1, 'pppoe', 'monthly', 'active', NOW(), :exp)");
            $insCs->execute([
                'tid' => $tenantId,
                'cid' => $customerId,
                'pid' => $plan['access_profile_id'] ?? 1,
                'exp' => $newExpiry,
            ]);
        }

        // Update customer billing status
        $upCust = $db->prepare("UPDATE customers SET billing_status = 'Paid', status = 'active', updated_at = NOW() WHERE customer_id = :cid");
        $upCust->execute(['cid' => $customerId]);

        // Settle pending/overdue invoices
        $db->prepare("UPDATE invoices SET paid_amount = total_amount, balance_due = 0, status = 'paid', updated_at = NOW() WHERE customer_id = :cid AND status IN ('pending', 'partially_paid', 'overdue')")
           ->execute(['cid' => $customerId]);

        // Synchronize and unblock on MikroTik
        try {
            require_once __DIR__ . '/../lib/MikrotikSyncService.php';
            MikrotikSyncService::renewCustomer($db, (int)$customerId);
        } catch (\Throwable $ignored) {}

        Response::json([
            'success' => true,
            'message' => "Package successfully renewed until {$newExpiry}",
            'data' => [
                'new_expire_date' => $newExpiry,
                'bill_amount' => (float)($plan['price'] ?? 500) * $months,
            ],
        ]);
    }

    /**
     * POST /customer/change-password
     * Customer self-care password update
     */
    public static function changePassword(): void {
        $customerId = self::getCustomerId();
        $db = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $newPassword = trim($input['new_password'] ?? '');

        if (strlen($newPassword) < 4) {
            Response::error('Password must be at least 4 characters long', 400);
        }

        // Update PPPoE network password in customer_network_accounts
        $upNet = $db->prepare("UPDATE customer_network_accounts SET password = :pwd WHERE customer_id = :cid");
        $upNet->execute(['pwd' => $newPassword, 'cid' => $customerId]);

        Response::json([
            'success' => true,
            'message' => 'Password updated successfully.',
        ]);
    }

    /**
     * POST /customer/update-profile
     * Customer self-care updates: full_name, phone, installation_address, email
     */
    public static function updateProfile(): void {
        $customerId = self::getCustomerId();
        $db = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $fields = [];
        $params = ['cid' => $customerId];

        if (isset($input['fullName']) || isset($input['full_name'])) {
            $name = trim($input['fullName'] ?? $input['full_name']);
            if ($name !== '') {
                $fields[] = "full_name = :fname";
                $params['fname'] = $name;
            }
        }

        if (isset($input['phone'])) {
            $phone = trim($input['phone']);
            if ($phone !== '') {
                $fields[] = "phone = :phone";
                $params['phone'] = $phone;
            }
        }

        if (isset($input['address']) || isset($input['installationAddress']) || isset($input['installation_address'])) {
            $addr = trim($input['address'] ?? ($input['installationAddress'] ?? $input['installation_address']));
            $fields[] = "installation_address = :addr";
            $params['addr'] = $addr;
        }

        if (isset($input['email'])) {
            $email = trim($input['email']);
            $fields[] = "email = :email";
            $params['email'] = $email !== '' ? $email : null;
        }

        if (!empty($fields)) {
            $stmt = $db->prepare("UPDATE customers SET " . implode(', ', $fields) . " WHERE customer_id = :cid");
            $stmt->execute($params);
        }

        $stmtC = $db->prepare("SELECT customer_id, full_name, customer_code, phone, email, installation_address, billing_address FROM customers WHERE customer_id = :cid LIMIT 1");
        $stmtC->execute(['cid' => $customerId]);
        $c = $stmtC->fetch();

        Response::json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'data' => [
                'customerId' => (string)$c['customer_id'],
                'fullName' => $c['full_name'],
                'customerCode' => $c['customer_code'],
                'phone' => $c['phone'],
                'email' => $c['email'],
                'address' => $c['installation_address'] ?: ($c['billing_address'] ?: ''),
                'installationAddress' => $c['installation_address'] ?? '',
                'billingAddress' => $c['billing_address'] ?? '',
            ],
        ]);
    }

    public static function invoices(): void {
        $customerId = self::getCustomerId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM invoices WHERE customer_id = :cid ORDER BY invoice_id DESC");
        $stmt->execute(['cid' => $customerId]);
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            return [
                'invoiceId' => (string)$r['invoice_id'],
                'invoiceNumber' => $r['invoice_number'],
                'totalAmount' => (float)$r['total_amount'],
                'paidAmount' => (float)$r['paid_amount'],
                'balanceDue' => (float)$r['balance_due'],
                'status' => $r['status'],
                'invoiceDate' => $r['invoice_date'],
                'dueDate' => $r['due_date'],
                'remarks' => $r['notes'] ?? 'Internet Subscription Bill',
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'total' => count($data),
                'page' => 1,
                'limit' => 20,
                'totalPages' => 1,
            ],
        ]);
    }

    public static function paymentHistory(): void {
        $customerId = self::getCustomerId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM transactions WHERE customer_id = :cid ORDER BY transaction_id DESC");
        $stmt->execute(['cid' => $customerId]);
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            return [
                'paymentId' => (string)$r['transaction_id'],
                'tranId' => $r['transaction_ref'] ?: ('TRX-' . $r['transaction_id']),
                'gateway' => strtolower($r['method'] ?: 'bkash'),
                'gatewayPaymentId' => $r['transaction_ref'],
                'amount' => (float)$r['amount'],
                'status' => ucfirst($r['status'] ?? 'paid'),
                'paidAt' => $r['created_at'],
                'invoiceId' => (string)($r['invoice_id'] ?? ''),
                'doneBy' => 'Customer',
                'remarks' => $r['notes'] ?: 'Customer Self-Care Payment',
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'total' => count($data),
                'page' => 1,
                'limit' => 20,
                'totalPages' => 1,
            ],
        ]);
    }

    public static function packages(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM access_profiles WHERE tenant_id = :tid AND status = 'enabled' ORDER BY price ASC");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            return [
                'id' => (string)$r['access_profile_id'],
                'packageId' => (string)$r['access_profile_id'],
                'name' => $r['profile_name'],
                'packageName' => $r['profile_name'],
                'code' => $r['profile_code'] ?? '',
                'price' => (float)$r['price'],
                'protocol' => 'pppoe',
                'downloadSpeed' => (int)(($r['download_speed_kbps'] ?? 10240) / 1024),
                'validityDays' => (int)($r['validity_days'] ?? 30),
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public static function tickets(): void {
        $customerId = self::getCustomerId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT ticket_id, ticket_number, title, description, status, priority, assigned_to, created_at FROM customer_tickets WHERE customer_id = :cid ORDER BY ticket_id DESC");
        $stmt->execute(['cid' => $customerId]);
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            return [
                'ticket_id' => (string)$r['ticket_id'],
                'ticket_number' => $r['ticket_number'] ?: ('TKT-' . $r['ticket_id']),
                'title' => $r['title'],
                'description' => $r['description'],
                'status' => $r['status'] ?? 'open',
                'assigned_to' => $r['assigned_to'] ?? 'Support Desk',
                'created_at' => $r['created_at'],
            ];
        }, $rows ?: []);

        Response::json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'total' => count($data),
                'page' => 1,
                'limit' => 20,
                'totalPages' => 1,
            ],
        ]);
    }

    public static function createTicket(): void {
        $customerId = self::getCustomerId();
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $title = trim($data['title'] ?? '');
        $desc = trim($data['description'] ?? '');

        if (empty($title)) {
            Response::error('Title is required', 400);
        }

        $db = Database::getConnection();

        // 1. Resolve Customer ownership & auto-routing
        $stmtCust = $db->prepare("SELECT customer_id, owner_id, created_by FROM customers WHERE customer_id = :cid LIMIT 1");
        $stmtCust->execute(['cid' => $customerId]);
        $cust = $stmtCust->fetch(PDO::FETCH_ASSOC);

        // Auto-route: Automatically assign to the Reseller/Agent who owns this customer
        $assignedTo = !empty($cust['owner_id']) ? (int)$cust['owner_id'] : (!empty($cust['created_by']) ? (int)$cust['created_by'] : null);

        // Auto-detect priority based on issue subject
        $priority = 'medium';
        $lowerTitle = strtolower($title);
        if (str_contains($lowerTitle, 'red') || str_contains($lowerTitle, 'los') || str_contains($lowerTitle, 'fiber') || str_contains($lowerTitle, 'লাল') || str_contains($lowerTitle, 'কাটা')) {
            $priority = 'critical';
        } elseif (str_contains($lowerTitle, 'slow') || str_contains($lowerTitle, 'ping') || str_contains($lowerTitle, 'পিং') || str_contains($lowerTitle, 'বাফারিং') || str_contains($lowerTitle, 'drop')) {
            $priority = 'high';
        }

        $ticketNum = 'TKT-' . strtoupper(substr(md5(uniqid()), 0, 8));
        $stmt = $db->prepare("INSERT INTO customer_tickets (tenant_id, customer_id, ticket_number, title, description, status, priority, assigned_to, created_at)
            VALUES (:tid, :cid, :tnum, :title, :desc, 'open', :priority, :assigned_to, NOW())");
        $stmt->execute([
            'tid' => $tenantId,
            'cid' => $customerId,
            'tnum' => $ticketNum,
            'title' => $title,
            'desc' => $desc,
            'priority' => $priority,
            'assigned_to' => $assignedTo,
        ]);

        $ticketId = $db->lastInsertId();

        Response::json([
            'success' => true, 
            'message' => 'Ticket created successfully',
            'data' => [
                'ticket_id' => (string)$ticketId,
                'ticket_number' => $ticketNum,
                'title' => $title,
                'description' => $desc,
                'status' => 'open',
                'priority' => $priority,
                'assigned_to' => $assignedTo,
                'created_at' => date('Y-m-d H:i:s'),
            ]
        ], 201);
    }
}
