<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/RouterosAPI.php';

class SubscriberController {
    public static function index(string $tenantId): void {
        $db = Database::getConnection();
        $status = $_GET['status'] ?? 'ALL';
        $zone = $_GET['zone'] ?? 'ALL';
        $search = trim($_GET['search'] ?? '');

        $sql = "SELECT s.*, p.name as package_name, p.rate_limit, r.name as router_name, res.name as reseller_name 
                FROM subscribers s 
                LEFT JOIN packages p ON s.package_id = p.id 
                LEFT JOIN mikrotik_routers r ON s.router_id = r.id 
                LEFT JOIN resellers res ON s.reseller_id = res.id 
                WHERE s.tenant_id = :tenant_id";
        $params = ['tenant_id' => $tenantId];

        if ($status !== 'ALL') {
            $sql .= " AND s.status = :status";
            $params['status'] = $status;
        }

        if ($zone !== 'ALL') {
            $sql .= " AND s.zone = :zone";
            $params['zone'] = $zone;
        }

        if (!empty($search)) {
            $sql .= " AND (s.name LIKE :search OR s.mobile LIKE :search OR s.pppoe_username LIKE :search OR s.customer_code LIKE :search)";
            $params['search'] = "%$search%";
        }

        $sql .= " ORDER BY s.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $subscribers = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'subscribers' => $subscribers,
            'total' => count($subscribers),
        ]);
    }

    public static function create(string $tenantId): void {
        $data = json_decode(file_get_contents('php://input'), true);
        $db = Database::getConnection();

        $name = trim($data['name'] ?? '');
        $mobile = trim($data['mobile'] ?? '');
        $pppoeUsername = trim($data['pppoeUsername'] ?? $data['pppoe_username'] ?? '');
        $pppoePassword = trim($data['pppoePassword'] ?? $data['pppoe_password'] ?? '');
        $packageId = $data['packageId'] ?? $data['package_id'] ?? '';
        $routerId = $data['routerId'] ?? $data['router_id'] ?? null;
        $zone = $data['zone'] ?? '';
        $boxNumber = $data['boxNumber'] ?? $data['box_number'] ?? '';
        $address = $data['address'] ?? '';
        $validityDays = (int)($data['validityDays'] ?? 30);

        if (empty($name) || empty($mobile) || empty($pppoeUsername) || empty($pppoePassword) || empty($packageId)) {
            Response::error('Name, mobile, PPPoE username, password, and package are required', 400);
        }

        // Check unique PPPoE username
        $stmt = $db->prepare("SELECT id FROM subscribers WHERE tenant_id = :tenant_id AND pppoe_username = :username LIMIT 1");
        $stmt->execute(['tenant_id' => $tenantId, 'username' => $pppoeUsername]);
        if ($stmt->fetch()) {
            Response::error('PPPoE username already taken', 400);
        }

        // Get package
        $stmt = $db->prepare("SELECT * FROM packages WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $packageId]);
        $pkg = $stmt->fetch();
        if (!$pkg) {
            Response::error('Invalid package selected', 400);
        }

        $id = 'sub-' . uniqid();
        $customerCode = 'C-' . rand(100000, 999999);
        $monthlyFee = (float)($data['monthlyFee'] ?? $pkg['price']);
        $discount = (float)($data['discount'] ?? 0);
        $expiryDate = date('Y-m-d H:i:s', strtotime("+{$validityDays} days"));

        $stmt = $db->prepare("INSERT INTO subscribers 
            (id, tenant_id, customer_code, name, mobile, address, zone, box_number, connection_type, pppoe_username, pppoe_password, package_id, router_id, monthly_fee, discount, expiry_date, status) 
            VALUES (:id, :tenant_id, :customer_code, :name, :mobile, :address, :zone, :box_number, 'PPPOE', :pppoe_username, :pppoe_password, :package_id, :router_id, :monthly_fee, :discount, :expiry_date, 'ACTIVE')");
        
        $stmt->execute([
            'id' => $id,
            'tenant_id' => $tenantId,
            'customer_code' => $customerCode,
            'name' => $name,
            'mobile' => $mobile,
            'address' => $address,
            'zone' => $zone,
            'box_number' => $boxNumber,
            'pppoe_username' => $pppoeUsername,
            'pppoe_password' => $pppoePassword,
            'package_id' => $packageId,
            'router_id' => $routerId,
            'monthly_fee' => $monthlyFee,
            'discount' => $discount,
            'expiry_date' => $expiryDate,
        ]);

        // Auto sync to MikroTik if router is selected
        if (!empty($routerId)) {
            $stmt = $db->prepare("SELECT * FROM mikrotik_routers WHERE id = :id LIMIT 1");
            $stmt->execute(['id' => $routerId]);
            $router = $stmt->fetch();

            if ($router) {
                $api = new RouterosAPI();
                $api->port = (int)$router['api_port'];
                $api->ssl = ($api->port === 8729 || !empty($router['use_ssl']));
                if ($api->connect($router['ip_address'], $router['username'], $router['password'])) {
                    $api->comm('/ppp/secret/add', [
                        '=name=' . $pppoeUsername,
                        '=password=' . $pppoePassword,
                        '=profile=' . ($pkg['mikrotik_profile'] ?: $pkg['name']),
                        '=service=pppoe',
                        '=comment=' . "{$name} | {$customerCode}",
                    ]);
                    $api->disconnect();
                }
            }
        }

        Response::json([
            'success' => true,
            'message' => 'Subscriber created and synchronized to MikroTik successfully',
            'subscriberId' => $id,
            'customerCode' => $customerCode,
        ], 201);
    }

    public static function recharge(string $tenantId, string $id): void {
        $data = json_decode(file_get_contents('php://input'), true);
        $db = Database::getConnection();

        $days = (int)($data['days'] ?? 30);
        $paymentMethod = $data['paymentMethod'] ?? 'CASH';

        $stmt = $db->prepare("SELECT s.*, p.price, r.ip_address, r.api_port, r.username, r.password as r_pass 
                               FROM subscribers s 
                               JOIN packages p ON s.package_id = p.id 
                               LEFT JOIN mikrotik_routers r ON s.router_id = r.id 
                               WHERE s.id = :id AND s.tenant_id = :tenant_id LIMIT 1");
        $stmt->execute(['id' => $id, 'tenant_id' => $tenantId]);
        $sub = $stmt->fetch();

        if (!$sub) {
            Response::error('Subscriber not found', 404);
        }

        // Calculate new expiry date
        $currentExpiry = strtotime($sub['expiry_date']);
        $baseTime = ($currentExpiry > time()) ? $currentExpiry : time();
        $newExpiry = date('Y-m-d H:i:s', strtotime("+{$days} days", $baseTime));

        // 1. Update subscriber
        $stmt = $db->prepare("UPDATE subscribers SET status = 'ACTIVE', expiry_date = :expiry WHERE id = :id");
        $stmt->execute(['expiry' => $newExpiry, 'id' => $id]);

        // 2. Generate invoice & payment
        $invoiceId = 'inv-' . uniqid();
        $invoiceNo = 'INV-' . date('Ym') . '-' . rand(1000, 9999);
        $amount = (float)($data['amount'] ?? $sub['monthly_fee']);

        $now = date('Y-m-d H:i:s');
        $stmt = $db->prepare("INSERT INTO invoices 
            (id, tenant_id, invoice_no, subscriber_id, package_id, billing_month, amount, payable_amount, paid_amount, due_amount, status, due_date, paid_at, payment_method) 
            VALUES (:id, :tenant_id, :invoice_no, :subscriber_id, :package_id, :billing_month, :amount, :payable_amount, :paid_amount, 0, 'PAID', :now1, :now2, :payment_method)");
        
        $stmt->execute([
            'id' => $invoiceId,
            'tenant_id' => $tenantId,
            'invoice_no' => $invoiceNo,
            'subscriber_id' => $id,
            'package_id' => $sub['package_id'],
            'billing_month' => date('Y-m'),
            'amount' => $amount,
            'payable_amount' => $amount,
            'paid_amount' => $amount,
            'now1' => $now,
            'now2' => $now,
            'payment_method' => $paymentMethod,
        ]);

        // 3. Record Payment
        $stmt = $db->prepare("INSERT INTO payments (id, tenant_id, invoice_id, subscriber_id, amount, payment_method, notes) 
                               VALUES (:id, :tenant_id, :invoice_id, :subscriber_id, :amount, :method, 'Recharge payment')");
        $stmt->execute([
            'id' => 'pay-' . uniqid(),
            'tenant_id' => $tenantId,
            'invoice_id' => $invoiceId,
            'subscriber_id' => $id,
            'amount' => $amount,
            'method' => $paymentMethod,
        ]);

        // 4. MikroTik Unblock / Enable
        if (!empty($sub['ip_address'])) {
            $api = new RouterosAPI();
            $api->port = (int)$sub['api_port'];
            $api->ssl = ($api->port === 8729 || !empty($sub['use_ssl']));
            if ($api->connect($sub['ip_address'], $sub['username'], $sub['r_pass'])) {
                $api->comm('/ppp/secret/set', [
                    '=numbers=' . $sub['pppoe_username'],
                    '=disabled=no',
                ]);
                $api->disconnect();
            }
        }

        Response::json([
            'success' => true,
            'message' => "Recharged successfully! Active until " . date('d M, Y', strtotime($newExpiry)),
            'newExpiry' => $newExpiry,
        ]);
    }

    public static function kick(string $tenantId, string $id): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT s.pppoe_username, r.ip_address, r.api_port, r.username, r.password 
                               FROM subscribers s 
                               JOIN mikrotik_routers r ON s.router_id = r.id 
                               WHERE s.id = :id AND s.tenant_id = :tenant_id LIMIT 1");
        $stmt->execute(['id' => $id, 'tenant_id' => $tenantId]);
        $row = $stmt->fetch();

        if (!$row) {
            Response::error('Subscriber or router not found', 404);
        }

        $api = new RouterosAPI();
        $api->port = (int)$row['api_port'];
        $api->ssl = ($api->port === 8729 || !empty($row['use_ssl']));
        if ($api->connect($row['ip_address'], $row['username'], $row['password'])) {
            $activeList = $api->comm('/ppp/active/print', ['?name=' . $row['pppoe_username']]);
            if (!empty($activeList)) {
                foreach ($activeList as $session) {
                    if (isset($session['.id'])) {
                        $api->comm('/ppp/active/remove', ['=.id=' . $session['.id']]);
                    }
                }
            }
            $api->disconnect();
        }

        Response::json([
            'success' => true,
            'message' => "Session for {$row['pppoe_username']} disconnected",
        ]);
    }

    public static function toggleStatus(string $tenantId, string $id): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT status FROM subscribers WHERE id = :id AND tenant_id = :tenant_id LIMIT 1");
        $stmt->execute(['id' => $id, 'tenant_id' => $tenantId]);
        $sub = $stmt->fetch();

        if (!$sub) {
            Response::error('Subscriber not found', 404);
        }

        $newStatus = ($sub['status'] === 'ACTIVE') ? 'SUSPENDED' : 'ACTIVE';
        $stmt = $db->prepare("UPDATE subscribers SET status = :status WHERE id = :id");
        $stmt->execute(['status' => $newStatus, 'id' => $id]);

        Response::json([
            'success' => true,
            'message' => "Subscriber marked as {$newStatus}",
            'status' => $newStatus,
        ]);
    }
}
