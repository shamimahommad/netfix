<?php
/**
 * NetFix ISP SaaS - Dashboard Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';
require_once __DIR__ . '/HealthController.php';

class DashboardController {
    public static function stats(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $callerId = (int)$user['user_id'];
        $scope = HierarchySecurityService::getDownwardScopeClause($callerId, $tenantId ? (int)$tenantId : null, 'c', 'u');
        $custWhere = !empty($scope['whereSql']) ? "WHERE {$scope['whereSql']}" : "WHERE c.tenant_id = :tid";
        $custParams = $scope['params'];
        if (empty($custParams['scope_tenant_id']) && $tenantId) {
            $custParams['tid'] = $tenantId;
        }

        // 1. Customer metrics scoped downward to user and descendants
        $stmt = $db->prepare("SELECT 
            COUNT(c.customer_id) as total_customers,
            SUM(CASE WHEN c.status = 'active' AND (c.billing_status != 'Expired' AND (cs.expires_at IS NULL OR cs.expires_at >= NOW())) THEN 1 ELSE 0 END) as active_customers,
            SUM(CASE WHEN DATE(c.created_at) = CURDATE() THEN 1 ELSE 0 END) as today_join,
            SUM(CASE WHEN c.customer_type = 'individual' THEN 1 ELSE 0 END) as home_customers,
            SUM(CASE WHEN c.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND c.created_at < DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END) as last_month_join,
            SUM(CASE WHEN c.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END) as this_month_join,
            SUM(CASE WHEN (c.billing_status = 'Expired' OR (cs.expires_at IS NOT NULL AND cs.expires_at < NOW())) AND c.status != 'suspended' AND c.status != 'cancelled' AND c.status != 'terminated' THEN 1 ELSE 0 END) as expired_customers,
            SUM(CASE WHEN c.status = 'suspended' THEN 1 ELSE 0 END) as suspended_customers,
            SUM(CASE WHEN c.status = 'cancelled' OR c.status = 'terminated' THEN 1 ELSE 0 END) as left_customers
            FROM customers c
            LEFT JOIN users u ON u.user_id = c.owner_id
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id AND cs.status != 'cancelled'
            {$custWhere}");
        $stmt->execute($custParams);
        $c = $stmt->fetch() ?: [];

        // 2. Collection metrics scoped downward to user's branch
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($user['role'] ?? '') === 0 || ($user['role'] ?? '') === 'saas_admin');
        $txParams = ['scope_tenant_id' => $tenantId];

        if ($isLevel0) {
            $txWhere = "WHERE t.tenant_id = :scope_tenant_id";
        } else {
            $rawPath = $user['hierarchy_path'] ?? "/{$callerId}/";
            $userPath = '/' . trim($rawPath, '/') . '/';
            $txParams['scope_uid'] = $callerId;
            $txParams['scope_path_wildcard'] = $userPath . '%';
            $txWhere = "WHERE t.tenant_id = :scope_tenant_id 
                AND (c.owner_id = :scope_uid 
                     OR u.hierarchy_path LIKE :scope_path_wildcard 
                     OR c.owner_path LIKE :scope_path_wildcard 
                     OR t.initiator_user_id = :scope_uid 
                     OR u_init.hierarchy_path LIKE :scope_path_wildcard 
                     OR t.collector_user_id = :scope_uid)";
        }

        // Online payment identification rule:
        // Gateway transactions, paybill, webhooks, or online payment gateways (bKash, Nagad, etc.)
        // Renewals or recharges from balance/wallet are Cash ('cash'), NOT online.
        $onlineCondition = "(t.transaction_type = 'GATEWAY_PAYMENT' OR LOWER(COALESCE(t.method, '')) IN ('bkash', 'nagad', 'rocket', 'upay', 'sslcommerz', 'ssl', 'surjopay', 'shurjopay', 'aamarpay', 'online', 'webhook', 'paybill', 'pgw'))";

        $stmt = $db->prepare("SELECT 
            SUM(CASE WHEN DATE(t.created_at) = CURDATE() AND t.transaction_type != 'REFUND' THEN t.amount ELSE 0 END) as today_collection,
            SUM(CASE WHEN t.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') AND t.transaction_type != 'REFUND' THEN t.amount ELSE 0 END) as this_month_collection,
            SUM(CASE WHEN t.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND t.created_at < DATE_FORMAT(NOW(), '%Y-%m-01') AND t.transaction_type != 'REFUND' THEN t.amount ELSE 0 END) as last_month_collection,
            SUM(CASE WHEN DATE(t.created_at) = CURDATE() AND {$onlineCondition} THEN t.amount ELSE 0 END) as online_today,
            SUM(CASE WHEN t.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') AND {$onlineCondition} THEN t.amount ELSE 0 END) as online_this_month,
            SUM(CASE WHEN t.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND {$onlineCondition} THEN t.amount ELSE 0 END) as online_last_month
            FROM transactions t
            LEFT JOIN customers c ON c.customer_id = t.customer_id
            LEFT JOIN users u ON u.user_id = c.owner_id
            LEFT JOIN users u_init ON u_init.user_id = t.initiator_user_id
            {$txWhere}");
        $stmt->execute($txParams);
        $t = $stmt->fetch() ?: [];

        $hideSales = HierarchySecurityService::hasPermission($callerId, 'hide_dashboard_sales');

        Response::json([
            'totalCustomers' => (int)($c['total_customers'] ?? 0),
            'totalActive' => (int)($c['active_customers'] ?? 0),
            'todayJoin' => (int)($c['today_join'] ?? 0),
            'homeCustomers' => (int)($c['home_customers'] ?? 0),
            'lastMonthJoin' => (int)($c['last_month_join'] ?? 0),
            'thisMonthJoin' => (int)($c['this_month_join'] ?? 0),
            'expiredCustomers' => (int)($c['expired_customers'] ?? 0),
            'suspendedCustomers' => (int)($c['suspended_customers'] ?? 0),
            'leftCustomers' => (int)($c['left_customers'] ?? 0),
            'todayCollection' => $hideSales ? 0.0 : (float)($t['today_collection'] ?? 0),
            'thisMonthCollection' => $hideSales ? 0.0 : (float)($t['this_month_collection'] ?? 0),
            'lastMonthCollection' => $hideSales ? 0.0 : (float)($t['last_month_collection'] ?? 0),
            'hotspotTotal' => 0,
            'hotspotActive' => 0,
            'hotspotExpired' => 0,
            'onlinePaymentToday' => $hideSales ? 0.0 : (float)($t['online_today'] ?? 0),
            'onlinePaymentThisMonth' => $hideSales ? 0.0 : (float)($t['online_this_month'] ?? 0),
            'onlinePaymentLastMonth' => $hideSales ? 0.0 : (float)($t['online_last_month'] ?? 0),
            'isSalesHidden' => $hideSales,
        ]);
    }

    public static function charts(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $callerId = (int)$user['user_id'];
        $role = strtolower($user['role'] ?? '');
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $role === 'saas_admin');

        $params = ['tid' => $tenantId];

        // 1. Online sessions count (downward scoped for non-admins)
        if ($isLevel0) {
            $stmt = $db->prepare("SELECT 
                COUNT(*) as total_accounts,
                SUM(CASE WHEN is_online = 1 THEN 1 ELSE 0 END) as online_accounts
                FROM customer_network_accounts WHERE tenant_id = :tid");
            $stmt->execute($params);
        } else {
            $rawPath = $user['hierarchy_path'] ?? "/{$callerId}/";
            $userPath = '/' . trim($rawPath, '/') . '/';
            $params['scope_uid'] = $callerId;
            $params['scope_path_wildcard'] = $userPath . '%';

            $stmt = $db->prepare("SELECT 
                COUNT(na.network_account_id) as total_accounts,
                SUM(CASE WHEN na.is_online = 1 THEN 1 ELSE 0 END) as online_accounts
                FROM customer_network_accounts na
                JOIN customers c ON c.customer_id = na.customer_id
                LEFT JOIN users u ON u.user_id = c.owner_id
                WHERE na.tenant_id = :tid
                  AND (c.owner_id = :scope_uid OR u.hierarchy_path LIKE :scope_path_wildcard OR c.owner_path LIKE :scope_path_wildcard)");
            $stmt->execute($params);
        }
        $net = $stmt->fetch() ?: [];

        // 2. SMS stats (scoped for non-admins)
        if ($isLevel0) {
            $stmt = $db->prepare("SELECT 
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as sms_today,
                SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END) as sms_this_month,
                SUM(CASE WHEN sms_type = 'alert' THEN 1 ELSE 0 END) as sms_alert,
                SUM(CASE WHEN sms_type = 'recharge' THEN 1 ELSE 0 END) as sms_recharge,
                SUM(CASE WHEN sms_type = 'new_customer' THEN 1 ELSE 0 END) as sms_new_customer
                FROM sms_log WHERE tenant_id = :tid");
            $stmt->execute(['tid' => $tenantId]);
        } else {
            $stmt = $db->prepare("SELECT 
                SUM(CASE WHEN DATE(s.created_at) = CURDATE() THEN 1 ELSE 0 END) as sms_today,
                SUM(CASE WHEN s.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END) as sms_this_month,
                SUM(CASE WHEN s.sms_type = 'alert' THEN 1 ELSE 0 END) as sms_alert,
                SUM(CASE WHEN s.sms_type = 'recharge' THEN 1 ELSE 0 END) as sms_recharge,
                SUM(CASE WHEN s.sms_type = 'new_customer' THEN 1 ELSE 0 END) as sms_new_customer
                FROM sms_log s
                JOIN customers c ON c.tenant_id = s.tenant_id AND (c.phone = s.to_number OR c.phone = SUBSTRING(s.to_number, -10))
                LEFT JOIN users u ON u.user_id = c.owner_id
                WHERE s.tenant_id = :tid
                  AND (c.owner_id = :scope_uid OR u.hierarchy_path LIKE :scope_path_wildcard OR c.owner_path LIKE :scope_path_wildcard)");
            $stmt->execute($params);
        }
        $sms = $stmt->fetch() ?: [];

        // 3. Tickets (scoped for non-admins)
        if ($isLevel0) {
            $stmt = $db->prepare("SELECT 
                SUM(CASE WHEN status IN ('open', 'in_progress') THEN 1 ELSE 0 END) as pending_tickets,
                SUM(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) as solved_tickets
                FROM customer_tickets WHERE tenant_id = :tid");
            $stmt->execute(['tid' => $tenantId]);
        } else {
            $stmt = $db->prepare("SELECT 
                SUM(CASE WHEN ct.status IN ('open', 'in_progress') THEN 1 ELSE 0 END) as pending_tickets,
                SUM(CASE WHEN ct.status IN ('resolved', 'closed') THEN 1 ELSE 0 END) as solved_tickets
                FROM customer_tickets ct
                JOIN customers c ON c.customer_id = ct.customer_id
                LEFT JOIN users u ON u.user_id = c.owner_id
                WHERE ct.tenant_id = :tid
                  AND (c.owner_id = :scope_uid OR u.hierarchy_path LIKE :scope_path_wildcard OR c.owner_path LIKE :scope_path_wildcard)");
            $stmt->execute($params);
        }
        $tickets = $stmt->fetch() ?: [];

        Response::json([
            'activeUsers' => (int)($net['total_accounts'] ?? 0),
            'onlineUsers' => (int)($net['online_accounts'] ?? 0),
            'smsSentToday' => (int)($sms['sms_today'] ?? 0),
            'smsSentThisMonth' => (int)($sms['sms_this_month'] ?? 0),
            'smsAveragePerDay' => round(((int)($sms['sms_this_month'] ?? 0)) / max(1, (int)date('j')), 1),
            'smsAlert' => (int)($sms['sms_alert'] ?? 0),
            'smsRecharge' => (int)($sms['sms_recharge'] ?? 0),
            'smsNewCustomer' => (int)($sms['sms_new_customer'] ?? 0),
            'smsOther' => 0,
            'ticketPending' => (int)($tickets['pending_tickets'] ?? 0),
            'ticketSolved' => (int)($tickets['solved_tickets'] ?? 0),
        ]);
    }

    public static function recentActivity(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 15;
        $db = Database::getConnection();

        try {
            // Ensure table exists & seed initial baseline logs if empty
            require_once __DIR__ . '/ActivityLogsController.php';
            if (!empty($tenantId)) {
                ActivityLogsController::syncInitialLogsIfEmpty($db, (int)$tenantId);
            }

            $callerId = (int)$user['user_id'];
            $role = strtolower($user['role'] ?? '');
            $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $role === 'saas_admin');

            $where = [];
            $params = [];

            if (!empty($tenantId)) {
                $where[] = "l.tenant_id = :tid";
                $params['tid'] = (int)$tenantId;
            } elseif (!$isLevel0) {
                $where[] = "l.tenant_id = :tid";
                $params['tid'] = (int)($user['tenant_id'] ?? 1);
            }

            // Downward Hierarchy Access Control:
            // Level 0 (ISP Admin / Manager): Can see all activities within the tenant.
            // Level > 0 (Reseller, Sub-Reseller, Dealer, Agent):
            // Can ONLY see actions performed by themselves OR by their strictly subordinate downline users.
            // Under no circumstances can a lower tier user see an upper tier's (Admin / parent) activity,
            // nor any sibling/peer reseller's activities.
            if (!$isLevel0) {
                $rawPath = $user['hierarchy_path'] ?? "/{$callerId}/";
                $userPath = '/' . trim($rawPath, '/') . '/';
                $params['scope_uid'] = $callerId;
                $params['scope_path_wildcard'] = $userPath . '%';
                $where[] = "(l.user_id = :scope_uid OR (u.hierarchy_path LIKE :scope_path_wildcard AND u.user_id != :scope_uid))";
            }

            $whereSql = !empty($where) ? implode(' AND ', $where) : '1=1';

            $stmt = $db->prepare("SELECT 
                l.id as logId,
                COALESCE(CAST(l.target_id AS UNSIGNED), 0) as customerId,
                l.log_type as actionType,
                CASE 
                    WHEN l.action = 'client_renew' THEN 'Subscription Renewed'
                    WHEN l.action = 'customer_onboard' THEN 'Customer Created'
                    WHEN l.action = 'user_login' THEN 'User Login'
                    WHEN l.action = 'extend_expiry_date' THEN 'Expiry Extended'
                    WHEN l.action = 'change_package' THEN 'Package Changed'
                    WHEN l.action = 'balance_transfer' THEN 'Balance Transferred'
                    WHEN l.action = 'bind_mac_address' THEN 'MAC Address Bound'
                    WHEN l.action = 'customer_delete' THEN 'Customer Deleted'
                    WHEN l.action = 'customer_left' THEN 'Marked as Left'
                    WHEN l.action = 'customer_reactivated' THEN 'Customer Reactivated'
                    WHEN l.action = 'pppoe_disconnect' THEN 'PPPoE Disconnected'
                    WHEN l.action = 'suspend_toggle' THEN 'Status Toggled'
                    WHEN l.action = 'payment_collected' THEN 'Payment Received'
                    ELSE REPLACE(CONCAT(UCASE(LEFT(l.action, 1)), SUBSTRING(l.action, 2)), '_', ' ')
                END as actionTitle,
                l.description as actionDetails,
                COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), u.username, 'System') as performedByName,
                COALESCE(u.role, 'system') as performedByRole,
                DATE_FORMAT(l.created_at, '%Y-%m-%dT%H:%i:%sZ') as createdAt
                FROM activity_logs l
                LEFT JOIN users u ON u.user_id = l.user_id
                WHERE {$whereSql}
                ORDER BY l.id DESC
                LIMIT :lim");

            foreach ($params as $k => $v) {
                $stmt->bindValue(':' . $k, $v);
            }
            $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
            $stmt->execute();
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

            Response::json([
                'success' => true,
                'data' => $items ?: [],
            ]);
        } catch (\Throwable $e) {
            error_log('RecentActivity error: ' . $e->getMessage());
            Response::json([
                'success' => true,
                'data' => [],
            ]);
        }
    }

    public static function saasStats(): void {
        $user = AuthMiddleware::requireAuth();
        if ($user['role'] !== 'saas_admin' && ($user['user_type'] ?? '') !== 'saas') {
            Response::error('Access restricted to SaaS Super Administrator', 403);
            return;
        }

        $db = Database::getConnection();

        // 1. Tenants Aggregate
        $stmt = $db->query("SELECT 
            COUNT(*) as total_tenants,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_tenants,
            SUM(CASE WHEN status = 'trial' THEN 1 ELSE 0 END) as trial_tenants,
            SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_tenants,
            SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_tenants,
            SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END) as new_tenants_this_month
            FROM tenants");
        $tenantStats = $stmt->fetch() ?: [];

        // 2. Customers / Subscribers Aggregate across platform
        $stmt = $db->query("SELECT 
            COUNT(*) as total_subscribers,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_subscribers,
            SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_subscribers,
            SUM(CASE WHEN billing_status = 'Expired' OR status = 'terminated' THEN 1 ELSE 0 END) as expired_subscribers,
            SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END) as new_subscribers_this_month
            FROM customers");
        $subscriberStats = $stmt->fetch() ?: [];

        // 3. Hardware & Network Telemetry
        $stmt = $db->query("SELECT 
            COUNT(*) as total_devices,
            SUM(CASE WHEN device_type = 'router' THEN 1 ELSE 0 END) as total_routers,
            SUM(CASE WHEN device_type = 'olt' THEN 1 ELSE 0 END) as total_olts,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_devices
            FROM network_devices");
        $deviceStats = $stmt->fetch() ?: [];

        // 4. Financial Collection across platform
        $stmt = $db->query("SELECT 
            SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN amount ELSE 0 END) as revenue_this_month,
            SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01') THEN amount ELSE 0 END) as revenue_last_month,
            COUNT(*) as total_transactions
            FROM transactions");
        $revenueStats = $stmt->fetch() ?: [];

        // 5. Tenant Wallets Aggregate
        $stmt = $db->query("SELECT SUM(balance) as total_wallet_balance FROM wallets");
        $walletStats = $stmt->fetch() ?: [];

        // 6. Registered Tenants Detailed List
        $stmt = $db->query("SELECT 
            t.tenant_id,
            t.tenant_code,
            t.tenant_name,
            t.status,
            t.country_code,
            t.business_email,
            t.business_phone,
            t.created_at,
            tl.max_customers,
            tl.max_routers,
            tl.max_resellers,
            (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.tenant_id) as total_customers,
            (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id AND nd.device_type = 'router') as total_routers,
            (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id AND nd.device_type = 'olt') as total_olts,
            (SELECT balance FROM wallets w WHERE w.tenant_id = t.tenant_id LIMIT 1) as wallet_balance
            FROM tenants t
            LEFT JOIN tenant_limits tl ON tl.tenant_id = t.tenant_id
            ORDER BY total_customers DESC, t.tenant_id ASC");
        $tenantsList = $stmt->fetchAll() ?: [];

        // 7. Recent Platform Activity
        $stmt = $db->query("SELECT 
            ll.id as logId,
            u.username,
            u.email,
            ll.ip,
            ll.browser,
            ll.os,
            ll.created_at as createdAt
            FROM login_logs ll
            LEFT JOIN users u ON u.user_id = ll.user_id
            ORDER BY ll.id DESC LIMIT 8");
        $recentLogs = $stmt->fetchAll() ?: [];

        // 8. Infrastructure Health & Comprehensive Diagnostics (Restricted to SaaS Admin)
        $diagnostics = HealthController::getDetailedDiagnostics();
        $health = [
            'phpVersion' => PHP_VERSION,
            'memoryUsage' => round(memory_get_usage(true) / 1024 / 1024, 2) . ' MB',
            'serverTime' => date('Y-m-d H:i:s'),
            'apiPort' => 4000,
            'dbStatus' => (($diagnostics['checks']['database']['status'] ?? 'healthy') === 'healthy') ? 'connected' : 'error',
            'telemetryStatus' => 'active',
        ];

        Response::json([
            'success' => true,
            'overview' => [
                'totalTenants' => (int)($tenantStats['total_tenants'] ?? 0),
                'activeTenants' => (int)($tenantStats['active_tenants'] ?? 0),
                'trialTenants' => (int)($tenantStats['trial_tenants'] ?? 0),
                'suspendedTenants' => (int)($tenantStats['suspended_tenants'] ?? 0),
                'expiredTenants' => (int)($tenantStats['expired_tenants'] ?? 0),
                'newTenantsThisMonth' => (int)($tenantStats['new_tenants_this_month'] ?? 0),

                'totalSubscribers' => (int)($subscriberStats['total_subscribers'] ?? 0),
                'activeSubscribers' => (int)($subscriberStats['active_subscribers'] ?? 0),
                'suspendedSubscribers' => (int)($subscriberStats['suspended_subscribers'] ?? 0),
                'expiredSubscribers' => (int)($subscriberStats['expired_subscribers'] ?? 0),
                'newSubscribersThisMonth' => (int)($subscriberStats['new_subscribers_this_month'] ?? 0),

                'totalRouters' => (int)($deviceStats['total_routers'] ?? 0),
                'totalOlts' => (int)($deviceStats['total_olts'] ?? 0),
                'totalDevices' => (int)($deviceStats['total_devices'] ?? 0),
                'activeDevices' => (int)($deviceStats['active_devices'] ?? 0),

                'revenueThisMonth' => (float)($revenueStats['revenue_this_month'] ?? 0),
                'revenueLastMonth' => (float)($revenueStats['revenue_last_month'] ?? 0),
                'totalTransactions' => (int)($revenueStats['total_transactions'] ?? 0),
                'totalWalletBalance' => (float)($walletStats['total_wallet_balance'] ?? 0),
            ],
            'tenants' => array_map(function($t) {
                return [
                    'tenantId' => (string)$t['tenant_id'],
                    'tenantCode' => $t['tenant_code'],
                    'tenantName' => $t['tenant_name'],
                    'status' => $t['status'],
                    'countryCode' => $t['country_code'] ?? 'BD',
                    'businessEmail' => $t['business_email'],
                    'businessPhone' => $t['business_phone'],
                    'createdAt' => $t['created_at'],
                    'totalCustomers' => (int)($t['total_customers'] ?? 0),
                    'totalRouters' => (int)($t['total_routers'] ?? 0),
                    'totalOlts' => (int)($t['total_olts'] ?? 0),
                    'maxCustomers' => (int)($t['max_customers'] ?? 5000),
                    'maxRouters' => (int)($t['max_routers'] ?? 10),
                    'maxOlts' => (int)($t['max_olts'] ?? 5),
                    'walletBalance' => (float)($t['wallet_balance'] ?? 0),
                ];
            }, $tenantsList),
            'recentLogs' => $recentLogs,
            'health' => $health,
            'telemetry' => $diagnostics
        ]);
    }
}
