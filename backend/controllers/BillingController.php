<?php
/**
 * NetFix ISP SaaS - Billing & Invoices Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/TenantSequenceService.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';

class BillingController {
    public static function accounts(string $filterType = 'all'): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(5000, (int)$_GET['limit'])) : 20;
        $offset = ($page - 1) * $limit;

        $scope = HierarchySecurityService::getDownwardScopeClause((int)$user['user_id'], $tenantId ? (int)$tenantId : null, 'c', 'owner_u');
        $where = [];
        $params = $scope['params'];
        if (!empty($scope['whereSql'])) {
            $where[] = $scope['whereSql'];
        }

        // Apply filterType
        switch ($filterType) {
            case 'active':
                $where[] = "c.status = 'active'";
                break;
            case 'new-customers':
                $where[] = "c.connection_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
                break;
            case 'expire-3-days':
                $where[] = "cs.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY)";
                break;
            case 'expire-7-days':
                $where[] = "cs.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)";
                break;
            case 'expired':
                $where[] = "(cs.expires_at < NOW() OR c.billing_status = 'Expired')";
                break;
            case 'suspended':
                $where[] = "c.status = 'suspended'";
                break;
            case 'left':
                $where[] = "c.status = 'cancelled'";
                break;
        }

        // Search
        if (!empty($_GET['search'])) {
            $search = '%' . trim($_GET['search']) . '%';
            $where[] = "(c.full_name LIKE :s1 OR c.phone LIKE :s2 OR c.customer_code LIKE :s3 OR na.username LIKE :s4)";
            $params['s1'] = $search;
            $params['s2'] = $search;
            $params['s3'] = $search;
            $params['s4'] = $search;
        }

        $whereSql = implode(' AND ', $where);

        $countStmt = $db->prepare("SELECT COUNT(DISTINCT c.customer_id) FROM customers c 
            LEFT JOIN users owner_u ON owner_u.user_id = c.owner_id
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id 
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id 
            WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $query = "SELECT 
            c.customer_id,
            c.customer_code,
            c.full_name,
            c.phone,
            c.status,
            c.billing_status as raw_billing_status,
            na.username,
            na.password,
            COALESCE(cs.protocol, na.protocol, ap.protocol, 'pppoe') as protocol,
            COALESCE(ap.profile_name, '30Mbps') as package_name,
            COALESCE(ap.price, 500.00) as package_price,
            cs.expires_at as expiry_date,
            cs.billing_cycle,
            COALESCE(inv.total_balance_due, 0) as balance_due,
            COALESCE(last_pay.last_payment_date, last_tx.tx_date) as last_payment_date,
            COALESCE(last_pay.collector_username, last_tx.tx_username) as last_collector_username,
            COALESCE(last_pay.collector_first_name, last_tx.tx_first_name) as last_collector_first_name,
            COALESCE(last_pay.collector_last_name, last_tx.tx_last_name) as last_collector_last_name,
            COALESCE(last_pay.collector_role, last_tx.tx_role) as last_collector_role,
            last_tx.tx_method
            FROM customers c
            LEFT JOIN users owner_u ON owner_u.user_id = c.owner_id
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id AND cs.status = 'active'
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            LEFT JOIN (
                SELECT customer_id, SUM(balance_due) as total_balance_due 
                FROM invoices 
                WHERE status = 'pending' 
                GROUP BY customer_id
            ) inv ON inv.customer_id = c.customer_id
            LEFT JOIN (
                SELECT 
                    i1.customer_id,
                    COALESCE(i1.paid_at, i1.invoice_date, i1.created_at) as last_payment_date,
                    u.username as collector_username,
                    u.first_name as collector_first_name,
                    u.last_name as collector_last_name,
                    u.role as collector_role
                FROM invoices i1
                INNER JOIN (
                    SELECT customer_id, MAX(invoice_id) as max_inv_id 
                    FROM invoices 
                    WHERE status = 'paid' 
                    GROUP BY customer_id
                ) latest_inv ON i1.invoice_id = latest_inv.max_inv_id
                LEFT JOIN users u ON u.user_id = COALESCE(i1.collected_by, i1.created_by, i1.creator_id)
            ) last_pay ON last_pay.customer_id = c.customer_id
            LEFT JOIN (
                SELECT 
                    t1.customer_id,
                    t1.created_at as tx_date,
                    t1.method as tx_method,
                    utx.username as tx_username,
                    utx.first_name as tx_first_name,
                    utx.last_name as tx_last_name,
                    utx.role as tx_role
                FROM transactions t1
                INNER JOIN (
                    SELECT customer_id, MAX(transaction_id) as max_tx_id 
                    FROM transactions 
                    WHERE amount > 0 
                    GROUP BY customer_id
                ) latest_tx ON t1.transaction_id = latest_tx.max_tx_id
                LEFT JOIN users utx ON utx.user_id = COALESCE(t1.collector_user_id, t1.initiator_user_id)
            ) last_tx ON last_tx.customer_id = c.customer_id
            WHERE {$whereSql}
            ORDER BY c.customer_id DESC
            LIMIT {$limit} OFFSET {$offset}";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $now = time();
        $data = array_map(function($r) use ($now) {
            $expiresAtTs = !empty($r['expiry_date']) ? strtotime($r['expiry_date']) : null;
            $dueAmount = (float)($r['balance_due'] ?? 0);

            if ($r['status'] === 'suspended') {
                $billingStatus = 'Suspended';
            } elseif ($r['status'] === 'cancelled') {
                $billingStatus = 'Left';
            } elseif (($expiresAtTs !== null && $expiresAtTs < $now) || strcasecmp($r['raw_billing_status'] ?? '', 'expired') === 0) {
                $billingStatus = 'Expired';
            } elseif ($dueAmount > 0) {
                $billingStatus = 'Pending';
            } else {
                $billingStatus = 'Paid';
            }

            $collectorName = trim(($r['last_collector_first_name'] ?? '') . ' ' . ($r['last_collector_last_name'] ?? ''));
            $rechargedBy = null;
            if ($collectorName || !empty($r['last_collector_username'])) {
                $label = $collectorName ?: $r['last_collector_username'];
                $role = !empty($r['last_collector_role']) ? " ({$r['last_collector_role']})" : '';
                $rechargedBy = "Recharged by: {$label}{$role}";
            } elseif (!empty($r['tx_method'])) {
                $rechargedBy = "Paid via " . ucfirst($r['tx_method']);
            }

            $balance = $dueAmount > 0 ? -$dueAmount : 0.0;

            return [
                'customerId' => (string)$r['customer_id'],
                'customer_id' => (string)$r['customer_id'],
                'customerCode' => $r['customer_code'],
                'customer_code' => $r['customer_code'],
                'fullName' => $r['full_name'],
                'full_name' => $r['full_name'],
                'phone' => $r['phone'],
                'mobile' => $r['phone'],
                'username' => $r['username'],
                'password' => $r['password'] ?? '',
                'packageName' => $r['package_name'],
                'package_name' => $r['package_name'],
                'protocol' => strtoupper($r['protocol'] ?: 'PPPoE'),
                'packagePrice' => (float)$r['package_price'],
                'package_price' => (float)$r['package_price'],
                'billAmount' => (float)$r['package_price'],
                'bill_amount' => (float)$r['package_price'],
                'balance' => $balance,
                'balanceDue' => $dueAmount,
                'balance_due' => $dueAmount,
                'expiryDate' => $r['expiry_date'],
                'expiry_date' => $r['expiry_date'],
                'billingCycle' => $r['billing_cycle'] ?: 'monthly',
                'billing_cycle' => $r['billing_cycle'] ?: 'monthly',
                'status' => $r['status'],
                'billingStatus' => $billingStatus,
                'billing_status' => $billingStatus,
                'lastPaymentDate' => $r['last_payment_date'],
                'last_payment_date' => $r['last_payment_date'],
                'lastPaymentBy' => $rechargedBy,
                'last_payment_by' => $rechargedBy,
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => (int)ceil($total / $limit),
            ],
        ]);
    }

    public static function renew(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $customerId = $data['customer_id'] ?? null;
        if (!$customerId) {
            Response::error('Customer ID is required', 400);
        }

        $db = Database::getConnection();
        $db->beginTransaction();

        try {
            $months = max(1, (int)($data['billing_cycle_months'] ?? $data['no_of_month'] ?? 1));
            $days = isset($data['selected_days']) ? (int)$data['selected_days'] : ($months * 30);
            $planId = $data['package_id'] ?? $data['plan_id'] ?? 1;

            // Fetch plan price
            $stmtPkg = $db->prepare("SELECT * FROM access_profiles WHERE access_profile_id = :pid");
            $stmtPkg->execute(['pid' => $planId]);
            $package = $stmtPkg->fetch();
            $price = (float)($data['plan_price'] ?? $package['price'] ?? 500);
            $totalAmount = $price * $months;

            // Calculate new expiry date
            $stmtCs = $db->prepare("SELECT * FROM customer_services WHERE customer_id = :cid ORDER BY customer_service_id DESC LIMIT 1");
            $stmtCs->execute(['cid' => $customerId]);
            $currentService = $stmtCs->fetch();

            $baseTime = time();
            if ($currentService && strtotime($currentService['expires_at']) > time()) {
                $baseTime = strtotime($currentService['expires_at']);
            }
            $newExpireTimestamp = strtotime("+{$days} days", $baseTime);
            $newExpireDate = date('Y-m-d H:i:s', $newExpireTimestamp);

            // Update or insert customer service
            if ($currentService) {
                $stmtUpdate = $db->prepare("UPDATE customer_services SET expires_at = :exp, status = 'active', access_profile_id = :pid WHERE customer_service_id = :sid");
                $stmtUpdate->execute([
                    'exp' => $newExpireDate,
                    'pid' => $planId,
                    'sid' => $currentService['customer_service_id'],
                ]);
            }

            // Update customer status
            $stmtCust = $db->prepare("UPDATE customers SET status = 'active', billing_status = 'Paid' WHERE customer_id = :cid");
            $stmtCust->execute(['cid' => $customerId]);

            // Create paid invoice with pure numeric globally unique sequence
            $invNumber = TenantSequenceService::generateNextCode($db, (string)$tenantId, 'invoice', 6);
            $stmtInv = $db->prepare("INSERT INTO invoices 
                (tenant_id, customer_id, customer_service_id, invoice_number, invoice_date, due_date, status, subtotal, total_amount, paid_amount, balance_due, base_price, sell_price, collected_by, renew_mode, created_by)
                VALUES (:tid, :cid, :sid, :inv_num, CURDATE(), CURDATE(), 'paid', :sub, :tot, :paid, 0.00, :base, :sell, :coll, 'RENEW', :uid)");
            $stmtInv->execute([
                'tid' => $tenantId,
                'cid' => $customerId,
                'sid' => $currentService['customer_service_id'] ?? null,
                'inv_num' => $invNumber,
                'sub' => $totalAmount,
                'tot' => $totalAmount,
                'paid' => $totalAmount,
                'base' => $totalAmount,
                'sell' => $totalAmount,
                'coll' => $user['user_id'],
                'uid' => $user['user_id'],
            ]);

            // Record transaction
            $trxRef = 'TRX-RENEW-' . strtoupper(bin2hex(random_bytes(4)));
            $stmtTrx = $db->prepare("INSERT INTO transactions 
                (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, collector_user_id, description)
                VALUES (:tid, :cid, :ref, 'RENEW_DEBIT', :amt, 'system', :uid, :role, :coll, 'Customer subscription renewal')");
            $stmtTrx->execute([
                'tid' => $tenantId,
                'cid' => $customerId,
                'ref' => $trxRef,
                'amt' => $totalAmount,
                'uid' => $user['user_id'],
                'role' => $user['role'],
                'coll' => $user['user_id'],
            ]);

            $db->commit();

            // Real-time synchronization with MikroTik Router
            $mtMsg = '';
            try {
                require_once __DIR__ . '/../lib/MikrotikSyncService.php';
                $mtRes = MikrotikSyncService::renewCustomer($db, $customerId, (int)$planId);
                if (!empty($mtRes['message'])) {
                    $mtMsg = ' • ' . $mtRes['message'];
                }
            } catch (\Throwable $mtErr) {
                error_log("Mikrotik renew sync notice: " . $mtErr->getMessage());
            }

            Response::json([
                'success' => true,
                'message' => 'Service renewed and secret synchronized' . $mtMsg,
                'expire_at' => $newExpireDate,
                'data' => [
                    'new_expire_date' => $newExpireDate,
                    'expire_at' => $newExpireDate,
                    'bill_amount' => $totalAmount,
                ],
            ]);
        } catch (Throwable $e) {
            $db->rollBack();
            Response::error('Failed to renew service: ' . $e->getMessage(), 500);
        }
    }

    public static function changePackage(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $customerId = $data['customer_id'] ?? null;
        $planId = $data['plan_id'] ?? null;

        if (!$customerId || !$planId) {
            Response::error('Customer ID and Plan ID are required', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE customer_services SET access_profile_id = :pid WHERE customer_id = :cid AND tenant_id = :tid");
        $stmt->execute(['pid' => $planId, 'cid' => $customerId, 'tid' => $tenantId]);

        Response::json([
            'success' => true,
            'message' => 'Package changed successfully',
        ]);
    }

    public static function invoices(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(5000, (int)$_GET['limit'])) : 20;
        $offset = ($page - 1) * $limit;

        $callerId = (int)$user['user_id'];
        $scope = HierarchySecurityService::getDownwardScopeClause($callerId, $tenantId ? (int)$tenantId : null, 'c', 'u');
        $where = ["i.tenant_id = :tid"];
        $params = array_merge(['tid' => $tenantId], $scope['params']);
        if (!empty($scope['whereSql'])) {
            $where[] = $scope['whereSql'];
        }

        if (!empty($_GET['status']) && $_GET['status'] !== 'all') {
            $where[] = "i.status = :status";
            $params['status'] = $_GET['status'];
        }

        if (!empty($_GET['dateFrom'])) {
            $where[] = "DATE(i.created_at) >= :date_from";
            $params['date_from'] = $_GET['dateFrom'];
        }

        if (!empty($_GET['dateTo'])) {
            $where[] = "DATE(i.created_at) <= :date_to";
            $params['date_to'] = $_GET['dateTo'];
        }

        if (!empty($_GET['ownerId'])) {
            $targetOwnerId = (int)$_GET['ownerId'];
            if (!HierarchySecurityService::canAccessUser($callerId, $targetOwnerId)) {
                Response::error("Access Denied: You do not have permission to filter by user #{$targetOwnerId}", 403);
            }
            $where[] = "(c.owner_id = :target_owner_id OR i.created_by = :target_owner_id2)";
            $params['target_owner_id'] = $targetOwnerId;
            $params['target_owner_id2'] = $targetOwnerId;
        }

        if (!empty($_GET['search'])) {
            $rawSearch = trim($_GET['search']);
            $search = '%' . $rawSearch . '%';
            $where[] = "(i.invoice_number = :exact_inv OR i.invoice_number LIKE :s1 OR c.customer_code = :exact_cust OR c.phone = :exact_phone OR c.full_name LIKE :s2 OR c.phone LIKE :s3)";
            $params['exact_inv'] = $rawSearch;
            $params['exact_cust'] = $rawSearch;
            $params['exact_phone'] = $rawSearch;
            $params['s1'] = $search;
            $params['s2'] = $search;
            $params['s3'] = $search;
        }

        $whereSql = implode(' AND ', $where);

        $countStmt = $db->prepare("SELECT COUNT(*) FROM invoices i 
            LEFT JOIN customers c ON c.customer_id = i.customer_id 
            LEFT JOIN users u ON u.user_id = c.owner_id
            WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $query = "SELECT 
            i.*,
            c.customer_code,
            c.full_name as customer_name,
            c.phone as customer_phone,
            COALESCE(na.username, c.customer_code, c.full_name) as username,
            ap.profile_name as package_name,
            COALESCE(u_coll.first_name, u_coll.username) as collected_by_name
            FROM invoices i
            LEFT JOIN customers c ON c.customer_id = i.customer_id
            LEFT JOIN users u ON u.user_id = c.owner_id
            LEFT JOIN customer_network_accounts na ON na.customer_id = i.customer_id
            LEFT JOIN customer_services cs ON cs.customer_service_id = i.customer_service_id
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            LEFT JOIN users u_coll ON u_coll.user_id = i.collected_by
            WHERE {$whereSql}
            ORDER BY i.invoice_id DESC
            LIMIT {$limit} OFFSET {$offset}";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $items = array_map(function($r) {
            $userVal = !empty($r['username']) ? $r['username'] : (!empty($r['customer_name']) ? $r['customer_name'] : ($r['customer_code'] ?? '—'));
            return [
                'invoiceId' => (string)$r['invoice_id'],
                'invoice_id' => (string)$r['invoice_id'],
                'invoiceNumber' => $r['invoice_number'],
                'invoice_number' => $r['invoice_number'],
                'customerId' => (string)$r['customer_id'],
                'customerCode' => $r['customer_code'],
                'customerName' => $r['customer_name'],
                'customerPhone' => $r['customer_phone'],
                'username' => $userVal,
                'mobile' => $r['customer_phone'] ?? null,
                'packageName' => $r['package_name'],
                'invoiceDate' => $r['invoice_date'],
                'dueDate' => $r['due_date'],
                'status' => $r['status'],
                'subtotal' => (float)$r['subtotal'],
                'totalAmount' => (float)$r['total_amount'],
                'paidAmount' => (float)$r['paid_amount'],
                'balanceDue' => (float)$r['balance_due'],
                'sellPrice' => (float)($r['sell_price'] ?? $r['total_amount']),
                'commissionAmount' => (float)($r['commission_amount'] ?? 0),
                'collectedByName' => $r['collected_by_name'] ?? 'System',
                'createdAt' => $r['created_at'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $items,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => (int)ceil($total / $limit),
            ],
        ]);
    }

    public static function invoiceDetail(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT i.*, c.customer_code, c.full_name as customer_name, c.phone as customer_phone, c.installation_address, COALESCE(na.username, c.customer_code) as username 
            FROM invoices i 
            LEFT JOIN customers c ON c.customer_id = i.customer_id 
            LEFT JOIN customer_network_accounts na ON na.customer_id = i.customer_id
            WHERE i.invoice_id = :id AND i.tenant_id = :tid LIMIT 1");
        $stmt->execute(['id' => $id, 'tid' => $tenantId]);
        $inv = $stmt->fetch();

        if (!$inv) {
            Response::error('Invoice not found', 404);
        }

        Response::json([
            'success' => true,
            'data' => [
                'invoiceId' => (string)$inv['invoice_id'],
                'invoiceNumber' => $inv['invoice_number'],
                'customerId' => (string)$inv['customer_id'],
                'customerCode' => $inv['customer_code'],
                'customerName' => $inv['customer_name'],
                'username' => $inv['username'] ?? ($inv['customer_name'] ?? '—'),
                'customerPhone' => $inv['customer_phone'],
                'address' => $inv['installation_address'],
                'invoiceDate' => $inv['invoice_date'],
                'dueDate' => $inv['due_date'],
                'status' => $inv['status'],
                'totalAmount' => (float)$inv['total_amount'],
                'paidAmount' => (float)$inv['paid_amount'],
                'balanceDue' => (float)$inv['balance_due'],
            ],
        ]);
    }

    /**
     * GET /billing/customers/{customerId}/invoices
     * GET /customers/{customerId}/invoices
     */
    public static function customerInvoices(string $customerId): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        // 1. Resolve Customer & Check IDOR
        $stmtCust = $db->prepare("SELECT customer_id, customer_code, full_name, phone, tenant_id FROM customers WHERE (customer_id = :cid OR customer_code = :ccode) LIMIT 1");
        $stmtCust->execute(['cid' => is_numeric($customerId) ? (int)$customerId : 0, 'ccode' => $customerId]);
        $customer = $stmtCust->fetch();

        if (!$customer) {
            Response::error('Customer not found', 404);
            return;
        }

        // Strict Downward-Only Access Control IDOR Guard
        HierarchySecurityService::canViewCustomer((int)$user['user_id'], (int)$customer['customer_id'], (int)$customer['tenant_id']);
        $resolvedCid = (int)$customer['customer_id'];

        // 2. Query invoices
        $where = ["(i.customer_id = :cid" . ($customer ? " OR c.customer_code = :ccode" : "") . ")"];
        $params = ['cid' => $resolvedCid];
        if ($customer) {
            $params['ccode'] = $customer['customer_code'];
        }

        if (!empty($_GET['status']) && $_GET['status'] !== 'all') {
            $where[] = "i.status = :status";
            $params['status'] = strtolower(trim($_GET['status']));
        }

        $whereSql = implode(' AND ', $where);

        $query = "SELECT 
            i.*,
            c.customer_code,
            c.full_name as customer_name,
            c.phone as customer_phone,
            ap.profile_name as package_name,
            u.first_name as collected_by_name,
            u.last_name as collected_by_last_name
            FROM invoices i
            LEFT JOIN customers c ON c.customer_id = i.customer_id
            LEFT JOIN customer_services cs ON cs.customer_service_id = i.customer_service_id
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            LEFT JOIN users u ON u.user_id = i.collected_by
            WHERE {$whereSql}
            ORDER BY i.invoice_id DESC";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        // Determine last paid invoice for cancel/return action permission
        $lastPaidInvoiceId = null;
        foreach ($rows as $r) {
            if (strtolower($r['status'] ?? '') === 'paid') {
                $lastPaidInvoiceId = (string)$r['invoice_id'];
                break;
            }
        }

        $items = array_map(function($r) use ($lastPaidInvoiceId) {
            $collector = trim(($r['collected_by_name'] ?? '') . ' ' . ($r['collected_by_last_name'] ?? ''));
            $invId = (string)$r['invoice_id'];
            return [
                'invoiceId' => $invId,
                'invoice_id' => $invId,
                'invoiceNumber' => $r['invoice_number'],
                'invoice_number' => $r['invoice_number'],
                'customerId' => (string)$r['customer_id'],
                'customer_id' => (string)$r['customer_id'],
                'customerName' => $r['customer_name'] ?? '',
                'customer_name' => $r['customer_name'] ?? '',
                'customerCode' => $r['customer_code'] ?? '',
                'customer_code' => $r['customer_code'] ?? '',
                'customerPhone' => $r['customer_phone'] ?? '',
                'packageName' => $r['package_name'] ?? '',
                'totalAmount' => (float)$r['total_amount'],
                'total_amount' => (float)$r['total_amount'],
                'paidAmount' => (float)$r['paid_amount'],
                'paid_amount' => (float)$r['paid_amount'],
                'balanceDue' => (float)($r['balance_due'] ?? ($r['total_amount'] - $r['paid_amount'])),
                'balance_due' => (float)($r['balance_due'] ?? ($r['total_amount'] - $r['paid_amount'])),
                'status' => $r['status'],
                'paymentMethod' => $r['payment_method'] ?? 'Cash',
                'payment_method' => $r['payment_method'] ?? 'Cash',
                'invoiceDate' => $r['invoice_date'] ?? $r['created_at'],
                'invoice_date' => $r['invoice_date'] ?? $r['created_at'],
                'dueDate' => $r['due_date'] ?? null,
                'due_date' => $r['due_date'] ?? null,
                'notes' => $r['notes'] ?? '',
                'renewMode' => $r['renew_mode'] ?? 'REGULAR',
                'renew_mode' => $r['renew_mode'] ?? 'REGULAR',
                'doneBy' => !empty($collector) ? $collector : ($r['renew_mode'] === 'RESELLER' ? 'Reseller' : 'Admin'),
                'isLastPaidInvoice' => ($invId === $lastPaidInvoiceId),
                'createdAt' => $r['created_at'],
                'created_at' => $r['created_at'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'customer' => $customer ? [
                'customer_id' => (string)$customer['customer_id'],
                'customer_code' => $customer['customer_code'],
                'full_name' => $customer['full_name'],
                'phone' => $customer['phone'],
            ] : null,
            'data' => $items,
        ]);
    }

    /**
     * POST /billing/invoices/{id}/cancel
     */
    public static function cancelInvoice(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM invoices WHERE invoice_id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $inv = $stmt->fetch();

        if (!$inv) {
            Response::error('Invoice not found', 404);
        }

        $stmtUp = $db->prepare("UPDATE invoices SET status = 'cancelled', notes = CONCAT(COALESCE(notes, ''), ' [Cancelled on " . date('Y-m-d H:i') . "]') WHERE invoice_id = :id");
        $stmtUp->execute(['id' => $id]);

        Response::json([
            'success' => true,
            'message' => 'Invoice cancelled successfully',
            'data' => [
                'invoiceId' => (string)$inv['invoice_id'],
                'status' => 'cancelled',
            ],
        ]);
    }

    /**
     * POST /billing/invoices/{id}/return
     */
    public static function returnInvoice(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM invoices WHERE invoice_id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $inv = $stmt->fetch();

        if (!$inv) {
            Response::error('Invoice not found', 404);
        }

        $returnAmount = (float)$inv['paid_amount'];

        $stmtUp = $db->prepare("UPDATE invoices SET status = 'cancelled', paid_amount = 0, balance_due = total_amount, notes = CONCAT(COALESCE(notes, ''), ' [Returned ৳" . $returnAmount . " on " . date('Y-m-d H:i') . "]') WHERE invoice_id = :id");
        $stmtUp->execute(['id' => $id]);

        Response::json([
            'success' => true,
            'message' => 'Invoice return processed successfully',
            'returnAmount' => $returnAmount,
            'data' => [
                'invoiceId' => (string)$inv['invoice_id'],
                'status' => 'cancelled',
                'returnAmount' => $returnAmount,
            ],
        ]);
    }
}
