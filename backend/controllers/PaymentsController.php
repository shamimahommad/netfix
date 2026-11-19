<?php
/**
 * NetFix ISP SaaS - Payments & Online Transactions Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';

class PaymentsController {
    public static function create(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $customerId = $data['customerId'] ?? null;
        $amount = (float)($data['amount'] ?? 0);
        $method = $data['paymentMethod'] ?? 'cash';
        $ref = $data['referenceNumber'] ?? ('TRX-' . date('YmdHis'));

        if (!$customerId || $amount <= 0) {
            Response::error('Customer ID and positive amount are required', 400);
        }

        $db = Database::getConnection();
        $db->beginTransaction();

        try {
            // Validate collector ID: if caller is Level > 0 (downline reseller/agent), they can only assign to themselves or their accessible downlines
            require_once __DIR__ . '/../lib/HierarchySecurityService.php';
            $callerLevel = HierarchySecurityService::getHierarchyLevel($user['role'] ?? '');
            $collectorId = !empty($data['receivedByUserId']) ? (int)$data['receivedByUserId'] : (int)$user['user_id'];
            if ($callerLevel > 0 && $collectorId !== (int)$user['user_id']) {
                if (!HierarchySecurityService::canAccessUser((int)$user['user_id'], $collectorId)) {
                    $collectorId = (int)$user['user_id']; // Fallback safely to self
                }
            }

            // 1. Record Transaction
            $stmtTrx = $db->prepare("INSERT INTO transactions 
                (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, collector_user_id, description)
                VALUES (:tid, :cid, :ref, 'MANUAL_CASH', :amt, :method, :uid, :role, :coll, :notes)");
            $stmtTrx->execute([
                'tid' => $tenantId,
                'cid' => $customerId,
                'ref' => $ref,
                'amt' => $amount,
                'method' => $method,
                'uid' => $user['user_id'],
                'role' => $user['role'],
                'coll' => $collectorId,
                'notes' => $data['notes'] ?? 'Manual payment received',
            ]);
            $trxId = $db->lastInsertId();

            // 2. Adjust pending invoice if any
            $stmtInv = $db->prepare("SELECT * FROM invoices WHERE customer_id = :cid AND tenant_id = :tid AND status = 'pending' ORDER BY invoice_id ASC LIMIT 1");
            $stmtInv->execute(['cid' => $customerId, 'tid' => $tenantId]);
            $inv = $stmtInv->fetch();

            $invoiceData = null;
            if ($inv) {
                $newPaid = (float)$inv['paid_amount'] + $amount;
                $newDue = max(0, (float)$inv['total_amount'] - $newPaid);
                $newStatus = $newDue <= 0 ? 'paid' : 'partially_paid';

                $stmtUpdInv = $db->prepare("UPDATE invoices SET paid_amount = :paid, balance_due = :due, status = :status WHERE invoice_id = :id");
                $stmtUpdInv->execute([
                    'paid' => $newPaid,
                    'due' => $newDue,
                    'status' => $newStatus,
                    'id' => $inv['invoice_id'],
                ]);

                if ($newDue <= 0) {
                    $stmtCust = $db->prepare("UPDATE customers SET billing_status = 'Paid' WHERE customer_id = :cid");
                    $stmtCust->execute(['cid' => $customerId]);
                }

                $invoiceData = [
                    'invoiceId' => (string)$inv['invoice_id'],
                    'invoiceNumber' => $inv['invoice_number'],
                    'status' => $newStatus,
                    'balanceDue' => $newDue,
                ];
            }

            $db->commit();

            Response::json([
                'success' => true,
                'data' => [
                    'paymentId' => (string)$trxId,
                    'tenantId' => (string)$tenantId,
                    'customerId' => (string)$customerId,
                    'invoiceId' => $inv ? (string)$inv['invoice_id'] : null,
                    'amount' => $amount,
                    'paymentMethod' => $method,
                    'referenceNumber' => $ref,
                    'notes' => $data['notes'] ?? '',
                    'paymentDate' => date('Y-m-d'),
                    'createdAt' => date('c'),
                ],
                'invoice' => $invoiceData,
            ], 201);
        } catch (Throwable $e) {
            $db->rollBack();
            Response::error('Payment recording failed: ' . $e->getMessage(), 500);
        }
    }

    public static function onlineTransactions(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $callerId = (int)$user['user_id'];
        $role = strtolower($user['role'] ?? '');
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $role === 'saas_admin');

        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 25)));
        $offset = ($page - 1) * $limit;

        $statusFilter = strtolower(trim($_GET['status'] ?? 'all'));
        $gatewayFilter = strtolower(trim($_GET['gateway'] ?? 'all'));
        $typeFilter = strtolower(trim($_GET['type'] ?? 'all'));
        $popInCharge = !empty($_GET['popInCharge']) ? (int)$_GET['popInCharge'] : null;
        $dateFrom = !empty($_GET['dateFrom']) ? trim($_GET['dateFrom']) : null;
        $dateTo = !empty($_GET['dateTo']) ? trim($_GET['dateTo']) : null;
        $search = !empty($_GET['search']) ? trim($_GET['search']) : null;

        $where = ["pi.tenant_id = :tid"];
        $params = ['tid' => $tenantId];

        if (!$isLevel0) {
            $rawPath = $user['hierarchy_path'] ?? "/{$callerId}/";
            $userPath = '/' . trim($rawPath, '/') . '/';
            $params['scope_uid'] = $callerId;
            $params['scope_path_wildcard'] = $userPath . '%';
            $where[] = "(
                c.owner_id = :scope_uid 
                OR u_owner.hierarchy_path LIKE :scope_path_wildcard 
                OR c.owner_path LIKE :scope_path_wildcard 
                OR CAST(JSON_UNQUOTE(JSON_EXTRACT(pi.metadata, '$.user_id')) AS UNSIGNED) = :scope_uid 
                OR u_meta.hierarchy_path LIKE :scope_path_wildcard
                OR tr.initiator_user_id = :scope_uid
            )";
        }

        if ($statusFilter !== 'all' && $statusFilter !== '') {
            if ($statusFilter === 'success' || $statusFilter === 'paid') {
                $where[] = "(pi.status = 'completed' OR tr.transaction_id IS NOT NULL)";
            } elseif ($statusFilter === 'failed') {
                $where[] = "(pi.status IN ('failed', 'cancelled') AND tr.transaction_id IS NULL)";
            } elseif ($statusFilter === 'pending') {
                $where[] = "(pi.status IN ('initiated', 'pending') AND tr.transaction_id IS NULL)";
            } elseif ($statusFilter === 'expired') {
                $where[] = "(pi.status IN ('expired', 'cancelled') AND tr.transaction_id IS NULL)";
            }
        }

        if ($gatewayFilter !== 'all' && $gatewayFilter !== '') {
            $where[] = "LOWER(pi.gateway) = :gw";
            $params['gw'] = $gatewayFilter;
        }

        if ($typeFilter !== 'all' && $typeFilter !== '') {
            if ($typeFilter === 'customer') {
                $where[] = "pi.customer_id IS NOT NULL";
            } elseif ($typeFilter === 'reseller' || $typeFilter === 'topup') {
                $where[] = "pi.customer_id IS NULL";
            }
        }

        if ($popInCharge) {
            $where[] = "(c.owner_id = :popInCharge OR CAST(JSON_UNQUOTE(JSON_EXTRACT(pi.metadata, '$.user_id')) AS UNSIGNED) = :popInCharge)";
            $params['popInCharge'] = $popInCharge;
        }

        if ($dateFrom) {
            $where[] = "DATE(pi.created_at) >= :dateFrom";
            $params['dateFrom'] = $dateFrom;
        }

        if ($dateTo) {
            $where[] = "DATE(pi.created_at) <= :dateTo";
            $params['dateTo'] = $dateTo;
        }

        if ($search) {
            $where[] = "(pi.transaction_ref LIKE :s OR pi.gateway_payment_id LIKE :s OR c.full_name LIKE :s OR c.phone LIKE :s OR c.customer_code LIKE :s OR u_meta.username LIKE :s OR u_meta.first_name LIKE :s)";
            $params['s'] = "%{$search}%";
        }

        $whereSql = implode(' AND ', $where);

        // Count total matching
        $countStmt = $db->prepare("SELECT COUNT(*) FROM payment_intents pi
            LEFT JOIN customers c ON c.customer_id = pi.customer_id
            LEFT JOIN users u_owner ON u_owner.user_id = c.owner_id
            LEFT JOIN users u_meta ON u_meta.user_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(pi.metadata, '$.user_id')) AS UNSIGNED)
            LEFT JOIN transactions tr ON (tr.transaction_ref = pi.transaction_ref OR tr.transaction_ref = pi.gateway_payment_id)
            WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        // Query paginated items
        $stmt = $db->prepare("SELECT 
            pi.id as paymentIntentId,
            COALESCE(pi.transaction_ref, pi.gateway_payment_id, CONCAT('PI-', pi.id)) as merchantInvoiceNumber,
            COALESCE(i.invoice_number, pi.transaction_ref, CONCAT('R', pi.id)) as invoiceNumber,
            pi.invoice_id as invoiceId,
            pi.gateway as gateway,
            COALESCE(pi.gateway_payment_id, pi.transaction_ref) as gatewayPaymentId,
            pi.amount,
            CASE 
                WHEN pi.status = 'completed' OR tr.transaction_id IS NOT NULL THEN 'PAID'
                WHEN pi.status IN ('failed', 'cancelled') THEN 'FAILED'
                WHEN pi.status = 'expired' THEN 'EXPIRED'
                ELSE 'PENDING'
            END as status,
            CASE 
                WHEN pi.status = 'completed' OR tr.transaction_id IS NOT NULL THEN 'Done'
                WHEN pi.status IN ('failed', 'cancelled', 'expired') THEN 'Failed'
                ELSE 'Pending'
            END as processed,
            COALESCE(
                NULLIF(JSON_UNQUOTE(JSON_EXTRACT(pi.metadata, '$.payment_method')), ''),
                NULLIF(JSON_UNQUOTE(JSON_EXTRACT(pi.metadata, '$.channel')), ''),
                CASE 
                    WHEN LOWER(pi.gateway) = 'bkash' THEN 'bKash'
                    WHEN LOWER(pi.gateway) = 'surjopay' OR LOWER(pi.gateway) = 'shurjopay' THEN 'Nagad'
                    WHEN LOWER(pi.gateway) = 'nagad' THEN 'Nagad'
                    WHEN LOWER(pi.gateway) = 'ssl' OR LOWER(pi.gateway) = 'sslcommerz' THEN 'Cards'
                    ELSE pi.gateway
                END
            ) as payType,
            0 as retry,
            COALESCE(
                NULLIF(JSON_UNQUOTE(JSON_EXTRACT(pi.metadata, '$.bank_trx_id')), ''),
                NULLIF(JSON_UNQUOTE(JSON_EXTRACT(pi.metadata, '$.trxID')), ''),
                tr.transaction_ref,
                pi.gateway_payment_id
            ) as bankTxn,
            pi.customer_id as customerId,
            COALESCE(
                NULLIF(c.full_name, ''),
                NULLIF(TRIM(CONCAT(COALESCE(u_meta.first_name, ''), ' ', COALESCE(u_meta.last_name, ''))), ''),
                u_meta.username,
                'Subscriber / Topup'
            ) as payeeName,
            COALESCE(
                NULLIF(c.phone, ''),
                NULLIF(u_meta.phone, ''),
                '—'
            ) as payeeMobile,
            pi.created_at as createdAt,
            pi.created_at as reqTime,
            pi.created_at as updatedAt,
            CASE WHEN pi.status = 'completed' OR tr.transaction_id IS NOT NULL THEN pi.created_at ELSE NULL END as paidAt,
            CASE WHEN pi.status = 'completed' OR tr.transaction_id IS NOT NULL THEN pi.created_at ELSE NULL END as payTime
            FROM payment_intents pi
            LEFT JOIN customers c ON c.customer_id = pi.customer_id
            LEFT JOIN users u_owner ON u_owner.user_id = c.owner_id
            LEFT JOIN users u_meta ON u_meta.user_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(pi.metadata, '$.user_id')) AS UNSIGNED)
            LEFT JOIN invoices i ON i.invoice_id = pi.invoice_id
            LEFT JOIN transactions tr ON (tr.transaction_ref = pi.transaction_ref OR tr.transaction_ref = pi.gateway_payment_id)
            WHERE {$whereSql}
            ORDER BY pi.id DESC
            LIMIT {$limit} OFFSET {$offset}");
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Overall Summary
        $stmtSum = $db->prepare("SELECT 
            SUM(CASE WHEN DATE(pi.created_at) = CURDATE() AND (pi.status = 'completed' OR tr.transaction_id IS NOT NULL) THEN pi.amount ELSE 0 END) as today,
            SUM(CASE WHEN DATE(pi.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND (pi.status = 'completed' OR tr.transaction_id IS NOT NULL) THEN pi.amount ELSE 0 END) as yesterday,
            SUM(CASE WHEN pi.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') AND (pi.status = 'completed' OR tr.transaction_id IS NOT NULL) THEN pi.amount ELSE 0 END) as this_month,
            SUM(CASE WHEN pi.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND pi.created_at < DATE_FORMAT(NOW(), '%Y-%m-01') AND (pi.status = 'completed' OR tr.transaction_id IS NOT NULL) THEN pi.amount ELSE 0 END) as last_month,
            SUM(CASE WHEN pi.status = 'completed' OR tr.transaction_id IS NOT NULL THEN pi.amount ELSE 0 END) as filtered_total
            FROM payment_intents pi
            LEFT JOIN customers c ON c.customer_id = pi.customer_id
            LEFT JOIN users u_owner ON u_owner.user_id = c.owner_id
            LEFT JOIN users u_meta ON u_meta.user_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(pi.metadata, '$.user_id')) AS UNSIGNED)
            LEFT JOIN transactions tr ON (tr.transaction_ref = pi.transaction_ref OR tr.transaction_ref = pi.gateway_payment_id)
            WHERE {$whereSql}");
        $stmtSum->execute($params);
        $sum = $stmtSum->fetch(PDO::FETCH_ASSOC) ?: [];

        // Gateway-wise Summaries (grouped by gateway)
        $stmtSumByGw = $db->prepare("SELECT 
            LOWER(pi.gateway) as gateway,
            SUM(CASE WHEN DATE(pi.created_at) = CURDATE() AND (pi.status = 'completed' OR tr.transaction_id IS NOT NULL) THEN pi.amount ELSE 0 END) as today,
            SUM(CASE WHEN DATE(pi.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND (pi.status = 'completed' OR tr.transaction_id IS NOT NULL) THEN pi.amount ELSE 0 END) as yesterday,
            SUM(CASE WHEN pi.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') AND (pi.status = 'completed' OR tr.transaction_id IS NOT NULL) THEN pi.amount ELSE 0 END) as this_month,
            SUM(CASE WHEN pi.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND pi.created_at < DATE_FORMAT(NOW(), '%Y-%m-01') AND (pi.status = 'completed' OR tr.transaction_id IS NOT NULL) THEN pi.amount ELSE 0 END) as last_month,
            SUM(CASE WHEN pi.status = 'completed' OR tr.transaction_id IS NOT NULL THEN pi.amount ELSE 0 END) as filtered_total
            FROM payment_intents pi
            LEFT JOIN customers c ON c.customer_id = pi.customer_id
            LEFT JOIN users u_owner ON u_owner.user_id = c.owner_id
            LEFT JOIN users u_meta ON u_meta.user_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(pi.metadata, '$.user_id')) AS UNSIGNED)
            LEFT JOIN transactions tr ON (tr.transaction_ref = pi.transaction_ref OR tr.transaction_ref = pi.gateway_payment_id)
            WHERE {$whereSql}
            GROUP BY LOWER(pi.gateway)");
        $stmtSumByGw->execute($params);
        $gwSums = $stmtSumByGw->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $gwSumMap = [];
        foreach ($gwSums as $row) {
            $gwSumMap[strtolower($row['gateway'])] = $row;
        }

        // Active/Configured gateways in payment_gateway_settings for tenant
        $stmtPg = $db->prepare("SELECT gateway, is_active FROM payment_gateway_settings WHERE tenant_id = :tid ORDER BY id ASC");
        $stmtPg->execute(['tid' => $tenantId]);
        $pgSettings = $stmtPg->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $gatewaysToShow = [];
        foreach ($pgSettings as $pg) {
            $gw = strtolower(trim($pg['gateway']));
            if (!empty($pg['is_active'])) {
                $gatewaysToShow[$gw] = true;
            }
        }

        // Also check if any gateways have transaction totals in payment_intents
        foreach ($gwSumMap as $gw => $row) {
            if ((float)($row['filtered_total'] ?? 0) > 0 || (float)($row['this_month'] ?? 0) > 0) {
                $gatewaysToShow[$gw] = true;
            }
        }

        // Fallback default if none active
        if (empty($gatewaysToShow)) {
            $gatewaysToShow['bkash'] = true;
        }

        $gatewaySummaries = [];
        foreach (array_keys($gatewaysToShow) as $gwCode) {
            $stats = $gwSumMap[$gwCode] ?? [];
            $gatewaySummaries[] = [
                'gateway' => $gwCode,
                'label' => ($gwCode === 'bkash' ? 'bKash' : ($gwCode === 'surjopay' || $gwCode === 'shurjopay' ? 'shurjopay' : ($gwCode === 'nagad' ? 'Nagad' : ($gwCode === 'ssl' || $gwCode === 'sslcommerz' ? 'SSLCommerz' : ucfirst($gwCode))))),
                'today' => (float)($stats['today'] ?? 0),
                'yesterday' => (float)($stats['yesterday'] ?? 0),
                'thisMonth' => (float)($stats['this_month'] ?? 0),
                'lastMonth' => (float)($stats['last_month'] ?? 0),
                'filteredTotal' => (float)($stats['filtered_total'] ?? 0),
            ];
        }

        // POP In Charge list for filter dropdown
        $stmtPops = $db->prepare("SELECT user_id, username, first_name, last_name, role FROM users WHERE tenant_id = :tid AND role IN ('staff', 'reseller', 'pop_in_charge', 'admin') ORDER BY username ASC");
        $stmtPops->execute(['tid' => $tenantId]);
        $popList = $stmtPops->fetchAll(PDO::FETCH_ASSOC) ?: [];

        Response::json([
            'success' => true,
            'data' => [
                'items' => $items ?: [],
                'total' => $total,
                'summary' => [
                    'today' => (float)($sum['today'] ?? 0),
                    'yesterday' => (float)($sum['yesterday'] ?? 0),
                    'thisMonth' => (float)($sum['this_month'] ?? 0),
                    'lastMonth' => (float)($sum['last_month'] ?? 0),
                    'filteredTotal' => (float)($sum['filtered_total'] ?? 0),
                ],
                'gatewaySummaries' => $gatewaySummaries,
                'popList' => $popList,
            ],
            'meta' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
            ],
        ]);
    }

    public static function merchantPayments(): void {
        self::onlineTransactions();
    }

    public static function customerPayments(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 25)));
        $offset = ($page - 1) * $limit;

        $callerId = (int)$user['user_id'];
        $role = strtolower($user['role'] ?? '');
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $role === 'saas_admin');

        $userId = !empty($_GET['userId']) ? (int)$_GET['userId'] : null;
        $createdBy = !empty($_GET['createdBy']) ? (int)$_GET['createdBy'] : (!empty($_GET['pop_in_charge']) ? (int)$_GET['pop_in_charge'] : null);
        $dateFrom = !empty($_GET['dateFrom']) ? trim($_GET['dateFrom']) : null;
        $dateTo = !empty($_GET['dateTo']) ? trim($_GET['dateTo']) : null;
        $method = !empty($_GET['method']) ? trim($_GET['method']) : null;
        $search = !empty($_GET['search']) ? trim($_GET['search']) : null;

        $where = ["t.tenant_id = :tid"];
        $params = ['tid' => $tenantId];

        if (!$isLevel0) {
            $rawPath = $user['hierarchy_path'] ?? "/{$callerId}/";
            $userPath = '/' . trim($rawPath, '/') . '/';
            $params['scope_uid'] = $callerId;
            $params['scope_path_wildcard'] = $userPath . '%';
            $where[] = "(c.owner_id = :scope_uid OR u_owner.hierarchy_path LIKE :scope_path_wildcard OR c.owner_path LIKE :scope_path_wildcard OR t.initiator_user_id = :scope_uid OR t.collector_user_id = :scope_uid)";
        }

        if ($userId) {
            $where[] = "t.initiator_user_id = :userId";
            $params['userId'] = $userId;
        }

        if ($createdBy) {
            $where[] = "(t.collector_user_id = :createdBy OR u_coll.user_id = :createdBy)";
            $params['createdBy'] = $createdBy;
        }

        if ($dateFrom) {
            $where[] = "DATE(t.created_at) >= :dateFrom";
            $params['dateFrom'] = $dateFrom;
        }

        if ($dateTo) {
            $where[] = "DATE(t.created_at) <= :dateTo";
            $params['dateTo'] = $dateTo;
        }

        if ($method) {
            $where[] = "LOWER(t.method) = :method";
            $params['method'] = strtolower($method);
        }

        if ($search) {
            $where[] = "(t.transaction_ref LIKE :search OR t.description LIKE :search OR c.full_name LIKE :search OR c.customer_code LIKE :search)";
            $params['search'] = "%{$search}%";
        }

        $whereSql = implode(' AND ', $where);

        // Count total matching
        $countStmt = $db->prepare("SELECT COUNT(*) FROM transactions t 
            LEFT JOIN customers c ON c.customer_id = t.customer_id
            LEFT JOIN users u_owner ON u_owner.user_id = c.owner_id
            LEFT JOIN users u_coll ON u_coll.user_id = t.collector_user_id
            WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        // Fetch paginated rows with dynamic running balance calculation
        $dataStmt = $db->prepare("SELECT 
            t.transaction_id,
            t.transaction_ref,
            t.transaction_type,
            t.amount,
            t.method,
            COALESCE(
                t.running_balance_after_transaction,
                (
                    SELECT SUM(CASE WHEN t2.transaction_type IN ('RENEW_DEBIT', 'DEBIT') THEN -t2.amount ELSE t2.amount END)
                    FROM transactions t2
                    WHERE t2.tenant_id = t.tenant_id
                      AND (
                          (t.initiator_user_id IS NOT NULL AND t2.initiator_user_id = t.initiator_user_id)
                          OR (t.initiator_user_id IS NULL AND t2.customer_id = t.customer_id)
                      )
                      AND t2.transaction_id <= t.transaction_id
                ),
                0.00
            ) as running_balance_after_transaction,
            t.description,
            t.created_at,
            c.full_name as customer_name,
            c.customer_code,
            TRIM(CONCAT(COALESCE(u_init.first_name, ''), ' ', COALESCE(u_init.last_name, ''))) as initiator_name,
            u_init.username as initiator_username,
            TRIM(CONCAT(COALESCE(u_coll.first_name, ''), ' ', COALESCE(u_coll.last_name, ''))) as collector_name,
            u_coll.username as collector_username
            FROM transactions t
            LEFT JOIN customers c ON c.customer_id = t.customer_id
            LEFT JOIN users u_owner ON u_owner.user_id = c.owner_id
            LEFT JOIN users u_init ON u_init.user_id = t.initiator_user_id
            LEFT JOIN users u_coll ON u_coll.user_id = t.collector_user_id
            WHERE {$whereSql}
            ORDER BY t.transaction_id DESC
            LIMIT {$limit} OFFSET {$offset}");
        $dataStmt->execute($params);
        $rows = $dataStmt->fetchAll();

        $dataRows = [];
        foreach ($rows as $r) {
            $isDebit = ($r['transaction_type'] === 'RENEW_DEBIT');
            $amount = (float)$r['amount'];
            $debit = $isDebit ? $amount : 0.0;
            $credit = $isDebit ? null : $amount;

            $initName = !empty($r['initiator_name']) ? $r['initiator_name'] : (!empty($r['initiator_username']) ? $r['initiator_username'] : (!empty($r['customer_name']) ? $r['customer_name'] : 'System / Online'));
            $collName = !empty($r['collector_name']) ? $r['collector_name'] : (!empty($r['collector_username']) ? $r['collector_username'] : 'Head Office / Online');

            $dataRows[] = [
                'ref' => $r['transaction_ref'] ?: ('TRX-' . $r['transaction_id']),
                'ref_no' => $r['transaction_ref'] ?: ('TRX-' . $r['transaction_id']),
                'initiator_name' => $initName,
                'collector_name' => $collName,
                'pop_name' => $collName,
                'pop_in_charge_name' => $collName,
                'debit' => $debit,
                'credit' => $credit,
                'balance' => (float)($r['running_balance_after_transaction'] ?? 0),
                'balance_after' => (float)($r['running_balance_after_transaction'] ?? 0),
                'created_at' => $r['created_at'],
                'description' => $r['description'] ?: 'Customer transaction',
                'customer_name' => $r['customer_name'] ?: '—',
                'customer_code' => $r['customer_code'] ?: '—',
                'method' => $r['method'] ?: '—',
            ];
        }

        Response::json([
            'success' => true,
            'total' => $total,
            'current_page' => $page,
            'per_page' => $limit,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
            ],
            'data' => $dataRows,
        ]);
    }

    public static function rechargeHistory(): void {
        self::customerPayments();
    }

    public static function bkashCallback(): void {
        // Instant reconnection webhook
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $paymentId = $data['paymentID'] ?? null;
        $trxId = $data['trxID'] ?? ('TRX-' . bin2hex(random_bytes(4)));

        Response::json([
            'statusCode' => '0000',
            'statusMessage' => 'Successful',
            'paymentID' => $paymentId,
            'trxID' => $trxId,
            'message' => 'bKash instant webhook reconnect processed successfully',
        ]);
    }
}

