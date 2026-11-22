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

        require_once __DIR__ . '/../lib/HierarchySecurityService.php';
        HierarchySecurityService::requirePermission((int)$user['user_id'], 'can_collect_payment');

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

            try {
                require_once __DIR__ . '/../lib/ActivityLogger.php';
                ActivityLogger::log([
                    'tenant_id' => $tenantId,
                    'user_id' => $user['user_id'] ?? null,
                    'log_type' => 'activity',
                    'action' => 'payment_collected',
                    'module' => 'billing',
                    'target_id' => (string)$customerId,
                    'target_type' => 'customer',
                    'description' => "Collected payment of ৳{$amount} via {$method} for customer #{$customerId}",
                    'metadata' => [
                        'customer_id' => $customerId,
                        'amount' => $amount,
                        'method' => $method,
                        'reference' => $ref,
                    ],
                ]);
            } catch (\Throwable $actErr) {}

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
            c.customer_id as cust_id,
            c.full_name as customer_name,
            c.customer_code,
            na.username as pppoe_username,
            TRIM(CONCAT(COALESCE(u_owner.first_name, ''), ' ', COALESCE(u_owner.last_name, ''))) as owner_name,
            u_owner.username as owner_username,
            u_owner.role as owner_role,
            TRIM(CONCAT(COALESCE(u_init.first_name, ''), ' ', COALESCE(u_init.last_name, ''))) as initiator_name,
            u_init.username as initiator_username,
            TRIM(CONCAT(COALESCE(u_coll.first_name, ''), ' ', COALESCE(u_coll.last_name, ''))) as collector_name,
            u_coll.username as collector_username
            FROM transactions t
            LEFT JOIN customers c ON c.customer_id = t.customer_id
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
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

            $method = strtolower($r['method'] ?: '');
            if (empty($method)) {
                if (stripos($r['description'], 'bkash') !== false) $method = 'bkash';
                elseif (stripos($r['description'], 'nagad') !== false) $method = 'nagad';
                elseif (stripos($r['description'], 'paybill') !== false) $method = 'paybill';
                elseif (stripos($r['description'], 'cash') !== false) $method = 'cash';
            }

            // 1. INITIATOR: How it happened (e.g. bKash PayBill, bKash, Nagad, User name)
            $initUser = !empty($r['initiator_name']) ? $r['initiator_name'] : (!empty($r['initiator_username']) ? $r['initiator_username'] : '');
            if ($method === 'paybill' || stripos($method, 'paybill') !== false) {
                $initName = 'bKash PayBill';
            } elseif ($method === 'bkash') {
                $initName = (!empty($initUser) && !in_array(strtolower($initUser), ['admin', 'saasadmin', 'system'])) ? "{$initUser} (bKash)" : 'bKash';
            } elseif ($method === 'nagad') {
                $initName = (!empty($initUser) && !in_array(strtolower($initUser), ['admin', 'saasadmin', 'system'])) ? "{$initUser} (Nagad)" : 'Nagad';
            } elseif ($method === 'rocket') {
                $initName = 'Rocket';
            } elseif ($method === 'upay') {
                $initName = 'Upay';
            } elseif ($method === 'cash') {
                $initName = !empty($initUser) ? "{$initUser} (Cash)" : 'Cash';
            } elseif ($method === 'ssl' || $method === 'sslcommerz') {
                $initName = 'SSLCommerz';
            } elseif ($method === 'surjopay' || $method === 'shurjopay') {
                $initName = 'shurjopay';
            } elseif (!empty($initUser)) {
                $initName = $initUser;
            } else {
                $initName = !empty($method) ? ucfirst($method) : 'Online';
            }

            // 2. POP IN-CHARGE: Under whom is this customer?
            $owner = !empty($r['owner_name']) ? $r['owner_name'] : (!empty($r['owner_username']) ? $r['owner_username'] : '');
            if (!empty($owner)) {
                $popName = $owner;
            } elseif (!empty($r['customer_code']) && $r['customer_code'] !== '—') {
                $popName = 'Head Office';
            } else {
                $popName = !empty($r['collector_name']) ? $r['collector_name'] : (!empty($r['collector_username']) ? $r['collector_username'] : 'Head Office');
            }

            // 3. DESCRIPTION: Customer ID, username or reseller name
            $desc = $r['description'];
            if (!empty($r['customer_code']) && $r['customer_code'] !== '—') {
                $uStr = !empty($r['pppoe_username']) ? " (User: {$r['pppoe_username']})" : '';
                $mStr = !empty($method) ? " via " . ucfirst($method) : '';
                if ($r['transaction_type'] === 'RENEW_DEBIT') {
                    $desc = "Customer Renew Debit: #{$r['customer_code']}{$uStr}";
                } elseif ($r['transaction_type'] === 'GATEWAY_PAYMENT' || $r['transaction_type'] === 'ONLINE_GATEWAY') {
                    $desc = "Customer Bill Received: #{$r['customer_code']}{$uStr}{$mStr}";
                } elseif ($r['transaction_type'] === 'MANUAL_CASH') {
                    $desc = "Customer Cash Payment: #{$r['customer_code']}{$uStr}";
                } else {
                    $desc = "Customer Payment: #{$r['customer_code']}{$uStr}{$mStr}";
                }
            } elseif ($r['transaction_type'] === 'UNMATCHED_PAYMENT') {
                $desc = "Unmatched Payment: " . ucfirst($method ?: 'MFS') . " - Ref " . $r['transaction_ref'];
            }

            $rawRef = $r['transaction_ref'] ?: (string)$r['transaction_id'];
            if (preg_match('/^TXG-\d{8}-/i', $rawRef)) {
                $trxId = (string)$r['transaction_id'];
            } else {
                $clean = preg_replace('/^(TRX[-_]RENEW|TRX[-_]BKASH|TEST[-_]UNMATCHED|BKASH|TRX|RCH|TOPUP|WT|TXG|TX)[-_]/i', '', $rawRef);
                $trxId = !empty($clean) ? $clean : (string)$r['transaction_id'];
            }

            $dataRows[] = [
                'ref' => $trxId,
                'trx_id' => $trxId,
                'ref_no' => $trxId,
                'initiator_name' => $initName,
                'collector_name' => $popName,
                'pop_name' => $popName,
                'pop_in_charge_name' => $popName,
                'debit' => $debit,
                'credit' => $credit,
                'balance' => (float)($r['running_balance_after_transaction'] ?? 0),
                'balance_after' => (float)($r['running_balance_after_transaction'] ?? 0),
                'created_at' => $r['created_at'],
                'description' => $desc,
                'customer_name' => $r['customer_name'] ?: '—',
                'customer_code' => $r['customer_code'] ?: '—',
                'method' => $r['method'] ?: '—',
                'transaction_id' => (int)$r['transaction_id'],
                'transaction_type' => $r['transaction_type'],
                'is_unmatched' => ($r['transaction_type'] === 'UNMATCHED_PAYMENT' || empty($r['customer_name']) || $r['customer_name'] === '—'),
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
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(100, (int)($_GET['limit'] ?? 25)));
        $offset = ($page - 1) * $limit;

        $callerId = (int)$user['user_id'];
        $role = strtolower($user['role'] ?? '');
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $role === 'saas_admin');

        $userId = !empty($_GET['userId']) ? (int)$_GET['userId'] : (!empty($_GET['initiator']) ? (int)$_GET['initiator'] : null);
        $popInCharge = !empty($_GET['createdBy']) ? (int)$_GET['createdBy'] : (!empty($_GET['pop_in_charge']) ? (int)$_GET['pop_in_charge'] : null);
        $dateFrom = !empty($_GET['dateFrom']) ? trim($_GET['dateFrom']) : null;
        $dateTo = !empty($_GET['dateTo']) ? trim($_GET['dateTo']) : null;
        $method = !empty($_GET['method']) ? trim($_GET['method']) : null;
        $search = !empty($_GET['search']) ? trim($_GET['search']) : null;

        $where = ["wt.tenant_id = :tid"];
        $params = ['tid' => $tenantId];

        // Downward hierarchy security scoping:
        // Level 0 (Admin) can see all wallet transactions in the tenant.
        // Reseller/Sub-reseller/Agent can only see their own wallet transactions or downlines' wallet transactions!
        if (!$isLevel0) {
            $rawPath = $user['hierarchy_path'] ?? "/{$callerId}/";
            $userPath = '/' . trim($rawPath, '/') . '/';
            $params['scope_uid'] = $callerId;
            $params['scope_path_wildcard'] = $userPath . '%';
            $where[] = "(wt.user_id = :scope_uid OR u_pop.hierarchy_path LIKE :scope_path_wildcard OR wt.created_by = :scope_uid)";
        }

        // Filter by Initiator (who created/initiated the transaction)
        if ($userId) {
            $where[] = "wt.created_by = :userId";
            $params['userId'] = $userId;
        }

        // Filter by POP In-Charge (whose wallet is affected)
        if ($popInCharge) {
            $where[] = "wt.user_id = :popInCharge";
            $params['popInCharge'] = $popInCharge;
        }

        // Date Range
        if ($dateFrom) {
            $where[] = "DATE(wt.created_at) >= :dateFrom";
            $params['dateFrom'] = $dateFrom;
        }
        if ($dateTo) {
            $where[] = "DATE(wt.created_at) <= :dateTo";
            $params['dateTo'] = $dateTo;
        }

        // Method filter (e.g. cash, bkash, nagad, system)
        if ($method) {
            $m = strtolower($method);
            if ($m === 'system') {
                $where[] = "(wt.reference_type = 'CUSTOMER_RECHARGE' OR LOWER(wt.description) LIKE '%system%')";
            } else {
                $where[] = "(LOWER(wt.description) LIKE :method OR LOWER(wt.reference_type) LIKE :method OR LOWER(wt.reference_id) LIKE :method)";
                $params['method'] = "%{$m}%";
            }
        }

        // Search text
        if ($search) {
            $where[] = "(wt.reference_id LIKE :search OR wt.description LIKE :search OR u_pop.username LIKE :search OR u_pop.first_name LIKE :search OR u_pop.last_name LIKE :search OR u_init.username LIKE :search OR u_init.first_name LIKE :search)";
            $params['search'] = "%{$search}%";
        }

        $whereSql = implode(' AND ', $where);

        // Count total matching
        $countStmt = $db->prepare("SELECT COUNT(*) FROM wallet_transactions wt
            LEFT JOIN users u_pop ON u_pop.user_id = wt.user_id
            LEFT JOIN users u_init ON u_init.user_id = wt.created_by
            WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        // Fetch paginated rows from wallet_transactions with customer, owner, pppoe, and invoice payment method
        $stmt = $db->prepare("SELECT 
            wt.transaction_id,
            wt.wallet_id,
            wt.user_id as pop_user_id,
            wt.type,
            wt.amount,
            wt.balance_before,
            wt.balance_after,
            wt.reference_type,
            wt.reference_id,
            wt.description,
            wt.created_by as initiator_user_id,
            wt.created_at,
            TRIM(CONCAT(COALESCE(u_pop.first_name, ''), ' ', COALESCE(u_pop.last_name, ''))) as pop_name,
            u_pop.username as pop_username,
            u_pop.role as pop_role,
            TRIM(CONCAT(COALESCE(u_init.first_name, ''), ' ', COALESCE(u_init.last_name, ''))) as initiator_name,
            u_init.username as initiator_username,
            u_init.role as initiator_role,
            wl.source_customer_id,
            wl.invoice_id as wl_invoice_id,
            c_wl.customer_id as wl_cid,
            c_wl.customer_code as wl_cust_code,
            c_wl.full_name as wl_cust_name,
            na_wl.username as wl_pppoe_username,
            c_wl.owner_id as wl_owner_id,
            u_wl_owner.username as wl_owner_username,
            TRIM(CONCAT(COALESCE(u_wl_owner.first_name, ''), ' ', COALESCE(u_wl_owner.last_name, ''))) as wl_owner_name,
            u_wl_owner.role as wl_owner_role,
            inv.payment_method as inv_payment_method,
            inv.invoice_number
            FROM wallet_transactions wt
            LEFT JOIN users u_pop ON u_pop.user_id = wt.user_id
            LEFT JOIN users u_init ON u_init.user_id = wt.created_by
            LEFT JOIN wallet_ledger wl ON wl.txn_group_id = wt.reference_id AND wl.user_id = wt.user_id
            LEFT JOIN customers c_wl ON c_wl.customer_id = wl.source_customer_id
            LEFT JOIN customer_network_accounts na_wl ON na_wl.customer_id = c_wl.customer_id
            LEFT JOIN users u_wl_owner ON u_wl_owner.user_id = c_wl.owner_id
            LEFT JOIN invoices inv ON inv.invoice_id = wl.invoice_id
            WHERE {$whereSql}
            ORDER BY wt.transaction_id DESC
            LIMIT {$limit} OFFSET {$offset}");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fallback for customer IDs mentioned in description but not in wallet_ledger
        $custIdsToFetch = [];
        foreach ($rows as $r) {
            if (empty($r['wl_cust_code'])) {
                if (preg_match('/customer #?(\d+)/i', $r['description'], $m)) {
                    $custIdsToFetch[] = $m[1];
                } elseif (preg_match('/Customer:\s*(\d+)/i', $r['description'], $m)) {
                    $custIdsToFetch[] = $m[1];
                }
            }
        }

        $fallbackCustomers = [];
        if (!empty($custIdsToFetch)) {
            $inClause = implode(',', array_map('intval', array_unique($custIdsToFetch)));
            $stmtCust = $db->query("SELECT c.customer_id, c.customer_code, c.full_name, c.owner_id,
                na.username as pppoe_username,
                u_owner.username as owner_username,
                TRIM(CONCAT(COALESCE(u_owner.first_name, ''), ' ', COALESCE(u_owner.last_name, ''))) as owner_name,
                u_owner.role as owner_role
                FROM customers c
                LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
                LEFT JOIN users u_owner ON u_owner.user_id = c.owner_id
                WHERE c.customer_id IN ({$inClause}) OR c.customer_code IN ({$inClause})");
            while ($c = $stmtCust->fetch(PDO::FETCH_ASSOC)) {
                $fallbackCustomers[$c['customer_id']] = $c;
                $fallbackCustomers[$c['customer_code']] = $c;
            }
        }

        $dataRows = [];
        $sl = $offset + 1;
        foreach ($rows as $r) {
            $isDebit = ($r['type'] === 'debit');
            $amount = (float)$r['amount'];
            $debit = $isDebit ? $amount : 0.0;
            $credit = $isDebit ? null : $amount;

            // Resolve Customer Info
            $custCode = $r['wl_cust_code'] ?? '';
            $custName = $r['wl_cust_name'] ?? '';
            $pppoeUser = $r['wl_pppoe_username'] ?? '';
            $ownerName = $r['wl_owner_name'] ?? '';
            $ownerUname = $r['wl_owner_username'] ?? '';
            $ownerRole = $r['wl_owner_role'] ?? '';

            if (empty($custCode)) {
                if (preg_match('/customer #?(\d+)/i', $r['description'], $m) && isset($fallbackCustomers[$m[1]])) {
                    $fc = $fallbackCustomers[$m[1]];
                    $custCode = $fc['customer_code'];
                    $custName = $fc['full_name'];
                    $pppoeUser = $fc['pppoe_username'];
                    $ownerName = $fc['owner_name'];
                    $ownerUname = $fc['owner_username'];
                    $ownerRole = $fc['owner_role'];
                } elseif (preg_match('/Customer:\s*(\d+)/i', $r['description'], $m) && isset($fallbackCustomers[$m[1]])) {
                    $fc = $fallbackCustomers[$m[1]];
                    $custCode = $fc['customer_code'];
                    $custName = $fc['full_name'];
                    $pppoeUser = $fc['pppoe_username'];
                    $ownerName = $fc['owner_name'];
                    $ownerUname = $fc['owner_username'];
                    $ownerRole = $fc['owner_role'];
                }
            }

            // Resolve Payment Method
            $method = strtolower($r['inv_payment_method'] ?? '');
            if (empty($method)) {
                if (preg_match('/\[cash\]/i', $r['description']) || stripos($r['description'], 'cash') !== false) {
                    $method = 'cash';
                } elseif (stripos($r['description'], 'bkash') !== false || stripos($r['reference_id'], 'bkash') !== false) {
                    $method = 'bkash';
                } elseif (stripos($r['description'], 'nagad') !== false) {
                    $method = 'nagad';
                } elseif (stripos($r['description'], 'paybill') !== false) {
                    $method = 'paybill';
                }
            }

            // 1. INITIATOR: How was it done? (e.g. bKash PayBill, bKash, Nagad, Cash, Mango, STAR NETWORK)
            $initUser = !empty($r['initiator_name']) ? $r['initiator_name'] : (!empty($r['initiator_username']) ? $r['initiator_username'] : '');
            if ($method === 'paybill' || stripos($method, 'paybill') !== false) {
                $initName = 'bKash PayBill';
            } elseif ($method === 'bkash') {
                $initName = (!empty($initUser) && !in_array(strtolower($initUser), ['admin', 'saasadmin', 'system'])) ? "{$initUser} (bKash)" : 'bKash';
            } elseif ($method === 'nagad') {
                $initName = (!empty($initUser) && !in_array(strtolower($initUser), ['admin', 'saasadmin', 'system'])) ? "{$initUser} (Nagad)" : 'Nagad';
            } elseif ($method === 'rocket') {
                $initName = 'Rocket';
            } elseif ($method === 'upay') {
                $initName = 'Upay';
            } elseif ($method === 'cash') {
                $initName = !empty($initUser) ? "{$initUser} (Cash)" : 'Cash';
            } elseif ($method === 'ssl' || $method === 'sslcommerz') {
                $initName = 'SSLCommerz';
            } elseif ($method === 'surjopay' || $method === 'shurjopay') {
                $initName = 'shurjopay';
            } elseif (!empty($initUser)) {
                $initName = $initUser;
            } else {
                $initName = !empty($method) ? ucfirst($method) : 'Online';
            }

            // 2. POP IN-CHARGE: Under whom is this customer?
            if (!empty($ownerName)) {
                $popName = $ownerName;
            } elseif (!empty($ownerUname)) {
                $popName = $ownerUname;
            } elseif (!empty($custCode)) {
                $popName = 'Head Office';
            } else {
                // Reseller balance topup / opening balance / wallet adjustment
                $popName = !empty($r['pop_name']) ? $r['pop_name'] : (!empty($r['pop_username']) ? $r['pop_username'] : 'Head Office');
            }

            // 3. DESCRIPTION: Customer ID & Username or Reseller/Agent Name
            $refType = strtoupper($r['reference_type'] ?? '');
            if (!empty($custCode)) {
                $uStr = !empty($pppoeUser) ? " (User: {$pppoeUser})" : (!empty($custName) ? " (Name: {$custName})" : '');
                if ($refType === 'CUSTOMER_RECHARGE' || $refType === 'RENEW') {
                    $pkgStr = '';
                    if (preg_match('/\[Package:\s*([^\]]+)\]/i', $r['description'], $pm)) {
                        $pkgStr = " [{$pm[1]}]";
                    } elseif (preg_match('/\(Package:\s*([^\)]+)\)/i', $r['description'], $pm)) {
                        $pkgStr = " [{$pm[1]}]";
                    }
                    $durStr = '';
                    if (preg_match('/\((\d+\s*(?:Month|Day)\(s\))\)/i', $r['description'], $dm)) {
                        $durStr = " - {$dm[1]}";
                    }
                    $desc = "Customer Renew: #{$custCode}{$uStr}{$durStr}{$pkgStr}";
                } elseif ($refType === 'COMMISSION_MARGIN') {
                    $roleLabel = !empty($r['pop_role']) ? ucfirst(str_replace('_', ' ', $r['pop_role'])) : 'Reseller';
                    $desc = "{$roleLabel} Commission: Customer #{$custCode}{$uStr} Bill Payment";
                } elseif ($refType === 'CUSTOMER_PAYMENT') {
                    $invStr = '';
                    if (preg_match('/Inv #([A-Za-z0-9\-]+)/i', $r['description'], $im)) {
                        $invStr = " [Inv #{$im[1]}]";
                    }
                    $mStr = !empty($method) ? " via " . ($method === 'bkash' ? 'bKash' : ($method === 'paybill' ? 'bKash PayBill' : ucfirst($method))) : '';
                    $desc = "Customer Bill Received: #{$custCode}{$uStr}{$mStr}{$invStr}";
                } else {
                    $desc = "Customer Transaction: #{$custCode}{$uStr}";
                }
            } else {
                // Reseller / Agent self recharge / topup / transfer
                $resellerName = !empty($r['pop_name']) ? $r['pop_name'] : (!empty($r['pop_username']) ? $r['pop_username'] : 'Reseller');
                $resellerUname = !empty($r['pop_username']) ? " (User: {$r['pop_username']})" : '';
                $initDisp = !empty($r['initiator_name']) ? $r['initiator_name'] : (!empty($r['initiator_username']) ? $r['initiator_username'] : '');

                if ($refType === 'TRANSFER_IN') {
                    $desc = "Fund Transfer Received: {$resellerName}{$resellerUname}" . (!empty($initDisp) ? " from {$initDisp}" : '');
                } elseif ($refType === 'TRANSFER_OUT') {
                    $desc = "Fund Transfer Sent: By {$initDisp}" . (!empty($resellerName) ? " to {$resellerName}{$resellerUname}" : '');
                } elseif ($refType === 'TOPUP') {
                    if (!empty($r['initiator_user_id']) && (int)$r['initiator_user_id'] === (int)($r['pop_user_id'] ?? 0)) {
                        $desc = "Reseller Self Recharge: {$resellerName}{$resellerUname}";
                    } else {
                        $desc = "Reseller Balance Topup: {$resellerName}{$resellerUname}" . (!empty($initDisp) ? " by {$initDisp}" : '');
                    }
                } elseif ($refType === 'OPENING_BALANCE') {
                    $desc = "Opening Balance: {$resellerName}{$resellerUname}";
                } elseif ($refType === 'MANUAL_DEBIT') {
                    $desc = "Balance Debit: {$resellerName}{$resellerUname}" . (!empty($initDisp) ? " by {$initDisp}" : '');
                } else {
                    $desc = "Reseller Transaction: {$resellerName}{$resellerUname} - " . $r['description'];
                }
            }

            $rawRef = $r['reference_id'] ?: (string)$r['transaction_id'];
            if (preg_match('/^TXG-\d{8}-/i', $rawRef)) {
                $trxId = (string)$r['transaction_id'];
            } else {
                $clean = preg_replace('/^(TRX[-_]RENEW|TRX[-_]BKASH|TEST[-_]UNMATCHED|BKASH|TRX|RCH|TOPUP|WT|TXG|TX)[-_]/i', '', $rawRef);
                $trxId = !empty($clean) ? $clean : (string)$r['transaction_id'];
            }

            $dataRows[] = [
                'sl' => $sl++,
                'ref' => $trxId,
                'trx_id' => $trxId,
                'ref_no' => $trxId,
                'initiator_name' => $initName,
                'pop_in_charge_name' => $popName,
                'pop_name' => $popName,
                'collector_name' => $popName,
                'debit' => $debit,
                'credit' => $credit,
                'balance' => (float)$r['balance_after'],
                'balance_after' => (float)$r['balance_after'],
                'created_at' => $r['created_at'],
                'description' => $desc,
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

    /**
     * GET /payments/unmatched
     * List all unmatched / suspense payments in this tenant
     */
    public static function unmatchedPayments(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = (int)AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT 
            t.transaction_id,
            t.tenant_id,
            t.transaction_ref,
            t.transaction_type,
            t.amount,
            t.method,
            t.description,
            t.metadata,
            t.created_at,
            t.customer_id
            FROM transactions t
            WHERE (t.tenant_id = :tid OR :tid2 = 0)
              AND (t.transaction_type = 'UNMATCHED_PAYMENT' OR (t.customer_id IS NULL AND t.description LIKE '%Unmatched%'))
            ORDER BY t.transaction_id DESC
            LIMIT 50");
        $stmt->execute(['tid' => $tenantId, 'tid2' => $tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $data = array_map(function($r) {
            $meta = !empty($r['metadata']) ? json_decode($r['metadata'], true) : [];
            $rawRef = $meta['reference'] ?? ($meta['payerReference'] ?? ($meta['ref'] ?? ($meta['customer_code'] ?? '')));
            return [
                'transaction_id' => (int)$r['transaction_id'],
                'transaction_ref' => $r['transaction_ref'],
                'amount' => (float)$r['amount'],
                'method' => $r['method'],
                'raw_reference' => $rawRef,
                'description' => $r['description'],
                'created_at' => $r['created_at'],
                'metadata' => $meta,
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'count' => count($data),
            'data' => $data,
        ]);
    }

    /**
     * POST /payments/assign-unmatched
     * Assigns an unmatched payment to a customer, settles bill, and reactivates MikroTik
     */
    public static function assignUnmatched(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = (int)AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $trxIdentifier = trim($data['transaction_id'] ?? ($data['transaction_ref'] ?? ($data['trx_id'] ?? '')));
        $targetCustomer = trim($data['customer_id'] ?? ($data['customer_code'] ?? ($data['username'] ?? '')));
        $months = max(1, (int)($data['months'] ?? 1));
        $notes = trim($data['notes'] ?? 'Manually assigned unmatched MFS payment');

        if (empty($trxIdentifier) || empty($targetCustomer)) {
            Response::error('Transaction ID/Ref and Customer ID/Code are required', 400);
            return;
        }

        // 1. Find Transaction
        $stmtTrx = $db->prepare("SELECT * FROM transactions 
            WHERE (transaction_id = :id OR transaction_ref = :ref) 
              AND (tenant_id = :tid OR :tid2 = 0) LIMIT 1");
        $stmtTrx->execute([
            'id' => is_numeric($trxIdentifier) ? (int)$trxIdentifier : 0,
            'ref' => $trxIdentifier,
            'tid' => $tenantId,
            'tid2' => $tenantId,
        ]);
        $trx = $stmtTrx->fetch(PDO::FETCH_ASSOC);

        if (!$trx) {
            Response::error('Transaction not found in this tenant', 404);
            return;
        }

        if (!empty($trx['customer_id']) && $trx['transaction_type'] !== 'UNMATCHED_PAYMENT') {
            Response::error("Transaction is already assigned to Customer #{$trx['customer_id']}", 400);
            return;
        }

        $effectiveTenantId = (int)$trx['tenant_id'];
        $amount = (float)$trx['amount'];
        $gateway = $trx['method'] ?: 'bkash';

        // 2. Find Target Customer
        $stmtCust = $db->prepare("SELECT c.*, cs.customer_service_id, cs.expires_at, cs.access_profile_id, ap.profile_name, ap.price
            FROM customers c
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id AND cs.status != 'cancelled'
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            WHERE (c.customer_id = :cid OR c.customer_code = :code OR c.phone = :phone)
              AND c.tenant_id = :tid LIMIT 1");
        $stmtCust->execute([
            'cid' => is_numeric($targetCustomer) ? (int)$targetCustomer : 0,
            'code' => $targetCustomer,
            'phone' => $targetCustomer,
            'tid' => $effectiveTenantId,
        ]);
        $cust = $stmtCust->fetch(PDO::FETCH_ASSOC);

        if (!$cust) {
            Response::error('Target customer not found in this tenant', 404);
            return;
        }

        $customerId = (int)$cust['customer_id'];
        $customerCode = $cust['customer_code'];
        $customerName = $cust['full_name'];

        $db->beginTransaction();
        try {
            // 3. Settle or Create Invoice
            $stmtInv = $db->prepare("SELECT invoice_id, total_amount, balance_due FROM invoices 
                WHERE customer_id = :cid AND tenant_id = :tid AND status IN ('pending', 'partially_paid') 
                ORDER BY invoice_id ASC LIMIT 1");
            $stmtInv->execute(['cid' => $customerId, 'tid' => $effectiveTenantId]);
            $inv = $stmtInv->fetch(PDO::FETCH_ASSOC);

            $resolvedInvId = null;
            if ($inv) {
                $resolvedInvId = (int)$inv['invoice_id'];
                $db->prepare("UPDATE invoices 
                    SET status = 'paid', paid_amount = :amt, balance_due = 0.00, payment_method = :pm, paid_at = NOW(), updated_at = NOW() 
                    WHERE invoice_id = :id")
                   ->execute(['amt' => $amount, 'pm' => $gateway, 'id' => $resolvedInvId]);
            } else {
                // Create paid invoice with pure numeric globally unique sequence starting from 1000
                require_once __DIR__ . '/../lib/TenantSequenceService.php';
                $invNumber = TenantSequenceService::generateNextCode($db, (string)$effectiveTenantId, 'invoice', 4);
                $stmtInsInv = $db->prepare("INSERT INTO invoices 
                    (tenant_id, customer_id, customer_service_id, invoice_number, invoice_no, invoice_date, due_date, subtotal, total_amount, paid_amount, balance_due, status, payment_method, paid_at, created_at, updated_at)
                    VALUES (:tid, :cid, :csid, :num, :num2, CURDATE(), DATE_ADD(CURDATE(), INTERVAL :days DAY), :sub, :amt, :paid, 0.00, 'paid', :pm, NOW(), NOW(), NOW())");
                $stmtInsInv->execute([
                    'tid' => $effectiveTenantId,
                    'cid' => $customerId,
                    'csid' => !empty($cust['customer_service_id']) ? (int)$cust['customer_service_id'] : null,
                    'num' => $invNumber,
                    'num2' => $invNumber,
                    'days' => $months * 30,
                    'sub' => $amount,
                    'amt' => $amount,
                    'paid' => $amount,
                    'pm' => $gateway,
                ]);
                $resolvedInvId = (int)$db->lastInsertId();
            }

            // 4. Extend Customer Expiry (+30 days * months)
            $daysToAdd = $months * 30;
            $db->prepare("UPDATE customer_services 
                SET expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, NOW()), NOW()), INTERVAL :days DAY),
                    status = 'active',
                    updated_at = NOW()
                WHERE customer_id = :cid AND tenant_id = :tid")
               ->execute(['days' => $daysToAdd, 'cid' => $customerId, 'tid' => $effectiveTenantId]);

            // Reactivate Customer Status
            $db->prepare("UPDATE customers 
                SET status = 'active', billing_status = 'Paid', updated_at = NOW() 
                WHERE customer_id = :cid AND tenant_id = :tid")
               ->execute(['cid' => $customerId, 'tid' => $effectiveTenantId]);

            // 5. Update Transaction Record
            $newDesc = $trx['description'] . " [Reconciled & Assigned to #{$customerCode} ({$customerName}) by {$user['username']}]";
            $db->prepare("UPDATE transactions 
                SET customer_id = :cid,
                    transaction_type = 'GATEWAY_PAYMENT',
                    collector_user_id = :uid,
                    description = :desc
                WHERE transaction_id = :tid")
               ->execute([
                   'cid' => $customerId,
                   'uid' => $user['user_id'],
                   'desc' => $newDesc,
                   'tid' => $trx['transaction_id'],
               ]);

            // 6. Execute Multi-Tier Split if invoice exists and reseller assigned
            if ($resolvedInvId) {
                try {
                    require_once __DIR__ . '/../lib/PaymentSplitService.php';
                    $splitService = new PaymentSplitService($db);
                    $splitService->processCustomerPayment($resolvedInvId, $amount, $gateway, ['trx_id' => $trx['transaction_ref']]);
                } catch (\Throwable $se) {
                    error_log("Assign Payment Split Note: " . $se->getMessage());
                }
            }

            // 7. Activity Logger
            try {
                require_once __DIR__ . '/../lib/ActivityLogger.php';
                ActivityLogger::log([
                    'tenant_id' => $effectiveTenantId,
                    'user_id' => (int)$user['user_id'],
                    'log_type' => 'financial',
                    'action' => 'assign_unmatched_payment',
                    'module' => 'payment',
                    'target_id' => (string)$customerId,
                    'target_type' => 'customer',
                    'description' => "Assigned unmatched payment #{$trx['transaction_ref']} (৳{$amount} via {$gateway}) to customer #{$customerCode} ({$customerName})",
                    'metadata' => [
                        'transaction_id' => $trxId,
                        'transaction_ref' => $trx['transaction_ref'],
                        'customer_id' => $customerId,
                        'customer_code' => $customerCode,
                        'amount' => $amount,
                        'months' => $months,
                        'invoice_id' => $resolvedInvId,
                    ],
                ]);
            } catch (\Throwable $actErr) {}

            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log("Assign Payment DB Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
            Response::error('Failed to assign payment: ' . $e->getMessage(), 500);
            return;
        }

        // 7. MikroTik Router Instant Reactivation
        $mtMsg = 'Internet unblocked and profile synced';
        try {
            require_once __DIR__ . '/../lib/MikrotikSyncService.php';
            $mtRes = MikrotikSyncService::renewCustomer($db, $customerId);
            if (!empty($mtRes['message'])) {
                $mtMsg = $mtRes['message'];
            }
        } catch (\Throwable $mte) {
            $mtMsg = 'MikroTik update queued: ' . $mte->getMessage();
        }

        // 8. Fetch updated expiry date
        $stmtExp = $db->prepare("SELECT expires_at FROM customer_services WHERE customer_id = :cid ORDER BY customer_service_id DESC LIMIT 1");
        $stmtExp->execute(['cid' => $customerId]);
        $newExpires = $stmtExp->fetchColumn();

        Response::json([
            'success' => true,
            'message' => "Payment of ৳" . number_format($amount, 2) . " successfully assigned to {$customerName} ({$customerCode}). Service reactivated!",
            'data' => [
                'transaction_id' => (int)$trx['transaction_id'],
                'transaction_ref' => $trx['transaction_ref'],
                'amount' => $amount,
                'customer_id' => $customerId,
                'customer_code' => $customerCode,
                'customer_name' => $customerName,
                'new_expiry' => $newExpires,
                'mikrotik' => $mtMsg,
            ],
        ]);
    }
}

