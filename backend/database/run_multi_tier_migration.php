<?php
/**
 * NetFix ISP SaaS - Multi-Tier Reseller System Migration Runner
 */

require_once __DIR__ . '/../config/database.php';

try {
    $db = Database::getConnection();
    $isCli = (php_sapi_name() === 'cli');
    $log = function(string $msg) use ($isCli) {
        if ($isCli) {
            echo $msg;
        }
    };
    $log("Connected to Database...\n");

    // Helper to check column
    $hasColumn = function(PDO $db, string $table, string $column): bool {
        $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c");
        $stmt->execute(['t' => $table, 'c' => $column]);
        $cnt = (int)$stmt->fetchColumn();
        $stmt->closeCursor();
        return $cnt > 0;
    };

    // 1. users.hierarchy_path
    if (!$hasColumn($db, 'users', 'hierarchy_path')) {
        echo "Adding hierarchy_path to users table...\n";
        $db->exec("ALTER TABLE `users` ADD COLUMN `hierarchy_path` VARCHAR(255) NOT NULL DEFAULT '/' AFTER `parent_id`, ADD INDEX `idx_users_hierarchy_path` (`hierarchy_path`)");
    }

    // 2. customers.owner_path
    if (!$hasColumn($db, 'customers', 'owner_path')) {
        echo "Adding owner_path to customers table...\n";
        $db->exec("ALTER TABLE `customers` ADD COLUMN `owner_path` VARCHAR(255) NOT NULL DEFAULT '/' AFTER `owner_role_level`, ADD INDEX `idx_customers_owner_path` (`owner_path`)");
    }

    // 3. tier_packages table
    echo "Ensuring tier_packages table...\n";
    $db->exec("CREATE TABLE IF NOT EXISTS `tier_packages` (
      `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      `tenant_id` BIGINT UNSIGNED NOT NULL,
      `package_id` BIGINT UNSIGNED NOT NULL,
      `user_id` BIGINT UNSIGNED NOT NULL,
      `assigned_by` BIGINT UNSIGNED NOT NULL,
      `cost_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      `retail_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      `is_allowed` TINYINT(1) NOT NULL DEFAULT 1,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY `uq_tier_pkg` (`tenant_id`, `user_id`, `package_id`),
      KEY `idx_tp_user` (`user_id`),
      KEY `idx_tp_pkg` (`package_id`),
      KEY `idx_tp_assigned_by` (`assigned_by`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    // 4. wallets table
    echo "Ensuring wallets table...\n";
    $db->exec("CREATE TABLE IF NOT EXISTS `wallets` (
      `wallet_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      `tenant_id` BIGINT UNSIGNED NOT NULL,
      `user_id` BIGINT UNSIGNED NOT NULL UNIQUE,
      `balance` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      `currency` VARCHAR(10) NOT NULL DEFAULT 'BDT',
      `status` ENUM('active','frozen','closed') NOT NULL DEFAULT 'active',
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY `idx_wallets_tenant` (`tenant_id`),
      KEY `idx_wallets_status` (`status`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    // 5. wallet_transactions table
    echo "Ensuring wallet_transactions table...\n";
    $db->exec("CREATE TABLE IF NOT EXISTS `wallet_transactions` (
      `transaction_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      `tenant_id` BIGINT UNSIGNED NOT NULL,
      `wallet_id` BIGINT UNSIGNED NOT NULL,
      `user_id` BIGINT UNSIGNED NOT NULL,
      `type` ENUM('credit','debit') NOT NULL,
      `amount` DECIMAL(15,2) NOT NULL,
      `balance_before` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      `balance_after` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      `reference_type` VARCHAR(50) NOT NULL,
      `reference_id` VARCHAR(100) DEFAULT NULL,
      `description` TEXT DEFAULT NULL,
      `created_by` BIGINT UNSIGNED DEFAULT NULL,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY `idx_wt_wallet` (`wallet_id`),
      KEY `idx_wt_user` (`user_id`),
      KEY `idx_wt_ref` (`reference_type`, `reference_id`),
      KEY `idx_wt_created` (`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    // 6. permissions table
    echo "Ensuring permissions table...\n";
    $db->exec("CREATE TABLE IF NOT EXISTS `permissions` (
      `permission_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      `permission_code` VARCHAR(50) NOT NULL UNIQUE,
      `name` VARCHAR(100) NOT NULL,
      `category` VARCHAR(50) NOT NULL DEFAULT 'general',
      `description` VARCHAR(255) DEFAULT NULL,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    // 7. user_permissions table
    echo "Ensuring user_permissions table...\n";
    $db->exec("CREATE TABLE IF NOT EXISTS `user_permissions` (
      `user_id` BIGINT UNSIGNED NOT NULL,
      `permission_id` BIGINT UNSIGNED NOT NULL,
      `granted` TINYINT(1) NOT NULL DEFAULT 1,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`user_id`, `permission_id`),
      KEY `idx_up_perm` (`permission_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    // 8. Seed permissions
    echo "Seeding default permissions...\n";
    $db->exec("INSERT IGNORE INTO `permissions` (`permission_code`, `name`, `category`, `description`) VALUES
    ('can_create_customer', 'Create Customer', 'customers', 'Permission to onboard new customer subscribers'),
    ('can_edit_customer', 'Edit Customer', 'customers', 'Permission to modify existing customer subscriber info'),
    ('can_delete_customer', 'Delete Customer', 'customers', 'Permission to delete or cancel customers'),
    ('can_view_invoice', 'View Invoices', 'billing', 'Permission to view invoices and billing records'),
    ('can_recharge', 'Recharge Customer', 'billing', 'Permission to recharge/renew customer subscriptions'),
    ('can_manage_sub_tier', 'Manage Sub-Tier', 'reseller', 'Permission to create and manage downline resellers, dealers, agents'),
    ('can_assign_package', 'Assign Packages', 'packages', 'Permission to set package commissions and sell prices for downlines'),
    ('can_transfer_balance', 'Transfer Balance', 'wallet', 'Permission to transfer wallet balance to downlines');");

    // 9. Populate hierarchy_path for all users
    echo "Populating hierarchy_path for users...\n";
    $stmt = $db->query("SELECT user_id, parent_id, role, role_level, tenant_id FROM users ORDER BY user_id ASC");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $stmt->closeCursor();

    // Map by id
    $userMap = [];
    foreach ($users as $u) {
        $userMap[$u['user_id']] = $u;
    }

    function computePath(int $userId, array &$userMap, array &$visited = []): string {
        if (in_array($userId, $visited, true)) {
            return "/{$userId}/"; // cycle break
        }
        $visited[] = $userId;
        $u = $userMap[$userId] ?? null;
        if (!$u || empty($u['parent_id']) || !isset($userMap[$u['parent_id']])) {
            return "/{$userId}/";
        }
        $parentPath = computePath((int)$u['parent_id'], $userMap, $visited);
        return rtrim($parentPath, '/') . "/{$userId}/";
    }

    $updateStmt = $db->prepare("UPDATE users SET hierarchy_path = :path WHERE user_id = :uid");
    foreach ($users as $u) {
        $visited = [];
        $path = computePath((int)$u['user_id'], $userMap, $visited);
        $updateStmt->execute(['path' => $path, 'uid' => $u['user_id']]);
        $updateStmt->closeCursor();
        echo "User {$u['user_id']} ({$u['role']}) -> Path: {$path}\n";
    }

    // 10. Populate owner_path for existing customers
    echo "Populating owner_path for customers...\n";
    $custStmt = $db->query("SELECT customer_id, owner_id FROM customers");
    $customers = $custStmt->fetchAll(PDO::FETCH_ASSOC);
    $custStmt->closeCursor();

    // Re-fetch updated paths
    $stmt = $db->query("SELECT user_id, hierarchy_path FROM users");
    $paths = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $stmt->closeCursor();

    $updateCustStmt = $db->prepare("UPDATE customers SET owner_path = :path WHERE customer_id = :cid");
    foreach ($customers as $c) {
        $ownerId = $c['owner_id'] ? (int)$c['owner_id'] : null;
        $cPath = ($ownerId && isset($paths[$ownerId])) ? $paths[$ownerId] : '/';
        $updateCustStmt->execute(['path' => $cPath, 'cid' => $c['customer_id']]);
        $updateCustStmt->closeCursor();
    }
    echo "Updated " . count($customers) . " customer owner paths.\n";

    // 11. Initialize Wallets for all users
    echo "Ensuring wallets for users...\n";
    $insertWallet = $db->prepare("INSERT INTO wallets (tenant_id, user_id, balance, currency, status) 
        VALUES (:tid, :uid, :bal, 'BDT', 'active')
        ON DUPLICATE KEY UPDATE balance = VALUES(balance)");
    $syncBalStmt = $db->prepare("SELECT COALESCE(SUM(credit - debit), 0) FROM reseller_ledger WHERE user_id = :uid");

    foreach ($users as $u) {
        $tid = $u['tenant_id'] ?: 1;
        $syncBalStmt->execute(['uid' => $u['user_id']]);
        $existingBal = (float)$syncBalStmt->fetchColumn();
        $syncBalStmt->closeCursor();

        $insertWallet->execute([
            'tid' => $tid,
            'uid' => $u['user_id'],
            'bal' => $existingBal,
        ]);
        $insertWallet->closeCursor();
    }
    echo "Wallets initialized.\n";

    // 12. Seed default permissions for users
    echo "Setting up default user permissions...\n";
    $allPermsStmt = $db->query("SELECT permission_id, permission_code FROM permissions");
    $allPerms = $allPermsStmt->fetchAll(PDO::FETCH_ASSOC);
    $allPermsStmt->closeCursor();

    $permMap = [];
    foreach ($allPerms as $p) {
        $permMap[$p['permission_code']] = (int)$p['permission_id'];
    }

    $insertPerm = $db->prepare("INSERT IGNORE INTO user_permissions (user_id, permission_id, granted) VALUES (:uid, :pid, 1)");

    foreach ($users as $u) {
        $role = strtolower($u['role'] ?? '');
        $uid = (int)$u['user_id'];

        $toGrant = [];
        if (in_array($role, ['admin', 'isp_admin', 'manager', 'saas_admin', 'super_admin'])) {
            $toGrant = array_keys($permMap);
        } elseif (in_array($role, ['reseller', 'sub_reseller', 'dealer'])) {
            $toGrant = [
                'can_create_customer',
                'can_edit_customer',
                'can_view_invoice',
                'can_recharge',
                'can_manage_sub_tier',
                'can_assign_package',
                'can_transfer_balance'
            ];
        } elseif ($role === 'agent') {
            $toGrant = [
                'can_create_customer',
                'can_view_invoice',
                'can_recharge'
            ];
        }

        foreach ($toGrant as $pCode) {
            if (isset($permMap[$pCode])) {
                $insertPerm->execute(['uid' => $uid, 'pid' => $permMap[$pCode]]);
                $insertPerm->closeCursor();
            }
        }
    }
    echo "Default user permissions configured.\n";

    // 13. Sync existing reseller_plan_permission into tier_packages
    echo "Syncing tier_packages with existing package assignments...\n";
    $rppStmt = $db->query("SELECT rpp.*, ap.price as retail_price, u.parent_id 
        FROM reseller_plan_permission rpp
        JOIN access_profiles ap ON ap.access_profile_id = rpp.access_profile_id
        JOIN users u ON u.user_id = rpp.user_id");
    $rpps = $rppStmt->fetchAll(PDO::FETCH_ASSOC);
    $rppStmt->closeCursor();

    $insertTp = $db->prepare("INSERT INTO tier_packages 
        (tenant_id, package_id, user_id, assigned_by, cost_price, commission_rate, retail_price, is_allowed)
        VALUES (:tid, :pid, :uid, :assigned_by, :cost, :comm, :retail, :allowed)
        ON DUPLICATE KEY UPDATE 
            cost_price = VALUES(cost_price),
            commission_rate = VALUES(commission_rate),
            retail_price = VALUES(retail_price),
            is_allowed = VALUES(is_allowed)");

    foreach ($rpps as $r) {
        $cost = (float)$r['sell_price'];
        $retail = (float)$r['retail_price'];
        $comm = (float)$r['pop_profit_percent'];
        if ($comm <= 0 && $retail > 0 && $cost < $retail) {
            $comm = round((($retail - $cost) / $retail) * 100, 2);
        }
        $assignedBy = $r['parent_id'] ?: 2;

        $insertTp->execute([
            'tid' => $r['tenant_id'],
            'pid' => $r['access_profile_id'],
            'uid' => $r['user_id'],
            'assigned_by' => $assignedBy,
            'cost' => $cost,
            'comm' => $comm,
            'retail' => $retail,
            'allowed' => $r['is_allowed'],
        ]);
        $insertTp->closeCursor();
    }
    echo "tier_packages synchronized.\n";

    echo "\n=== Multi-Tier Reseller System Database Migration COMPLETED SUCCESSFULLY! ===\n";
} catch (Throwable $e) {
    echo "MIGRATION ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
