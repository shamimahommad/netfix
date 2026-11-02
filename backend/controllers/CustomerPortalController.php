<?php
/**
 * NetFix ISP SaaS - Customer Self-Service Portal Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class CustomerPortalController {
    private static function getCustomerId(): string {
        $user = AuthMiddleware::requireAuth();
        $cid = $user['customer_id'] ?? $user['user_id'] ?? null;
        if (!$cid) {
            Response::error('Customer context not found', 403);
        }
        return (string)$cid;
    }

    public static function dashboard(): void {
        $customerId = self::getCustomerId();
        $db = Database::getConnection();

        // Customer record
        $stmt = $db->prepare("SELECT * FROM customers WHERE customer_id = :cid LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $customer = $stmt->fetch();

        if (!$customer) {
            Response::error('Customer not found', 404);
        }

        // Active service & package
        $stmtCs = $db->prepare("SELECT cs.*, ap.profile_name, ap.price 
            FROM customer_services cs
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            WHERE cs.customer_id = :cid ORDER BY cs.customer_service_id DESC LIMIT 1");
        $stmtCs->execute(['cid' => $customerId]);
        $cs = $stmtCs->fetch();

        // Network account
        $stmtNet = $db->prepare("SELECT * FROM customer_network_accounts WHERE customer_id = :cid LIMIT 1");
        $stmtNet->execute(['cid' => $customerId]);
        $net = $stmtNet->fetch();

        // Recent invoices
        $stmtInv = $db->prepare("SELECT invoice_id, invoice_number, total_amount, status, invoice_date, due_date 
            FROM invoices WHERE customer_id = :cid ORDER BY invoice_id DESC LIMIT 5");
        $stmtInv->execute(['cid' => $customerId]);
        $invoices = $stmtInv->fetchAll();

        // Total due
        $stmtDue = $db->prepare("SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE customer_id = :cid AND status = 'pending'");
        $stmtDue->execute(['cid' => $customerId]);
        $due = (float)$stmtDue->fetchColumn();

        Response::json([
            'success' => true,
            'data' => [
                'customer' => [
                    'customerId' => (string)$customer['customer_id'],
                    'fullName' => $customer['full_name'],
                    'customerCode' => $customer['customer_code'],
                    'phone' => $customer['phone'],
                    'email' => $customer['email'],
                ],
                'packageName' => $cs['profile_name'] ?? 'Starter 10M',
                'expiryDate' => $cs['expires_at'] ?? date('Y-m-d', strtotime('+20 days')),
                'billingStatus' => $customer['billing_status'] ?: 'Paid',
                'balance' => $due,
                'planPrice' => (float)($cs['price'] ?? 500),
                'billingSummary' => ['totalDue' => $due],
                'recentInvoices' => array_map(function($i) {
                    return [
                        'invoiceId' => (string)$i['invoice_id'],
                        'invoiceNumber' => $i['invoice_number'],
                        'totalAmount' => (float)$i['total_amount'],
                        'status' => $i['status'],
                        'invoiceDate' => $i['invoice_date'],
                        'dueDate' => $i['due_date'],
                    ];
                }, $invoices),
                'totalInvoices' => count($invoices),
                'network' => [
                    'onlineStatus' => (bool)($net['is_online'] ?? true),
                    'username' => $net['username'] ?? $customer['customer_code'],
                    'uploadBytes' => (int)($net['upload_bytes'] ?? 1073741824),
                    'downloadBytes' => (int)($net['download_bytes'] ?? 5368709120),
                ],
            ],
        ]);
    }

    public static function invoices(): void {
        $customerId = self::getCustomerId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM invoices WHERE customer_id = :cid ORDER BY invoice_id DESC");
        $stmt->execute(['cid' => $customerId]);
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            return [
                'invoiceId' => (string)$r['invoice_id'],
                'invoiceNumber' => $r['invoice_number'],
                'totalAmount' => (float)$r['total_amount'],
                'paidAmount' => (float)$r['paid_amount'],
                'balanceDue' => (float)$r['balance_due'],
                'status' => $r['status'],
                'invoiceDate' => $r['invoice_date'],
                'dueDate' => $r['due_date'],
                'remarks' => $r['notes'] ?? 'Internet Subscription Bill',
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'total' => count($data),
                'page' => 1,
                'limit' => 20,
                'totalPages' => 1,
            ],
        ]);
    }

    public static function paymentHistory(): void {
        $customerId = self::getCustomerId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM transactions WHERE customer_id = :cid ORDER BY transaction_id DESC");
        $stmt->execute(['cid' => $customerId]);
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            return [
                'paymentId' => (string)$r['transaction_id'],
                'tranId' => $r['transaction_ref'],
                'amount' => (float)$r['amount'],
                'cardType' => strtoupper($r['method'] ?: 'CASH'),
                'paymentTime' => $r['created_at'],
                'status' => 'Success',
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'total' => count($data),
                'page' => 1,
                'limit' => 20,
                'totalPages' => 1,
            ],
        ]);
    }

    public static function packages(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM access_profiles WHERE tenant_id = :tid AND status = 'enabled' ORDER BY price ASC");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            return [
                'packageId' => (string)$r['access_profile_id'],
                'packageName' => $r['profile_name'],
                'price' => (float)$r['price'],
                'downloadSpeed' => (int)($r['download_speed_kbps'] / 1024),
                'validityDays' => (int)$r['validity_days'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public static function paymentMethods(): void {
        Response::json([
            ['id' => 'bkash', 'name' => 'bKash Direct Pay', 'logo' => '/assets/bkash.png'],
            ['id' => 'nagad', 'name' => 'Nagad', 'logo' => '/assets/nagad.png'],
            ['id' => 'card', 'name' => 'Visa / Mastercard', 'logo' => '/assets/visa.png'],
        ]);
    }

    public static function tickets(): void {
        $customerId = self::getCustomerId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM customer_tickets WHERE customer_id = :cid ORDER BY ticket_id DESC");
        $stmt->execute(['cid' => $customerId]);
        $rows = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'data' => $rows ?: [],
        ]);
    }

    public static function createTicket(): void {
        $customerId = self::getCustomerId();
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $title = trim($data['title'] ?? '');
        $desc = trim($data['description'] ?? '');

        if (empty($title) || empty($desc)) {
            Response::error('Title and description are required', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO customer_tickets (tenant_id, customer_id, title, description, status, priority)
            VALUES (:tid, :cid, :title, :desc, 'open', 'medium')");
        $stmt->execute([
            'tid' => $tenantId,
            'cid' => $customerId,
            'title' => $title,
            'desc' => $desc,
        ]);

        Response::json(['success' => true, 'message' => 'Ticket created successfully'], 201);
    }
}

