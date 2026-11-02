<?php
/**
 * NetFix ISP SaaS - Dashboard Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class DashboardController {
    public static function stats(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        // 1. Customer metrics
        $stmt = $db->prepare("SELECT 
            COUNT(*) as total_customers,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_customers,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_join,
            SUM(CASE WHEN customer_type = 'individual' THEN 1 ELSE 0 END) as home_customers,
            SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END) as last_month_join,
            SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END) as this_month_join,
            SUM(CASE WHEN billing_status = 'Expired' OR status = 'terminated' THEN 1 ELSE 0 END) as expired_customers,
            SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_customers,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as left_customers
            FROM customers WHERE tenant_id = :tid");
        $stmt->execute(['tid' => $tenantId]);
        $c = $stmt->fetch() ?: [];

        // 2. Collection metrics
        $stmt = $db->prepare("SELECT 
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN amount ELSE 0 END) as today_collection,
            SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN amount ELSE 0 END) as this_month_collection,
            SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01') THEN amount ELSE 0 END) as last_month_collection,
            SUM(CASE WHEN DATE(created_at) = CURDATE() AND method != 'cash' THEN amount ELSE 0 END) as online_today,
            SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') AND method != 'cash' THEN amount ELSE 0 END) as online_this_month,
            SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01') AND method != 'cash' THEN amount ELSE 0 END) as online_last_month
            FROM transactions WHERE tenant_id = :tid");
        $stmt->execute(['tid' => $tenantId]);
        $t = $stmt->fetch() ?: [];

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
            'todayCollection' => (float)($t['today_collection'] ?? 0),
            'thisMonthCollection' => (float)($t['this_month_collection'] ?? 0),
            'lastMonthCollection' => (float)($t['last_month_collection'] ?? 0),
            'hotspotTotal' => 0,
            'hotspotActive' => 0,
            'hotspotExpired' => 0,
            'onlinePaymentToday' => (float)($t['online_today'] ?? 0),
            'onlinePaymentThisMonth' => (float)($t['online_this_month'] ?? 0),
            'onlinePaymentLastMonth' => (float)($t['online_last_month'] ?? 0),
        ]);
    }

    public static function charts(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        // Online sessions count
        $stmt = $db->prepare("SELECT 
            COUNT(*) as total_accounts,
            SUM(CASE WHEN is_online = 1 THEN 1 ELSE 0 END) as online_accounts
            FROM customer_network_accounts WHERE tenant_id = :tid");
        $stmt->execute(['tid' => $tenantId]);
        $net = $stmt->fetch() ?: [];

        // SMS stats
        $stmt = $db->prepare("SELECT 
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as sms_today,
            SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END) as sms_this_month,
            SUM(CASE WHEN sms_type = 'alert' THEN 1 ELSE 0 END) as sms_alert,
            SUM(CASE WHEN sms_type = 'recharge' THEN 1 ELSE 0 END) as sms_recharge,
            SUM(CASE WHEN sms_type = 'new_customer' THEN 1 ELSE 0 END) as sms_new_customer
            FROM sms_log WHERE tenant_id = :tid");
        $stmt->execute(['tid' => $tenantId]);
        $sms = $stmt->fetch() ?: [];

        // Tickets
        $stmt = $db->prepare("SELECT 
            SUM(CASE WHEN status IN ('open', 'in_progress') THEN 1 ELSE 0 END) as pending_tickets,
            SUM(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) as solved_tickets
            FROM customer_tickets WHERE tenant_id = :tid");
        $stmt->execute(['tid' => $tenantId]);
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

        $stmt = $db->prepare("SELECT 
            t.transaction_id as logId,
            COALESCE(t.customer_id, 0) as customerId,
            t.transaction_type as actionType,
            CONCAT(t.transaction_type, ' - ৳', t.amount) as actionTitle,
            t.description as actionDetails,
            COALESCE(u.first_name, 'System') as performedByName,
            t.initiator_role as performedByRole,
            DATE_FORMAT(t.created_at, '%Y-%m-%dT%H:%i:%sZ') as createdAt
            FROM transactions t
            LEFT JOIN users u ON u.user_id = t.initiator_user_id
            WHERE t.tenant_id = :tid
            ORDER BY t.created_at DESC
            LIMIT :lim");
        $stmt->bindValue(':tid', $tenantId, PDO::PARAM_INT);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'data' => $items ?: [],
        ]);
    }
}
