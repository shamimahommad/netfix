-- Enterprise-Grade Multi-Tier Reseller System Migration
-- Adds Materialized Path, Tier Packages, Wallets, and Granular Permissions

-- 1. Ensure `hierarchy_path` on `users` table
SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'hierarchy_path');
SET @sql := IF(@exist = 0, 'ALTER TABLE `users` ADD COLUMN `hierarchy_path` VARCHAR(255) NOT NULL DEFAULT \'/\' AFTER `parent_id`, ADD INDEX `idx_users_hierarchy_path` (`hierarchy_path`)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Ensure `owner_path` on `customers` table
SET @exist := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'customers' AND column_name = 'owner_path');
SET @sql := IF(@exist = 0, 'ALTER TABLE `customers` ADD COLUMN `owner_path` VARCHAR(255) NOT NULL DEFAULT \'/\' AFTER `owner_role_level`, ADD INDEX `idx_customers_owner_path` (`owner_path`)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Create `tier_packages` table
CREATE TABLE IF NOT EXISTS `tier_packages` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create `wallets` table
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

-- 5. Create `wallet_transactions` table
CREATE TABLE IF NOT EXISTS `wallet_transactions` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Create `permissions` table
CREATE TABLE IF NOT EXISTS `permissions` (
  `permission_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `permission_code` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'general',
  `description` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Create `user_permissions` table
CREATE TABLE IF NOT EXISTS `user_permissions` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `permission_id` BIGINT UNSIGNED NOT NULL,
  `granted` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `permission_id`),
  KEY `idx_up_perm` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Seed Standard Permissions
INSERT IGNORE INTO `permissions` (`permission_code`, `name`, `category`, `description`) VALUES
('can_create_customer', 'Create Customer', 'customers', 'Permission to onboard new customer subscribers'),
('can_edit_customer', 'Edit Customer', 'customers', 'Permission to modify existing customer subscriber info'),
('can_delete_customer', 'Delete Customer', 'customers', 'Permission to delete or cancel customers'),
('can_view_invoice', 'View Invoices', 'billing', 'Permission to view invoices and billing records'),
('can_recharge', 'Recharge Customer', 'billing', 'Permission to recharge/renew customer subscriptions'),
('can_manage_sub_tier', 'Manage Sub-Tier', 'reseller', 'Permission to create and manage downline resellers, dealers, agents'),
('can_assign_package', 'Assign Packages', 'packages', 'Permission to set package commissions and sell prices for downlines'),
('can_transfer_balance', 'Transfer Balance', 'wallet', 'Permission to transfer wallet balance to downlines');

