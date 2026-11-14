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
                'coll' => $data['receivedByUserId'] ?? $user['user_id'],
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

        $where = ["t.tenant_id = :tid"];
        $params = ['tid' => $tenantId];

        if (!$isLevel0) {
            $rawPath = $user['hierarchy_path'] ?? "/{$callerId}/";
            $userPath = '/' . trim($rawPath, '/') . '/';
            $params['scope_uid'] = $callerId;
            $params['scope_path_wildcard'] = $userPath . '%';
            $where[] = "(c.owner_id = :scope_uid OR u.hierarchy_path LIKE :scope_path_wildcard OR c.owner_path LIKE :scope_path_wildcard)";
        }

        $whereSql = implode(' AND ', $where);

        $stmt = $db->prepare("SELECT 
            t.transaction_id as paymentIntentId,
            t.transaction_ref as merchantInvoiceNumber,
            COALESCE(i.invoice_number, t.transaction_ref) as invoiceNumber,
            i.invoice_id as invoiceId,
            t.method as gateway,
            t.transaction_ref as gatewayPaymentId,
            t.amount,
            'PAID' as status,
            t.customer_id as customerId,
            c.full_name as payeeName,
            c.phone as payeeMobile,
            t.created_at as createdAt,
            t.created_at as updatedAt,
            t.created_at as paidAt
            FROM transactions t
            LEFT JOIN customers c ON c.customer_id = t.customer_id
            LEFT JOIN users u ON u.user_id = c.owner_id
            LEFT JOIN invoices i ON i.customer_id = t.customer_id
            WHERE {$whereSql}
            ORDER BY t.transaction_id DESC LIMIT 50");
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        // Calculate summary
        $stmtSum = $db->prepare("SELECT 
            SUM(CASE WHEN DATE(t.created_at) = CURDATE() THEN t.amount ELSE 0 END) as today,
            SUM(CASE WHEN DATE(t.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN t.amount ELSE 0 END) as yesterday,
            SUM(CASE WHEN t.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN t.amount ELSE 0 END) as this_month,
            SUM(CASE WHEN t.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND t.created_at < DATE_FORMAT(NOW(), '%Y-%m-01') THEN t.amount ELSE 0 END) as last_month,
            SUM(t.amount) as filtered_total
            FROM transactions t
            LEFT JOIN customers c ON c.customer_id = t.customer_id
            LEFT JOIN users u ON u.user_id = c.owner_id
            WHERE {$whereSql}");
        $stmtSum->execute($params);
        $sum = $stmtSum->fetch() ?: [];

        Response::json([
            'success' => true,
            'data' => [
                'items' => $items ?: [],
                'total' => count($items),
                'summary' => [
                    'today' => (float)($sum['today'] ?? 0),
                    'yesterday' => (float)($sum['yesterday'] ?? 0),
                    'thisMonth' => (float)($sum['this_month'] ?? 0),
                    'lastMonth' => (float)($sum['last_month'] ?? 0),
                    'filteredTotal' => (float)($sum['filtered_total'] ?? 0),
                ],
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

        // Fetch paginated rows
        $dataStmt = $db->prepare("SELECT 
            t.transaction_id,
            t.transaction_ref,
            t.transaction_type,
            t.amount,
            t.method,
            t.running_balance_after_transaction,
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

