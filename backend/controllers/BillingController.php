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
            $billingCycle = $data['billing_cycle'] ?? (isset($data['selected_days']) && (int)$data['selected_days'] < 30 ? 'Day-based' : 'Monthly');
            $isDayBased = ($billingCycle === 'Day-based' || (isset($data['selected_days']) && (int)$data['selected_days'] > 0 && empty($data['no_of_month'])));

            $callerUserId = (int)($user['user_id'] ?? 0);
            require_once __DIR__ . '/../lib/HierarchySecurityService.php';

            // Permission check 1: General recharge permission
            if (!HierarchySecurityService::hasPermission($callerUserId, 'can_recharge')) {
                $db->rollBack();
                Response::error('You do not have permission to recharge or renew customer services', 403);
                return;
            }

            // Permission check 2: Partial renewal (Day-based)
            if ($isDayBased && !HierarchySecurityService::hasPermission($callerUserId, 'can_partial_renew')) {
                $db->rollBack();
                Response::error('Partial (day-based) renewal is not permitted for your account. You can only renew full month(s).', 403);
                return;
            }

            $months = max(1, (int)($data['billing_cycle_months'] ?? $data['no_of_month'] ?? 1));
            $days = isset($data['selected_days']) && (int)$data['selected_days'] > 0 ? (int)$data['selected_days'] : ($months * 30);
            $planId = $data['package_id'] ?? $data['plan_id'] ?? 1;

            // Fetch plan price
            $stmtPkg = $db->prepare("SELECT * FROM access_profiles WHERE access_profile_id = :pid");
            $stmtPkg->execute(['pid' => $planId]);
            $package = $stmtPkg->fetch();
            if (!$package) {
                $db->rollBack();
                Response::error('Package not found', 404);
                return;
            }

            require_once __DIR__ . '/../lib/HierarchySecurityService.php';
            $callerLevel = HierarchySecurityService::getHierarchyLevel($user['role'] ?? '');
            if ($callerLevel > 0) {
                $allowedPkg = (int)$db->query("SELECT (
                    (SELECT COUNT(*) FROM tier_packages WHERE user_id = " . (int)$user['user_id'] . " AND package_id = " . (int)$planId . " AND is_allowed = 1) +
                    (SELECT COUNT(*) FROM reseller_plan_permission WHERE user_id = " . (int)$user['user_id'] . " AND access_profile_id = " . (int)$planId . " AND is_allowed = 1)
                )")->fetchColumn();
                if ($allowedPkg <= 0) {
                    $db->rollBack();
                    Response::error('Access Denied: The selected package has not been assigned to your account.', 403);
                    return;
                }
            }
            $monthlyPrice = (float)($data['plan_price'] ?? $package['price'] ?? 500);

            if ($isDayBased) {
                // Pro-rated day-based price: respect explicit bill_amount from frontend, or calculate (monthlyPrice / 30) * days
                if (isset($data['bill_amount']) && (float)$data['bill_amount'] > 0) {
                    $totalAmount = (float)$data['bill_amount'];
                } else {
                    $calc = ($monthlyPrice / 30) * $days;
                    $totalAmount = (float)round($calc);
                    if ($totalAmount < 1) {
                        $totalAmount = round($calc, 2);
                    }
                }
                $renewDaysParam = $days;
                $renewMonthsParam = 1;
                $renewNotes = "Day-based Renewal: {$days} Day(s) (Package: " . ($package['profile_name'] ?? 'Plan') . ")";
                $renewMode = 'DAY_RENEW';
                $bCycleDb = 'custom';
            } else {
                $totalAmount = round($monthlyPrice * $months, 2);
                $renewDaysParam = null;
                $renewMonthsParam = $months;
                $renewNotes = "Monthly Renewal: {$months} Month(s) (Package: " . ($package['profile_name'] ?? 'Plan') . ")";
                $renewMode = 'RENEW';
                $bCycleDb = 'monthly';
            }

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
                $stmtUpdate = $db->prepare("UPDATE customer_services SET expires_at = :exp, status = 'active', access_profile_id = :pid, billing_cycle = :bc WHERE customer_service_id = :sid");
                $stmtUpdate->execute([
                    'exp' => $newExpireDate,
                    'pid' => $planId,
                    'bc' => $bCycleDb,
                    'sid' => $currentService['customer_service_id'],
                ]);
            }

            // Update customer status
            $stmtCust = $db->prepare("UPDATE customers SET status = 'active', billing_status = 'Paid' WHERE customer_id = :cid");
            $stmtCust->execute(['cid' => $customerId]);

            // Create paid invoice with pure numeric globally unique sequence
            $invNumber = TenantSequenceService::generateNextCode($db, (string)$tenantId, 'invoice', 6);

            // Strict Pre-Flight Balance & Credit Limit Enforcement for Reseller, Sub-Reseller, Dealer, Agent
            require_once __DIR__ . '/../lib/HierarchySecurityService.php';
            require_once __DIR__ . '/../lib/WalletLedgerService.php';

            $callerRole = strtolower($user['role'] ?? '');
            $callerLevel = HierarchySecurityService::getHierarchyLevel($callerRole);
            $renewAsReseller = !empty($data['renew_as_reseller']);

            $targetChargedUserId = (int)$user['user_id'];
            $targetResellerUser = null;

            if ($callerLevel > 0) {
                // Initiator is directly a reseller/agent/dealer: charge their own wallet
                $targetChargedUserId = (int)$user['user_id'];
                $targetResellerUser = $user;
            } elseif ($renewAsReseller) {
                // Admin checked "Renew as Reseller": identify the customer's owner/reseller
                $stmtCustOwner = $db->prepare("SELECT customer_id, owner_id, owner_role, owner_path, created_by FROM customers WHERE customer_id = :cid LIMIT 1");
                $stmtCustOwner->execute(['cid' => $customerId]);
                $cOwner = $stmtCustOwner->fetch(PDO::FETCH_ASSOC);

                $resellerId = null;

                // 1. Direct owner_id
                $cOwnerId = !empty($cOwner['owner_id']) ? (int)$cOwner['owner_id'] : null;
                if ($cOwnerId) {
                    $uCheck = HierarchySecurityService::getUser($cOwnerId);
                    if ($uCheck && in_array(strtolower($uCheck['role'] ?? ''), ['agent', 'dealer', 'sub_reseller', 'reseller'], true)) {
                        $resellerId = $cOwnerId;
                        $targetResellerUser = $uCheck;
                    }
                }

                // 2. Leaf/deepest reseller in owner_path
                if (!$resellerId && !empty($cOwner['owner_path'])) {
                    $pathIds = array_filter(array_map('intval', explode('/', trim($cOwner['owner_path'], '/'))));
                    foreach (array_reverse($pathIds) as $pUid) {
                        $uCheck = HierarchySecurityService::getUser($pUid);
                        if ($uCheck && in_array(strtolower($uCheck['role'] ?? ''), ['agent', 'dealer', 'sub_reseller', 'reseller'], true)) {
                            $resellerId = $pUid;
                            $targetResellerUser = $uCheck;
                            break;
                        }
                    }
                }

                // 3. Fallback to created_by
                if (!$resellerId && !empty($cOwner['created_by'])) {
                    $uCheck = HierarchySecurityService::getUser((int)$cOwner['created_by']);
                    if ($uCheck && in_array(strtolower($uCheck['role'] ?? ''), ['agent', 'dealer', 'sub_reseller', 'reseller'], true)) {
                        $resellerId = (int)$cOwner['created_by'];
                        $targetResellerUser = $uCheck;
                    }
                }

                if (!$resellerId || !$targetResellerUser) {
                    $db->rollBack();
                    Response::error('This customer does not belong to any reseller panel. Cannot renew as reseller.', 400);
                    return;
                }

                $targetChargedUserId = $resellerId;
            }

            $rechargeRef = null;
            $actorDeduction = $totalAmount;
            if ($targetResellerUser && HierarchySecurityService::getHierarchyLevel($targetResellerUser['role'] ?? '') > 0) {
                // Deduct cost from the reseller's wallet and cascade margin to upstream
                $rechargeResult = WalletLedgerService::rechargeWithMarginCascade(
                    (int)$targetChargedUserId,
                    (int)$customerId,
                    (int)$planId,
                    $invNumber,
                    $tenantId ? (int)$tenantId : null,
                    $renewMonthsParam,
                    $renewDaysParam
                );
                $rechargeRef = $rechargeResult['recharge_ref'] ?? null;
                $actorDeduction = (float)($rechargeResult['actor_deduction'] ?? $totalAmount);
                $renewMode = 'RESELLER';
            }

            $finalNotes = $rechargeRef ? "{$renewNotes} • Ref: {$rechargeRef}" : $renewNotes;
            if ($renewAsReseller && $targetResellerUser && $callerLevel === 0) {
                $resellerLabel = !empty($targetResellerUser['username']) ? $targetResellerUser['username'] : "Reseller #{$targetChargedUserId}";
                $finalNotes .= " (Renewed as Reseller: {$resellerLabel})";
            }

            $stmtInv = $db->prepare("INSERT INTO invoices 
                (tenant_id, customer_id, customer_service_id, invoice_number, invoice_date, due_date, status, subtotal, total_amount, paid_amount, balance_due, base_price, sell_price, collected_by, charged_user_id, renew_mode, notes, previous_expire_date, created_by)
                VALUES (:tid, :cid, :sid, :inv_num, CURDATE(), CURDATE(), 'paid', :sub, :tot, :paid, 0.00, :base, :sell, :coll, :chg, :renew_mode, :notes, :prev_exp, :uid)");
            $stmtInv->execute([
                'tid' => $tenantId,
                'cid' => $customerId,
                'sid' => $currentService['customer_service_id'] ?? null,
                'inv_num' => $invNumber,
                'sub' => $totalAmount,
                'tot' => $totalAmount,
                'paid' => $totalAmount,
                'base' => $actorDeduction,
                'sell' => $totalAmount,
                'coll' => $user['user_id'],
                'chg' => $targetChargedUserId,
                'renew_mode' => $renewMode,
                'notes' => $finalNotes,
                'prev_exp' => $currentService['expires_at'] ?? null,
                'uid' => $user['user_id'],
            ]);

            // Record transaction matching actual initiator wallet deduction
            $trxRef = 'TRX-RENEW-' . strtoupper(bin2hex(random_bytes(4)));
            $trxDescr = ($renewAsReseller && $targetResellerUser && $callerLevel === 0)
                ? "Customer renewal debited from reseller {$targetResellerUser['username']} (#{$targetChargedUserId})"
                : ($isDayBased ? "Customer subscription renewal ({$days} Days)" : "Customer subscription renewal ({$months} Months)");

            $stmtTrx = $db->prepare("INSERT INTO transactions 
                (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, collector_user_id, description)
                VALUES (:tid, :cid, :ref, 'RENEW_DEBIT', :amt, 'system', :uid, :role, :coll, :descr)");
            $stmtTrx->execute([
                'tid' => $tenantId,
                'cid' => $customerId,
                'ref' => $trxRef,
                'amt' => $actorDeduction,
                'uid' => $targetChargedUserId,
                'role' => $targetResellerUser ? ($targetResellerUser['role'] ?? 'reseller') : $user['role'],
                'coll' => $user['user_id'],
                'descr' => $trxDescr,
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

            try {
                require_once __DIR__ . '/../lib/ActivityLogger.php';
                $logDescr = "Renewed customer subscription #{$customerId}: {$renewNotes} (৳{$totalAmount})";
                if ($renewAsReseller && $targetResellerUser && $callerLevel === 0) {
                    $logDescr .= " [Debited from Reseller #{$targetChargedUserId} ({$targetResellerUser['username']})]";
                }
                ActivityLogger::log([
                    'tenant_id' => $tenantId,
                    'user_id' => $user['user_id'] ?? null,
                    'log_type' => 'client_task',
                    'action' => 'client_renew',
                    'module' => 'billing',
                    'target_id' => (string)$customerId,
                    'target_type' => 'customer',
                    'description' => $logDescr,
                    'metadata' => [
                        'customer_id' => $customerId,
                        'new_expire_date' => $newExpireDate,
                        'amount' => $totalAmount,
                        'charged_user_id' => $targetChargedUserId,
                        'deducted_amount' => $actorDeduction,
                        'mode' => $renewMode,
                    ],
                ]);
            } catch (\Throwable $actErr) {}

            $successMsg = 'Service renewed and secret synchronized';
            if ($renewAsReseller && $targetResellerUser && $callerLevel === 0) {
                $successMsg = "Service renewed successfully. Debited ৳" . number_format($actorDeduction, 2) . " from Reseller '{$targetResellerUser['username']}' account.";
            }
            $successMsg .= $mtMsg;

            Response::json([
                'success' => true,
                'message' => $successMsg,
                'expire_at' => $newExpireDate,
                'data' => [
                    'new_expire_date' => $newExpireDate,
                    'expire_at' => $newExpireDate,
                    'bill_amount' => $totalAmount,
                    'charged_user_id' => $targetChargedUserId,
                    'charged_username' => $targetResellerUser['username'] ?? null,
                    'deducted_amount' => $actorDeduction,
                ],
            ]);
        } catch (DomainException $de) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            Response::error($de->getMessage(), 400);
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            Response::error('Failed to renew service: ' . $e->getMessage(), 500);
        }
    }

    public static function changePackage(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();

        require_once __DIR__ . '/../lib/HierarchySecurityService.php';
        HierarchySecurityService::requirePermission((int)$user['user_id'], 'can_change_package');

        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $customerId = $data['customer_id'] ?? null;
        $planId = $data['plan_id'] ?? null;

        if (!$customerId || !$planId) {
            Response::error('Customer ID and Plan ID are required', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE customer_services SET access_profile_id = :pid WHERE customer_id = :cid AND tenant_id = :tid");
        $stmt->execute(['pid' => $planId, 'cid' => $customerId, 'tid' => $tenantId]);

        try {
            require_once __DIR__ . '/../lib/ActivityLogger.php';
            ActivityLogger::log([
                'tenant_id' => $tenantId,
                'user_id' => $user['user_id'] ?? null,
                'log_type' => 'client_task',
                'action' => 'change_package',
                'module' => 'billing',
                'target_id' => (string)$customerId,
                'target_type' => 'customer',
                'description' => "Migrated customer #{$customerId} to Plan ID #{$planId}",
                'metadata' => [
                    'customer_id' => $customerId,
                    'plan_id' => $planId,
                ],
            ]);
        } catch (\Throwable $actErr) {}

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
        HierarchySecurityService::requirePermission($callerId, 'can_view_invoice');

        $scope = HierarchySecurityService::getDownwardScopeClause($callerId, $tenantId ? (int)$tenantId : null, 'c', 'u');
        $where = ["i.tenant_id = :tid"];
        $params = array_merge(['tid' => $tenantId], $scope['params']);
        if (!empty($scope['whereSql'])) {
            $where[] = $scope['whereSql'];
        }

        // Hide downline invoices if caller has hide_downline_invoices granted
        if (HierarchySecurityService::hasPermission($callerId, 'hide_downline_invoices')) {
            $where[] = "(c.owner_id = :direct_caller_id OR i.created_by = :direct_caller_id2)";
            $params['direct_caller_id'] = $callerId;
            $params['direct_caller_id2'] = $callerId;
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
        HierarchySecurityService::requirePermission((int)$user['user_id'], 'can_view_invoice');
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
        HierarchySecurityService::requirePermission((int)$user['user_id'], 'can_view_invoice');
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
        HierarchySecurityService::requirePermission((int)$user['user_id'], 'can_edit_invoice');
        $role = strtolower(trim($user['role'] ?? ''));
        $allowedRoles = ['admin', 'saas_admin', 'isp_admin', 'tenant_admin', 'manager', 'super_admin'];
        if (!in_array($role, $allowedRoles, true)) {
            Response::error('Access denied. Only ISP administrators and managers can cancel invoices.', 403);
            return;
        }

        self::returnInvoice($id);
    }

    /**
     * POST /billing/invoices/{id}/return
     * Atomically reverses invoice, refunds the reseller wallet, claws back upstream margins,
     * and reverts customer service expiry.
     * Allowed only for ISP admin and Manager roles.
     */
    public static function returnInvoice(string $id): void {
        $user = AuthMiddleware::requireAuth();
        HierarchySecurityService::requirePermission((int)$user['user_id'], 'can_edit_invoice');
        $tenantId = AuthMiddleware::getTenantId();

        $role = strtolower(trim($user['role'] ?? ''));
        $allowedRoles = ['admin', 'saas_admin', 'isp_admin', 'tenant_admin', 'manager', 'super_admin'];
        if (!in_array($role, $allowedRoles, true)) {
            Response::error('Access denied. Only ISP administrators and managers can process invoice returns.', 403);
            return;
        }

        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM invoices WHERE invoice_id = :id AND (tenant_id = :tid OR :tid2 IS NULL) LIMIT 1");
        $stmt->execute(['id' => $id, 'tid' => $tenantId, 'tid2' => $tenantId]);
        $inv = $stmt->fetch();

        if (!$inv) {
            Response::error('Invoice not found', 404);
        }

        if ($inv['status'] === 'returned') {
            Response::error('Invoice has already been returned and refunded.', 400);
        }

        $invId = (int)$inv['invoice_id'];
        $invNum = $inv['invoice_number'];
        $customerId = (int)$inv['customer_id'];
        $collectedBy = !empty($inv['charged_user_id']) 
            ? (int)$inv['charged_user_id'] 
            : (!empty($inv['collected_by']) ? (int)$inv['collected_by'] : (!empty($inv['created_by']) ? (int)$inv['created_by'] : (int)$user['user_id']));
        $totalAmount = (float)$inv['total_amount'];
        $paidAmount = (float)$inv['paid_amount'];
        $effectiveTenantId = (int)($inv['tenant_id'] ?? $tenantId);

        $db->beginTransaction();
        try {
            require_once __DIR__ . '/../lib/WalletLedgerService.php';

            // Extract recharge reference if stored in notes or lookup from wallet_transactions
            $rechargeRef = null;
            if (!empty($inv['notes']) && preg_match('/Recharge Ref:\s*([A-Za-z0-9\-_]+)/i', $inv['notes'], $rm)) {
                $rechargeRef = trim($rm[1]);
            }

            // Find actor deduction from wallet_transactions
            if ($rechargeRef) {
                $stmtWt = $db->prepare("SELECT * FROM wallet_transactions 
                    WHERE tenant_id = :tid AND reference_type = 'CUSTOMER_RECHARGE' AND reference_id = :ref LIMIT 1");
                $stmtWt->execute(['tid' => $effectiveTenantId, 'ref' => $rechargeRef]);
                $actorWt = $stmtWt->fetch(PDO::FETCH_ASSOC);
            } else {
                $stmtWt = $db->prepare("SELECT * FROM wallet_transactions 
                    WHERE tenant_id = :tid 
                      AND reference_type = 'CUSTOMER_RECHARGE' 
                      AND user_id = :uid 
                      AND (description LIKE :custDesc OR created_at BETWEEN DATE_SUB(:invTime, INTERVAL 5 MINUTE) AND DATE_ADD(:invTime, INTERVAL 5 MINUTE))
                    ORDER BY transaction_id DESC LIMIT 1");
                $stmtWt->execute([
                    'tid' => $effectiveTenantId,
                    'uid' => $collectedBy,
                    'custDesc' => "%customer #{$customerId}%",
                    'invTime' => $inv['created_at'],
                ]);
                $actorWt = $stmtWt->fetch(PDO::FETCH_ASSOC);
                if ($actorWt) {
                    $rechargeRef = $actorWt['reference_id'];
                }
            }

            $refundAmount = 0.00;
            if ($actorWt) {
                $refundAmount = (float)$actorWt['amount'];

                // a) Refund actor wallet
                $wStmt = $db->prepare("SELECT wallet_id, balance FROM wallets WHERE user_id = :uid FOR UPDATE");
                $wStmt->execute(['uid' => $collectedBy]);
                $actorWallet = $wStmt->fetch(PDO::FETCH_ASSOC);

                if ($actorWallet) {
                    $balBefore = (float)$actorWallet['balance'];
                    $balAfter = round($balBefore + $refundAmount, 2);

                    $db->prepare("UPDATE wallets SET balance = :bal, updated_at = NOW() WHERE wallet_id = :wid")
                       ->execute(['bal' => $balAfter, 'wid' => $actorWallet['wallet_id']]);

                    // Audit in wallet_transactions
                    $db->prepare("INSERT INTO wallet_transactions 
                        (tenant_id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, created_by)
                        VALUES (:tid, :wid, :uid, 'credit', :amt, :bb, :ba, 'INVOICE_RETURN', :ref, :desc, :cb)")
                       ->execute([
                           'tid' => $effectiveTenantId,
                           'wid' => $actorWallet['wallet_id'],
                           'uid' => $collectedBy,
                           'amt' => $refundAmount,
                           'bb' => $balBefore,
                           'ba' => $balAfter,
                           'ref' => "RET-{$invNum}",
                           'desc' => "Refund for returned invoice #{$invNum} (Customer #{$customerId})",
                           'cb' => $user['user_id'],
                       ]);

                    // Keep reseller_ledger in sync
                    $db->prepare("INSERT INTO reseller_ledger 
                        (tenant_id, user_id, credit, debit, reference_type, reference_id, notes, created_by)
                        VALUES (:tid, :uid, :amt, 0.00, 'INVOICE_RETURN', :ref, :notes, :cb)")
                       ->execute([
                           'tid' => $effectiveTenantId,
                           'uid' => $collectedBy,
                           'amt' => $refundAmount,
                           'ref' => "RET-{$invNum}",
                           'notes' => "Refund for returned invoice #{$invNum} (Customer #{$customerId})",
                           'cb' => $user['user_id'],
                       ]);
                }

                // b) Clawback upstream commissions
                if ($rechargeRef) {
                    $stmtComm = $db->prepare("SELECT * FROM wallet_transactions 
                        WHERE tenant_id = :tid AND reference_type = 'UPSTREAM_COMMISSION' AND reference_id = :ref");
                    $stmtComm->execute(['tid' => $effectiveTenantId, 'ref' => $rechargeRef]);
                    $commissions = $stmtComm->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($commissions as $comm) {
                        $pUid = (int)$comm['user_id'];
                        $commAmt = (float)$comm['amount'];

                        $pWStmt = $db->prepare("SELECT wallet_id, balance FROM wallets WHERE user_id = :uid FOR UPDATE");
                        $pWStmt->execute(['uid' => $pUid]);
                        $pWallet = $pWStmt->fetch(PDO::FETCH_ASSOC);

                        if ($pWallet) {
                            $pBalBefore = (float)$pWallet['balance'];
                            $pBalAfter = round($pBalBefore - $commAmt, 2);

                            $db->prepare("UPDATE wallets SET balance = :bal, updated_at = NOW() WHERE wallet_id = :wid")
                               ->execute(['bal' => $pBalAfter, 'wid' => $pWallet['wallet_id']]);

                            $db->prepare("INSERT INTO wallet_transactions 
                                (tenant_id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, created_by)
                                VALUES (:tid, :wid, :uid, 'debit', :amt, :bb, :ba, 'COMMISSION_REVERSAL', :ref, :desc, :cb)")
                               ->execute([
                                   'tid' => $effectiveTenantId,
                                   'wid' => $pWallet['wallet_id'],
                                   'uid' => $pUid,
                                   'amt' => $commAmt,
                                   'bb' => $pBalBefore,
                                   'ba' => $pBalAfter,
                                   'ref' => "RET-{$invNum}",
                                   'desc' => "Reversal of margin commission on returned invoice #{$invNum}",
                                   'cb' => $user['user_id'],
                               ]);

                            $db->prepare("INSERT INTO reseller_ledger 
                                (tenant_id, user_id, debit, credit, reference_type, reference_id, notes, created_by)
                                VALUES (:tid, :uid, :amt, 0.00, 'COMMISSION_REVERSAL', :ref, :notes, :cb)")
                               ->execute([
                                   'tid' => $effectiveTenantId,
                                   'uid' => $pUid,
                                   'amt' => $commAmt,
                                   'ref' => "RET-{$invNum}",
                                   'notes' => "Reversal of margin commission on returned invoice #{$invNum}",
                                   'cb' => $user['user_id'],
                               ]);
                        }
                    }
                }
            } else if ($paidAmount > 0) {
                // Direct refund fallback
                $refundAmount = $paidAmount;
                WalletLedgerService::topup(
                    (int)$user['user_id'],
                    $collectedBy,
                    $refundAmount,
                    "Refund for returned invoice #{$invNum}",
                    $effectiveTenantId
                );
            }

            // 2. Record in transactions table (as REFUND)
            if ($refundAmount > 0) {
                $db->prepare("INSERT INTO transactions 
                    (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, collector_user_id, description)
                    VALUES (:tid, :cid, :ref, 'REFUND', :amt, 'system', :uid, 'reseller', :coll, :desc)")
                   ->execute([
                       'tid' => $effectiveTenantId,
                       'cid' => $customerId,
                       'ref' => "RET-{$invNum}",
                       'amt' => $refundAmount,
                       'uid' => $collectedBy,
                       'coll' => $user['user_id'],
                       'desc' => "Refund for returned invoice #{$invNum} (Customer #{$customerId})",
                   ]);
            }

            // 3. Revert Customer Service Expiry Date
            $stmtCs = $db->prepare("SELECT * FROM customer_services WHERE customer_id = :cid ORDER BY customer_service_id DESC LIMIT 1");
            $stmtCs->execute(['cid' => $customerId]);
            $cs = $stmtCs->fetch(PDO::FETCH_ASSOC);

            if ($cs) {
                if (!empty($inv['previous_expire_date'])) {
                    $newExp = $inv['previous_expire_date'];
                } else {
                    $newExp = date('Y-m-d H:i:s', strtotime('-30 days', strtotime($cs['expires_at'])));
                }

                $isPastExpiry = strtotime($newExp) < time();
                $newCsStatus = $isPastExpiry ? 'suspended' : ($cs['status'] === 'active' ? 'active' : 'inactive');

                $db->prepare("UPDATE customer_services SET expires_at = :exp, status = :st, updated_at = NOW() WHERE customer_service_id = :sid")
                   ->execute([
                       'exp' => $newExp,
                       'st' => $newCsStatus,
                       'sid' => $cs['customer_service_id'],
                   ]);

                // Update MikroTik Router if expired
                if ($isPastExpiry) {
                    $db->prepare("UPDATE customers SET status = 'suspended', billing_status = 'Expired', updated_at = NOW() WHERE customer_id = :cid")
                       ->execute(['cid' => $customerId]);
                    try {
                        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
                        MikrotikSyncService::disableCustomer($db, $customerId);
                    } catch (\Throwable $mke) {
                        error_log("MikroTik disable notice on invoice return: " . $mke->getMessage());
                    }
                }
            }

            // 4. Update Invoice status to 'cancelled' with refund notes
            $noteMsg = " [Returned & Refunded ৳{$refundAmount} on " . date('Y-m-d H:i') . "]";
            $db->prepare("UPDATE invoices 
                SET status = 'cancelled', paid_amount = 0.00, balance_due = 0.00, notes = CONCAT(COALESCE(notes, ''), :note) 
                WHERE invoice_id = :id")
               ->execute([
                   'note' => $noteMsg,
                   'id' => $invId,
               ]);

            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            Response::error('Failed to process invoice return: ' . $e->getMessage(), 500);
        }

        $actorNewBal = WalletLedgerService::getBalance($collectedBy);

        Response::json([
            'success' => true,
            'message' => "Invoice return processed. ৳" . number_format($refundAmount, 2) . " has been refunded to your wallet.",
            'returnAmount' => $refundAmount,
            'balance' => $actorNewBal,
            'data' => [
                'invoiceId' => (string)$inv['invoice_id'],
                'status' => 'cancelled',
                'returnAmount' => $refundAmount,
                'balance' => $actorNewBal,
            ],
        ]);
    }

    /**
     * POST /billing/invoices/{id}/transfer
     * Transfers an invoice and its renewed service period from one customer to another customer.
     * Allowed only for ISP admin and Manager roles.
     */
    public static function transferInvoice(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();

        $role = strtolower(trim($user['role'] ?? ''));
        $allowedRoles = ['admin', 'saas_admin', 'isp_admin', 'tenant_admin', 'manager', 'super_admin'];
        if (!in_array($role, $allowedRoles, true)) {
            Response::error('Access denied. Only ISP administrators and managers can transfer invoices.', 403);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $targetCustomerInput = trim((string)($input['targetCustomer'] ?? $input['targetCustomerId'] ?? $input['targetCustomerUsername'] ?? ''));

        if (empty($targetCustomerInput)) {
            Response::error('Target customer ID, username, or code is required.', 400);
            return;
        }

        $db = Database::getConnection();

        // 1. Fetch current invoice
        $stmt = $db->prepare("SELECT * FROM invoices WHERE invoice_id = :id AND (tenant_id = :tid OR :tid2 IS NULL) LIMIT 1");
        $stmt->execute(['id' => $id, 'tid' => $tenantId, 'tid2' => $tenantId]);
        $inv = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$inv) {
            Response::error('Invoice not found.', 404);
            return;
        }

        if (in_array(strtolower($inv['status'] ?? ''), ['cancelled', 'returned'], true)) {
            Response::error('Cancelled or returned invoices cannot be transferred.', 400);
            return;
        }

        $invId = (int)$inv['invoice_id'];
        $invNum = $inv['invoice_number'];
        $sourceCustomerId = (int)$inv['customer_id'];
        $effectiveTenantId = (int)($inv['tenant_id'] ?? $tenantId);

        // 2. Fetch source customer
        $stmtSource = $db->prepare("SELECT * FROM customers WHERE customer_id = :cid AND (tenant_id = :tid OR :tid2 IS NULL) LIMIT 1");
        $stmtSource->execute(['cid' => $sourceCustomerId, 'tid' => $effectiveTenantId, 'tid2' => $effectiveTenantId]);
        $sourceCust = $stmtSource->fetch(PDO::FETCH_ASSOC);

        // 3. Fetch target customer (by customer_id, customer_code, or username)
        $stmtTarget = $db->prepare("SELECT * FROM customers 
            WHERE (tenant_id = :tid OR :tid2 IS NULL) 
              AND (customer_id = :cid OR customer_code = :ccode OR username = :uname) 
            LIMIT 1");
        $stmtTarget->execute([
            'tid' => $effectiveTenantId,
            'tid2' => $effectiveTenantId,
            'cid' => is_numeric($targetCustomerInput) ? (int)$targetCustomerInput : 0,
            'ccode' => $targetCustomerInput,
            'uname' => $targetCustomerInput,
        ]);
        $targetCust = $stmtTarget->fetch(PDO::FETCH_ASSOC);

        if (!$targetCust) {
            Response::error("Target customer '{$targetCustomerInput}' not found.", 404);
            return;
        }

        $targetCustomerId = (int)$targetCust['customer_id'];
        if ($targetCustomerId === $sourceCustomerId) {
            Response::error('Source customer and target customer cannot be the same.', 400);
            return;
        }

        $db->beginTransaction();
        try {
            // A. Revert Source Customer Service Expiry
            $stmtCs = $db->prepare("SELECT * FROM customer_services WHERE customer_id = :cid ORDER BY customer_service_id DESC LIMIT 1");
            $stmtCs->execute(['cid' => $sourceCustomerId]);
            $sourceCs = $stmtCs->fetch(PDO::FETCH_ASSOC);

            if ($sourceCs) {
                if (!empty($inv['previous_expire_date'])) {
                    $newSourceExp = $inv['previous_expire_date'];
                } else {
                    $newSourceExp = date('Y-m-d H:i:s', strtotime('-30 days', strtotime($sourceCs['expires_at'])));
                }

                $isSourceExpired = strtotime($newSourceExp) < time();
                $newSourceStatus = $isSourceExpired ? 'suspended' : ($sourceCs['status'] === 'active' ? 'active' : 'inactive');

                $db->prepare("UPDATE customer_services SET expires_at = :exp, status = :st, updated_at = NOW() WHERE customer_service_id = :sid")
                   ->execute(['exp' => $newSourceExp, 'st' => $newSourceStatus, 'sid' => $sourceCs['customer_service_id']]);

                if ($isSourceExpired) {
                    $db->prepare("UPDATE customers SET status = 'suspended', billing_status = 'Expired', updated_at = NOW() WHERE customer_id = :cid")
                       ->execute(['cid' => $sourceCustomerId]);
                    try {
                        require_once __DIR__ . '/../lib/MikrotikSyncService.php';
                        MikrotikSyncService::disableCustomer($db, $sourceCustomerId);
                    } catch (\Throwable $mke) {
                        error_log("MikroTik disable notice on invoice transfer: " . $mke->getMessage());
                    }
                }
            }

            // B. Extend Target Customer Service Expiry
            $stmtTargetCs = $db->prepare("SELECT * FROM customer_services WHERE customer_id = :cid ORDER BY customer_service_id DESC LIMIT 1");
            $stmtTargetCs->execute(['cid' => $targetCustomerId]);
            $targetCs = $stmtTargetCs->fetch(PDO::FETCH_ASSOC);

            $now = time();
            if ($targetCs) {
                $targetCurrentExp = strtotime($targetCs['expires_at']);
                $baseTime = ($targetCurrentExp && $targetCurrentExp > $now) ? $targetCurrentExp : $now;
                $newTargetExp = date('Y-m-d H:i:s', strtotime('+30 days', $baseTime));

                $db->prepare("UPDATE customer_services SET expires_at = :exp, status = 'active', updated_at = NOW() WHERE customer_service_id = :sid")
                   ->execute(['exp' => $newTargetExp, 'sid' => $targetCs['customer_service_id']]);
            } else {
                $newTargetExp = date('Y-m-d H:i:s', strtotime('+30 days', $now));
            }

            // Activate Target Customer
            $db->prepare("UPDATE customers SET status = 'active', billing_status = 'Paid', updated_at = NOW() WHERE customer_id = :cid")
               ->execute(['cid' => $targetCustomerId]);

            try {
                require_once __DIR__ . '/../lib/MikrotikSyncService.php';
                MikrotikSyncService::enableCustomer($db, $targetCustomerId);
            } catch (\Throwable $mke) {
                error_log("MikroTik enable notice on invoice transfer: " . $mke->getMessage());
            }

            // C. Update Invoice Record
            $sourceIdentifier = $sourceCust ? ($sourceCust['customer_code'] ?: $sourceCust['username'] ?: (string)$sourceCustomerId) : (string)$sourceCustomerId;
            $targetIdentifier = $targetCust['customer_code'] ?: $targetCust['username'] ?: (string)$targetCustomerId;
            $transferNote = " [Transferred from Customer #{$sourceIdentifier} to #{$targetIdentifier} by {$user['username']} on " . date('Y-m-d H:i') . "]";

            $db->prepare("UPDATE invoices 
                SET customer_id = :targetCid, notes = CONCAT(COALESCE(notes, ''), :note), updated_at = NOW() 
                WHERE invoice_id = :id")
               ->execute([
                   'targetCid' => $targetCustomerId,
                   'note' => $transferNote,
                   'id' => $invId,
               ]);

            // D. Update Transactions Record if any
            $db->prepare("UPDATE transactions 
                SET customer_id = :targetCid, description = CONCAT(COALESCE(description, ''), :note) 
                WHERE tenant_id = :tid AND (transaction_ref = :ref OR (customer_id = :srcCid AND created_at BETWEEN DATE_SUB(:invTime, INTERVAL 5 MINUTE) AND DATE_ADD(:invTime, INTERVAL 5 MINUTE)))")
               ->execute([
                   'targetCid' => $targetCustomerId,
                   'note' => $transferNote,
                   'tid' => $effectiveTenantId,
                   'ref' => "INV-{$invNum}",
                   'srcCid' => $sourceCustomerId,
                   'invTime' => $inv['created_at'],
               ]);

            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            Response::error('Failed to transfer invoice: ' . $e->getMessage(), 500);
            return;
        }

        Response::json([
            'success' => true,
            'message' => "Invoice #{$invNum} transferred successfully to customer {$targetCust['username']} ({$targetCust['name']}).",
            'data' => [
                'invoiceId' => (string)$invId,
                'targetCustomerId' => (string)$targetCustomerId,
                'targetCustomerName' => $targetCust['name'] ?? $targetCust['username'],
            ],
        ]);
    }
}
