<?php
/**
 * NetFix ISP SaaS - Customers Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/TenantSequenceService.php';

class CustomersController {
    public static function index(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 20;
        $offset = ($page - 1) * $limit;

        $where = ["c.tenant_id = :tid"];
        $params = ['tid' => $tenantId];

        // Filter: status
        if (!empty($_GET['status']) && $_GET['status'] !== 'all') {
            $status = trim($_GET['status']);
            if (in_array($status, ['Paid', 'Due', 'Expired', 'Left', 'Suspended', 'Pending'])) {
                $where[] = "c.billing_status = :bstatus";
                $params['bstatus'] = $status;
            } else {
                $where[] = "c.status = :status";
                $params['status'] = $status;
            }
        }

        // Filter: search
        if (!empty($_GET['search'])) {
            $search = '%' . trim($_GET['search']) . '%';
            $where[] = "(c.full_name LIKE :s1 OR c.phone LIKE :s2 OR c.customer_code LIKE :s3 OR na.username LIKE :s4)";
            $params['s1'] = $search;
            $params['s2'] = $search;
            $params['s3'] = $search;
            $params['s4'] = $search;
        }

        // Filter: ownerId (Reseller / Agent filter)
        if (!empty($_GET['ownerId'])) {
            $where[] = "c.owner_id = :ownerId";
            $params['ownerId'] = $_GET['ownerId'];
        }

        // If user is Reseller/Agent, apply hierarchical isolation
        if (!empty($user['role']) && in_array($user['role'], ['reseller', 'sub_reseller', 'agent'])) {
            $where[] = "(c.owner_id = :user_owner_id OR c.owner_role_level <= :user_role_level)";
            $params['user_owner_id'] = $user['user_id'];
            $params['user_role_level'] = $user['role_level'] ?? 40;
        }

        $whereSql = implode(' AND ', $where);

        // Count total
        $countStmt = $db->prepare("SELECT COUNT(DISTINCT c.customer_id) as total 
            FROM customers c 
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id 
            WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        // Query data with joins
        $query = "SELECT 
            c.customer_id,
            c.customer_code,
            c.full_name,
            c.phone,
            c.email,
            c.status,
            c.billing_status,
            c.installation_address,
            c.connection_date,
            c.created_at,
            na.username,
            na.is_online as online_status,
            na.current_ip as ip_address,
            na.mac_address,
            na.uptime_seconds,
            na.upload_bytes,
            na.download_bytes,
            ap.profile_name as package_name,
            ap.price as package_price,
            cs.expires_at as expiry_date,
            cs.billing_cycle,
            nd.device_name as server_name,
            sa.name as area_name,
            sub.name as sub_area_name,
            u.first_name as owner_name,
            u.role as owner_role
            FROM customers c
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id AND cs.status = 'active'
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            LEFT JOIN network_devices nd ON nd.network_device_id = cs.network_device_id
            LEFT JOIN service_areas sa ON sa.service_area_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.service_area_id')) AS UNSIGNED)
            LEFT JOIN sub_areas sub ON sub.sub_area_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.sub_area_id')) AS UNSIGNED)
            LEFT JOIN users u ON u.user_id = c.owner_id
            WHERE {$whereSql}
            ORDER BY c.customer_id DESC
            LIMIT {$limit} OFFSET {$offset}";

        $stmt = $db->prepare($query);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $formatted = array_map(function($row) {
            return [
                'customer_id' => (string)$row['customer_id'],
                'customer_code' => $row['customer_code'],
                'customerId' => (string)$row['customer_id'],
                'customerCode' => $row['customer_code'],
                'full_name' => $row['full_name'],
                'fullName' => $row['full_name'],
                'phone' => $row['phone'],
                'mobile' => $row['phone'],
                'email' => $row['email'],
                'username' => $row['username'],
                'status' => $row['status'],
                'billing_status' => $row['billing_status'] ?: 'Paid',
                'account_status' => $row['status'],
                'connection_date' => $row['connection_date'],
                'connectionDate' => $row['connection_date'],
                'online_status' => (bool)$row['online_status'],
                'ip_address' => $row['ip_address'],
                'mac_address' => $row['mac_address'],
                'uptime_seconds' => (int)($row['uptime_seconds'] ?? 0),
                'upload_bytes' => (int)($row['upload_bytes'] ?? 0),
                'download_bytes' => (int)($row['download_bytes'] ?? 0),
                'package_name' => $row['package_name'],
                'package_price' => (float)($row['package_price'] ?? 0),
                'bill_amount' => (float)($row['package_price'] ?? 0),
                'expiry_date' => $row['expiry_date'],
                'billing_cycle' => $row['billing_cycle'] ?: 'monthly',
                'server_name' => $row['server_name'],
                'area_name' => $row['area_name'],
                'sub_area_name' => $row['sub_area_name'],
                'owner_name' => $row['owner_name'],
                'created_at' => $row['created_at'],
                'createdAt' => $row['created_at'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $formatted,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => (int)ceil($total / $limit),
            ],
        ]);
    }

    public static function show(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM customers WHERE customer_id = :id AND tenant_id = :tid LIMIT 1");
        $stmt->execute(['id' => $id, 'tid' => $tenantId]);
        $customer = $stmt->fetch();

        if (!$customer) {
            Response::error('Customer not found', 404);
        }

        // Get active service
        $stmtService = $db->prepare("SELECT cs.*, ap.profile_name, ap.price 
            FROM customer_services cs 
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            WHERE cs.customer_id = :cid ORDER BY cs.customer_service_id DESC LIMIT 1");
        $stmtService->execute(['cid' => $id]);
        $service = $stmtService->fetch();

        // Get network account
        $stmtNet = $db->prepare("SELECT na.*, nd.device_name 
            FROM customer_network_accounts na 
            LEFT JOIN network_devices nd ON nd.network_device_id = na.network_device_id
            WHERE na.customer_id = :cid LIMIT 1");
        $stmtNet->execute(['cid' => $id]);
        $net = $stmtNet->fetch();

        // Get last invoice/payment
        $stmtBilling = $db->prepare("SELECT * FROM invoices WHERE customer_id = :cid ORDER BY invoice_id DESC LIMIT 1");
        $stmtBilling->execute(['cid' => $id]);
        $inv = $stmtBilling->fetch();

        $metadata = json_decode($customer['metadata'] ?? '{}', true) ?: [];

        // Resolve ONU Information by matching Customer's MAC with OLT Connected ONUs
        $onuData = [
            'olt' => null,
            'onuMac' => null,
            'ponId' => null,
            'vlan' => null,
            'power' => null,
            'distance' => null,
            'lastUpdate' => null,
        ];

        $targetMac = !empty($net['mac_address']) ? trim($net['mac_address']) : '';

        // If MAC is not saved, auto-discover from live MikroTik active session
        if (empty($targetMac) && !empty($net['username']) && !empty($net['network_device_id'])) {
            try {
                $rStmt = $db->prepare("SELECT * FROM network_devices WHERE network_device_id = :did LIMIT 1");
                $rStmt->execute(['did' => $net['network_device_id']]);
                $rDev = $rStmt->fetch();
                if ($rDev && !empty($rDev['management_ip'])) {
                    require_once __DIR__ . '/../lib/RouterosAPI.php';
                    $api = new RouterosAPI();
                    $rPort = (int)($rDev['management_port'] ?: 7636);
                    $rUser = $rDev['api_username'] ?? 'admin';
                    $rPass = $rDev['api_password'] ?? '';
                    if ($api->connect($rDev['management_ip'], $rUser, $rPass, $rPort)) {
                        $api->write('/ppp/active/print', false);
                        $api->write('?name=' . $net['username']);
                        $activeSess = $api->read();
                        $api->disconnect();
                        if (!empty($activeSess[0]['caller-id'])) {
                            $targetMac = trim($activeSess[0]['caller-id']);
                            $upStmt = $db->prepare("UPDATE customer_network_accounts SET mac_address = :mac, is_online = 1 WHERE customer_id = :cid");
                            $upStmt->execute(['mac' => $targetMac, 'cid' => $id]);
                            $net['mac_address'] = $targetMac;
                            $net['is_online'] = 1;
                        }
                    }
                }
            } catch (\Throwable $e) {}
        }

        // Match MAC with fast stored OLT connected ONUs (0ms SQL latency)
        if (!empty($targetMac)) {
            try {
                $cleanMac = strtoupper(str_replace(['-', '.', ' '], ':', trim($targetMac)));
                $onuStmt = $db->prepare("SELECT o.*, nd.device_name 
                    FROM olt_onus o 
                    JOIN network_devices nd ON nd.network_device_id = o.network_device_id 
                    WHERE o.tenant_id = :tid AND o.mac_address = :mac 
                    LIMIT 1");
                $onuStmt->execute(['tid' => $tenantId, 'mac' => $cleanMac]);
                $matchedOnu = $onuStmt->fetch();
                if ($matchedOnu) {
                    $onuData = [
                        'olt' => $matchedOnu['device_name'],
                        'onuMac' => $matchedOnu['mac_address'],
                        'ponId' => $matchedOnu['pon_port_name'] . ' (' . $matchedOnu['onu_id'] . ')',
                        'vlan' => '100',
                        'power' => $matchedOnu['rx_power_dbm'] . ' dBm',
                        'distance' => 'Online',
                        'lastUpdate' => $matchedOnu['last_sync_at'],
                    ];
                }
            } catch (\Throwable $e) {}
        }

        Response::json([
            'success' => true,
            'data' => [
                'customer' => [
                    'customerId' => (string)$customer['customer_id'],
                    'customer_id' => (string)$customer['customer_id'],
                    'customerCode' => $customer['customer_code'],
                    'customerType' => $customer['customer_type'],
                    'fullName' => $customer['full_name'],
                    'full_name' => $customer['full_name'],
                    'email' => $customer['email'],
                    'phone' => $customer['phone'],
                    'alternatePhone' => $customer['alternate_phone'],
                    'nationalId' => $customer['national_id'],
                    'taxIdentifier' => $customer['tax_identifier'],
                    'billingAddress' => $customer['billing_address'],
                    'installationAddress' => $customer['installation_address'],
                    'city' => $customer['city'],
                    'stateProvince' => $customer['state_province'],
                    'postalCode' => $customer['postal_code'],
                    'countryCode' => $customer['country_code'] ?: 'BD',
                    'latitude' => $customer['latitude'] ? (float)$customer['latitude'] : null,
                    'longitude' => $customer['longitude'] ? (float)$customer['longitude'] : null,
                    'status' => $customer['status'],
                    'billingStatus' => $customer['billing_status'],
                    'connectionDate' => $customer['connection_date'],
                    'creditLimit' => (float)($customer['credit_limit'] ?? 0),
                    'internalNotes' => $customer['internal_notes'],
                    'ownerId' => $customer['owner_id'] ? (string)$customer['owner_id'] : null,
                    'area' => $metadata['area_name'] ?? null,
                    'subArea' => $metadata['sub_area_name'] ?? null,
                    'createdAt' => $customer['created_at'],
                    'updatedAt' => $customer['updated_at'],
                ],
                'service' => [
                    'packageName' => $service['profile_name'] ?? 'None',
                    'expiryDate' => $service['expires_at'] ?? null,
                    'dataUsed' => '0 GB',
                    'price' => (float)($service['price'] ?? 0),
                    'billingCycle' => $service['billing_cycle'] ?? 'monthly',
                    'billingType' => 'Paid',
                    'customerType' => $customer['customer_type'] ?: 'Prepaid',
                ],
                'network' => [
                    'protocolType' => $net['protocol'] ?? 'pppoe',
                    'serverName' => $net['device_name'] ?? 'Core Router',
                    'username' => $net['username'] ?? '',
                    'password' => $net['password'] ?? '',
                    'ipAddress' => $net['current_ip'] ?? $net['remote_address'] ?? null,
                    'macAddress' => $net['mac_address'] ?? $targetMac ?: null,
                    'activeMacAddress' => $net['mac_address'] ?? $targetMac ?: null,
                    'deviceVendor' => null,
                    'vendorSource' => null,
                    'uptime' => (int)($net['uptime_seconds'] ?? 0),
                    'onlineStatus' => (bool)($net['is_online'] ?? false),
                    'lastLogoutTime' => null,
                    'uploadBytes' => 0,
                    'downloadBytes' => 0,
                    'totalDataUsed' => 0,
                    'isSuspended' => ($customer['status'] === 'suspended'),
                ],
                'billing' => [
                    'balance' => (float)($inv['balance_due'] ?? 0),
                    'currentBalance' => (float)($inv['balance_due'] ?? 0),
                    'planPrice' => (float)($service['price'] ?? 0),
                    'billingStatus' => $customer['billing_status'] ?: 'Paid',
                    'accountStatus' => ($customer['status'] === 'suspended' ? 'suspended' : ($customer['status'] === 'inactive' ? 'expired' : 'active')),
                    'expiryDate' => $service['expires_at'] ?? null,
                    'lastPaymentDate' => $inv['invoice_date'] ?? null,
                    'connectedBy' => $customer['created_by'] ?? 'Admin',
                    'location' => $customer['installation_address'] ?? '',
                ],
                'onu' => $onuData,
            ],
        ]);
    }

    public static function nextCode(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $code = TenantSequenceService::peekNextCode($db, (string)$tenantId, 'customer', 6);

        Response::json(['customerCode' => $code]);
    }

    public static function create(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $fullName = trim($data['clientName'] ?? $data['fullName'] ?? $data['full_name'] ?? $data['name'] ?? '');
        $phone = trim($data['mobileNo'] ?? $data['mobile'] ?? $data['phone'] ?? '');
        $address = trim($data['address'] ?? $data['installationAddress'] ?? $data['installation_address'] ?? 'Dhaka, Bangladesh');

        if (empty($fullName) || empty($phone)) {
            Response::error('Full Name and Phone are required', 400);
        }

        $db = Database::getConnection();
        $db->beginTransaction();

        try {
            $rawCustCode = preg_replace('/\D/', '', (string)($data['customerCode'] ?? ''));
            if (!empty($rawCustCode) && strlen($rawCustCode) >= 6) {
                $checkStmt = $db->prepare("SELECT COUNT(*) FROM customers WHERE customer_code = :code");
                $checkStmt->execute(['code' => $rawCustCode]);
                if ((int)$checkStmt->fetchColumn() > 0) {
                    $db->rollBack();
                    Response::error("Customer ID {$rawCustCode} is already taken across the platform. Please use a unique ID.", 409);
                    return;
                }
                $customerCode = $rawCustCode;
            } else {
                $customerCode = TenantSequenceService::generateNextCode($db, (string)$tenantId, 'customer', 6);
            }

            $stmt = $db->prepare("INSERT INTO customers 
                (tenant_id, customer_code, customer_type, full_name, email, phone, installation_address, status, billing_status, connection_date, owner_id, owner_role, owner_role_level, created_by)
                VALUES (:tid, :code, :type, :name, :email, :phone, :addr, 'active', 'Paid', CURDATE(), :oid, :orole, :olevel, :created_by)");
            $stmt->execute([
                'tid' => $tenantId,
                'code' => $customerCode,
                'type' => $data['customerType'] ?? 'individual',
                'name' => $fullName,
                'email' => $data['email'] ?? null,
                'phone' => $phone,
                'addr' => $address,
                'oid' => $data['ownerId'] ?? $user['user_id'],
                'orole' => $user['role'] ?? 'admin',
                'olevel' => $user['role_level'] ?? 100,
                'created_by' => $user['user_id'],
            ]);

            $customerId = $db->lastInsertId();
            $db->commit();

            Response::json([
                'success' => true,
                'message' => 'Customer created successfully',
                'customerId' => (string)$customerId,
                'customerCode' => $customerCode,
                'data' => [
                    'customerId' => (string)$customerId,
                    'customerCode' => $customerCode,
                ],
            ], 201);
        } catch (Throwable $e) {
            $db->rollBack();
            if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('Duplicate customer ID detected. Customer ID must be globally unique across the system.', 409);
            }
            Response::error('Failed to create customer: ' . $e->getMessage(), 500);
        }
    }

    public static function onboard(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $db = Database::getConnection();
        $db->beginTransaction();

        try {
            $fullName = trim($data['clientName'] ?? $data['fullName'] ?? $data['full_name'] ?? $data['name'] ?? '');
            $phone = trim($data['mobileNo'] ?? $data['mobile'] ?? $data['phone'] ?? '');
            $address = trim($data['address'] ?? $data['installationAddress'] ?? $data['installation_address'] ?? 'Dhaka, Bangladesh');
            $username = trim($data['username'] ?? '');
            $password = trim($data['password'] ?? 'pass123');
            $packageId = $data['packageId'] ?? $data['access_profile_id'] ?? 1;
            $deviceId = $data['serverId'] ?? $data['network_device_id'] ?? 1;

            if (empty($fullName) || empty($phone) || empty($username)) {
                $db->rollBack();
                Response::error('Full name, phone, and PPPoE username are required', 400);
                return;
            }

            $rawCustCode = preg_replace('/\D/', '', (string)($data['customerCode'] ?? ''));
            if (!empty($rawCustCode) && strlen($rawCustCode) >= 6) {
                $checkStmt = $db->prepare("SELECT COUNT(*) FROM customers WHERE customer_code = :code");
                $checkStmt->execute(['code' => $rawCustCode]);
                if ((int)$checkStmt->fetchColumn() > 0) {
                    $db->rollBack();
                    Response::error("Customer ID {$rawCustCode} is already taken across the platform. Please use a unique ID.", 409);
                    return;
                }
                $customerCode = $rawCustCode;
            } else {
                $customerCode = TenantSequenceService::generateNextCode($db, (string)$tenantId, 'customer', 6);
            }

            // 1. Insert Customer
            $stmt = $db->prepare("INSERT INTO customers 
                (tenant_id, customer_code, customer_type, full_name, email, phone, installation_address, status, billing_status, connection_date, owner_id, owner_role, owner_role_level, metadata, created_by)
                VALUES (:tid, :code, :type, :name, :email, :phone, :addr, 'active', 'Paid', CURDATE(), :oid, :orole, :olevel, :meta, :created_by)");
            $stmt->execute([
                'tid' => $tenantId,
                'code' => $customerCode,
                'type' => $data['customerType'] ?? 'individual',
                'name' => $fullName,
                'email' => $data['email'] ?? null,
                'phone' => $phone,
                'addr' => $address,
                'oid' => $data['ownerId'] ?? $user['user_id'],
                'orole' => $user['role'] ?? 'admin',
                'olevel' => $user['role_level'] ?? 100,
                'meta' => json_encode([
                    'service_area_id' => $data['areaId'] ?? null,
                    'sub_area_id' => $data['subAreaId'] ?? null,
                ]),
                'created_by' => $user['user_id'],
            ]);
            $customerId = $db->lastInsertId();

            // 2. Insert Customer Service
            $stmtService = $db->prepare("INSERT INTO customer_services 
                (tenant_id, customer_id, access_profile_id, network_device_id, protocol, billing_cycle, status, starts_at, expires_at, created_by)
                VALUES (:tid, :cid, :pid, :did, 'pppoe', 'monthly', 'active', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), :uid)");
            $stmtService->execute([
                'tid' => $tenantId,
                'cid' => $customerId,
                'pid' => $packageId,
                'did' => $deviceId,
                'uid' => $user['user_id'],
            ]);
            $serviceId = $db->lastInsertId();

            // 3. Insert Network Account (PPPoE Secret)
            $stmtNet = $db->prepare("INSERT INTO customer_network_accounts 
                (tenant_id, customer_id, network_device_id, protocol, username, password, status, is_online)
                VALUES (:tid, :cid, :did, 'pppoe', :uname, :pwd, 'active', 0)");
            $stmtNet->execute([
                'tid' => $tenantId,
                'cid' => $customerId,
                'did' => $deviceId,
                'uname' => $username,
                'pwd' => $password,
            ]);

            // 4. Generate first invoice
            $stmtPkg = $db->prepare("SELECT price FROM access_profiles WHERE access_profile_id = :pid");
            $stmtPkg->execute(['pid' => $packageId]);
            $price = (float)($stmtPkg->fetchColumn() ?: 500.00);

            $invNumber = TenantSequenceService::generateNextCode($db, (string)$tenantId, 'invoice', 6);
            $stmtInv = $db->prepare("INSERT INTO invoices 
                (tenant_id, customer_id, customer_service_id, invoice_number, invoice_date, due_date, status, subtotal, total_amount, paid_amount, balance_due, base_price, sell_price, created_by)
                VALUES (:tid, :cid, :sid, :inv_num, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 DAY), 'paid', :sub, :tot, :paid, 0.00, :base, :sell, :uid)");
            $stmtInv->execute([
                'tid' => $tenantId,
                'cid' => $customerId,
                'sid' => $serviceId,
                'inv_num' => $invNumber,
                'sub' => $price,
                'tot' => $price,
                'paid' => $price,
                'base' => $price,
                'sell' => $price,
                'uid' => $user['user_id'],
            ]);

            $db->commit();

            Response::json([
                'success' => true,
                'message' => 'Customer onboarded successfully with active package and credentials',
                'customerId' => (string)$customerId,
                'customerCode' => $customerCode,
                'data' => [
                    'customerId' => (string)$customerId,
                    'customerCode' => $customerCode,
                    'username' => $username,
                ],
            ], 201);
        } catch (Throwable $e) {
            $db->rollBack();
            if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
                Response::error('Duplicate customer ID or PPPoE username detected. Must be unique across the platform.', 409);
            }
            Response::error('Failed to onboard customer: ' . $e->getMessage(), 500);
        }
    }

    public static function update(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $db = Database::getConnection();

        $fields = [];
        $params = ['id' => $id, 'tid' => $tenantId];

        if (isset($data['fullName']) || isset($data['full_name'])) {
            $fields[] = "full_name = :name";
            $params['name'] = $data['fullName'] ?? $data['full_name'];
        }
        if (isset($data['phone'])) {
            $fields[] = "phone = :phone";
            $params['phone'] = $data['phone'];
        }
        if (isset($data['email'])) {
            $fields[] = "email = :email";
            $params['email'] = $data['email'];
        }
        if (isset($data['status'])) {
            $fields[] = "status = :status";
            $params['status'] = $data['status'];
        }
        if (isset($data['billingStatus']) || isset($data['billing_status'])) {
            $fields[] = "billing_status = :bstatus";
            $params['bstatus'] = $data['billingStatus'] ?? $data['billing_status'];
        }
        if (isset($data['installationAddress']) || isset($data['address'])) {
            $fields[] = "installation_address = :addr";
            $params['addr'] = $data['installationAddress'] ?? $data['address'];
        }

        if (empty($fields)) {
            Response::json(['success' => true, 'message' => 'No changes provided']);
        }

        $sql = "UPDATE customers SET " . implode(', ', $fields) . " WHERE customer_id = :id AND tenant_id = :tid";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        Response::json([
            'success' => true,
            'message' => 'Customer updated successfully',
        ]);
    }

    public static function delete(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("UPDATE customers SET status = 'cancelled' WHERE customer_id = :id AND tenant_id = :tid");
        $stmt->execute(['id' => $id, 'tid' => $tenantId]);

        Response::json([
            'success' => true,
            'message' => 'Customer cancelled/archived successfully',
        ]);
    }

    public static function services(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT cs.*, ap.profile_name, ap.price, nd.device_name 
            FROM customer_services cs
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            LEFT JOIN network_devices nd ON nd.network_device_id = cs.network_device_id
            WHERE cs.customer_id = :cid AND cs.tenant_id = :tid
            ORDER BY cs.customer_service_id DESC");
        $stmt->execute(['cid' => $id, 'tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'data' => $rows ?: [],
        ]);
    }

    public static function networkAccounts(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT na.*, nd.device_name 
            FROM customer_network_accounts na
            LEFT JOIN network_devices nd ON nd.network_device_id = na.network_device_id
            WHERE na.customer_id = :cid AND na.tenant_id = :tid");
        $stmt->execute(['cid' => $id, 'tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'data' => $rows ?: [],
        ]);
    }

    public static function billingSummary(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT 
            COALESCE(SUM(total_amount), 0) as totalBilled,
            COALESCE(SUM(paid_amount), 0) as totalPaid,
            COALESCE(SUM(balance_due), 0) as totalDue
            FROM invoices WHERE customer_id = :cid AND tenant_id = :tid");
        $stmt->execute(['cid' => $id, 'tid' => $tenantId]);
        $row = $stmt->fetch();

        Response::json([
            'success' => true,
            'data' => [
                'totalBilled' => (float)($row['totalBilled'] ?? 0),
                'totalPaid' => (float)($row['totalPaid'] ?? 0),
                'totalDue' => (float)($row['totalDue'] ?? 0),
            ],
        ]);
    }

    public static function reportsResellerWise(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT 
            u.user_id as resellerId,
            COALESCE(u.first_name, 'Direct/Admin') as resellerName,
            COUNT(c.customer_id) as total,
            SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN c.billing_status = 'Expired' THEN 1 ELSE 0 END) as expired,
            SUM(CASE WHEN c.status = 'cancelled' THEN 1 ELSE 0 END) as `left`,
            SUM(CASE WHEN c.status = 'pending_activation' THEN 1 ELSE 0 END) as pending,
            COUNT(c.customer_id) as pppoe,
            0 as hotspot,
            0 as free,
            0 as vip
            FROM customers c
            LEFT JOIN users u ON u.user_id = c.owner_id
            WHERE c.tenant_id = :tid
            GROUP BY u.user_id, u.first_name");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        Response::json($rows ?: []);
    }

    public static function reportsAreaWise(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT 
            COALESCE(sa.name, 'Unassigned Area') as areaName,
            COUNT(c.customer_id) as total,
            SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN c.billing_status = 'Expired' THEN 1 ELSE 0 END) as expired,
            SUM(CASE WHEN c.status = 'cancelled' THEN 1 ELSE 0 END) as `left`,
            SUM(CASE WHEN c.status = 'pending_activation' THEN 1 ELSE 0 END) as pending,
            COUNT(c.customer_id) as pppoe,
            0 as hotspot,
            0 as free,
            0 as vip
            FROM customers c
            LEFT JOIN service_areas sa ON sa.service_area_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.service_area_id')) AS UNSIGNED)
            WHERE c.tenant_id = :tid
            GROUP BY sa.name");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        Response::json($rows ?: []);
    }

    public static function reportsServerWise(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT 
            nd.network_device_id as serverId,
            COALESCE(nd.device_name, 'Default Router') as serverName,
            COUNT(c.customer_id) as total,
            SUM(CASE WHEN c.status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN c.billing_status = 'Expired' THEN 1 ELSE 0 END) as expired,
            SUM(CASE WHEN c.status = 'cancelled' THEN 1 ELSE 0 END) as `left`,
            SUM(CASE WHEN c.status = 'pending_activation' THEN 1 ELSE 0 END) as pending,
            COUNT(c.customer_id) as pppoe,
            0 as hotspot,
            0 as free,
            0 as vip
            FROM customers c
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
            LEFT JOIN network_devices nd ON nd.network_device_id = cs.network_device_id
            WHERE c.tenant_id = :tid
            GROUP BY nd.network_device_id, nd.device_name");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        Response::json($rows ?: []);
    }
}

