<?php
/**
 * NetFix ISP SaaS - Multi-Tier Payment Split Engine & Double-Entry Ledger Worker
 * 
 * Enforces strict Double-Entry Conservation of Money:
 * Total Disbursed = Direct Seller Margin + All Intermediate Parent Margins + ISP Base Cost = Customer Payment
 * 
 * Concurrency & Integrity:
 * - Row-level locking on wallets (SELECT ... FOR UPDATE) ordered by user_id ASC to prevent deadlocks.
 * - Immutable financial audit trail in `wallet_ledger` with opening and closing balances.
 * - Complete ACID rollback on any failure.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';
require_once __DIR__ . '/../lib/WalletLedgerService.php';

class PaymentSplitService {

    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?: Database::getConnection();
    }

    /**
     * Static convenience entrypoint
     */
    public static function split(
        int $invoiceId, 
        float $totalAmount = 0.0, 
        string $paymentMethod = 'online_gateway', 
        array $metadata = []
    ): array {
        $service = new self();
        return $service->processCustomerPayment($invoiceId, $totalAmount, $paymentMethod, $metadata);
    }

    /**
     * Process customer retail payment and disburse upstream margins concurrently
     * 
     * @param int|string $invoiceId Invoice ID, invoice_no, or invoice_number
     * @param float $totalAmount Total paid amount in BDT (0 = read from invoice)
     * @param string $paymentMethod Gateway/channel name (bkash, nagad, ssl, cash, etc.)
     * @param array $metadata Optional payload (trxId, gateway_payment_id, etc.)
     * @return array Result summary with txn_group_id, disbursements, and audit logs
     */
    public function processCustomerPayment(
        $invoiceId, 
        float $totalAmount = 0.0, 
        string $paymentMethod = 'online_gateway', 
        array $metadata = []
    ): array {
        $db = $this->db;
        $isNested = $db->inTransaction();

        if (!$isNested) {
            $db->beginTransaction();
        }

        try {
            // 1. Locate Invoice
            $stmtInv = $db->prepare("SELECT * FROM invoices 
                WHERE invoice_id = :id 
                   OR invoice_number = :no 
                   OR (invoice_no IS NOT NULL AND invoice_no = :no2) 
                LIMIT 1 FOR UPDATE");
            $stmtInv->execute([
                'id' => is_numeric($invoiceId) ? (int)$invoiceId : 0,
                'no' => (string)$invoiceId,
                'no2' => (string)$invoiceId,
            ]);
            $invoice = $stmtInv->fetch(PDO::FETCH_ASSOC);
            $stmtInv->closeCursor();

            if (!$invoice) {
                throw new InvalidArgumentException("Invoice [{$invoiceId}] not found in billing records.");
            }

            $resolvedInvoiceId = (int)$invoice['invoice_id'];
            $tenantId = (int)$invoice['tenant_id'];
            $customerId = (int)$invoice['customer_id'];
            $invoiceAmount = (float)$invoice['total_amount'];

            if ($totalAmount <= 0) {
                $totalAmount = $invoiceAmount > 0 ? $invoiceAmount : (float)$invoice['subtotal'];
            }
            if ($totalAmount <= 0) {
                throw new DomainException("Payment amount must be greater than zero.");
            }

            // 2. Idempotency Check: Avoid double-splitting the same invoice
            $stmtCheck = $db->prepare("SELECT txn_group_id, COUNT(*) as cnt, SUM(amount) as total_split 
                FROM wallet_ledger 
                WHERE invoice_id = :inv AND purpose IN ('customer_payment', 'commission_margin')
                GROUP BY txn_group_id LIMIT 1");
            $stmtCheck->execute(['inv' => $resolvedInvoiceId]);
            $existingSplit = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            $stmtCheck->closeCursor();

            if ($existingSplit && (int)$existingSplit['cnt'] > 0) {
                if (!$isNested) {
                    $db->commit();
                }
                return [
                    'success' => true,
                    'already_processed' => true,
                    'message' => "Invoice #{$resolvedInvoiceId} already split under Txn Group {$existingSplit['txn_group_id']}",
                    'txn_group_id' => $existingSplit['txn_group_id'],
                    'total_amount' => (float)$existingSplit['total_split'],
                ];
            }

            // 3. Locate Customer & Service Profile
            $stmtCust = $db->prepare("SELECT customer_id, tenant_id, full_name, customer_code, 
                owner_id, owner_role_level, owner_path 
                FROM customers WHERE customer_id = :cid LIMIT 1");
            $stmtCust->execute(['cid' => $customerId]);
            $customer = $stmtCust->fetch(PDO::FETCH_ASSOC);
            $stmtCust->closeCursor();

            if (!$customer) {
                throw new DomainException("Customer record [{$customerId}] not found for invoice.");
            }
            $customerIdent = !empty($customer['customer_code']) ? $customer['customer_code'] : ($customer['full_name'] ?: "CID-{$customerId}");

            // Identify Package / Access Profile ID
            $packageId = 0;
            if (!empty($invoice['customer_service_id'])) {
                $stmtCs = $db->prepare("SELECT access_profile_id FROM customer_services WHERE customer_service_id = :csid LIMIT 1");
                $stmtCs->execute(['csid' => $invoice['customer_service_id']]);
                $csRow = $stmtCs->fetch(PDO::FETCH_ASSOC);
                $stmtCs->closeCursor();
                if ($csRow && !empty($csRow['access_profile_id'])) {
                    $packageId = (int)$csRow['access_profile_id'];
                }
            }

            if ($packageId <= 0) {
                $stmtPkg = $db->prepare("SELECT access_profile_id FROM customer_services 
                    WHERE customer_id = :cid ORDER BY customer_service_id DESC LIMIT 1");
                $stmtPkg->execute(['cid' => $customerId]);
                $pkgRow = $stmtPkg->fetch(PDO::FETCH_ASSOC);
                $stmtPkg->closeCursor();

                if ($pkgRow && !empty($pkgRow['access_profile_id'])) {
                    $packageId = (int)$pkgRow['access_profile_id'];
                }
            }

            if ($packageId <= 0 && !empty($metadata['package_id'])) {
                $packageId = (int)$metadata['package_id'];
            }

            // Fallback package check from access_profiles price
            $packageRetailPrice = $totalAmount;
            if ($packageId > 0) {
                $stmtAp = $db->prepare("SELECT price FROM access_profiles WHERE access_profile_id = :pid LIMIT 1");
                $stmtAp->execute(['pid' => $packageId]);
                $apRow = $stmtAp->fetch(PDO::FETCH_ASSOC);
                $stmtAp->closeCursor();
                if ($apRow && (float)$apRow['price'] > 0) {
                    $packageRetailPrice = (float)$apRow['price'];
                }
            }

            // 4. Resolve Ancestor Chain (ISP -> Reseller -> Sub-Reseller -> Dealer -> Agent)
            $ancestors = $this->resolveHierarchyAncestors($tenantId, $customer);

            // 5. Calculate Split Distribution
            $splits = $this->calculateMargins($tenantId, $packageId, $ancestors, $totalAmount, $packageRetailPrice);

            // 6. Ensure all beneficiary wallets exist
            $beneficiaryUserIds = array_keys($splits);
            foreach ($beneficiaryUserIds as $bUid) {
                WalletLedgerService::ensureWallet((int)$bUid, $tenantId);
            }

            // 7. Deadlock-Free Concurrency Lock: Lock all beneficiary wallets ordered by user_id ASC
            sort($beneficiaryUserIds, SORT_NUMERIC);
            $lockedWallets = [];
            foreach ($beneficiaryUserIds as $bUid) {
                $stmtLock = $db->prepare("SELECT wallet_id, user_id, balance, status 
                    FROM wallets WHERE user_id = :uid FOR UPDATE");
                $stmtLock->execute(['uid' => $bUid]);
                $wRow = $stmtLock->fetch(PDO::FETCH_ASSOC);
                $stmtLock->closeCursor();

                if (!$wRow) {
                    throw new RuntimeException("Failed to lock wallet for beneficiary User #{$bUid}");
                }
                if ($wRow['status'] !== 'active') {
                    throw new DomainException("Beneficiary User #{$bUid} wallet is {$wRow['status']}. Cannot disburse funds.");
                }
                $lockedWallets[$bUid] = $wRow;
            }

            // 8. Generate Unique Transaction Group Identifier
            $txnGroupId = 'TXG-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(6)));

            // 9. Execute Double-Entry Disbursement & Immutable Ledger Trail
            $auditTrail = [];
            $totalDisbursed = 0.0;

            $stmtLedger = $db->prepare("INSERT INTO wallet_ledger (
                tenant_id, wallet_id, user_id, txn_group_id, type, amount, 
                opening_balance, closing_balance, purpose, source_customer_id, 
                invoice_id, description, created_at
            ) VALUES (
                :tid, :wid, :uid, :tgid, 'credit', :amt,
                :open_bal, :close_bal, :purpose, :cid,
                :invid, :descr, NOW()
            )");

            $stmtWalletUpdate = $db->prepare("UPDATE wallets 
                SET balance = :new_bal, updated_at = NOW() 
                WHERE wallet_id = :wid");

            $stmtLegacyTxn = $db->prepare("INSERT INTO wallet_transactions (
                tenant_id, wallet_id, user_id, type, amount, 
                balance_before, balance_after, reference_type, reference_id, description, created_at
            ) VALUES (
                :tid, :wid, :uid, 'credit', :amt,
                :open_bal, :close_bal, :ref_type, :ref_id, :descr, NOW()
            )");

            foreach ($splits as $bUid => $item) {
                $disburseAmt = round($item['amount'], 2);
                if ($disburseAmt <= 0) {
                    continue;
                }

                $w = $lockedWallets[$bUid];
                $walletId = (int)$w['wallet_id'];
                $openingBal = (float)$w['balance'];
                $closingBal = round($openingBal + $disburseAmt, 2);

                // Update Wallet
                $stmtWalletUpdate->execute([
                    'new_bal' => $closingBal,
                    'wid' => $walletId,
                ]);
                $stmtWalletUpdate->closeCursor();

                // Purpose
                $purpose = $item['is_isp'] ? 'customer_payment' : 'commission_margin';
                $roleLabel = ucfirst(str_replace('_', ' ', $item['role']));
                $descr = $item['is_isp']
                    ? "ISP Base Net Received for Customer bill (Inv #{$invoice['invoice_number']}, Customer: {$customerIdent})"
                    : "{$roleLabel} bill margin ({$item['description']}) for Inv #{$invoice['invoice_number']} (Customer: {$customerIdent})";

                // Immutable Ledger Insert
                $stmtLedger->execute([
                    'tid' => $tenantId,
                    'wid' => $walletId,
                    'uid' => $bUid,
                    'tgid' => $txnGroupId,
                    'amt' => $disburseAmt,
                    'open_bal' => $openingBal,
                    'close_bal' => $closingBal,
                    'purpose' => $purpose,
                    'cid' => $customerId,
                    'invid' => $resolvedInvoiceId,
                    'descr' => $descr,
                ]);
                $stmtLedger->closeCursor();

                // Compatibility log in wallet_transactions
                $stmtLegacyTxn->execute([
                    'tid' => $tenantId,
                    'wid' => $walletId,
                    'uid' => $bUid,
                    'amt' => $disburseAmt,
                    'open_bal' => $openingBal,
                    'close_bal' => $closingBal,
                    'ref_type' => $purpose,
                    'ref_id' => $txnGroupId,
                    'descr' => $descr,
                ]);
                $stmtLegacyTxn->closeCursor();

                $totalDisbursed += $disburseAmt;

                $auditTrail[] = [
                    'user_id' => $bUid,
                    'username' => $item['username'],
                    'role' => $item['role'],
                    'tier_level' => $item['tier_level'],
                    'disbursed_amount' => $disburseAmt,
                    'opening_balance' => $openingBal,
                    'closing_balance' => $closingBal,
                    'purpose' => $purpose,
                    'description' => $descr,
                ];
            }

            // 10. Mark Invoice as Paid & Log Payment Method
            $stmtUpdateInv = $db->prepare("UPDATE invoices SET 
                status = 'paid',
                paid_amount = :amt,
                balance_due = 0.00,
                payment_method = :pm,
                paid_at = NOW(),
                updated_at = NOW()
                WHERE invoice_id = :id");
            $stmtUpdateInv->execute([
                'amt' => $totalAmount,
                'pm' => $paymentMethod,
                'id' => $resolvedInvoiceId,
            ]);
            $stmtUpdateInv->closeCursor();

            if (!$isNested) {
                $db->commit();
            }

            return [
                'success' => true,
                'invoice_id' => $resolvedInvoiceId,
                'invoice_number' => $invoice['invoice_number'],
                'txn_group_id' => $txnGroupId,
                'customer_id' => $customerId,
                'customer_username' => $customerIdent,
                'total_paid' => $totalAmount,
                'total_disbursed' => round($totalDisbursed, 2),
                'disbursements' => $auditTrail,
                'metadata' => $metadata,
            ];
        } catch (Throwable $e) {
            if (!$isNested && $db->inTransaction()) {
                $db->rollBack();
            }
            error_log("PaymentSplitService Exception on Invoice [{$invoiceId}]: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Resolves the full ancestor chain from ISP Root down to Direct Customer Owner
     *
     * @return array Array of user associative arrays ordered from ISP (index 0) to Direct Owner (last index)
     */
    private function resolveHierarchyAncestors(int $tenantId, array $customer): array {
        $ownerId = (int)($customer['owner_id'] ?? 0);
        $ownerPath = trim((string)($customer['owner_path'] ?? ''));

        // Identify tenant's ISP Admin user
        $stmtIsp = $this->db->prepare("SELECT user_id, username, role, hierarchy_path, parent_id 
            FROM users 
            WHERE tenant_id = :tid AND role IN ('isp_admin', 'admin', 'manager', 'saas_admin')
            ORDER BY user_id ASC LIMIT 1");
        $stmtIsp->execute(['tid' => $tenantId]);
        $ispUser = $stmtIsp->fetch(PDO::FETCH_ASSOC);
        $stmtIsp->closeCursor();

        if (!$ispUser) {
            // Fallback: select user 1 or first user of tenant
            $stmtFirst = $this->db->prepare("SELECT user_id, username, role, hierarchy_path, parent_id 
                FROM users WHERE tenant_id = :tid ORDER BY user_id ASC LIMIT 1");
            $stmtFirst->execute(['tid' => $tenantId]);
            $ispUser = $stmtFirst->fetch(PDO::FETCH_ASSOC) ?: [
                'user_id' => 1,
                'username' => 'admin',
                'role' => 'isp_admin',
                'hierarchy_path' => '/1/',
                'parent_id' => 0,
            ];
            $stmtFirst->closeCursor();
        }

        // If customer is owned directly by ISP or has no downline owner
        if ($ownerId <= 0 || $ownerId === (int)$ispUser['user_id']) {
            $ispUser['tier_level'] = 0;
            return [$ispUser];
        }

        // Extract IDs along the materialized path
        $pathIds = [];
        if (!empty($ownerPath) && $ownerPath !== '/') {
            $parts = array_filter(explode('/', $ownerPath));
            foreach ($parts as $p) {
                if (is_numeric($p)) {
                    $pathIds[] = (int)$p;
                }
            }
        }

        if (!in_array($ownerId, $pathIds, true)) {
            $pathIds[] = $ownerId;
        }
        if (!in_array((int)$ispUser['user_id'], $pathIds, true)) {
            array_unshift($pathIds, (int)$ispUser['user_id']);
        }

        // Query users in path
        $placeholders = implode(',', array_fill(0, count($pathIds), '?'));
        $stmtUsers = $this->db->prepare("SELECT user_id, username, role, hierarchy_path, parent_id 
            FROM users 
            WHERE user_id IN ({$placeholders})");
        $stmtUsers->execute($pathIds);
        $usersMap = [];
        while ($u = $stmtUsers->fetch(PDO::FETCH_ASSOC)) {
            $usersMap[(int)$u['user_id']] = $u;
        }
        $stmtUsers->closeCursor();

        // Build sorted chain from top (level 0) down to direct owner
        $chain = [];
        foreach ($pathIds as $uid) {
            if (isset($usersMap[$uid])) {
                $u = $usersMap[$uid];
                $u['tier_level'] = HierarchySecurityService::getHierarchyLevel($u['role']);
                $chain[] = $u;
            }
        }

        // Sort chain by tier level ascending (0 = ISP, 1 = Reseller, 2 = Sub-Reseller, 3 = Dealer, 4 = Agent)
        usort($chain, function($a, $b) {
            return $a['tier_level'] <=> $b['tier_level'];
        });

        return !empty($chain) ? $chain : [$ispUser];
    }

    /**
     * Calculates step-by-step margins using cascading cost prices
     * 
     * Rule:
     * - Direct Seller: Retail - Direct Cost
     * - Intermediate Parents: Child Cost - Parent Cost
     * - ISP Admin: Reseller Cost (or Retail if direct)
     */
    private function calculateMargins(
        int $tenantId, 
        int $packageId, 
        array $ancestors, 
        float $totalPaid, 
        float $retailPrice
    ): array {
        $splits = [];
        $chainCount = count($ancestors);

        // Case 1: ISP is the sole owner (no downline)
        if ($chainCount === 1) {
            $isp = $ancestors[0];
            $splits[(int)$isp['user_id']] = [
                'user_id' => (int)$isp['user_id'],
                'username' => $isp['username'],
                'role' => $isp['role'],
                'tier_level' => 0,
                'is_isp' => true,
                'amount' => $totalPaid,
                'cost_price' => 0.00,
                'description' => "Direct customer retail bill payment (100% ISP Net)",
            ];
            return $splits;
        }

        // Fetch cost prices for each tier member
        $tierCosts = [];
        foreach ($ancestors as $member) {
            $uid = (int)$member['user_id'];
            $tierCosts[$uid] = $this->getTierPackageCost($tenantId, $uid, $packageId, $retailPrice, $member['tier_level']);
        }

        // Iterate through chain:
        // Index 0 is ISP Root
        // Index N-1 is Direct Seller (e.g., Agent)
        $ispUser = $ancestors[0];
        $directSeller = $ancestors[$chainCount - 1];

        // 1. Direct Seller Profit: Retail Price - Direct Seller Cost Price
        $directSellerUid = (int)$directSeller['user_id'];
        $directSellerCost = $tierCosts[$directSellerUid];
        $directSellerMargin = max(0.00, round($retailPrice - $directSellerCost, 2));

        $splits[$directSellerUid] = [
            'user_id' => $directSellerUid,
            'username' => $directSeller['username'],
            'role' => $directSeller['role'],
            'tier_level' => $directSeller['tier_level'],
            'is_isp' => false,
            'amount' => $directSellerMargin,
            'cost_price' => $directSellerCost,
            'description' => "Retail ৳{$retailPrice} - Cost ৳{$directSellerCost} = Margin ৳{$directSellerMargin}",
        ];

        // 2. Intermediate Parents: Child Cost - Current Tier Cost
        for ($i = $chainCount - 1; $i >= 1; $i--) {
            $child = $ancestors[$i];
            $parent = $ancestors[$i - 1];

            $childUid = (int)$child['user_id'];
            $parentUid = (int)$parent['user_id'];

            if ($parentUid === (int)$ispUser['user_id']) {
                // We reached the ISP level; ISP base net is handled below
                continue;
            }

            $childCost = $tierCosts[$childUid];
            $parentCost = $tierCosts[$parentUid];
            $intermediateMargin = max(0.00, round($childCost - $parentCost, 2));

            $splits[$parentUid] = [
                'user_id' => $parentUid,
                'username' => $parent['username'],
                'role' => $parent['role'],
                'tier_level' => $parent['tier_level'],
                'is_isp' => false,
                'amount' => $intermediateMargin,
                'cost_price' => $parentCost,
                'description' => "Child Cost ৳{$childCost} - Cost ৳{$parentCost} = Margin ৳{$intermediateMargin}",
            ];
        }

        // 3. ISP Base Net Received: Cost price of the first child right below ISP
        $level1Child = $ancestors[1]; // First downline tier under ISP
        $level1Uid = (int)$level1Child['user_id'];
        $ispNetReceived = max(0.00, round($tierCosts[$level1Uid], 2));

        $ispUid = (int)$ispUser['user_id'];
        $splits[$ispUid] = [
            'user_id' => $ispUid,
            'username' => $ispUser['username'],
            'role' => $ispUser['role'],
            'tier_level' => 0,
            'is_isp' => true,
            'amount' => $ispNetReceived,
            'cost_price' => $ispNetReceived,
            'description' => "Base net collection from downline #{$level1Child['username']}",
        ];

        // 4. Strict Double-Entry Reconciliation: Verify total disbursed matches customer payment
        $sumDisbursed = 0.0;
        foreach ($splits as $item) {
            $sumDisbursed += $item['amount'];
        }
        $sumDisbursed = round($sumDisbursed, 2);

        // If there is any fractional rounding discrepancy between retail price and total paid:
        $diff = round($totalPaid - $sumDisbursed, 2);
        if (abs($diff) > 0.0001) {
            // Attribute variance to ISP base net to preserve mathematical conservation
            $splits[$ispUid]['amount'] = round($splits[$ispUid]['amount'] + $diff, 2);
        }

        return $splits;
    }

    /**
     * Retrieves the agreed cost price for a user and package
     */
    private function getTierPackageCost(
        int $tenantId, 
        int $userId, 
        int $packageId, 
        float $retailPrice, 
        int $tierLevel
    ): float {
        // Check tier_packages first
        if ($packageId > 0) {
            $stmt = $this->db->prepare("SELECT cost_price, commission_rate FROM tier_packages 
                WHERE tenant_id = :tid AND user_id = :uid AND package_id = :pid LIMIT 1");
            $stmt->execute(['tid' => $tenantId, 'uid' => $userId, 'pid' => $packageId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $stmt->closeCursor();

            if ($row && (float)$row['cost_price'] > 0) {
                return (float)$row['cost_price'];
            }
            if ($row && (float)$row['commission_rate'] > 0) {
                $comm = (float)$row['commission_rate'];
                return round($retailPrice - ($retailPrice * ($comm / 100)), 2);
            }

            // Check legacy reseller_plan_permission
            $stmtLegacy = $this->db->prepare("SELECT sell_price, pop_profit_percent FROM reseller_plan_permission 
                WHERE user_id = :uid AND access_profile_id = :pid LIMIT 1");
            $stmtLegacy->execute(['uid' => $userId, 'pid' => $packageId]);
            $legRow = $stmtLegacy->fetch(PDO::FETCH_ASSOC);
            $stmtLegacy->closeCursor();

            if ($legRow && (float)$legRow['sell_price'] > 0) {
                return (float)$legRow['sell_price'];
            }
            if ($legRow && (float)$legRow['pop_profit_percent'] > 0) {
                $comm = (float)$legRow['pop_profit_percent'];
                return round($retailPrice - ($retailPrice * ($comm / 100)), 2);
            }
        }

        // Standard Default Tier Cost Margins if unassigned:
        // Level 0 (ISP): 60% of retail (Cost = 0.60 * retail)
        // Level 1 (Reseller): 60% of retail (Cost = 300 on 500)
        // Level 2 (Sub-Reseller): 70% of retail (Cost = 350 on 500)
        // Level 3 (Dealer): 75% of retail (Cost = 375 on 500)
        // Level 4 (Agent): 80% of retail (Cost = 400 on 500)
        switch ($tierLevel) {
            case 0:
            case 1:
                return round($retailPrice * 0.60, 2);
            case 2:
                return round($retailPrice * 0.70, 2);
            case 3:
                return round($retailPrice * 0.75, 2);
            case 4:
                return round($retailPrice * 0.80, 2);
            default:
                return $retailPrice;
        }
    }
}
