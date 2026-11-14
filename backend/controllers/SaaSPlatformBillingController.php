<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class SaaSPlatformBillingController {
    private static function checkSaasAdmin(): array {
        $user = AuthMiddleware::requireAuth();
        if (($user['role'] ?? '') !== 'saas_admin' && ($user['user_type'] ?? '') !== 'saas') {
            Response::json([
                'success' => false,
                'message' => 'Access denied: SaaS Administrator privileges required'
            ], 403);
            exit;
        }
        return $user;
    }

    /**
     * GET /saas/billing/overview
     * Complete platform subscription billing telemetry:
     * - Paid ISPs
     * - Due / Overdue ISPs
     * - Free Trial ISPs
     * - Invoices list
     * - Metrics (MRR, Total Paid, Total Due, Trial count)
     */
    public static function overview(): void {
        self::checkSaasAdmin();
        $db = Database::getConnection();

        // 1. Fetch all tenants with package and invoice aggregates
        $stmt = $db->query("SELECT 
            t.tenant_id,
            t.tenant_code,
            t.tenant_name,
            t.business_email,
            t.business_phone,
            t.status as tenant_status,
            t.trial_ends_at,
            t.created_at,
            p.id as package_id,
            p.code as package_code,
            p.name as package_name,
            p.price as package_price,
            p.billing_cycle,
            p.max_customers,
            p.max_routers,
            p.max_olts,
            p.max_users,
            p.map_enabled,
            p.monitoring_enabled,
            p.sms_enabled,
            p.customer_portal_enabled,
            p.reseller_enabled,
            (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.tenant_id) as total_customers,
            (SELECT COUNT(*) FROM network_devices nd WHERE nd.tenant_id = t.tenant_id AND nd.device_type = 'router') as total_routers,
            (SELECT COALESCE(SUM(amount), 0) FROM saas_invoices si WHERE si.tenant_id = t.tenant_id) as total_invoiced,
            (SELECT COALESCE(SUM(paid_amount), 0) FROM saas_invoices si WHERE si.tenant_id = t.tenant_id) as total_paid,
            (SELECT COALESCE(SUM(balance_due), 0) FROM saas_invoices si WHERE si.tenant_id = t.tenant_id AND si.status IN ('due', 'overdue')) as total_due,
            (SELECT MAX(paid_at) FROM saas_invoices si WHERE si.tenant_id = t.tenant_id AND si.status = 'paid') as last_payment_date,
            (SELECT MIN(due_date) FROM saas_invoices si WHERE si.tenant_id = t.tenant_id AND si.status IN ('due', 'overdue')) as next_due_date
            FROM tenants t
            LEFT JOIN saas_packages p ON p.id = t.saas_package_id
            ORDER BY total_due DESC, t.tenant_id ASC");
        
        $tenantsRaw = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $now = new DateTime();
        $totalMrr = 0.0;
        $totalPaidGlobal = 0.0;
        $totalDueGlobal = 0.0;
        $trialCount = 0;
        $paidCount = 0;
        $dueCount = 0;

        $ispSubscriptions = [];

        foreach ($tenantsRaw as $r) {
            $status = $r['tenant_status'];
            $trialEnds = $r['trial_ends_at'] ? new DateTime($r['trial_ends_at']) : null;
            $isTrial = ($status === 'trial') || ($trialEnds && $trialEnds > $now);
            $trialDaysLeft = 0;

            if ($isTrial && $trialEnds) {
                $diff = $now->diff($trialEnds);
                $trialDaysLeft = $trialEnds > $now ? (int)$diff->days : 0;
            }

            $totalDue = (float)$r['total_due'];
            $totalPaid = (float)$r['total_paid'];
            $pkgPrice = (float)($r['package_price'] ?? 0);

            // Determine specific billing status
            $billingStatus = 'paid';
            if ($isTrial) {
                $billingStatus = 'trial';
                $trialCount++;
            } elseif ($status === 'suspended') {
                $billingStatus = 'suspended';
                if ($totalDue > 0) $dueCount++;
            } elseif ($totalDue > 0) {
                $billingStatus = 'due';
                $dueCount++;
            } else {
                $billingStatus = 'paid';
                $paidCount++;
            }

            $totalMrr += $pkgPrice;
            $totalPaidGlobal += $totalPaid;
            $totalDueGlobal += $totalDue;

            $ispSubscriptions[] = [
                'tenantId' => (string)$r['tenant_id'],
                'tenantCode' => $r['tenant_code'],
                'tenantName' => $r['tenant_name'],
                'businessEmail' => $r['business_email'],
                'businessPhone' => $r['business_phone'],
                'tenantStatus' => $status,
                'billingStatus' => $billingStatus,
                'isTrial' => $isTrial,
                'trialEndsAt' => $r['trial_ends_at'],
                'trialDaysLeft' => $trialDaysLeft,
                'package' => $r['package_id'] ? [
                    'id' => (int)$r['package_id'],
                    'code' => $r['package_code'],
                    'name' => $r['package_name'],
                    'price' => $pkgPrice,
                    'billingCycle' => $r['billing_cycle'],
                    'limits' => [
                        'maxCustomers' => (int)$r['max_customers'],
                        'maxRouters' => (int)$r['max_routers'],
                        'maxOlts' => (int)$r['max_olts'],
                        'maxUsers' => (int)$r['max_users'],
                    ],
                    'permissions' => [
                        'mapEnabled' => (bool)$r['map_enabled'],
                        'monitoringEnabled' => (bool)$r['monitoring_enabled'],
                        'smsEnabled' => (bool)$r['sms_enabled'],
                        'customerPortalEnabled' => (bool)$r['customer_portal_enabled'],
                        'resellerEnabled' => (bool)$r['reseller_enabled'],
                    ]
                ] : null,
                'totalCustomers' => (int)$r['total_customers'],
                'totalRouters' => (int)$r['total_routers'],
                'totalInvoiced' => (float)$r['total_invoiced'],
                'totalPaid' => $totalPaid,
                'balanceDue' => $totalDue,
                'lastPaymentDate' => $r['last_payment_date'],
                'nextDueDate' => $r['next_due_date'] ?? date('Y-m-d', strtotime('+30 days')),
                'createdAt' => $r['created_at'],
            ];
        }

        // 2. Fetch all subscription invoices
        $invStmt = $db->query("SELECT 
            si.id,
            si.invoice_no,
            si.tenant_id,
            t.tenant_name,
            t.tenant_code,
            si.package_name,
            si.amount,
            si.paid_amount,
            si.balance_due,
            si.status,
            si.billing_period_start,
            si.billing_period_end,
            si.due_date,
            si.paid_at,
            si.payment_method,
            si.transaction_ref,
            si.notes,
            si.created_at
            FROM saas_invoices si
            JOIN tenants t ON t.tenant_id = si.tenant_id
            ORDER BY si.id DESC");
        $invoices = array_map(function($inv) {
            return [
                'id' => (int)$inv['id'],
                'invoiceNo' => $inv['invoice_no'],
                'tenantId' => (string)$inv['tenant_id'],
                'tenantName' => $inv['tenant_name'],
                'tenantCode' => $inv['tenant_code'],
                'packageName' => $inv['package_name'],
                'amount' => (float)$inv['amount'],
                'paidAmount' => (float)$inv['paid_amount'],
                'balanceDue' => (float)$inv['balance_due'],
                'status' => $inv['status'],
                'billingPeriodStart' => $inv['billing_period_start'],
                'billingPeriodEnd' => $inv['billing_period_end'],
                'dueDate' => $inv['due_date'],
                'paidAt' => $inv['paid_at'],
                'paymentMethod' => $inv['payment_method'],
                'transactionRef' => $inv['transaction_ref'],
                'notes' => $inv['notes'],
                'createdAt' => $inv['created_at']
            ];
        }, $invStmt->fetchAll(PDO::FETCH_ASSOC) ?: []);

        Response::json([
            'success' => true,
            'metrics' => [
                'mrr' => $totalMrr,
                'totalCollected' => $totalPaidGlobal,
                'totalDue' => $totalDueGlobal,
                'totalTenants' => count($tenantsRaw),
                'paidCount' => $paidCount,
                'dueCount' => $dueCount,
                'trialCount' => $trialCount,
            ],
            'ispSubscriptions' => $ispSubscriptions,
            'invoices' => $invoices
        ]);
    }

    /**
     * POST /saas/billing/record-payment
     * Record payment from an ISP tenant for their SaaS subscription
     */
    public static function recordPayment(): void {
        self::checkSaasAdmin();
        $db = Database::getConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $tenantId = (int)($input['tenantId'] ?? 0);
        $amount = (float)($input['amount'] ?? 0);
        $invoiceId = isset($input['invoiceId']) ? (int)$input['invoiceId'] : null;
        $method = trim($input['paymentMethod'] ?? 'bkash');
        $ref = trim($input['transactionRef'] ?? ('TXN-' . strtoupper(substr(md5(uniqid()), 0, 10))));
        $notes = trim($input['notes'] ?? 'Subscription fee payment recorded by SaaS admin');

        if (!$tenantId || $amount <= 0) {
            Response::json(['success' => false, 'message' => 'tenantId and positive amount are required'], 400);
            return;
        }

        // If specific invoice is targeted
        if ($invoiceId) {
            $stmt = $db->prepare("SELECT * FROM saas_invoices WHERE id = :id AND tenant_id = :tid");
            $stmt->execute(['id' => $invoiceId, 'tid' => $tenantId]);
            $inv = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($inv) {
                $newPaid = (float)$inv['paid_amount'] + $amount;
                $newDue = max(0.0, (float)$inv['amount'] - $newPaid);
                $newStatus = $newDue <= 0 ? 'paid' : 'due';

                $db->prepare("UPDATE saas_invoices SET 
                    paid_amount = :paid,
                    balance_due = :due,
                    status = :status,
                    paid_at = NOW(),
                    payment_method = :method,
                    transaction_ref = :ref,
                    notes = :notes
                    WHERE id = :id")->execute([
                        'paid' => $newPaid,
                        'due' => $newDue,
                        'status' => $newStatus,
                        'method' => $method,
                        'ref' => $ref,
                        'notes' => $notes,
                        'id' => $invoiceId
                    ]);
            }
        } else {
            // Find any outstanding due invoice for this tenant
            $dueStmt = $db->prepare("SELECT * FROM saas_invoices WHERE tenant_id = :tid AND status IN ('due', 'overdue') ORDER BY id ASC LIMIT 1");
            $dueStmt->execute(['tid' => $tenantId]);
            $inv = $dueStmt->fetch(PDO::FETCH_ASSOC);

            if ($inv) {
                $newPaid = (float)$inv['paid_amount'] + $amount;
                $newDue = max(0.0, (float)$inv['amount'] - $newPaid);
                $newStatus = $newDue <= 0 ? 'paid' : 'due';

                $db->prepare("UPDATE saas_invoices SET 
                    paid_amount = :paid,
                    balance_due = :due,
                    status = :status,
                    paid_at = NOW(),
                    payment_method = :method,
                    transaction_ref = :ref,
                    notes = :notes
                    WHERE id = :id")->execute([
                        'paid' => $newPaid,
                        'due' => $newDue,
                        'status' => $newStatus,
                        'method' => $method,
                        'ref' => $ref,
                        'notes' => $notes,
                        'id' => $inv['id']
                    ]);
            } else {
                // Create a newly settled invoice
                $tQuery = $db->prepare("SELECT t.*, p.name as pkg_name FROM tenants t LEFT JOIN saas_packages p ON p.id = t.saas_package_id WHERE t.tenant_id = :tid");
                $tQuery->execute(['tid' => $tenantId]);
                $tData = $tQuery->fetch(PDO::FETCH_ASSOC);

                $invNo = 'INV-SAAS-' . date('Ym') . '-' . str_pad($tenantId, 3, '0', STR_PAD_LEFT);
                $pkgName = $tData['pkg_name'] ?? 'SaaS Standard Subscription';

                $db->prepare("INSERT INTO saas_invoices 
                    (invoice_no, tenant_id, package_id, package_name, amount, paid_amount, balance_due, status, due_date, paid_at, payment_method, transaction_ref, notes)
                    VALUES (:no, :tid, :pid, :pname, :amt, :paid, 0.00, 'paid', CURDATE(), NOW(), :method, :ref, :notes)")->execute([
                        'no' => $invNo,
                        'tid' => $tenantId,
                        'pid' => $tData['saas_package_id'] ?? null,
                        'pname' => $pkgName,
                        'amt' => $amount,
                        'paid' => $amount,
                        'method' => $method,
                        'ref' => $ref,
                        'notes' => $notes
                    ]);
            }
        }

        // If tenant was suspended or trial, ensure active status
        $db->prepare("UPDATE tenants SET status = 'active', activated_at = COALESCE(activated_at, NOW()) WHERE tenant_id = :tid")
           ->execute(['tid' => $tenantId]);

        Response::json([
            'success' => true,
            'message' => 'Payment recorded successfully and tenant account refreshed to Active status'
        ]);
    }

    /**
     * POST /saas/billing/extend-trial
     * Grant or extend free trial period for an ISP
     */
    public static function extendTrial(): void {
        self::checkSaasAdmin();
        $db = Database::getConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $tenantId = (int)($input['tenantId'] ?? 0);
        $days = (int)($input['days'] ?? 14);

        if (!$tenantId || $days <= 0) {
            Response::json(['success' => false, 'message' => 'tenantId and valid days are required'], 400);
            return;
        }

        $stmt = $db->prepare("UPDATE tenants SET 
            status = 'trial',
            trial_ends_at = DATE_ADD(NOW(), INTERVAL :days DAY)
            WHERE tenant_id = :tid");
        $stmt->execute(['days' => $days, 'tid' => $tenantId]);

        Response::json([
            'success' => true,
            'message' => "Free trial successfully granted/extended by {$days} days"
        ]);
    }

    /**
     * POST /saas/billing/generate-invoice
     * Generate a new monthly invoice for an ISP
     */
    public static function generateInvoice(): void {
        self::checkSaasAdmin();
        $db = Database::getConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $tenantId = (int)($input['tenantId'] ?? 0);
        if (!$tenantId) {
            Response::json(['success' => false, 'message' => 'tenantId is required'], 400);
            return;
        }

        $tStmt = $db->prepare("SELECT t.*, p.name as pkg_name, p.price as pkg_price FROM tenants t LEFT JOIN saas_packages p ON p.id = t.saas_package_id WHERE t.tenant_id = :tid");
        $tStmt->execute(['tid' => $tenantId]);
        $t = $tStmt->fetch(PDO::FETCH_ASSOC);

        if (!$t) {
            Response::json(['success' => false, 'message' => 'Tenant not found'], 404);
            return;
        }

        $amount = isset($input['amount']) && (float)$input['amount'] > 0 ? (float)$input['amount'] : (float)($t['pkg_price'] ?? 3500.00);
        $dueDate = !empty($input['dueDate']) ? $input['dueDate'] : date('Y-m-d', strtotime('+10 days'));
        $pkgName = $t['pkg_name'] ?? 'SaaS Standard Subscription';
        $invNo = 'INV-SAAS-' . date('Ymd') . '-' . rand(100, 999);
        $notes = trim($input['notes'] ?? 'Monthly platform license and BRAS quota fee');

        $db->prepare("INSERT INTO saas_invoices 
            (invoice_no, tenant_id, package_id, package_name, amount, paid_amount, balance_due, status, billing_period_start, billing_period_end, due_date, notes)
            VALUES (:no, :tid, :pid, :pname, :amt, 0.00, :due, 'due', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 MONTH), :due_date, :notes)")->execute([
                'no' => $invNo,
                'tid' => $tenantId,
                'pid' => $t['saas_package_id'] ?? null,
                'pname' => $pkgName,
                'amt' => $amount,
                'due' => $amount,
                'due_date' => $dueDate,
                'notes' => $notes
            ]);

        Response::json([
            'success' => true,
            'message' => 'Subscription invoice generated successfully',
            'invoiceNo' => $invNo
        ], 201);
    }
}

