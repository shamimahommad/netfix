<?php
/**
 * NetFix ISP SaaS - Billing & Invoices Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/TenantSequenceService.php';

class BillingController {
    public static function accounts(string $filterType = 'all'): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 20;
        $offset = ($page - 1) * $limit;

        $where = ["c.tenant_id = :tid"];
        $params = ['tid' => $tenantId];

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
            c.billing_status,
            na.username,
            ap.profile_name as package_name,
            ap.price as package_price,
            cs.expires_at as expiry_date,
            cs.billing_cycle,
            inv.balance_due
            FROM customers c
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id AND cs.status = 'active'
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            LEFT JOIN invoices inv ON inv.customer_id = c.customer_id AND inv.status = 'pending'
            WHERE {$whereSql}
            ORDER BY c.customer_id DESC
            LIMIT {$limit} OFFSET {$offset}";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            return [
                'customerId' => (string)$r['customer_id'],
                'customerCode' => $r['customer_code'],
                'fullName' => $r['full_name'],
                'phone' => $r['phone'],
                'username' => $r['username'],
                'packageName' => $r['package_name'],
                'packagePrice' => (float)($r['package_price'] ?? 0),
                'billAmount' => (float)($r['package_price'] ?? 0),
                'expiryDate' => $r['expiry_date'],
                'billingCycle' => $r['billing_cycle'] ?: 'monthly',
                'status' => $r['status'],
                'billingStatus' => $r['billing_status'] ?: 'Paid',
                'balanceDue' => (float)($r['balance_due'] ?? 0),
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
            $months = max(1, (int)($data['no_of_month'] ?? 1));
            $days = isset($data['selected_days']) ? (int)$data['selected_days'] : ($months * 30);
            $planId = $data['plan_id'] ?? 1;

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
                'message' => 'Service renewed successfully' . $mtMsg,
                'data' => [
                    'new_expire_date' => $newExpireDate,
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
        $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 20;
        $offset = ($page - 1) * $limit;

        $where = ["i.tenant_id = :tid"];
        $params = ['tid' => $tenantId];

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
            $where[] = "(c.reseller_id = :owner_id OR i.created_by = :owner_id2)";
            $params['owner_id'] = $_GET['ownerId'];
            $params['owner_id2'] = $_GET['ownerId'];
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
            WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $query = "SELECT 
            i.*,
            c.customer_code,
            c.full_name as customer_name,
            c.phone as customer_phone,
            ap.profile_name as package_name,
            u.first_name as collected_by_name
            FROM invoices i
            LEFT JOIN customers c ON c.customer_id = i.customer_id
            LEFT JOIN customer_services cs ON cs.customer_service_id = i.customer_service_id
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            LEFT JOIN users u ON u.user_id = i.collected_by
            WHERE {$whereSql}
            ORDER BY i.invoice_id DESC
            LIMIT {$limit} OFFSET {$offset}";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $items = array_map(function($r) {
            return [
                'invoiceId' => (string)$r['invoice_id'],
                'invoice_id' => (string)$r['invoice_id'],
                'invoiceNumber' => $r['invoice_number'],
                'invoice_number' => $r['invoice_number'],
                'customerId' => (string)$r['customer_id'],
                'customerCode' => $r['customer_code'],
                'customerName' => $r['customer_name'],
                'customerPhone' => $r['customer_phone'],
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

        $stmt = $db->prepare("SELECT i.*, c.customer_code, c.full_name as customer_name, c.phone as customer_phone, c.installation_address 
            FROM invoices i 
            LEFT JOIN customers c ON c.customer_id = i.customer_id 
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
}
