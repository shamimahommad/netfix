<?php
/**
 * NetFix ISP SaaS - Multi-Tier Reconciliation & Auditing Report API
 * 
 * Groups transactions by Package, Downline/Agent, and Commission Margins across weekly/monthly/yearly timeframes.
 * Enforces strict downward-only visibility.
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../lib/AuthMiddleware.php';
require_once __DIR__ . '/../../lib/HierarchySecurityService.php';

try {
    $authUser = AuthMiddleware::requireAuth();
    $db = Database::getConnection();

    $currentUserId = (int)$authUser['user_id'];
    $tenantId = (int)AuthMiddleware::getTenantId();
    $userRole = (string)($authUser['role'] ?? '');

    $period = trim($_GET['period'] ?? 'this_month'); // 'today', 'this_week', 'this_month', 'this_year', 'custom'
    $startDate = !empty($_GET['start_date']) ? trim($_GET['start_date']) : null;
    $endDate = !empty($_GET['end_date']) ? trim($_GET['end_date']) : null;
    $filterPackageId = isset($_GET['package_id']) && is_numeric($_GET['package_id']) ? (int)$_GET['package_id'] : 0;
    $filterUserId = isset($_GET['downline_user_id']) && is_numeric($_GET['downline_user_id']) ? (int)$_GET['downline_user_id'] : 0;

    // Resolve date bounds
    $now = new DateTime();
    if ($period === 'today') {
        $startDate = $now->format('Y-m-d');
        $endDate = $now->format('Y-m-d');
    } elseif ($period === 'this_week') {
        $start = clone $now;
        $start->modify('this week monday');
        $startDate = $start->format('Y-m-d');
        $endDate = $now->format('Y-m-d');
    } elseif ($period === 'this_month') {
        $startDate = $now->format('Y-m-01');
        $endDate = $now->format('Y-m-t');
    } elseif ($period === 'this_year') {
        $startDate = $now->format('Y-01-01');
        $endDate = $now->format('Y-12-31');
    } else {
        if (!$startDate) $startDate = $now->format('Y-m-01');
        if (!$endDate) $endDate = $now->format('Y-m-d');
    }

    // Downward Scope Filter:
    // Determine which user IDs are in the authenticated user's descending branch
    $accessibleUserIds = [];
    $isIspAdmin = in_array(strtolower($userRole), ['isp_admin', 'admin', 'manager', 'saas_admin'], true);

    if ($isIspAdmin) {
        $stmtAll = $db->prepare("SELECT user_id FROM users WHERE tenant_id = :tid");
        $stmtAll->execute(['tid' => $tenantId]);
        $accessibleUserIds = $stmtAll->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $stmtAll->closeCursor();
    } else {
        $downlines = HierarchySecurityService::getDownlineUsers($currentUserId, true);
        $accessibleUserIds = array_column($downlines, 'user_id');
        if (!in_array($currentUserId, $accessibleUserIds, true)) {
            $accessibleUserIds[] = $currentUserId;
        }
    }

    if (empty($accessibleUserIds)) {
        $accessibleUserIds = [$currentUserId];
    }

    if ($filterUserId > 0) {
        if (!in_array($filterUserId, $accessibleUserIds, true)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden: Cannot audit downline outside your scope.']);
            exit;
        }
        $targetUserIds = [$filterUserId];
    } else {
        $targetUserIds = $accessibleUserIds;
    }

    $userPlaceholders = implode(',', array_fill(0, count($targetUserIds), '?'));

    // 1. Total Metrics
    $metricsSql = "SELECT 
        COUNT(DISTINCT wl.txn_group_id) AS total_settled_txns,
        COUNT(DISTINCT wl.invoice_id) AS total_settled_invoices,
        COALESCE(SUM(CASE WHEN wl.type = 'credit' THEN wl.amount ELSE 0 END), 0) AS total_disbursed_funds,
        COALESCE(SUM(CASE WHEN wl.purpose = 'commission_margin' THEN wl.amount ELSE 0 END), 0) AS total_commissions_distributed,
        COALESCE(SUM(CASE WHEN wl.purpose = 'customer_payment' THEN wl.amount ELSE 0 END), 0) AS total_isp_collected
        FROM wallet_ledger wl
        WHERE wl.tenant_id = ?
          AND wl.user_id IN ({$userPlaceholders})
          AND wl.created_at >= ? AND wl.created_at <= ?";
    
    $metricParams = array_merge([$tenantId], $targetUserIds, [$startDate . ' 00:00:00', $endDate . ' 23:59:59']);
    $stmtMet = $db->prepare($metricsSql);
    $stmtMet->execute($metricParams);
    $overallMetrics = $stmtMet->fetch(PDO::FETCH_ASSOC);
    $stmtMet->closeCursor();

    // 2. Breakdown By Downline / Beneficiary
    $downlineSql = "SELECT 
        u.user_id,
        u.username,
        u.full_name,
        u.role,
        COUNT(DISTINCT wl.txn_group_id) AS txn_count,
        COALESCE(SUM(CASE WHEN wl.purpose = 'commission_margin' THEN wl.amount ELSE 0 END), 0) AS commission_earned,
        COALESCE(SUM(CASE WHEN wl.purpose = 'customer_payment' THEN wl.amount ELSE 0 END), 0) AS direct_payment_received,
        COALESCE(SUM(wl.amount), 0) AS total_credited,
        MAX(w.balance) AS current_wallet_balance
        FROM users u
        LEFT JOIN wallet_ledger wl ON wl.user_id = u.user_id 
             AND wl.tenant_id = ? 
             AND wl.created_at >= ? AND wl.created_at <= ?
        LEFT JOIN wallets w ON w.user_id = u.user_id
        WHERE u.user_id IN ({$userPlaceholders})
        GROUP BY u.user_id, u.username, u.full_name, u.role
        ORDER BY total_credited DESC";

    $downlineParams = array_merge([$tenantId, $startDate . ' 00:00:00', $endDate . ' 23:59:59'], $targetUserIds);
    $stmtDl = $db->prepare($downlineSql);
    $stmtDl->execute($downlineParams);
    $downlineRows = $stmtDl->fetchAll(PDO::FETCH_ASSOC);
    $stmtDl->closeCursor();

    // 3. Breakdown By Packages
    $packageSql = "SELECT 
        ap.access_profile_id,
        ap.profile_name AS package_name,
        ap.price AS retail_price,
        COUNT(DISTINCT inv.invoice_id) AS total_invoices_paid,
        COALESCE(SUM(inv.total_amount), 0) AS total_retail_volume,
        COUNT(DISTINCT cs.customer_id) AS active_subscribers
        FROM access_profiles ap
        JOIN customer_services cs ON cs.access_profile_id = ap.access_profile_id
        JOIN invoices inv ON inv.customer_id = cs.customer_id 
             AND inv.status = 'paid' 
             AND inv.paid_at >= ? AND inv.paid_at <= ?
        WHERE ap.tenant_id = ?
        GROUP BY ap.access_profile_id, ap.profile_name, ap.price
        ORDER BY total_retail_volume DESC";

    $stmtPkg = $db->prepare($packageSql);
    $stmtPkg->execute([$startDate . ' 00:00:00', $endDate . ' 23:59:59', $tenantId]);
    $packageRows = $stmtPkg->fetchAll(PDO::FETCH_ASSOC);
    $stmtPkg->closeCursor();

    // 4. Daily Trend Timeline
    $timelineSql = "SELECT 
        DATE(wl.created_at) AS txn_date,
        COUNT(DISTINCT wl.txn_group_id) AS settlements_count,
        COALESCE(SUM(CASE WHEN wl.purpose = 'commission_margin' THEN wl.amount ELSE 0 END), 0) AS daily_commissions,
        COALESCE(SUM(CASE WHEN wl.purpose = 'customer_payment' THEN wl.amount ELSE 0 END), 0) AS daily_isp_revenue,
        COALESCE(SUM(wl.amount), 0) AS daily_total_disbursed
        FROM wallet_ledger wl
        WHERE wl.tenant_id = ?
          AND wl.user_id IN ({$userPlaceholders})
          AND wl.created_at >= ? AND wl.created_at <= ?
        GROUP BY DATE(wl.created_at)
        ORDER BY txn_date ASC";

    $stmtTl = $db->prepare($timelineSql);
    $stmtTl->execute($metricParams);
    $timelineRows = $stmtTl->fetchAll(PDO::FETCH_ASSOC);
    $stmtTl->closeCursor();

    echo json_encode([
        'success' => true,
        'period' => [
            'key' => $period,
            'start_date' => $startDate,
            'end_date' => $endDate,
        ],
        'overall' => [
            'total_settled_txns' => (int)($overallMetrics['total_settled_txns'] ?? 0),
            'total_settled_invoices' => (int)($overallMetrics['total_settled_invoices'] ?? 0),
            'total_disbursed_funds' => (float)($overallMetrics['total_disbursed_funds'] ?? 0),
            'total_commissions_distributed' => (float)($overallMetrics['total_commissions_distributed'] ?? 0),
            'total_isp_collected' => (float)($overallMetrics['total_isp_collected'] ?? 0),
        ],
        'downline_reconciliation' => $downlineRows,
        'package_reconciliation' => $packageRows,
        'daily_timeline' => $timelineRows,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to generate reconciliation report: ' . $e->getMessage(),
    ]);
}

