-- =========================================================================
-- NetFix ISP SaaS - Ensure All Missing Columns & Tables Migration
-- Run this on production database (e.g. phpMyAdmin / MySQL CLI) if needed:
-- mysql -u root -p netfix_db < migration_ensure_all_columns.sql
-- =========================================================================

-- 1. Ensure columns in customer_network_accounts
ALTER TABLE `customer_network_accounts` 
    ADD COLUMN IF NOT EXISTS `last_disconnect_reason` VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `last_offline_at` DATETIME DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `last_online_at` DATETIME DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `device_vendor` VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `vendor_source` VARCHAR(50) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `uptime_seconds` INT(11) DEFAULT 0;

-- 2. Ensure columns in customers
ALTER TABLE `customers` 
    ADD COLUMN IF NOT EXISTS `customer_type` ENUM('individual', 'business') DEFAULT 'individual',
    ADD COLUMN IF NOT EXISTS `billing_status` ENUM('Paid','Due','Expired','Left','Suspended','Pending') DEFAULT 'Paid',
    ADD COLUMN IF NOT EXISTS `connection_date` DATE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `credit_limit` DECIMAL(15,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS `metadata` LONGTEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `internal_notes` TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `owner_id` BIGINT(20) UNSIGNED DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `owner_role` VARCHAR(50) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `owner_role_level` INT(11) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `owner_path` VARCHAR(255) DEFAULT NULL;

-- 3. Ensure columns in access_profiles
ALTER TABLE `access_profiles` 
    ADD COLUMN IF NOT EXISTS `color_hex` VARCHAR(20) NOT NULL DEFAULT '#2563EB',
    ADD COLUMN IF NOT EXISTS `download_speed_kbps` INT(10) UNSIGNED NOT NULL DEFAULT 10240,
    ADD COLUMN IF NOT EXISTS `upload_speed_kbps` INT(10) UNSIGNED NOT NULL DEFAULT 10240,
    ADD COLUMN IF NOT EXISTS `validity_days` INT(10) UNSIGNED NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS `validity_hours` INT(10) UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS `data_volume_type` ENUM('unlimited','gb') NOT NULL DEFAULT 'unlimited',
    ADD COLUMN IF NOT EXISTS `data_volume_gb` INT(10) UNSIGNED DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `mikrotik_profile_id` VARCHAR(200) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `mikrotik_profile_name` VARCHAR(200) DEFAULT NULL;

-- 4. Ensure customer_id_reservations table
CREATE TABLE IF NOT EXISTS `customer_id_reservations` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `reserved_code` VARCHAR(20) NOT NULL,
    `admin_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `session_token` VARCHAR(64) NOT NULL,
    `status` ENUM('reserved', 'used', 'released') NOT NULL DEFAULT 'reserved',
    `expires_at` DATETIME NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_reserved_code_status` (`reserved_code`, `status`),
    KEY `idx_tenant_status_expires` (`tenant_id`, `status`, `expires_at`),
    KEY `idx_session_token` (`session_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Ensure columns in olt_onus
ALTER TABLE `olt_onus` 
    ADD COLUMN IF NOT EXISTS `uptime` VARCHAR(60) DEFAULT NULL AFTER `status`,
    ADD COLUMN IF NOT EXISTS `router_mac` VARCHAR(30) DEFAULT NULL AFTER `mac_address`,
    ADD COLUMN IF NOT EXISTS `vlan_id` INT(11) DEFAULT NULL AFTER `router_mac`,
    ADD COLUMN IF NOT EXISTS `pppoe_username` VARCHAR(100) DEFAULT NULL AFTER `vlan_id`;

