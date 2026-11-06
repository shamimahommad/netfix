<?php
/**
 * NetFix ISP SaaS - Ledger Statement & Financial Audit API
 * 
 * Enforces Downward-Only Access Control:
 * Users can only inspect their own ledger or downline descendants' ledgers.
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

    // Query filters
    $requestedUserId = isset($_GET['user_id']) && is_numeric($_GET['user_id']) ? (int)$_GET['user_id'] : $currentUserId;
    $startDate = !empty($_GET['start_date']) ? trim($_GET['start_date']) : null;
    $endDate = !empty($_GET['end_date']) ? trim($_GET['end_date']) : null;
    $purpose = !empty($_GET['purpose']) ? trim($_GET['purpose']) : null;
    $type = !empty($_GET['type']) ? trim($_GET['type']) : null; // 'credit' or 'debit'
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(200, max(10, (int)($_GET['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;

    // 1. Security Check: Downward scope verification
    if ($requestedUserId !== $currentUserId) {
        if (!HierarchySecurityService::canAccessUser($currentUserId, $requestedUserId)) {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Forbidden: You do not have permission to view ledger statements outside your hierarchy branch.'
            ]);
            exit;
        }
    }

    // Target user info
    $stmtTarget = $db->prepare("SELECT user_id, username, full_name, role, hierarchy_path FROM users WHERE user_id = :uid LIMIT 1");
    $stmtTarget->execute(['uid' => $requestedUserId]);
    $targetUser = $stmtTarget->fetch(PDO::FETCH_ASSOC);
    $stmtTarget->closeCursor();

    if (!$targetUser) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Target user not found']);
        exit;
    }

    // 2. Fetch current wallet balance
    $stmtBal = $db->prepare("SELECT balance, status, currency FROM wallets WHERE user_id = :uid LIMIT 1");
    $stmtBal->execute(['uid' => $requestedUserId]);
    $wallet = $stmtBal->fetch(PDO::FETCH_ASSOC);
    $stmtBal->closeCursor();
    $currentBalance = $wallet ? (float)$wallet['balance'] : 0.00;

    // 3. Build WHERE criteria
    $where = ["wl.tenant_id = :tid", "wl.user_id = :uid"];
    $params = [
        'tid' => $tenantId,
        'uid' => $requestedUserId,
    ];

    if ($startDate) {
        $where[] = "wl.created_at >= :sdate";
        $params['sdate'] = $startDate . ' 00:00:00';
    }
    if ($endDate) {
        $where[] = "wl.created_at <= :edate";
        $params['edate'] = $endDate . ' 23:59:59';
    }
    if ($purpose && $purpose !== 'all') {
        $where[] = "wl.purpose = :purpose";
        $params['purpose'] = $purpose;
    }
    if ($type && in_array($type, ['credit', 'debit'])) {
        $where[] = "wl.type = :type";
        $params['type'] = $type;
    }

    $whereSql = implode(' AND ', $where);

    // 4. Financial Summary Metrics
    $sumSql = "SELECT 
        COALESCE(SUM(CASE WHEN wl.type = 'credit' THEN wl.amount ELSE 0 END), 0) AS total_credit,
        COALESCE(SUM(CASE WHEN wl.type = 'debit' THEN wl.amount ELSE 0 END), 0) AS total_debit,
        COUNT(*) AS total_count
        FROM wallet_ledger wl
        WHERE {$whereSql}";
    $stmtSum = $db->prepare($sumSql);
    $stmtSum->execute($params);
    $summaryRow = $stmtSum->fetch(PDO::FETCH_ASSOC);
    $stmtSum->closeCursor();

    $totalCredit = (float)($summaryRow['total_credit'] ?? 0);
    $totalDebit = (float)($summaryRow['total_debit'] ?? 0);
    $totalRecords = (int)($summaryRow['total_count'] ?? 0);
    $netProfit = round($totalCredit - $totalDebit, 2);
    $totalPages = (int)ceil($totalRecords / $limit);

    // 5. Paginated Detailed Ledger Query with Joined Context
    $listSql = "SELECT 
        wl.id,
        wl.txn_group_id,
        wl.type,
        wl.amount,
        wl.opening_balance,
        wl.closing_balance,
        wl.purpose,
        wl.description,
        wl.created_at,
        wl.invoice_id,
        inv.invoice_number,
        wl.source_customer_id,
        c.username AS customer_username,
        c.full_name AS customer_full_name,
        u.username AS account_username,
        u.role AS account_role
        FROM wallet_ledger wl
        LEFT JOIN invoices inv ON inv.invoice_id = wl.invoice_id
        LEFT JOIN customers c ON c.customer_id = wl.source_customer_id
        LEFT JOIN users u ON u.user_id = wl.user_id
        WHERE {$whereSql}
        ORDER BY wl.id DESC
        LIMIT :limit OFFSET :offset";

    $stmtList = $db->prepare($listSql);
    foreach ($params as $k => $v) {
        $stmtList->bindValue(":{$k}", $v);
    }
    $stmtList->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmtList->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmtList->execute();
    $rows = $stmtList->fetchAll(PDO::FETCH_ASSOC);
    $stmtList->closeCursor();

    // 6. Return Clean Response
    echo json_encode([
        'success' => true,
        'user' => [
            'user_id' => (int)$targetUser['user_id'],
            'username' => $targetUser['username'],
            'full_name' => $targetUser['full_name'],
            'role' => $targetUser['role'],
        ],
        'wallet' => [
            'balance' => $currentBalance,
            'currency' => $wallet['currency'] ?? 'BDT',
            'status' => $wallet['status'] ?? 'active',
        ],
        'summary' => [
            'total_credit' => $totalCredit,
            'total_debit' => $totalDebit,
            'net_profit' => $netProfit,
            'current_balance' => $currentBalance,
        ],
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total_records' => $totalRecords,
            'total_pages' => $totalPages,
        ],
        'data' => $rows,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to retrieve ledger statement: ' . $e->getMessage()
    ]);
}
