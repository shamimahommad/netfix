<?php
/**
 * NetFix ISP SaaS - Payment Split & Double-Entry Ledger Migration Runner
 */

require_once __DIR__ . '/../config/database.php';

try {
    $db = Database::getConnection();
    $isCli = (php_sapi_name() === 'cli');
    $log = function(string $msg) use ($isCli) {
        if ($isCli) echo $msg;
    };

    $log("Starting Payment Split & Double-Entry Ledger Migration...\n");

    $hasColumn = function(PDO $db, string $table, string $column): bool {
        $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c");
        $stmt->execute(['t' => $table, 'c' => $column]);
        $cnt = (int)$stmt->fetchColumn();
        $stmt->closeCursor();
        return $cnt > 0;
    };

    // 1. wallets table
    $log("Ensuring wallets table...\n");
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

    // 2. wallet_ledger table
    $log("Ensuring wallet_ledger table...\n");
    $db->exec("CREATE TABLE IF NOT EXISTS `wallet_ledger` (
      `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      `tenant_id` BIGINT UNSIGNED NOT NULL,
      `wallet_id` BIGINT UNSIGNED NOT NULL,
      `user_id` BIGINT UNSIGNED NOT NULL,
      `txn_group_id` VARCHAR(64) NOT NULL,
      `type` ENUM('credit', 'debit') NOT NULL,
      `amount` DECIMAL(12,2) NOT NULL,
      `opening_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      `closing_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      `purpose` ENUM('customer_payment', 'commission_margin', 'wallet_recharge', 'package_deduction') NOT NULL,
      `source_customer_id` BIGINT UNSIGNED DEFAULT NULL,
      `invoice_id` BIGINT UNSIGNED DEFAULT NULL,
      `description` TEXT DEFAULT NULL,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY `idx_wl_user_created` (`user_id`, `created_at`),
      KEY `idx_wl_txn_group` (`txn_group_id`),
      KEY `idx_wl_wallet` (`wallet_id`),
      KEY `idx_wl_tenant` (`tenant_id`),
      KEY `idx_wl_purpose` (`purpose`),
      KEY `idx_wl_customer` (`source_customer_id`),
      KEY `idx_wl_invoice` (`invoice_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    // 3. invoices table column enhancements
    if (!$hasColumn($db, 'invoices', 'invoice_no')) {
        $log("Adding invoice_no to invoices...\n");
        $db->exec("ALTER TABLE `invoices` ADD COLUMN `invoice_no` VARCHAR(50) DEFAULT NULL AFTER `invoice_number`, ADD INDEX `idx_invoices_invoice_no` (`invoice_no`)");
    }

    if (!$hasColumn($db, 'invoices', 'creator_id')) {
        $log("Adding creator_id to invoices...\n");
        $db->exec("ALTER TABLE `invoices` ADD COLUMN `creator_id` BIGINT UNSIGNED DEFAULT NULL AFTER `created_by`, ADD INDEX `idx_invoices_creator_id` (`creator_id`)");
    }

    if (!$hasColumn($db, 'invoices', 'payment_method')) {
        $log("Adding payment_method to invoices...\n");
        $db->exec("ALTER TABLE `invoices` ADD COLUMN `payment_method` VARCHAR(50) DEFAULT NULL AFTER `balance_due`, ADD INDEX `idx_invoices_payment_method` (`payment_method`)");
    }

    if (!$hasColumn($db, 'invoices', 'paid_at')) {
        $log("Adding paid_at to invoices...\n");
        $db->exec("ALTER TABLE `invoices` ADD COLUMN `paid_at` DATETIME DEFAULT NULL AFTER `payment_method`");
    }

    // Sync backfill
    $db->exec("UPDATE `invoices` SET `invoice_no` = `invoice_number` WHERE `invoice_no` IS NULL AND `invoice_number` IS NOT NULL");
    $db->exec("UPDATE `invoices` SET `creator_id` = `created_by` WHERE `creator_id` IS NULL AND `created_by` IS NOT NULL");

    $log("Payment Split & Ledger Migration completed successfully!\n");
} catch (Throwable $e) {
    if (php_sapi_name() === 'cli') {
        echo "Migration Error: " . $e->getMessage() . "\n";
    }
    error_log("run_payment_split_migration error: " . $e->getMessage());
}
