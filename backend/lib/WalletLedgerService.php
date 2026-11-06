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
                'ref' => 'TOPUP-' . strtoupper(bin2hex(random_bytes(4))),
                'desc' => $notes,
                'cb' => $actorUserId,
            ]);

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
        ?int $tenantId = null
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

                $actorBalBefore = (float)$actorWallet['balance'];
                if ($actorBalBefore < $actorCost) {
                    throw new DomainException(
                        "Insufficient wallet balance: Available ৳{$actorBalBefore}, Package Cost ৳{$actorCost}."
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
                        'desc' => "Subscription recharge for customer #{$customerId} (Package: {$pkg['profile_name']})",
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
                        'notes' => "Recharge customer #{$customerId} [{$pkg['profile_name']}]",
                        'cb' => $actorUserId,
                    ]);
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
