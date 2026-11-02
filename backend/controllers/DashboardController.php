<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';

class DashboardController {
    public static function stats(string $tenantId): void {
        $db = Database::getConnection();

        $now = date('Y-m-d H:i:s');
        $threeDays = date('Y-m-d H:i:s', strtotime('+3 days'));
        $sevenDays = date('Y-m-d H:i:s', strtotime('+7 days'));

        // 1. Subscriber Counts
        $stmt = $db->prepare("SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) as expired,
            SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'ACTIVE' AND expiry_date BETWEEN :now1 AND :three_days THEN 1 ELSE 0 END) as expiring_3_days,
            SUM(CASE WHEN status = 'ACTIVE' AND expiry_date BETWEEN :now2 AND :seven_days THEN 1 ELSE 0 END) as expiring_7_days
            FROM subscribers WHERE tenant_id = :tenant_id");
        
        $stmt->execute([
            'tenant_id' => $tenantId,
            'now1' => $now,
            'three_days' => $threeDays,
            'now2' => $now,
            'seven_days' => $sevenDays,
        ]);
        $subStats = $stmt->fetch();

        // 2. Financial Metrics
        $stmt = $db->prepare("SELECT 
            COALESCE(SUM(payable_amount), 0) as this_month_revenue,
            COALESCE(SUM(paid_amount), 0) as this_month_collection,
            COALESCE(SUM(due_amount), 0) as total_due
            FROM invoices WHERE tenant_id = :tenant_id");
        $stmt->execute(['tenant_id' => $tenantId]);
        $finStats = $stmt->fetch();

        // Today's Payments
        $todayStart = date('Y-m-d 00:00:00');
        $todayEnd = date('Y-m-d 23:59:59');
        $stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) as today_collection 
                               FROM payments 
                               WHERE tenant_id = :tenant_id AND created_at BETWEEN :start AND :end");
        $stmt->execute(['tenant_id' => $tenantId, 'start' => $todayStart, 'end' => $todayEnd]);
        $todayFin = $stmt->fetch();

        // 3. Routers
        $stmt = $db->prepare("SELECT id, name, ip_address, status, cpu_load, uptime, ros_version 
                               FROM mikrotik_routers WHERE tenant_id = :tenant_id");
        $stmt->execute(['tenant_id' => $tenantId]);
        $routers = $stmt->fetchAll();

        // 4. Recent Payments
        $stmt = $db->prepare("SELECT p.*, s.customer_code, s.name as subscriber_name, s.mobile, s.pppoe_username 
                               FROM payments p 
                               JOIN subscribers s ON p.subscriber_id = s.id 
                               WHERE p.tenant_id = :tenant_id 
                               ORDER BY p.created_at DESC LIMIT 6");
        $stmt->execute(['tenant_id' => $tenantId]);
        $recentPayments = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'stats' => [
                'subscribers' => [
                    'total' => (int)($subStats['total'] ?? 0),
                    'active' => (int)($subStats['active'] ?? 0),
                    'expired' => (int)($subStats['expired'] ?? 0),
                    'suspended' => (int)($subStats['suspended'] ?? 0),
                    'pending' => (int)($subStats['pending'] ?? 0),
                    'online' => max(0, (int)($subStats['active'] ?? 0) - 1),
                    'offline' => min(1, (int)($subStats['active'] ?? 0)),
                    'expiringIn3Days' => (int)($subStats['expiring_3_days'] ?? 0),
                    'expiringIn7Days' => (int)($subStats['expiring_7_days'] ?? 0),
                ],
                'financials' => [
                    'thisMonthRevenue' => (float)($finStats['this_month_revenue'] ?? 0),
                    'thisMonthCollection' => (float)($finStats['this_month_collection'] ?? 0),
                    'todayCollection' => (float)($todayFin['today_collection'] ?? 0),
                    'totalDue' => (float)($finStats['total_due'] ?? 0),
                ],
                'routers' => $routers,
                'recentPayments' => $recentPayments,
            ]
        ]);
    }
}
