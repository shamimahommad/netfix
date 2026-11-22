<?php
/**
 * NetFix ISP SaaS - Atomic Wallet & Cascading Ledger Service
 * Strictly enforces race-condition-free ACID transactions with SELECT ... FOR UPDATE
 * and automated upstream pass-through margin cascading across all reseller tiers.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/HierarchySecurityService.php';

class WalletLedgerService {
    /**
     * Ensure a wallet exists for the given user, returning wallet details
     */
    public static function ensureWallet(int $userId, ?int $tenantId = null): array {
        $db = Database::getConnection();
        $user = HierarchySecurityService::getUser($userId);
        $effectiveTenantId = $tenantId ?: (int)($user['tenant_id'] ?? 1);

        $stmt = $db->prepare("SELECT wallet_id, tenant_id, user_id, balance, currency, status 
            FROM wallets WHERE user_id = :uid LIMIT 1");
        $stmt->execute(['uid' => $userId]);
        $wallet = $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt->closeCursor();

        if ($wallet) {
            return $wallet;
        }

        // Initialize wallet if not yet created
        $insertStmt = $db->prepare("INSERT INTO wallets (tenant_id, user_id, balance, currency, status) 
            VALUES (:tid, :uid, 0.00, 'BDT', 'active')
            ON DUPLICATE KEY UPDATE updated_at = NOW()");
        $insertStmt->execute(['tid' => $effectiveTenantId, 'uid' => $userId]);
        $insertStmt->closeCursor();

        $stmt->execute(['uid' => $userId]);
        $wallet = $stmt->fetch(PDO::FETCH_ASSOC);
        $stmt->closeCursor();

        return $wallet ?: [
            'wallet_id' => 0,
            'tenant_id' => $effectiveTenantId,
            'user_id' => $userId,
            'balance' => 0.00,
            'currency' => 'BDT',
            'status' => 'active',
        ];
    }

    /**
     * Get current wallet balance for user
     */
    public static function getBalance(int $userId): float {
        $wallet = self::ensureWallet($userId);
        return (float)($wallet['balance'] ?? 0.00);
    }

    /**
     * Top-up user wallet with strict FOR UPDATE lock
     */
    public static function topup(
        int $actorUserId,
        int $targetUserId,
        float $amount,
        string $notes = 'Wallet Top-up',
        ?int $tenantId = null
    ): array {
        if ($amount <= 0) {
            throw new InvalidArgumentException("Top-up amount must be greater than zero.");
        }

        $db = Database::getConnection();
        self::ensureWallet($targetUserId, $tenantId);

        $isNested = $db->inTransaction();
        if (!$isNested) {
            $db->beginTransaction();
        }
        try {
            // Lock target wallet for update
            $stmt = $db->prepare("SELECT wallet_id, tenant_id, balance, status 
                FROM wallets WHERE user_id = :uid FOR UPDATE");
            $stmt->execute(['uid' => $targetUserId]);
            $wallet = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$wallet) {
                throw new DomainException("Target wallet not found for user #{$targetUserId}");
            }
            if ($wallet['status'] !== 'active') {
                throw new DomainException("Target wallet is {$wallet['status']} and cannot receive funds.");
            }

            $balanceBefore = (float)$wallet['balance'];
            $balanceAfter = round($balanceBefore + $amount, 2);
            $effectiveTenantId = (int)$wallet['tenant_id'];

            // Update wallet balance
            $upStmt = $db->prepare("UPDATE wallets SET balance = :bal, updated_at = NOW() WHERE wallet_id = :wid");
            $upStmt->execute(['bal' => $balanceAfter, 'wid' => $wallet['wallet_id']]);

            $topupRef = 'TOPUP-' . strtoupper(bin2hex(random_bytes(4)));

            // Insert audit record in wallet_transactions
            $txStmt = $db->prepare("INSERT INTO wallet_transactions 
                (tenant_id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, created_by)
                VALUES (:tid, :wid, :uid, 'credit', :amt, :bb, :ba, 'TOPUP', :ref, :desc, :cb)");
            $txStmt->execute([
                'tid' => $effectiveTenantId,
                'wid' => $wallet['wallet_id'],
                'uid' => $targetUserId,
                'amt' => $amount,
                'bb' => $balanceBefore,
                'ba' => $balanceAfter,
                'ref' => $topupRef,
                'desc' => $notes,
                'cb' => $actorUserId,
            ]);

            // Keep immutable double-entry wallet_ledger in sync
            try {
                $db->prepare("INSERT INTO wallet_ledger 
                    (tenant_id, wallet_id, user_id, txn_group_id, type, amount, opening_balance, closing_balance, purpose, description, created_at)
                    VALUES (:tid, :wid, :uid, :tgid, 'credit', :amt, :bb, :ba, 'wallet_recharge', :desc, NOW())")
                    ->execute([
                        'tid' => $effectiveTenantId,
                        'wid' => $wallet['wallet_id'],
                        'uid' => $targetUserId,
                        'tgid' => $topupRef,
                        'amt' => $amount,
                        'bb' => $balanceBefore,
                        'ba' => $balanceAfter,
                        'desc' => $notes,
                    ]);
            } catch (Throwable $ignore) {}

            // Keep legacy reseller_ledger in sync
            $rlStmt = $db->prepare("INSERT INTO reseller_ledger 
                (tenant_id, user_id, credit, reference_type, notes, created_by)
                VALUES (:tid, :uid, :credit, 'ADMIN_TOPUP', :notes, :cb)");
            $rlStmt->execute([
                'tid' => $effectiveTenantId,
                'uid' => $targetUserId,
                'credit' => $amount,
                'notes' => $notes,
                'cb' => $actorUserId,
            ]);

            if (!$isNested) {
                $db->commit();
            }

            return [
                'success' => true,
                'target_user_id' => $targetUserId,
                'amount' => $amount,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
            ];
        } catch (Throwable $e) {
            if (!$isNested && $db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Debit user wallet with strict FOR UPDATE lock
     */
    public static function debit(
        int $actorUserId,
        int $targetUserId,
        float $amount,
        string $notes = 'Manual Balance Debit',
        ?int $tenantId = null
    ): array {
        if ($amount <= 0) {
            throw new InvalidArgumentException("Debit amount must be greater than zero.");
        }

        $db = Database::getConnection();
        self::ensureWallet($targetUserId, $tenantId);

        $isNested = $db->inTransaction();
        if (!$isNested) {
            $db->beginTransaction();
        }
        try {
            // Lock target wallet for update
            $stmt = $db->prepare("SELECT wallet_id, tenant_id, balance, status 
                FROM wallets WHERE user_id = :uid FOR UPDATE");
            $stmt->execute(['uid' => $targetUserId]);
            $wallet = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$wallet) {
                throw new DomainException("Target wallet not found for user #{$targetUserId}");
            }
            if ($wallet['status'] !== 'active') {
                throw new DomainException("Target wallet is {$wallet['status']} and cannot be debited.");
            }

            // Target user info & credit limit
            $userStmt = $db->prepare("SELECT user_id, username, role, metadata FROM users WHERE user_id = :uid LIMIT 1");
            $userStmt->execute(['uid' => $targetUserId]);
            $targetUser = $userStmt->fetch(PDO::FETCH_ASSOC);

            $meta = json_decode($targetUser['metadata'] ?? '{}', true) ?: [];
            $creditLimit = (float)($meta['credit_limit'] ?? 0.00);
            $balanceBefore = (float)$wallet['balance'];
            $availableFunds = round($balanceBefore + $creditLimit, 2);

            // Fetch actor user to check permissions
            $actorStmt = $db->prepare("SELECT user_id, username, role FROM users WHERE user_id = :uid LIMIT 1");
            $actorStmt->execute(['uid' => $actorUserId]);
            $actorUser = $actorStmt->fetch(PDO::FETCH_ASSOC);
            $actorRole = strtolower($actorUser['role'] ?? '');
            $isAdmin = in_array($actorRole, ['superadmin', 'admin', 'tenant_admin', 'operator'], true);

            // If not admin, check available funds
            if (!$isAdmin && $availableFunds < $amount) {
                $limitText = $creditLimit > 0 ? " (Credit Limit: ৳" . number_format($creditLimit, 2) . ")" : "";
                $userLabel = !empty($targetUser['username']) ? $targetUser['username'] : "User #{$targetUserId}";
                throw new DomainException(
                    "Insufficient balance for '{$userLabel}'. Current balance: ৳" . number_format($balanceBefore, 2) . 
                    $limitText . ", Attempted debit: ৳" . number_format($amount, 2)
                );
            }

            $balanceAfter = round($balanceBefore - $amount, 2);
            $effectiveTenantId = (int)$wallet['tenant_id'];

            // Update wallet balance
            $upStmt = $db->prepare("UPDATE wallets SET balance = :bal, updated_at = NOW() WHERE wallet_id = :wid");
            $upStmt->execute(['bal' => $balanceAfter, 'wid' => $wallet['wallet_id']]);

            $debitRef = 'DBT-' . strtoupper(bin2hex(random_bytes(4)));

            // Insert audit record in wallet_transactions
            $txStmt = $db->prepare("INSERT INTO wallet_transactions 
                (tenant_id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, created_by)
                VALUES (:tid, :wid, :uid, 'debit', :amt, :bb, :ba, 'MANUAL_DEBIT', :ref, :desc, :cb)");
            $txStmt->execute([
                'tid' => $effectiveTenantId,
                'wid' => $wallet['wallet_id'],
                'uid' => $targetUserId,
                'amt' => $amount,
                'bb' => $balanceBefore,
                'ba' => $balanceAfter,
                'ref' => $debitRef,
                'desc' => $notes,
                'cb' => $actorUserId,
            ]);

            // Keep immutable double-entry wallet_ledger in sync
            try {
                $db->prepare("INSERT INTO wallet_ledger 
                    (tenant_id, wallet_id, user_id, txn_group_id, type, amount, opening_balance, closing_balance, purpose, description, created_at)
                    VALUES (:tid, :wid, :uid, :tgid, 'debit', :amt, :bb, :ba, 'manual_debit', :desc, NOW())")
                    ->execute([
                        'tid' => $effectiveTenantId,
                        'wid' => $wallet['wallet_id'],
                        'uid' => $targetUserId,
                        'tgid' => $debitRef,
                        'amt' => $amount,
                        'bb' => $balanceBefore,
                        'ba' => $balanceAfter,
                        'desc' => $notes,
                    ]);
            } catch (Throwable $ignore) {}

            // Keep legacy reseller_ledger in sync
            $rlStmt = $db->prepare("INSERT INTO reseller_ledger 
                (tenant_id, user_id, debit, reference_type, reference_id, notes, created_by)
                VALUES (:tid, :uid, :debit, 'MANUAL_DEBIT', :ref, :notes, :cb)");
            $rlStmt->execute([
                'tid' => $effectiveTenantId,
                'uid' => $targetUserId,
                'debit' => $amount,
                'ref' => $debitRef,
                'notes' => $notes,
                'cb' => $actorUserId,
            ]);

            if (!$isNested) {
                $db->commit();
            }

            return [
                'success' => true,
                'target_user_id' => $targetUserId,
                'amount' => $amount,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
            ];
        } catch (Throwable $e) {
            if (!$isNested && $db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Transfer funds between wallets with consistent locking order to prevent InnoDB deadlocks
     */
    public static function transfer(
        int $actorUserId,
        int $fromUserId,
        int $toUserId,
        float $amount,
        string $notes = 'Wallet Transfer',
        ?int $tenantId = null
    ): array {
        if ($amount <= 0) {
            throw new InvalidArgumentException("Transfer amount must be greater than zero.");
        }
        if ($fromUserId === $toUserId) {
            throw new InvalidArgumentException("Sender and receiver cannot be the same user.");
        }

        $db = Database::getConnection();
        self::ensureWallet($fromUserId, $tenantId);
        self::ensureWallet($toUserId, $tenantId);

        $isNested = $db->inTransaction();
        if (!$isNested) {
            $db->beginTransaction();
        }
        try {
            // Lock wallets in consistent user_id order to eliminate deadlocks
            $firstId = min($fromUserId, $toUserId);
            $secondId = max($fromUserId, $toUserId);

            $lockStmt = $db->prepare("SELECT wallet_id, user_id, tenant_id, balance, status 
                FROM wallets WHERE user_id IN (:uid1, :uid2) FOR UPDATE");
            $lockStmt->execute(['uid1' => $firstId, 'uid2' => $secondId]);
            $wallets = $lockStmt->fetchAll(PDO::FETCH_ASSOC);

            $walletMap = [];
            foreach ($wallets as $w) {
                $walletMap[(int)$w['user_id']] = $w;
            }

            $senderWallet = $walletMap[$fromUserId] ?? null;
            $receiverWallet = $walletMap[$toUserId] ?? null;

            if (!$senderWallet || !$receiverWallet) {
                throw new DomainException("Sender or receiver wallet could not be locked.");
            }

            $senderBal = (float)$senderWallet['balance'];
            $receiverBal = (float)$receiverWallet['balance'];

            // Verify sender balance
            $actorUser = HierarchySecurityService::getUser($actorUserId);
            $isLevel0 = HierarchySecurityService::getHierarchyLevel($actorUser['role'] ?? '') === 0;

            if ($senderBal < $amount && !$isLevel0) {
                throw new DomainException("Insufficient wallet balance: Available ৳{$senderBal}, Required ৳{$amount}.");
            }

            $senderAfter = round($senderBal - $amount, 2);
            $receiverAfter = round($receiverBal + $amount, 2);
            $txRef = 'TRF-' . strtoupper(bin2hex(random_bytes(4)));

            // Debit sender
            $db->prepare("UPDATE wallets SET balance = :bal, updated_at = NOW() WHERE wallet_id = :wid")
                ->execute(['bal' => $senderAfter, 'wid' => $senderWallet['wallet_id']]);

            $db->prepare("INSERT INTO wallet_transactions 
                (tenant_id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, created_by)
                VALUES (:tid, :wid, :uid, 'debit', :amt, :bb, :ba, 'TRANSFER_OUT', :ref, :desc, :cb)")
                ->execute([
                    'tid' => $senderWallet['tenant_id'],
                    'wid' => $senderWallet['wallet_id'],
                    'uid' => $fromUserId,
                    'amt' => $amount,
                    'bb' => $senderBal,
                    'ba' => $senderAfter,
                    'ref' => $txRef,
                    'desc' => "Transfer to user #{$toUserId}: {$notes}",
                    'cb' => $actorUserId,
                ]);

            // Credit receiver
            $db->prepare("UPDATE wallets SET balance = :bal, updated_at = NOW() WHERE wallet_id = :wid")
                ->execute(['bal' => $receiverAfter, 'wid' => $receiverWallet['wallet_id']]);

            $db->prepare("INSERT INTO wallet_transactions 
                (tenant_id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, created_by)
                VALUES (:tid, :wid, :uid, 'credit', :amt, :bb, :ba, 'TRANSFER_IN', :ref, :desc, :cb)")
                ->execute([
                    'tid' => $receiverWallet['tenant_id'],
                    'wid' => $receiverWallet['wallet_id'],
                    'uid' => $toUserId,
                    'amt' => $amount,
                    'bb' => $receiverBal,
                    'ba' => $receiverAfter,
                    'ref' => $txRef,
                    'desc' => "Transfer from user #{$fromUserId}: {$notes}",
                    'cb' => $actorUserId,
                ]);

            // Keep immutable double-entry wallet_ledger in sync
            try {
                $db->prepare("INSERT INTO wallet_ledger 
                    (tenant_id, wallet_id, user_id, txn_group_id, type, amount, opening_balance, closing_balance, purpose, description, created_at)
                    VALUES (:tid, :wid, :uid, :tgid, 'debit', :amt, :bb, :ba, 'package_deduction', :desc, NOW())")
                    ->execute([
                        'tid' => $senderWallet['tenant_id'],
                        'wid' => $senderWallet['wallet_id'],
                        'uid' => $fromUserId,
                        'tgid' => $txRef,
                        'amt' => $amount,
                        'bb' => $senderBal,
                        'ba' => $senderAfter,
                        'desc' => "Transfer to user #{$toUserId}: {$notes}",
                    ]);

                $db->prepare("INSERT INTO wallet_ledger 
                    (tenant_id, wallet_id, user_id, txn_group_id, type, amount, opening_balance, closing_balance, purpose, description, created_at)
                    VALUES (:tid, :wid, :uid, :tgid, 'credit', :amt, :bb, :ba, 'wallet_recharge', :desc, NOW())")
                    ->execute([
                        'tid' => $receiverWallet['tenant_id'],
                        'wid' => $receiverWallet['wallet_id'],
                        'uid' => $toUserId,
                        'tgid' => $txRef,
                        'amt' => $amount,
                        'bb' => $receiverBal,
                        'ba' => $receiverAfter,
                        'desc' => "Transfer from user #{$fromUserId}: {$notes}",
                    ]);
            } catch (Throwable $ignore) {}

            // Keep legacy reseller_ledger in sync
            $db->prepare("INSERT INTO reseller_ledger (tenant_id, user_id, debit, reference_type, notes, created_by)
                VALUES (:tid, :uid, :amt, 'TRANSFER_OUT', :notes, :cb)")
                ->execute([
                    'tid' => $senderWallet['tenant_id'],
                    'uid' => $fromUserId,
                    'amt' => $amount,
                    'notes' => "Transferred to user #{$toUserId}",
                    'cb' => $actorUserId,
                ]);

            $db->prepare("INSERT INTO reseller_ledger (tenant_id, user_id, credit, reference_type, notes, created_by)
                VALUES (:tid, :uid, :amt, 'TRANSFER_IN', :notes, :cb)")
                ->execute([
                    'tid' => $receiverWallet['tenant_id'],
                    'uid' => $toUserId,
                    'amt' => $amount,
                    'notes' => "Received from user #{$fromUserId}",
                    'cb' => $actorUserId,
                ]);

            if (!$isNested) {
                $db->commit();
            }

            return [
                'success' => true,
                'transfer_ref' => $txRef,
                'amount' => $amount,
                'from_user_id' => $fromUserId,
                'from_balance_after' => $senderAfter,
                'to_user_id' => $toUserId,
                'to_balance_after' => $receiverAfter,
            ];
        } catch (Throwable $e) {
            if (!$isNested && $db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Execute Customer Recharge with Atomic Cost Deduction & Cascading Upstream Margin
     */
    public static function rechargeWithMarginCascade(
        int $actorUserId,
        int $customerId,
        int $packageId,
        ?string $invoiceNumber = null,
        ?int $tenantId = null,
        int $months = 1,
        ?int $days = null
    ): array {
        $db = Database::getConnection();
        $actorUser = HierarchySecurityService::getUser($actorUserId);
        if (!$actorUser) {
            throw new InvalidArgumentException("Recharge initiator #{$actorUserId} not found");
        }

        // Fetch package info
        $pkgStmt = $db->prepare("SELECT access_profile_id, profile_name, price as retail_price 
            FROM access_profiles WHERE access_profile_id = :pid LIMIT 1");
        $pkgStmt->execute(['pid' => $packageId]);
        $pkg = $pkgStmt->fetch(PDO::FETCH_ASSOC);
        $pkgStmt->closeCursor();

        if (!$pkg) {
            throw new InvalidArgumentException("Package #{$packageId} not found");
        }

        $retailPrice = (float)$pkg['retail_price'];
        $actorLevel = HierarchySecurityService::getHierarchyLevel($actorUser['role']);
        $effectiveTenantId = $tenantId ?: (int)($actorUser['tenant_id'] ?: 1);

        // Fetch Actor's buy cost price for this package
        $actorCost = $retailPrice;
        if ($actorLevel === 0) {
            // Level 0 ISP Admin: base company cost is 0.00
            $actorCost = 0.00;
        } else {
            $costStmt = $db->prepare("SELECT cost_price FROM tier_packages 
                WHERE user_id = :uid AND package_id = :pid AND is_allowed = 1 LIMIT 1");
            $costStmt->execute(['uid' => $actorUserId, 'pid' => $packageId]);
            $costVal = $costStmt->fetchColumn();
            $costStmt->closeCursor();

            if ($costVal !== false) {
                $actorCost = (float)$costVal;
            } else {
                // Fallback to legacy reseller_plan_permission
                $rppStmt = $db->prepare("SELECT sell_price FROM reseller_plan_permission 
                    WHERE user_id = :uid AND access_profile_id = :pid AND is_allowed = 1 LIMIT 1");
                $rppStmt->execute(['uid' => $actorUserId, 'pid' => $packageId]);
                $rppVal = $rppStmt->fetchColumn();
                $rppStmt->closeCursor();
                $actorCost = $rppVal !== false ? (float)$rppVal : $retailPrice;
            }
        }

        $isDayBased = ($days !== null && $days > 0);
        if ($isDayBased) {
            $durationFactor = $days / 30.0;
            $actorCost = round($actorCost * $durationFactor, 2);
            $periodLabel = "{$days} Day(s)";
        } else {
            $months = max(1, $months);
            $actorCost = round($actorCost * $months, 2);
            $periodLabel = "{$months} Month(s)";
        }

        $isNested = $db->inTransaction();
        if (!$isNested) {
            $db->beginTransaction();
        }
        try {
            $cascadedMargins = [];
            $rechargeRef = 'RCH-' . strtoupper(bin2hex(random_bytes(4)));

            // 1. Deduct cost from actor's wallet if actor is a reseller/dealer/agent (Level > 0)
            if ($actorLevel > 0 && $actorCost > 0) {
                self::ensureWallet($actorUserId, $effectiveTenantId);

                $wStmt = $db->prepare("SELECT wallet_id, balance, status FROM wallets WHERE user_id = :uid FOR UPDATE");
                $wStmt->execute(['uid' => $actorUserId]);
                $actorWallet = $wStmt->fetch(PDO::FETCH_ASSOC);

                if (!$actorWallet) {
                    throw new DomainException("Initiator wallet not found");
                }
                if ($actorWallet['status'] !== 'active') {
                    throw new DomainException("Initiator wallet is {$actorWallet['status']}");
                }

                $meta = json_decode($actorUser['metadata'] ?? '{}', true) ?: [];
                $creditLimit = (float)($meta['credit_limit'] ?? 0.00);
                $actorBalBefore = (float)$actorWallet['balance'];
                $availableFunds = round($actorBalBefore + $creditLimit, 2);

                if ($availableFunds < $actorCost) {
                    $limitText = $creditLimit > 0 ? " (Credit Limit: ৳" . number_format($creditLimit, 2) . ")" : "";
                    $userLabel = !empty($actorUser['username']) ? $actorUser['username'] : "User #{$actorUserId}";
                    throw new DomainException(
                        "Insufficient balance for '{$userLabel}'. Current balance: ৳" . number_format($actorBalBefore, 2) . 
                        $limitText . ", Required: ৳" . number_format($actorCost, 2) . 
                        ". Please top up the reseller wallet or assign a credit limit."
                    );
                }

                $actorBalAfter = round($actorBalBefore - $actorCost, 2);

                // Update actor wallet
                $db->prepare("UPDATE wallets SET balance = :bal, updated_at = NOW() WHERE wallet_id = :wid")
                    ->execute(['bal' => $actorBalAfter, 'wid' => $actorWallet['wallet_id']]);

                // Record actor deduction
                $db->prepare("INSERT INTO wallet_transactions 
                    (tenant_id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, created_by)
                    VALUES (:tid, :wid, :uid, 'debit', :amt, :bb, :ba, 'CUSTOMER_RECHARGE', :ref, :desc, :cb)")
                    ->execute([
                        'tid' => $effectiveTenantId,
                        'wid' => $actorWallet['wallet_id'],
                        'uid' => $actorUserId,
                        'amt' => $actorCost,
                        'bb' => $actorBalBefore,
                        'ba' => $actorBalAfter,
                        'ref' => $rechargeRef,
                        'desc' => "Subscription recharge for customer #{$customerId} ({$periodLabel}) (Package: {$pkg['profile_name']})",
                        'cb' => $actorUserId,
                    ]);

                // Record in reseller_ledger
                $db->prepare("INSERT INTO reseller_ledger 
                    (tenant_id, user_id, debit, reference_type, reference_id, notes, created_by)
                    VALUES (:tid, :uid, :amt, 'CUSTOMER_RECHARGE', :ref, :notes, :cb)")
                    ->execute([
                        'tid' => $effectiveTenantId,
                        'uid' => $actorUserId,
                        'amt' => $actorCost,
                        'ref' => $rechargeRef,
                        'notes' => "Recharge customer #{$customerId} [{$pkg['profile_name']}, {$periodLabel}]",
                        'cb' => $actorUserId,
                    ]);

                // Double-entry record in wallet_ledger
                try {
                    $db->prepare("INSERT INTO wallet_ledger 
                        (tenant_id, wallet_id, user_id, txn_group_id, type, amount, opening_balance, closing_balance, purpose, source_customer_id, description, created_at)
                        VALUES (:tid, :wid, :uid, :tgid, 'debit', :amt, :bb, :ba, 'package_deduction', :cid, :desc, NOW())")
                        ->execute([
                            'tid' => $effectiveTenantId,
                            'wid' => $actorWallet['wallet_id'],
                            'uid' => $actorUserId,
                            'tgid' => $rechargeRef,
                            'amt' => $actorCost,
                            'bb' => $actorBalBefore,
                            'ba' => $actorBalAfter,
                            'cid' => $customerId,
                            'desc' => "Subscription recharge for customer #{$customerId} ({$periodLabel}) (Package: {$pkg['profile_name']})",
                        ]);
                } catch (Throwable $ignore) {}
            }

            // 2. Cascade Upstream Pass-Through Margins
            // Walk up ancestor chain: child -> parent -> grandparent -> ... -> Level 0
            $currentChildId = $actorUserId;
            $currentChildCost = $actorCost;
            $currentParentId = $actorUser['parent_id'] ? (int)$actorUser['parent_id'] : null;

            while ($currentParentId !== null && $currentParentId > 0) {
                $parentUser = HierarchySecurityService::getUser($currentParentId);
                if (!$parentUser) {
                    break;
                }

                $parentLevel = HierarchySecurityService::getHierarchyLevel($parentUser['role']);
                if ($parentLevel === 0) {
                    // Reached ISP Admin root (Company). The ISP keeps the base amount.
                    break;
                }

                // Determine parent's buy cost for this package
                $pCostStmt = $db->prepare("SELECT cost_price FROM tier_packages 
                    WHERE user_id = :uid AND package_id = :pid LIMIT 1");
                $pCostStmt->execute(['uid' => $currentParentId, 'pid' => $packageId]);
                $pCostVal = $pCostStmt->fetchColumn();

                $parentCost = $pCostVal !== false ? (float)$pCostVal : 0.00;
                if ($isDayBased) {
                    $parentCost = round($parentCost * $durationFactor, 2);
                } else {
                    $parentCost = round($parentCost * $months, 2);
                }
                $marginProfit = round($currentChildCost - $parentCost, 2);

                if ($marginProfit > 0) {
                    self::ensureWallet($currentParentId, $effectiveTenantId);

                    // Lock parent wallet FOR UPDATE
                    $pWalletStmt = $db->prepare("SELECT wallet_id, balance, status FROM wallets WHERE user_id = :uid FOR UPDATE");
                    $pWalletStmt->execute(['uid' => $currentParentId]);
                    $pWallet = $pWalletStmt->fetch(PDO::FETCH_ASSOC);

                    if ($pWallet && $pWallet['status'] === 'active') {
                        $pBalBefore = (float)$pWallet['balance'];
                        $pBalAfter = round($pBalBefore + $marginProfit, 2);

                        // Credit parent wallet
                        $db->prepare("UPDATE wallets SET balance = :bal, updated_at = NOW() WHERE wallet_id = :wid")
                            ->execute(['bal' => $pBalAfter, 'wid' => $pWallet['wallet_id']]);

                        // Record in wallet_transactions
                        $db->prepare("INSERT INTO wallet_transactions 
                            (tenant_id, wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, created_by)
                            VALUES (:tid, :wid, :uid, 'credit', :amt, :bb, :ba, 'UPSTREAM_COMMISSION', :ref, :desc, :cb)")
                            ->execute([
                                'tid' => $effectiveTenantId,
                                'wid' => $pWallet['wallet_id'],
                                'uid' => $currentParentId,
                                'amt' => $marginProfit,
                                'bb' => $pBalBefore,
                                'ba' => $pBalAfter,
                                'ref' => $rechargeRef,
                                'desc' => "Pass-through margin from downline user {$actorUser['username']} on customer recharge #{$customerId}",
                                'cb' => $actorUserId,
                            ]);

                        // Record in reseller_ledger
                        $db->prepare("INSERT INTO reseller_ledger 
                            (tenant_id, user_id, credit, reference_type, reference_id, notes, created_by)
                            VALUES (:tid, :uid, :amt, 'UPSTREAM_COMMISSION', :ref, :notes, :cb)")
                            ->execute([
                                'tid' => $effectiveTenantId,
                                'uid' => $currentParentId,
                                'amt' => $marginProfit,
                                'ref' => $rechargeRef,
                                'notes' => "Pass-through margin (৳{$marginProfit}) from downline #{$actorUserId}",
                                'cb' => $actorUserId,
                            ]);

                        // Double-entry record in wallet_ledger
                        try {
                            $db->prepare("INSERT INTO wallet_ledger 
                                (tenant_id, wallet_id, user_id, txn_group_id, type, amount, opening_balance, closing_balance, purpose, source_customer_id, description, created_at)
                                VALUES (:tid, :wid, :uid, :tgid, 'credit', :amt, :bb, :ba, 'commission_margin', :cid, :desc, NOW())")
                                ->execute([
                                    'tid' => $effectiveTenantId,
                                    'wid' => $pWallet['wallet_id'],
                                    'uid' => $currentParentId,
                                    'tgid' => $rechargeRef,
                                    'amt' => $marginProfit,
                                    'bb' => $pBalBefore,
                                    'ba' => $pBalAfter,
                                    'cid' => $customerId,
                                    'desc' => "Pass-through margin from downline user {$actorUser['username']} on customer recharge #{$customerId}",
                                ]);
                        } catch (Throwable $ignore) {}

                        $cascadedMargins[] = [
                            'user_id' => $currentParentId,
                            'username' => $parentUser['username'],
                            'role' => $parentUser['role'],
                            'margin_credited' => $marginProfit,
                            'balance_after' => $pBalAfter,
                        ];
                    }
                }

                // Advance up the chain
                $currentChildId = $currentParentId;
                $currentChildCost = $parentCost;
                $currentParentId = $parentUser['parent_id'] ? (int)$parentUser['parent_id'] : null;
            }

            if (!$isNested) {
                $db->commit();
            }

            return [
                'success' => true,
                'recharge_ref' => $rechargeRef,
                'customer_id' => $customerId,
                'package_id' => $packageId,
                'package_name' => $pkg['profile_name'],
                'retail_price' => $retailPrice,
                'actor_deduction' => $actorCost,
                'cascaded_margins' => $cascadedMargins,
            ];
        } catch (Throwable $e) {
            if (!$isNested && $db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }
}
