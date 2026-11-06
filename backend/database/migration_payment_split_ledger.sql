-- NetFix ISP SaaS - Payment Split & Wallet Ledger Migration
-- Creates strict double-entry ledger and aligns invoice schema

-- 1. Ensure `wallets` table exists
CREATE TABLE IF NOT EXISTS `wallets` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Ensure `wallet_ledger` table exists (Immutable Double-Entry Ledger)
CREATE TABLE IF NOT EXISTS `wallet_ledger` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Invoices Table Enhancements
SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'invoice_no');
SET @sql := IF(@exist = 0, 'ALTER TABLE `invoices` ADD COLUMN `invoice_no` VARCHAR(50) DEFAULT NULL AFTER `invoice_number`, ADD INDEX `idx_invoices_invoice_no` (`invoice_no`)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'creator_id');
SET @sql := IF(@exist = 0, 'ALTER TABLE `invoices` ADD COLUMN `creator_id` BIGINT UNSIGNED DEFAULT NULL AFTER `created_by`, ADD INDEX `idx_invoices_creator_id` (`creator_id`)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'payment_method');
SET @sql := IF(@exist = 0, 'ALTER TABLE `invoices` ADD COLUMN `payment_method` VARCHAR(50) DEFAULT NULL AFTER `balance_due`, ADD INDEX `idx_invoices_payment_method` (`payment_method`)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'paid_at');
SET @sql := IF(@exist = 0, 'ALTER TABLE `invoices` ADD COLUMN `paid_at` DATETIME DEFAULT NULL AFTER `payment_method`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill invoice_no and creator_id from existing columns if empty
UPDATE `invoices` SET `invoice_no` = `invoice_number` WHERE `invoice_no` IS NULL AND `invoice_number` IS NOT NULL;
UPDATE `invoices` SET `creator_id` = `created_by` WHERE `creator_id` IS NULL AND `created_by` IS NOT NULL;
