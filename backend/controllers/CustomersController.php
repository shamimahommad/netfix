<?php
/**
 * NetFix ISP SaaS - Customers Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/TenantSequenceService.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';

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

        // Strict Downward-Only Access Control via Materialized Path
        $callerRole = strtolower($user['role'] ?? '');
        $isLevel0 = in_array($callerRole, ['admin', 'isp_admin', 'manager', 'tenant_admin', 'saas_admin', 'super_admin'], true);
        if (!$isLevel0) {
            $userPath = $user['hierarchy_path'] ?? "/{$user['user_id']}/";
            $where[] = "(c.owner_id = :user_owner_id OR c.owner_path LIKE :user_path_like)";
            $params['user_owner_id'] = $user['user_id'];
            $params['user_path_like'] = rtrim($userPath, '/') . '/%';
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

        // Match by either numeric customer_id or string customer_code
        if (($user['user_type'] ?? '') === 'saas') {
            $stmt = $db->prepare("SELECT * FROM customers WHERE (customer_id = :id OR customer_code = :id) LIMIT 1");
            $stmt->execute(['id' => $id]);
        } else {
            $stmt = $db->prepare("SELECT * FROM customers WHERE (customer_id = :id OR customer_code = :id) AND tenant_id = :tid LIMIT 1");
            $stmt->execute(['id' => $id, 'tid' => $tenantId]);
        }
        $customer = $stmt->fetch();

        // Soft fallback ONLY for SaaS admin if tenant_id context was switched
        if (!$customer && (($user['user_type'] ?? '') === 'saas' || ($user['role'] ?? '') === 'saas_admin')) {
            $stmt = $db->prepare("SELECT * FROM customers WHERE customer_id = :id OR customer_code = :id LIMIT 1");
            $stmt->execute(['id' => $id]);
            $customer = $stmt->fetch();
        }

        if (!$customer) {
            Response::error('Customer not found', 404);
        }

        // IDOR Protection: Enforce Downward-Only Access
        if (!HierarchySecurityService::canAccessCustomer((int)$user['user_id'], (int)$customer['customer_id'], (int)$customer['tenant_id'])) {
            Response::error('Access denied: You do not have permission to view this customer record.', 403);
            return;
        }

        $realCid = $customer['customer_id'];
        $customerTenantId = $customer['tenant_id'];

        // Get active service
        $stmtService = $db->prepare("SELECT cs.*, ap.profile_name, ap.price 
            FROM customer_services cs 
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            WHERE cs.customer_id = :cid ORDER BY cs.customer_service_id DESC LIMIT 1");
        $stmtService->execute(['cid' => $realCid]);
        $service = $stmtService->fetch();

        // Get network account
        $stmtNet = $db->prepare("SELECT na.*, nd.device_name 
            FROM customer_network_accounts na 
            LEFT JOIN network_devices nd ON nd.network_device_id = na.network_device_id
            WHERE na.customer_id = :cid LIMIT 1");
        $stmtNet->execute(['cid' => $realCid]);
        $net = $stmtNet->fetch();

        // Check MikroTik live connection status in real-time
        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
        if ($net && !empty($net['username'])) {
            $net['tenant_id'] = $customerTenantId;
            MikrotikSyncService::checkCustomerLiveStatus($db, $realCid, $net);
        }

        // Get last invoice/payment
        $stmtBilling = $db->prepare("SELECT * FROM invoices WHERE customer_id = :cid ORDER BY invoice_id DESC LIMIT 1");
        $stmtBilling->execute(['cid' => $realCid]);
        $inv = $stmtBilling->fetch();

        $metadata = json_decode($customer['metadata'] ?? '{}', true) ?: [];

        // Resolve ONU Information by matching Customer's Router MAC or PPPoE Username with stored OLT Connected ONUs (Option 2)
        $onuData = [
            'olt' => null,
            'onuMac' => null,
            'routerMac' => null,
            'ponId' => null,
            'vlan' => null,
            'power' => null,
            'rxPower' => null,
            'distance' => null,
            'status' => null,
            'lastUpdate' => null,
        ];

        $targetMac = !empty($net['mac_address']) ? trim($net['mac_address']) : '';
        $targetUser = !empty($net['username']) ? trim($net['username']) : '';

        try {
            $cleanMac = !empty($targetMac) ? strtoupper(str_replace(['-', '.', ' '], ':', trim($targetMac))) : '';
            
            $sql = "SELECT o.*, nd.device_name 
                FROM olt_onus o 
                JOIN network_devices nd ON nd.network_device_id = o.network_device_id 
                WHERE (o.tenant_id = :tid OR o.tenant_id = :ctid) ";
            
            $clauses = [];
            $params = ['tid' => $tenantId, 'ctid' => $customerTenantId];

            if ($cleanMac) {
                $clauses[] = "(o.router_mac = :cleanMac OR o.mac_address = :cleanMac)";
                $params['cleanMac'] = $cleanMac;
            }
            if ($targetUser) {
                $clauses[] = "(o.pppoe_username IS NOT NULL AND LOWER(o.pppoe_username) = LOWER(:uName))";
                $params['uName'] = $targetUser;
            }

            if (!empty($clauses)) {
                $sql .= " AND (" . implode(" OR ", $clauses) . ") LIMIT 1";
                $onuStmt = $db->prepare($sql);
                $onuStmt->execute($params);
                $matchedOnu = $onuStmt->fetch();

                if ($matchedOnu) {
                    $onuIdFormatted = str_contains($matchedOnu['onu_id'], ':') ? explode(':', $matchedOnu['onu_id'])[1] : $matchedOnu['onu_id'];
                    $onuData = [
                        'olt' => $matchedOnu['device_name'],
                        'onuMac' => $matchedOnu['mac_address'],
                        'routerMac' => $matchedOnu['router_mac'],
                        'ponId' => $matchedOnu['pon_port_name'] . ' (#' . $onuIdFormatted . ')',
                        'vlan' => !empty($matchedOnu['vlan_id']) ? (string)$matchedOnu['vlan_id'] : '—',
                        'power' => $matchedOnu['rx_power_dbm'] !== null ? $matchedOnu['rx_power_dbm'] . ' dBm' : '—',
                        'rxPower' => $matchedOnu['rx_power_dbm'] !== null ? (float)$matchedOnu['rx_power_dbm'] : null,
                        'status' => $matchedOnu['status'],
                        'distance' => ucfirst($matchedOnu['status']),
                        'lastUpdate' => $matchedOnu['last_sync_at'],
                    ];

                    // If customer network account was missing router_mac, backfill it
                    if (empty($net['mac_address']) && !empty($matchedOnu['router_mac'])) {
                        $net['mac_address'] = $matchedOnu['router_mac'];
                        try {
                            $db->prepare("UPDATE customer_network_accounts SET mac_address = :rmac WHERE customer_id = :cid")
                               ->execute(['rmac' => $matchedOnu['router_mac'], 'cid' => $realCid]);
                        } catch (\Throwable $e) {}
                    }
                }
            }
        } catch (\Throwable $e) {}

        // Resolve Device / Router Vendor via MACVendors.com API with local DB caching
        require_once __DIR__ . '/../lib/MacVendorService.php';
        $deviceVendor = !empty($net['device_vendor']) ? $net['device_vendor'] : null;
        $vendorSource = !empty($net['vendor_source']) ? $net['vendor_source'] : 'macvendors.com';
        $effectiveMac = $net['mac_address'] ?? $targetMac ?: ($onuData['routerMac'] ?? null);

        if ((empty($deviceVendor) || $deviceVendor === 'Unknown') && !empty($effectiveMac)) {
            $resolved = MacVendorService::resolveVendor($effectiveMac, $db);
            if ($resolved && $resolved !== 'Unknown') {
                $deviceVendor = $resolved;
                $vendorSource = 'macvendors.com';
                try {
                    $db->prepare("UPDATE customer_network_accounts SET device_vendor = :dv, vendor_source = :vs WHERE customer_id = :cid")
                       ->execute(['dv' => $deviceVendor, 'vs' => $vendorSource, 'cid' => $realCid]);
                } catch (\Throwable $e) {}
            }
        }

        // Also resolve physical ONU hardware vendor if ONU MAC is present
        if (!empty($onuData['onuMac'])) {
            $onuData['onuVendor'] = MacVendorService::resolveVendor($onuData['onuMac'], $db);
        }

        // Resolve Connected By / Creator User Name
        $connectedByName = 'Admin';
        $creatorId = $customer['created_by'] ?? $customer['owner_id'] ?? null;
        if (!empty($creatorId)) {
            $stmtCreator = $db->prepare("SELECT first_name, last_name, username, role FROM users WHERE user_id = :uid LIMIT 1");
            $stmtCreator->execute(['uid' => $creatorId]);
            $creator = $stmtCreator->fetch();
            if ($creator) {
                $creatorFullName = trim(($creator['first_name'] ?? '') . ' ' . ($creator['last_name'] ?? ''));
                $connectedByName = $creatorFullName ?: ($creator['username'] ?: 'Admin');
            }
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
                    'serverId' => $net['network_device_id'] ?? null,
                    'networkDeviceId' => $net['network_device_id'] ?? null,
                    'serverName' => $net['device_name'] ?? 'Core Router',
                    'username' => $net['username'] ?? '',
                    'password' => $net['password'] ?? '',
                    'ipAddress' => $net['current_ip'] ?? $net['remote_address'] ?? null,
                    'macAddress' => $effectiveMac,
                    'activeMacAddress' => $effectiveMac,
                    'deviceVendor' => $deviceVendor ?: ($effectiveMac ? 'Unknown' : '—'),
                    'vendorSource' => $vendorSource,
                    'uptime' => (!empty($net['is_online']) && !empty($net['uptime_seconds'])) ? (int)$net['uptime_seconds'] : 0,
                    'onlineStatus' => (bool)($net['is_online'] ?? false),
                    'lastLogoutTime' => $net['last_offline_at'] ?? null,
                    'lastDisconnectReason' => $net['last_disconnect_reason'] ?? null,
                    'uploadBytes' => (float)($net['upload_bytes'] ?? 0),
                    'downloadBytes' => (float)($net['download_bytes'] ?? 0),
                    'totalDataUsed' => (float)(($net['upload_bytes'] ?? 0) + ($net['download_bytes'] ?? 0)),
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
                    'connectedBy' => $connectedByName,
                    'connectedById' => $customer['created_by'] ?? null,
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

    public static function reserveId(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId() ?: 0;
        $db = Database::getConnection();

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?: [];
        $sessionToken = trim($data['session_token'] ?? $data['lease_token'] ?? '');

        require_once __DIR__ . '/../lib/CustomerIdReservationService.php';

        try {
            $result = CustomerIdReservationService::reserve(
                $db,
                (int)$tenantId,
                (int)($user['user_id'] ?? 0),
                !empty($sessionToken) ? $sessionToken : null
            );

            Response::json($result);
        } catch (\Throwable $e) {
            error_log('reserveId fallback: ' . $e->getMessage());
            require_once __DIR__ . '/../lib/TenantSequenceService.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';
            $fallbackCode = TenantSequenceService::peekNextCode($db, (string)$tenantId, 'customer', 6);
            Response::json([
                'success' => true,
                'customer_code' => $fallbackCode,
                'lease_token' => $sessionToken ?: ('fallback_' . time()),
                'expires_in' => 900,
                'fallback' => true,
            ]);
        }
    }

    public static function releaseId(): void {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!$data && !empty($_POST)) {
            $data = $_POST;
        }

        $code = trim($data['customer_code'] ?? $data['customerCode'] ?? $_GET['customer_code'] ?? '');
        $token = trim($data['lease_token'] ?? $data['session_token'] ?? $data['token'] ?? $_GET['lease_token'] ?? '');

        if (empty($code) || empty($token)) {
            Response::error('customer_code and lease_token are required to release reservation', 400);
            return;
        }

        require_once __DIR__ . '/../lib/CustomerIdReservationService.php';
        $db = Database::getConnection();

        $released = CustomerIdReservationService::release($db, $code, $token);

        Response::json([
            'success' => true,
            'message' => $released ? 'Reservation released successfully' : 'No active reservation found or already released',
        ]);
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

            $ownerId = (int)($data['ownerId'] ?? $user['user_id']);
            $ownerUser = HierarchySecurityService::getUser($ownerId);
            $ownerPath = $ownerUser['hierarchy_path'] ?? "/{$ownerId}/";

            $stmt = $db->prepare("INSERT INTO customers 
                (tenant_id, customer_code, customer_type, full_name, email, phone, installation_address, status, billing_status, connection_date, owner_id, owner_role, owner_role_level, owner_path, created_by)
                VALUES (:tid, :code, :type, :name, :email, :phone, :addr, 'active', 'Paid', CURDATE(), :oid, :orole, :olevel, :opath, :created_by)");
            $stmt->execute([
                'tid' => $tenantId,
                'code' => $customerCode,
                'type' => $data['customerType'] ?? 'individual',
                'name' => $fullName,
                'email' => $data['email'] ?? null,
                'phone' => $phone,
                'addr' => $address,
                'oid' => $ownerId,
                'orole' => $user['role'] ?? 'admin',
                'olevel' => $user['role_level'] ?? 100,
                'opath' => $ownerPath,
                'created_by' => $user['user_id'],
            ]);

            $customerId = $db->lastInsertId();
            $db->commit();

            require_once __DIR__ . '/../lib/CustomerIdReservationService.php';
            $leaseToken = trim($data['leaseToken'] ?? $data['lease_token'] ?? $data['session_token'] ?? '');
            CustomerIdReservationService::markUsed($db, $customerCode, $leaseToken ?: null);

            require_once __DIR__ . '/../lib/CustomerIdReservationService.php';
            $leaseToken = trim($data['leaseToken'] ?? $data['lease_token'] ?? $data['session_token'] ?? '');
            CustomerIdReservationService::markUsed($db, $customerCode, $leaseToken ?: null);

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
            $packageId = $data['packageId'] ?? $data['access_profile_id'] ?? null;
            $deviceId = $data['serverId'] ?? $data['network_device_id'] ?? null;

            if (empty($fullName) || empty($phone) || empty($username)) {
                $db->rollBack();
                Response::error('Full name, phone, and PPPoE username are required', 400);
                return;
            }

            if (empty($deviceId) || empty($packageId)) {
                $db->rollBack();
                Response::error('Network router and internet package plan are required', 400);
                return;
            }

            // Strictly validate that the router device belongs to this tenant
            if (($user['role'] ?? '') !== 'saas_admin' || $tenantId !== null) {
                $devCheck = $db->prepare("SELECT network_device_id FROM network_devices WHERE network_device_id = :did AND tenant_id = :tid LIMIT 1");
                $devCheck->execute(['did' => $deviceId, 'tid' => $tenantId]);
                if (!$devCheck->fetch()) {
                    $db->rollBack();
                    Response::error('Invalid network server: The selected router does not belong to your network.', 403);
                    return;
                }

                $pkgCheck = $db->prepare("SELECT access_profile_id FROM access_profiles WHERE access_profile_id = :pid AND tenant_id = :tid LIMIT 1");
                $pkgCheck->execute(['pid' => $packageId, 'tid' => $tenantId]);
                if (!$pkgCheck->fetch()) {
                    $db->rollBack();
                    Response::error('Invalid package plan: The selected package does not belong to your network.', 403);
                    return;
                }

                $ownerId = $data['ownerId'] ?? $user['user_id'];
                if (!empty($ownerId) && (string)$ownerId !== (string)$user['user_id']) {
                    $ownerCheck = $db->prepare("SELECT user_id FROM users WHERE user_id = :oid AND tenant_id = :tid LIMIT 1");
                    $ownerCheck->execute(['oid' => $ownerId, 'tid' => $tenantId]);
                    if (!$ownerCheck->fetch()) {
                        $db->rollBack();
                        Response::error('Invalid reseller: The selected user does not belong to your network.', 403);
                        return;
                    }
                }
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
            $ownerId = (int)($data['ownerId'] ?? $user['user_id']);
            $ownerUser = HierarchySecurityService::getUser($ownerId);
            $ownerPath = $ownerUser['hierarchy_path'] ?? "/{$ownerId}/";

            $stmt = $db->prepare("INSERT INTO customers 
                (tenant_id, customer_code, customer_type, full_name, email, phone, installation_address, status, billing_status, connection_date, owner_id, owner_role, owner_role_level, owner_path, metadata, created_by)
                VALUES (:tid, :code, :type, :name, :email, :phone, :addr, 'active', 'Paid', CURDATE(), :oid, :orole, :olevel, :opath, :meta, :created_by)");
            $stmt->execute([
                'tid' => $tenantId,
                'code' => $customerCode,
                'type' => $data['customerType'] ?? 'individual',
                'name' => $fullName,
                'email' => $data['email'] ?? null,
                'phone' => $phone,
                'addr' => $address,
                'oid' => $ownerId,
                'orole' => $user['role'] ?? 'admin',
                'olevel' => $user['role_level'] ?? 100,
                'opath' => $ownerPath,
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

            require_once __DIR__ . '/../lib/CustomerIdReservationService.php';
            $leaseToken = trim($data['leaseToken'] ?? $data['lease_token'] ?? $data['session_token'] ?? '');
            CustomerIdReservationService::markUsed($db, $customerCode, $leaseToken ?: null);

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

        // 1. Locate customer by customer_id or customer_code
        $stmtC = $db->prepare("SELECT * FROM customers WHERE (customer_id = :id OR customer_code = :id) LIMIT 1");
        $stmtC->execute(['id' => $id]);
        $customer = $stmtC->fetch();
        if (!$customer) {
            Response::error('Customer not found', 404);
        }

        // IDOR Protection: Enforce Downward-Only Access
        if (!HierarchySecurityService::canAccessCustomer((int)$user['user_id'], (int)$customer['customer_id'], (int)$customer['tenant_id'])) {
            Response::error('Access denied: You do not have permission to view this customer record.', 403);
            return;
        }
        $realCid = (int)$customer['customer_id'];
        $customerTenantId = (int)$customer['tenant_id'];

        $fields = [];
        $params = ['cid' => $realCid];

        if (isset($data['fullName']) || isset($data['full_name'])) {
            $fields[] = "full_name = :name";
            $params['name'] = trim($data['fullName'] ?? $data['full_name']);
        }
        if (isset($data['phone']) || isset($data['mobileNumber'])) {
            $fields[] = "phone = :phone";
            $params['phone'] = trim($data['phone'] ?? $data['mobileNumber']);
        }
        if (isset($data['alternatePhone']) || isset($data['alternate_phone'])) {
            $fields[] = "alternate_phone = :alt_phone";
            $params['alt_phone'] = trim($data['alternatePhone'] ?? $data['alternate_phone']);
        }
        if (array_key_exists('email', $data)) {
            $fields[] = "email = :email";
            $params['email'] = $data['email'] ? trim($data['email']) : null;
        }
        if (array_key_exists('nationalId', $data) || array_key_exists('national_id', $data)) {
            $fields[] = "national_id = :nid";
            $params['nid'] = $data['nationalId'] ?? $data['national_id'] ?? null;
        }
        if (array_key_exists('taxIdentifier', $data) || array_key_exists('tax_identifier', $data)) {
            $fields[] = "tax_identifier = :tax";
            $params['tax'] = $data['taxIdentifier'] ?? $data['tax_identifier'] ?? null;
        }
        if (isset($data['status'])) {
            $fields[] = "status = :status";
            $params['status'] = $data['status'];
        }
        if (isset($data['billingStatus']) || isset($data['billing_status'])) {
            $fields[] = "billing_status = :bstatus";
            $params['bstatus'] = $data['billingStatus'] ?? $data['billing_status'];
        }
        if (isset($data['installationAddress']) || isset($data['address']) || isset($data['installation_address'])) {
            $fields[] = "installation_address = :addr";
            $params['addr'] = trim($data['installationAddress'] ?? $data['address'] ?? $data['installation_address']);
        }
        if (isset($data['billingAddress']) || isset($data['billing_address'])) {
            $fields[] = "billing_address = :baddr";
            $params['baddr'] = trim($data['billingAddress'] ?? $data['billing_address']);
        }
        if (isset($data['district']) || isset($data['city'])) {
            $fields[] = "city = :city";
            $params['city'] = trim($data['district'] ?? $data['city']);
        }
        if (isset($data['thana']) || isset($data['state_province'])) {
            $fields[] = "state_province = :thana";
            $params['thana'] = trim($data['thana'] ?? $data['state_province']);
        }
        if (isset($data['postalCode']) || isset($data['postal_code'])) {
            $fields[] = "postal_code = :pcode";
            $params['pcode'] = trim($data['postalCode'] ?? $data['postal_code']);
        }
        if (isset($data['connectionDate']) || isset($data['connection_date'])) {
            $fields[] = "connection_date = :cdate";
            $params['cdate'] = $data['connectionDate'] ?? $data['connection_date'];
        }
        if (array_key_exists('internalNotes', $data) || array_key_exists('internal_notes', $data)) {
            $fields[] = "internal_notes = :notes";
            $params['notes'] = $data['internalNotes'] ?? $data['internal_notes'] ?? null;
        }

        // Handle metadata (merge existing with new area, subArea, dob, etc.)
        $meta = json_decode($customer['metadata'] ?? '{}', true) ?: [];
        if (isset($data['metadata']) && is_array($data['metadata'])) {
            $meta = array_merge($meta, $data['metadata']);
        }
        if (isset($data['area'])) $meta['area_name'] = $data['area'];
        if (isset($data['subArea'])) $meta['sub_area_name'] = $data['subArea'];
        if (isset($data['dob'])) $meta['dob'] = $data['dob'];
        if (isset($data['district'])) $meta['district'] = $data['district'];
        if (isset($data['thana'])) $meta['thana'] = $data['thana'];

        $fields[] = "metadata = :meta";
        $params['meta'] = json_encode($meta, JSON_UNESCAPED_UNICODE);

        if (!empty($fields)) {
            $sql = "UPDATE customers SET " . implode(', ', $fields) . " WHERE customer_id = :cid";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }

        // 2. Handle Network Account (password, mac, ip, router)
        $netFields = [];
        $netParams = ['cid' => $realCid];

        if (isset($data['password']) && strlen(trim($data['password'])) > 0) {
            $newPassword = trim($data['password']);
            $netFields[] = "password = :pwd";
            $netParams['pwd'] = $newPassword;

            // Also sync new password to MikroTik router secret if available
            try {
                require_once __DIR__ . '/../lib/MikrotikSyncService.php';
                $router = MikrotikSyncService::getRouter($db, $realCid, $customerTenantId);
                if ($router) {
                    $api = MikrotikSyncService::connect($router, 2);
                    if ($api) {
                        $stmtU = $db->prepare("SELECT username FROM customer_network_accounts WHERE customer_id = :cid");
                        $stmtU->execute(['cid' => $realCid]);
                        $currUser = $stmtU->fetchColumn();
                        if ($currUser) {
                            $secrets = $api->comm('/ppp/secret/print', ['?name' => $currUser]);
                            if (!empty($secrets[0]['.id'])) {
                                $api->comm('/ppp/secret/set', [
                                    '.id' => $secrets[0]['.id'],
                                    'password' => $newPassword
                                ]);
                            }
                        }
                        $api->disconnect();
                    }
                }
            } catch (\Throwable $e) {}
        }

        if (isset($data['macAddress']) || isset($data['mac_address'])) {
            $newMac = trim($data['macAddress'] ?? $data['mac_address']);
            $netFields[] = "mac_address = :mac";
            $netParams['mac'] = $newMac ?: null;

            if (!empty($newMac)) {
                require_once __DIR__ . '/../lib/MacVendorService.php';
                $vendor = MacVendorService::resolveVendor($newMac, $db);
                if ($vendor && $vendor !== 'Unknown') {
                    $netFields[] = "device_vendor = :dvendor";
                    $netParams['dvendor'] = $vendor;
                    $netFields[] = "vendor_source = 'macvendors.com'";
                }
            }
        }

        if (isset($data['ipAddress']) || isset($data['ip_address']) || isset($data['remote_address'])) {
            $newIp = trim($data['ipAddress'] ?? $data['ip_address'] ?? $data['remote_address']);
            $netFields[] = "remote_address = :rip";
            $netParams['rip'] = $newIp ?: null;
        }

        if (!empty($netFields)) {
            $netSql = "UPDATE customer_network_accounts SET " . implode(', ', $netFields) . " WHERE customer_id = :cid";
            $stmtNet = $db->prepare($netSql);
            $stmtNet->execute($netParams);
        }

        // 3. Handle Package / Access Profile update if passed
        $newPlanId = $data['planId'] ?? $data['plan_id'] ?? $data['access_profile_id'] ?? null;
        if (!empty($newPlanId)) {
            $stmtPlan = $db->prepare("UPDATE customer_services SET access_profile_id = :pid WHERE customer_id = :cid");
            $stmtPlan->execute(['pid' => $newPlanId, 'cid' => $realCid]);
        }

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

        // Server-wise customers report is restricted to ISP Admin / Company roles only
        $role = strtolower($user['role'] ?? $user['role_code'] ?? '');
        $allowedRoles = ['admin', 'manager', 'isp_admin', 'tenant_admin', 'saas_admin', 'super_admin'];
        if (!in_array($role, $allowedRoles, true)) {
            Response::error('Access denied. Server-wise customer reports are restricted to ISP Admin/Company only.', 403);
            return;
        }

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

    private static function getRealCustomerId(PDO $db, string $id, ?string $tenantId, bool $isSaas): ?string {
        if ($isSaas || $tenantId === null) {
            $stmt = $db->prepare("SELECT customer_id FROM customers WHERE customer_id = :id OR customer_code = :code LIMIT 1");
            $stmt->execute(['id' => $id, 'code' => $id]);
        } else {
            $stmt = $db->prepare("SELECT customer_id FROM customers WHERE (customer_id = :id OR customer_code = :code) AND tenant_id = :tid LIMIT 1");
            $stmt->execute(['id' => $id, 'code' => $id, 'tid' => $tenantId]);
        }
        $val = $stmt->fetchColumn();
        return $val !== false ? (string)$val : null;
    }

    public static function macStatus(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $realCid = self::getRealCustomerId($db, $id, $tenantId, ($user['role'] ?? '') === 'saas_admin');
        if (!$realCid) {
            Response::error('Customer not found', 404);
            return;
        }

        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
        $status = MikrotikSyncService::getMacBindingStatus($db, $realCid, $tenantId);

        Response::json([
            'success' => true,
            'data' => $status,
        ]);
    }

    public static function syncSession(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $realCid = self::getRealCustomerId($db, $id, $tenantId, ($user['role'] ?? '') === 'saas_admin');
        if (!$realCid) {
            Response::error('Customer not found', 404);
            return;
        }

        $allowProvision = !empty($_GET['provision']);

        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
        $res = MikrotikSyncService::syncCustomer($db, $realCid, $tenantId, $allowProvision);

        Response::json($res);
    }

    public static function provisionSecret(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $realCid = self::getRealCustomerId($db, $id, $tenantId, ($user['role'] ?? '') === 'saas_admin');
        if (!$realCid) {
            Response::error('Customer not found', 404);
            return;
        }

        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
        $res = MikrotikSyncService::provisionSecret($db, $realCid, $tenantId);

        Response::json($res);
    }

    public static function disconnectSession(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $realCid = self::getRealCustomerId($db, $id, $tenantId, ($user['role'] ?? '') === 'saas_admin');
        if (!$realCid) {
            Response::error('Customer not found', 404);
            return;
        }

        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
        $res = MikrotikSyncService::disconnect($db, $realCid, $tenantId);

        Response::json($res);
    }

    public static function toggleSuspend(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $realCid = self::getRealCustomerId($db, $id, $tenantId, ($user['role'] ?? '') === 'saas_admin');
        if (!$realCid) {
            Response::error('Customer not found', 404);
            return;
        }

        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
        $res = MikrotikSyncService::toggleSuspend($db, $realCid, $tenantId);

        Response::json($res);
    }

    public static function bindMac(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $realCid = self::getRealCustomerId($db, $id, $tenantId, ($user['role'] ?? '') === 'saas_admin');
        if (!$realCid) {
            Response::error('Customer not found', 404);
            return;
        }

        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $mac = !empty($body['mac']) ? trim($body['mac']) : null;

        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
        $res = MikrotikSyncService::bindMac($db, $realCid, $mac, $tenantId);

        Response::json($res);
    }

    public static function getRouter(string $id): void {
        AuthMiddleware::requireAuth();
        Response::json([
            'success' => true,
            'data' => [
                'routerIp' => '',
                'routerPort' => 80,
                'username' => 'admin',
                'password' => '',
            ],
        ]);
    }

    public static function saveRouter(string $id): void {
        AuthMiddleware::requireAuth();
        Response::json([
            'success' => true,
            'message' => 'Router login configuration saved',
        ]);
    }

    public static function ping(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $realCid = self::getRealCustomerId($db, $id, $tenantId, ($user['role'] ?? '') === 'saas_admin');
        if (!$realCid) {
            Response::error('Customer not found', 404);
            return;
        }

        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
        $res = MikrotikSyncService::pingCustomer($db, $realCid, $tenantId);

        Response::json(array_merge([
            'success' => $res['success'] ?? false,
            'data' => $res,
        ], $res));
    }

    public static function markLeft(string $id): void {
        AuthMiddleware::requireAuth();
        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE customers SET status = 'cancelled' WHERE customer_id = :cid");
        $stmt->execute(['cid' => $id]);

        Response::json([
            'success' => true,
            'message' => 'Customer marked as left/inactive',
        ]);
    }

    public static function activateLeft(string $id): void {
        AuthMiddleware::requireAuth();
        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE customers SET status = 'active' WHERE customer_id = :cid");
        $stmt->execute(['cid' => $id]);

        Response::json([
            'success' => true,
            'message' => 'Customer account reactivated successfully',
        ]);
    }

    public static function importBatch(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $clients = $data['clients'] ?? [];
        if (empty($clients) || !is_array($clients)) {
            Response::error('No clients provided for import', 400);
            return;
        }

        $importTarget = $data['importTarget'] ?? 'admin';
        $importAs = strtolower($data['importAs'] ?? 'prepaid');
        $globalExpiryDate = !empty($data['expiryDate']) ? trim($data['expiryDate']) : null;
        $globalInvoiceMonth = !empty($data['invoiceMonth']) ? trim($data['invoiceMonth']) : date('Y-m');
        $createInvoice = !empty($data['createInvoice']);
        $defaultDeviceId = $data['defaultDeviceId'] ?? null;
        $defaultPackageId = $data['defaultPackageId'] ?? null;
        $defaultAreaId = $data['defaultAreaId'] ?? null;

        $db = Database::getConnection();
        $db->beginTransaction();

        try {
            // Determine owner
            $ownerId = ($importTarget !== 'admin' && !empty($importTarget)) ? (int)$importTarget : (int)$user['user_id'];
            $ownerUser = HierarchySecurityService::getUser($ownerId);
            $ownerRole = $ownerUser['role'] ?? 'admin';
            $ownerLevel = $ownerUser['role_level'] ?? 100;
            $ownerPath = $ownerUser['hierarchy_path'] ?? "/{$ownerId}/";

            // Pre-fetch routers for tenant
            $routerStmt = $db->prepare("SELECT network_device_id, LOWER(device_name) as dname, management_ip FROM network_devices WHERE tenant_id = :tid OR :is_saas = 1");
            $routerStmt->execute(['tid' => $tenantId, 'is_saas' => ($user['role'] === 'saas_admin' ? 1 : 0)]);
            $routerMap = [];
            $firstRouterId = null;
            while ($r = $routerStmt->fetch()) {
                if (!$firstRouterId) $firstRouterId = $r['network_device_id'];
                $routerMap[trim($r['dname'])] = $r['network_device_id'];
                $routerMap[trim($r['management_ip'])] = $r['network_device_id'];
            }

            // Pre-fetch packages for tenant
            $pkgStmt = $db->prepare("SELECT access_profile_id, LOWER(name) as pname, LOWER(profile_name) as pprof, price FROM access_profiles WHERE tenant_id = :tid OR :is_saas = 1");
            $pkgStmt->execute(['tid' => $tenantId, 'is_saas' => ($user['role'] === 'saas_admin' ? 1 : 0)]);
            $pkgMap = [];
            $pkgPrices = [];
            $firstPkgId = null;
            while ($p = $pkgStmt->fetch()) {
                if (!$firstPkgId) $firstPkgId = $p['access_profile_id'];
                $pkgMap[trim($p['pname'])] = $p['access_profile_id'];
                $pkgPrices[$p['access_profile_id']] = (float)$p['price'];
                if (!empty($p['pprof'])) {
                    $pkgMap[trim($p['pprof'])] = $p['access_profile_id'];
                }
            }

            // Pre-fetch areas
            $areaStmt = $db->prepare("SELECT service_area_id, LOWER(name) as aname FROM service_areas WHERE tenant_id = :tid");
            $areaStmt->execute(['tid' => $tenantId]);
            $areaMap = [];
            while ($a = $areaStmt->fetch()) {
                $areaMap[trim($a['aname'])] = $a['service_area_id'];
            }

            // Pre-fetch existing pppoe usernames and customer codes
            $existingUsernamesStmt = $db->prepare("SELECT LOWER(username) FROM customer_network_accounts WHERE tenant_id = :tid");
            $existingUsernamesStmt->execute(['tid' => $tenantId]);
            $existingUsernames = array_flip($existingUsernamesStmt->fetchAll(PDO::FETCH_COLUMN));

            $existingCodesStmt = $db->prepare("SELECT customer_code FROM customers WHERE tenant_id = :tid");
            $existingCodesStmt->execute(['tid' => $tenantId]);
            $existingCodes = array_flip($existingCodesStmt->fetchAll(PDO::FETCH_COLUMN));

            $imported = 0;
            $skipped = 0;
            $errors = [];

            // Prepared statements
            $stmtCustomer = $db->prepare("INSERT INTO customers 
                (tenant_id, customer_code, customer_type, full_name, email, phone, installation_address, status, billing_status, connection_date, owner_id, owner_role, owner_role_level, owner_path, metadata, created_by)
                VALUES (:tid, :code, :type, :name, :email, :phone, :addr, :status, 'Paid', :conn_date, :oid, :orole, :olevel, :opath, :meta, :created_by)");

            $stmtService = $db->prepare("INSERT INTO customer_services 
                (tenant_id, customer_id, access_profile_id, network_device_id, protocol, billing_cycle, status, starts_at, expires_at, created_by)
                VALUES (:tid, :cid, :pid, :did, 'pppoe', 'monthly', 'active', :starts, :expires, :uid)");

            $stmtNet = $db->prepare("INSERT INTO customer_network_accounts 
                (tenant_id, customer_id, network_device_id, protocol, username, password, status, is_online)
                VALUES (:tid, :cid, :did, 'pppoe', :uname, :pwd, 'active', 0)");

            $stmtInvoice = $db->prepare("INSERT INTO invoices 
                (tenant_id, customer_id, customer_service_id, invoice_number, invoice_date, due_date, status, subtotal, total_amount, paid_amount, balance_due, base_price, sell_price, created_by)
                VALUES (:tid, :cid, :sid, :inv_num, :inv_date, DATE_ADD(:inv_date_calc, INTERVAL 10 DAY), 'paid', :sub, :tot, :paid, 0.00, :base, :sell, :uid)");

            foreach ($clients as $idx => $row) {
                $name = trim($row['name'] ?? $row['full_name'] ?? $row['client_name'] ?? '');
                $pppoeId = trim($row['pppoe_id'] ?? $row['username'] ?? $row['user_id'] ?? '');
                $rawPkg = trim($row['package'] ?? $row['plan'] ?? $row['package_name'] ?? '');
                $phone = trim($row['mobile'] ?? $row['phone'] ?? $row['mobile_no'] ?? '');
                $password = trim($row['pppoe_pass'] ?? $row['password'] ?? 'pass123');
                $email = !empty($row['email']) ? trim($row['email']) : null;
                $address = !empty($row['address']) ? trim($row['address']) : 'Dhaka, Bangladesh';
                $status = !empty($row['status']) ? strtolower(trim($row['status'])) : 'active';
                if (!in_array($status, ['active', 'suspended', 'pending', 'cancelled'])) $status = 'active';

                if (empty($name) || empty($pppoeId)) {
                    $errors[] = "Row #" . ($idx + 1) . ": Name and PPPoE Username are required";
                    $skipped++;
                    continue;
                }

                $lowerPppoe = strtolower($pppoeId);
                if (isset($existingUsernames[$lowerPppoe])) {
                    $errors[] = "Row #" . ($idx + 1) . " (User: {$pppoeId}): PPPoE username already exists in software";
                    $skipped++;
                    continue;
                }

                // Resolve package
                $pkgId = $defaultPackageId;
                if (!empty($rawPkg) && isset($pkgMap[strtolower($rawPkg)])) {
                    $pkgId = $pkgMap[strtolower($rawPkg)];
                } elseif (!empty($row['package_id']) && isset($pkgPrices[$row['package_id']])) {
                    $pkgId = $row['package_id'];
                }
                if (!$pkgId) {
                    $pkgId = $firstPkgId;
                }
                if (!$pkgId) {
                    $errors[] = "Row #" . ($idx + 1) . " (User: {$pppoeId}): No valid package found in system";
                    $skipped++;
                    continue;
                }

                // Resolve router
                $deviceId = $defaultDeviceId;
                $rawRouter = trim($row['router'] ?? $row['server'] ?? '');
                if (!empty($rawRouter) && isset($routerMap[strtolower($rawRouter)])) {
                    $deviceId = $routerMap[strtolower($rawRouter)];
                }
                if (!$deviceId) {
                    $deviceId = $firstRouterId;
                }
                if (!$deviceId) {
                    $errors[] = "Row #" . ($idx + 1) . " (User: {$pppoeId}): No network router configured";
                    $skipped++;
                    continue;
                }

                // Resolve area
                $areaId = $defaultAreaId;
                $rawArea = trim($row['area'] ?? $row['zone'] ?? '');
                if (!empty($rawArea) && isset($areaMap[strtolower($rawArea)])) {
                    $areaId = $areaMap[strtolower($rawArea)];
                }

                // Generate customer code
                $rawCode = preg_replace('/\D/', '', (string)($row['client_code'] ?? ''));
                if (!empty($rawCode) && strlen($rawCode) >= 6 && !isset($existingCodes[$rawCode])) {
                    $customerCode = $rawCode;
                } else {
                    $customerCode = TenantSequenceService::generateNextCode($db, (string)$tenantId, 'customer', 6);
                }
                $existingCodes[$customerCode] = true;

                // Dates
                $joinDate = !empty($row['join_date']) ? date('Y-m-d', strtotime($row['join_date'])) : date('Y-m-d');
                $rowExpiry = !empty($row['expiry_date']) ? date('Y-m-d', strtotime($row['expiry_date'])) : null;
                $effectiveExpiry = $globalExpiryDate ?: ($rowExpiry ?: date('Y-m-d', strtotime('+30 days')));

                // Insert customer
                $stmtCustomer->execute([
                    'tid' => $tenantId,
                    'code' => $customerCode,
                    'type' => 'individual',
                    'name' => $name,
                    'email' => $email,
                    'phone' => $phone ?: '01700000000',
                    'addr' => $address,
                    'status' => $status,
                    'conn_date' => $joinDate,
                    'oid' => $ownerId,
                    'orole' => $ownerRole,
                    'olevel' => $ownerLevel,
                    'opath' => $ownerPath,
                    'meta' => json_encode([
                        'service_area_id' => $areaId,
                        'zone' => $row['zone'] ?? null,
                        'onu_mac' => $row['onu_mac'] ?? null,
                        'ip_address' => $row['ip_address'] ?? null,
                        'remarks' => $row['remarks'] ?? null,
                    ]),
                    'created_by' => $user['user_id'],
                ]);
                $customerId = $db->lastInsertId();

                // Insert customer service
                $stmtService->execute([
                    'tid' => $tenantId,
                    'cid' => $customerId,
                    'pid' => $pkgId,
                    'did' => $deviceId,
                    'starts' => $joinDate . ' 00:00:00',
                    'expires' => $effectiveExpiry . ' 23:59:59',
                    'uid' => $user['user_id'],
                ]);
                $serviceId = $db->lastInsertId();

                // Insert network account
                $stmtNet->execute([
                    'tid' => $tenantId,
                    'cid' => $customerId,
                    'did' => $deviceId,
                    'uname' => $pppoeId,
                    'pwd' => $password,
                ]);
                $existingUsernames[$lowerPppoe] = true;

                // Create invoice if postpaid + requested
                if ($createInvoice) {
                    $pkgPrice = $pkgPrices[$pkgId] ?? (!empty($row['monthly_bill']) ? (float)$row['monthly_bill'] : 0.00);
                    $invNumber = TenantSequenceService::generateNextCode($db, (string)$tenantId, 'invoice', 6);
                    $invDate = !empty($globalInvoiceMonth) ? date('Y-m-d', strtotime($globalInvoiceMonth . '-01')) : date('Y-m-d');
                    $stmtInvoice->execute([
                        'tid' => $tenantId,
                        'cid' => $customerId,
                        'sid' => $serviceId,
                        'inv_num' => $invNumber,
                        'inv_date' => $invDate,
                        'inv_date_calc' => $invDate,
                        'sub' => $pkgPrice,
                        'tot' => $pkgPrice,
                        'paid' => $pkgPrice,
                        'base' => $pkgPrice,
                        'sell' => $pkgPrice,
                        'uid' => $user['user_id'],
                    ]);
                }

                $imported++;
            }

            $db->commit();

            Response::json([
                'success' => true,
                'message' => "Successfully imported {$imported} client(s)" . ($skipped > 0 ? " ({$skipped} skipped)" : ""),
                'importedCount' => $imported,
                'skippedCount' => $skipped,
                'errors' => $errors,
            ]);
        } catch (Throwable $e) {
            $db->rollBack();
            Response::error('Failed to import clients: ' . $e->getMessage(), 500);
        }
    }
}

