-- =====================================================================
-- NetFix ISP Billing & Bandwidth Management SaaS - Enterprise Schema
-- Version: 1.0.0
-- Compatible with MariaDB 10.4+ and MySQL 8.0+
-- Matches NestJS TypeORM Entities and React Frontend Contracts
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `netfix_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `netfix_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS `tenants` (
    `tenant_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_code` VARCHAR(50) NOT NULL UNIQUE,
    `tenant_name` VARCHAR(255) NOT NULL,
    `tenant_slug` VARCHAR(100) NOT NULL UNIQUE,
    `business_email` VARCHAR(255) NOT NULL UNIQUE,
    `business_phone` VARCHAR(20) NULL,
    `business_address` TEXT NULL,
    `country_code` CHAR(2) NOT NULL DEFAULT 'BD',
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
    `currency_code` CHAR(3) NOT NULL DEFAULT 'BDT',
    `tax_identifier` VARCHAR(100) NULL,
    `business_registration_number` VARCHAR(100) NULL,
    `status` ENUM('active', 'suspended', 'trial', 'expired', 'terminated') NOT NULL DEFAULT 'active',
    `trial_ends_at` DATETIME NULL,
    `activated_at` DATETIME NULL,
    `suspended_at` DATETIME NULL,
    `terminated_at` DATETIME NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_tenant_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Roles Table
CREATE TABLE IF NOT EXISTS `roles` (
    `role_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `role_code` VARCHAR(50) NOT NULL UNIQUE,
    `role_name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `role_level` INT NOT NULL DEFAULT 50,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Users Table (Supports SaaS Admin, ISP Admins, Resellers, Sub-Resellers, Agents)
CREATE TABLE IF NOT EXISTS `users` (
    `user_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NULL,
    `email` VARCHAR(255) NOT NULL,
    `username` VARCHAR(100) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `password_changed_at` DATETIME NULL,
    `must_change_password` TINYINT(1) NOT NULL DEFAULT 0,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `avatar_url` VARCHAR(500) NULL,
    `status` ENUM('active', 'inactive', 'suspended', 'pending_verification', 'locked') NOT NULL DEFAULT 'active',
    `email_verified` TINYINT(1) NOT NULL DEFAULT 1,
    `email_verified_at` DATETIME NULL,
    `email_verification_token` VARCHAR(255) NULL,
    `email_verification_expires_at` DATETIME NULL,
    `password_reset_token` VARCHAR(255) NULL,
    `password_reset_expires_at` DATETIME NULL,
    `two_factor_enabled` TINYINT(1) NOT NULL DEFAULT 0,
    `two_factor_secret` VARCHAR(255) NULL,
    `failed_login_attempts` INT UNSIGNED NOT NULL DEFAULT 0,
    `locked_until` DATETIME NULL,
    `last_login_at` DATETIME NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `concurrent_sessions_allowed` INT UNSIGNED NOT NULL DEFAULT 5,
    `language_code` CHAR(2) NOT NULL DEFAULT 'en',
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
    `parent_id` BIGINT UNSIGNED NULL,
    `role` VARCHAR(50) NULL,
    `role_level` INT NULL DEFAULT 100,
    `metadata` JSON NULL,
    `notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `deleted_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_users_tenant` (`tenant_id`),
    INDEX `idx_users_email` (`email`),
    INDEX `idx_users_parent` (`parent_id`),
    INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Network Devices (MikroTik Routers, OLTs, Switches)
CREATE TABLE IF NOT EXISTS `network_devices` (
    `network_device_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `device_code` VARCHAR(50) NOT NULL,
    `device_name` VARCHAR(150) NOT NULL,
    `device_type` ENUM('router', 'switch', 'olt', 'access_point', 'firewall', 'other') NOT NULL DEFAULT 'router',
    `vendor` ENUM('mikrotik', 'olt', 'cisco', 'ubiquiti', 'huawei', 'other') NOT NULL DEFAULT 'mikrotik',
    `status` ENUM('active', 'inactive', 'maintenance', 'offline', 'decommissioned', 'auth_failed') NOT NULL DEFAULT 'active',
    `management_ip` VARCHAR(45) NULL,
    `dns_name` VARCHAR(255) NULL,
    `management_port` INT NOT NULL DEFAULT 8728,
    `winbox_port` INT NULL DEFAULT 8291,
    `web_port` INT NULL DEFAULT 80,
    `api_username` VARCHAR(100) NULL,
    `api_password` VARCHAR(255) NULL,
    `is_production` TINYINT(1) NOT NULL DEFAULT 1,
    `custom_ping_interval` INT NULL DEFAULT 10,
    `last_sync_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_devices_tenant` (`tenant_id`),
    INDEX `idx_devices_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Access Profiles (Bandwidth Packages / Speed Plans)
CREATE TABLE IF NOT EXISTS `access_profiles` (
    `access_profile_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `network_device_id` BIGINT UNSIGNED NOT NULL,
    `profile_code` VARCHAR(50) NOT NULL,
    `profile_name` VARCHAR(150) NOT NULL,
    `protocol` ENUM('pppoe', 'hotspot', 'static', 'ovpn', 'pptp') NOT NULL DEFAULT 'pppoe',
    `color_hex` VARCHAR(20) NOT NULL DEFAULT '#2563EB',
    `download_speed_kbps` INT UNSIGNED NOT NULL,
    `upload_speed_kbps` INT UNSIGNED NOT NULL,
    `status` ENUM('enabled', 'disabled') NOT NULL DEFAULT 'enabled',
    `is_default` TINYINT(1) NOT NULL DEFAULT 0,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `validity_days` INT UNSIGNED NOT NULL DEFAULT 30,
    `validity_hours` INT UNSIGNED NOT NULL DEFAULT 0,
    `data_volume_type` ENUM('unlimited', 'gb') NOT NULL DEFAULT 'unlimited',
    `data_volume_gb` INT UNSIGNED NULL,
    `privacy` ENUM('public', 'private') NOT NULL DEFAULT 'public',
    `mikrotik_profile_id` VARCHAR(200) NULL,
    `mikrotik_profile_name` VARCHAR(200) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_profile_tenant` (`tenant_id`),
    INDEX `idx_profile_device` (`network_device_id`),
    INDEX `idx_profile_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Service Areas & Sub-Areas
CREATE TABLE IF NOT EXISTS `service_areas` (
    `service_area_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_area_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sub_areas` (
    `sub_area_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `service_area_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_subarea_tenant` (`tenant_id`),
    INDEX `idx_subarea_area` (`service_area_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Customers Table
CREATE TABLE IF NOT EXISTS `customers` (
    `customer_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `customer_code` VARCHAR(50) NOT NULL,
    `customer_type` ENUM('individual', 'business') NOT NULL DEFAULT 'individual',
    `full_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(20) NOT NULL,
    `alternate_phone` VARCHAR(20) NULL,
    `national_id` VARCHAR(100) NULL,
    `tax_identifier` VARCHAR(100) NULL,
    `billing_address` TEXT NULL,
    `installation_address` TEXT NOT NULL,
    `city` VARCHAR(100) NULL,
    `state_province` VARCHAR(100) NULL,
    `postal_code` VARCHAR(20) NULL,
    `country_code` CHAR(2) NULL DEFAULT 'BD',
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `status` ENUM('pending_activation', 'active', 'suspended', 'terminated', 'cancelled') NOT NULL DEFAULT 'active',
    `billing_status` ENUM('Paid', 'Due', 'Expired', 'Left', 'Suspended', 'Pending') NOT NULL DEFAULT 'Paid',
    `connection_date` DATE NULL,
    `credit_limit` DECIMAL(15, 2) NULL DEFAULT 0.00,
    `metadata` JSON NULL,
    `internal_notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `owner_id` BIGINT UNSIGNED NULL,
    `owner_role` VARCHAR(50) NULL,
    `owner_role_level` INT NULL,
    `login_user_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_customer_tenant` (`tenant_id`),
    INDEX `idx_customer_code` (`customer_code`),
    INDEX `idx_customer_status` (`status`),
    INDEX `idx_customer_owner` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Customer Services (Subscriptions)
CREATE TABLE IF NOT EXISTS `customer_services` (
    `customer_service_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `access_profile_id` BIGINT UNSIGNED NOT NULL,
    `network_device_id` BIGINT UNSIGNED NOT NULL,
    `protocol` ENUM('pppoe', 'hotspot', 'static', 'ovpn', 'pptp') NOT NULL DEFAULT 'pppoe',
    `billing_cycle` ENUM('monthly', 'custom') NOT NULL DEFAULT 'monthly',
    `status` ENUM('active', 'inactive', 'suspended', 'cancelled') NOT NULL DEFAULT 'active',
    `starts_at` DATETIME NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_service_customer` (`customer_id`),
    INDEX `idx_service_profile` (`access_profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Customer Network Accounts (PPPoE / Hotspot credentials on MikroTik)
CREATE TABLE IF NOT EXISTS `customer_network_accounts` (
    `network_account_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `network_device_id` BIGINT UNSIGNED NOT NULL,
    `protocol` ENUM('pppoe', 'hotspot', 'static', 'ovpn', 'pptp') NOT NULL DEFAULT 'pppoe',
    `username` VARCHAR(100) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `remote_address` VARCHAR(45) NULL,
    `status` ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
    `mikrotik_profile_id` VARCHAR(200) NULL,
    `mikrotik_profile_name` VARCHAR(200) NULL,
    `is_online` TINYINT(1) NOT NULL DEFAULT 0,
    `current_ip` VARCHAR(45) NULL,
    `mac_address` VARCHAR(17) NULL,
    `device_vendor` VARCHAR(255) NULL,
    `vendor_source` VARCHAR(50) NULL,
    `uptime_seconds` INT NULL DEFAULT 0,
    `last_online_at` DATETIME NULL,
    `last_offline_at` DATETIME NULL,
    `upload_bytes` BIGINT NULL DEFAULT 0,
    `download_bytes` BIGINT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_net_account_customer` (`customer_id`),
    INDEX `idx_net_account_user` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Invoices Table
CREATE TABLE IF NOT EXISTS `invoices` (
    `invoice_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `customer_service_id` BIGINT UNSIGNED NULL,
    `invoice_number` VARCHAR(50) NOT NULL,
    `invoice_date` DATE NOT NULL,
    `due_date` DATE NOT NULL,
    `status` ENUM('draft', 'pending', 'paid', 'overdue', 'cancelled', 'partially_paid') NOT NULL DEFAULT 'pending',
    `subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `tax_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `discount_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `paid_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `balance_due` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `base_price` DECIMAL(15, 2) NULL,
    `sell_price` DECIMAL(15, 2) NULL,
    `commission_percent` DECIMAL(5, 2) NULL,
    `commission_amount` DECIMAL(15, 2) NULL,
    `collected_by` BIGINT UNSIGNED NULL,
    `parent_user_id` BIGINT UNSIGNED NULL,
    `renew_mode` VARCHAR(30) NULL,
    `charged_user_id` BIGINT UNSIGNED NULL,
    `notes` TEXT NULL,
    `previous_expire_date` DATETIME NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_invoice_tenant` (`tenant_id`),
    INDEX `idx_invoice_customer` (`customer_id`),
    INDEX `idx_invoice_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Transactions Table
CREATE TABLE IF NOT EXISTS `transactions` (
    `transaction_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NULL,
    `transaction_ref` VARCHAR(120) NOT NULL,
    `transaction_type` ENUM('GATEWAY_PAYMENT', 'MANUAL_CASH', 'ADMIN_ADJUST', 'RENEW_DEBIT', 'COMMISSION_CREDIT', 'REFUND', 'REVERSE_COMMISSION') NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `method` VARCHAR(30) NULL DEFAULT 'cash',
    `initiator_user_id` BIGINT UNSIGNED NULL,
    `initiator_role` VARCHAR(50) NULL,
    `collector_user_id` BIGINT UNSIGNED NULL,
    `running_balance_after_transaction` DECIMAL(15, 2) NULL,
    `description` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_trx_tenant` (`tenant_id`),
    INDEX `idx_trx_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Reseller Plan Permission (Upper -> Lower Commission % Cap Rule)
CREATE TABLE IF NOT EXISTS `reseller_plan_permission` (
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `access_profile_id` BIGINT UNSIGNED NOT NULL,
    `sell_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `pop_profit` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `pop_profit_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `is_allowed` TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`tenant_id`, `user_id`, `access_profile_id`),
    INDEX `idx_rpp_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Reseller Ledger (Wallet / Balance Tracking)
CREATE TABLE IF NOT EXISTS `reseller_ledger` (
    `ledger_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `credit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `reference_type` VARCHAR(50) NULL,
    `reference_id` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_ledger_tenant_user` (`tenant_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Commission Logs
CREATE TABLE IF NOT EXISTS `commission_logs` (
    `commission_log_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `invoice_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `base_price` DECIMAL(15, 2) NOT NULL,
    `commission_percent` DECIMAL(5, 2) NOT NULL,
    `commission_amount` DECIMAL(15, 2) NOT NULL,
    `reference_type` VARCHAR(50) NOT NULL DEFAULT 'gateway_payment',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_comm_invoice` (`invoice_id`),
    INDEX `idx_comm_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. SMS Gateway Settings & Templates & Logs
CREATE TABLE IF NOT EXISTS `sms_gateway_settings` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `provider` VARCHAR(50) NOT NULL DEFAULT 'mim_sms',
    `api_key` VARCHAR(255) NULL,
    `sender_id` VARCHAR(100) NULL,
    `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_sms_gw_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sms_templates` (
    `sms_template_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `template_key` VARCHAR(80) NOT NULL,
    `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `body` TEXT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_tenant_tpl_key` (`tenant_id`, `template_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sms_log` (
    `sms_log_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `provider_name` VARCHAR(100) NOT NULL,
    `to_number` VARCHAR(20) NOT NULL,
    `message` TEXT NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `sms_type` VARCHAR(50) NULL,
    `trxn_id` VARCHAR(100) NULL,
    `error_message` VARCHAR(500) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sms_log_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Payment Gateway Settings & Payment Intents
CREATE TABLE IF NOT EXISTS `payment_gateway_settings` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `gateway` VARCHAR(50) NOT NULL,
    `app_key` VARCHAR(255) NULL,
    `app_secret` VARCHAR(255) NULL,
    `username` VARCHAR(100) NULL,
    `password` VARCHAR(255) NULL,
    `is_sandbox` TINYINT(1) NOT NULL DEFAULT 1,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_pgw_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_intents` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `invoice_id` BIGINT UNSIGNED NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `gateway` VARCHAR(50) NOT NULL,
    `gateway_payment_id` VARCHAR(150) NULL,
    `status` ENUM('initiated', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'initiated',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_pi_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Tenant Settings & Limits
CREATE TABLE IF NOT EXISTS `tenant_settings` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `setting_key` VARCHAR(100) NOT NULL,
    `setting_value` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_tenant_setting` (`tenant_id`, `setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_limits` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL UNIQUE,
    `max_customers` INT NOT NULL DEFAULT 5000,
    `max_routers` INT NOT NULL DEFAULT 10,
    `max_resellers` INT NOT NULL DEFAULT 50,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Customer Tickets
CREATE TABLE IF NOT EXISTS `customer_tickets` (
    `ticket_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    `priority` ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
    `assigned_to` BIGINT UNSIGNED NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_ticket_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Login Logs & Client Task Logs
CREATE TABLE IF NOT EXISTS `login_logs` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `ip` VARCHAR(45) NOT NULL,
    `browser` VARCHAR(100) NULL,
    `os` VARCHAR(100) NULL,
    `method` VARCHAR(50) NOT NULL DEFAULT 'web',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_login_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `client_task_logs` (
    `task_id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'completed',
    `created_by` BIGINT UNSIGNED NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_task_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- SEED DATA: SAAS ADMIN, ISP TENANT, USERS, PACKAGES, ROUTERS, CUSTOMERS
-- =====================================================================

-- Roles
INSERT INTO `roles` (`role_id`, `role_code`, `role_name`, `role_level`, `description`) VALUES
(1, 'saas_admin', 'SaaS Super Administrator', 200, 'Global super admin'),
(2, 'admin', 'ISP Tenant Administrator', 100, 'ISP owner/admin'),
(3, 'manager', 'ISP Manager', 90, 'ISP operations manager'),
(4, 'reseller', 'Reseller (POP In-Charge)', 80, 'Level 1 reseller'),
(5, 'sub_reseller', 'Sub-Reseller (Dealer)', 60, 'Level 2 sub-reseller'),
(6, 'agent', 'Billing Agent', 40, 'Level 3 agent / collector'),
(7, 'customer', 'End Customer', 10, 'Subscriber portal access')
ON DUPLICATE KEY UPDATE `role_name` = VALUES(`role_name`);

-- Default Tenants (Tenant ID 1 and Tenant ID 2 for compatibility with frontend VITE_DEFAULT_TENANT_ID=2)
INSERT INTO `tenants` (`tenant_id`, `tenant_code`, `tenant_name`, `tenant_slug`, `business_email`, `business_phone`, `business_address`, `status`) VALUES
(1, 'ISP001', 'NetFix Cloud Network', 'netfix-cloud', 'admin@netfix.com', '+8801700000001', 'Level 4, Gulshan-2, Dhaka', 'active'),
(2, 'ISP002', 'SpeedNet Fiber Broadband', 'speednet', 'contact@speednet.com', '+8801800000002', 'Dhanmondi 27, Dhaka', 'active')
ON DUPLICATE KEY UPDATE `tenant_name` = VALUES(`tenant_name`);

-- Default Users (Password: password123 -> $2y$10$wN1Qe4r7W483kE1p9sS13OOY1YfVzE14uA3t10WjBfU8eGzZk9vQ2)
-- Using PHP password_hash('password123', PASSWORD_BCRYPT)
INSERT INTO `users` (`user_id`, `tenant_id`, `email`, `username`, `password_hash`, `first_name`, `last_name`, `phone`, `status`, `role`, `role_level`, `parent_id`) VALUES
(1, NULL, 'admin@ispsaas.com', 'saasadmin', '$2y$10$Kq.9QjFqT6B8WJgWl1Nf8u9c2vK3Wl7Zf6kHqN2uM3dYwG6vJ5eO.', 'Super', 'Admin', '+8801700000000', 'active', 'saas_admin', 200, NULL),
(2, 2, 'admin@netfix.com', 'admin', '$2y$10$Kq.9QjFqT6B8WJgWl1Nf8u9c2vK3Wl7Zf6kHqN2uM3dYwG6vJ5eO.', 'ISP', 'Admin', '+8801700000001', 'active', 'admin', 100, NULL),
(3, 2, 'reseller1@netfix.com', 'reseller1', '$2y$10$Kq.9QjFqT6B8WJgWl1Nf8u9c2vK3Wl7Zf6kHqN2uM3dYwG6vJ5eO.', 'Rafiq', 'POP Incharge', '+8801700000003', 'active', 'reseller', 80, 2),
(4, 2, 'sub1@netfix.com', 'subreseller1', '$2y$10$Kq.9QjFqT6B8WJgWl1Nf8u9c2vK3Wl7Zf6kHqN2uM3dYwG6vJ5eO.', 'Kamal', 'Sub Reseller', '+8801700000004', 'active', 'sub_reseller', 60, 3),
(5, 2, 'agent1@netfix.com', 'agent1', '$2y$10$Kq.9QjFqT6B8WJgWl1Nf8u9c2vK3Wl7Zf6kHqN2uM3dYwG6vJ5eO.', 'Salam', 'Agent', '+8801700000005', 'active', 'agent', 40, 4)
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- Network Device (MikroTik Router Core)
INSERT INTO `network_devices` (`network_device_id`, `tenant_id`, `device_code`, `device_name`, `device_type`, `vendor`, `status`, `management_ip`, `management_port`, `winbox_port`, `api_username`, `api_password`) VALUES
(1, 2, 'ROUTER01', 'Core-CCR2004-Dhaka', 'router', 'mikrotik', 'active', '192.168.88.1', 8728, 8291, 'admin', 'admin123')
ON DUPLICATE KEY UPDATE `device_name` = VALUES(`device_name`);

-- Access Profiles (Bandwidth Packages)
INSERT INTO `access_profiles` (`access_profile_id`, `tenant_id`, `network_device_id`, `profile_code`, `profile_name`, `protocol`, `color_hex`, `download_speed_kbps`, `upload_speed_kbps`, `price`, `validity_days`) VALUES
(1, 2, 1, 'STARTER-10M', 'Starter 10 Mbps', 'pppoe', '#10B981', 10240, 10240, 500.00, 30),
(2, 2, 1, 'STANDARD-20M', 'Standard 20 Mbps', 'pppoe', '#3B82F6', 20480, 20480, 800.00, 30),
(3, 2, 1, 'ULTRA-50M', 'Ultra Fast 50 Mbps', 'pppoe', '#8B5CF6', 51200, 51200, 1500.00, 30)
ON DUPLICATE KEY UPDATE `profile_name` = VALUES(`profile_name`);

-- Service Areas & Sub-Areas
INSERT INTO `service_areas` (`service_area_id`, `tenant_id`, `name`, `description`, `created_by`) VALUES
(1, 2, 'Dhanmondi Zone', 'Central Dhanmondi ISP Area', 2),
(2, 2, 'Gulshan Zone', 'North Dhaka Area', 2),
(3, 2, 'Mirpur Zone', 'Mirpur 1-14 Area', 2)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `sub_areas` (`sub_area_id`, `tenant_id`, `service_area_id`, `name`, `description`) VALUES
(1, 2, 1, 'Road 27 & Shatmasjid Road', 'Commercial and Residential'),
(2, 2, 1, 'Road 15 / 8A', 'Residential Area'),
(3, 2, 2, 'Gulshan 1 Circle', 'Corporate Hub')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Reseller Plan Permissions (Demonstrating Upper -> Lower Commission % Cap Rule)
-- Reseller 3 (POP): 30% profit percent
INSERT INTO `reseller_plan_permission` (`tenant_id`, `user_id`, `access_profile_id`, `sell_price`, `pop_profit`, `pop_profit_percent`, `is_allowed`) VALUES
(2, 3, 1, 500.00, 150.00, 30.00, 1),
(2, 3, 2, 800.00, 240.00, 30.00, 1),
(2, 3, 3, 1500.00, 450.00, 30.00, 1),
-- Sub-Reseller 4 (Dealer): 25% profit percent (<= parent 30%)
(2, 4, 1, 500.00, 125.00, 25.00, 1),
(2, 4, 2, 800.00, 200.00, 25.00, 1),
(2, 4, 3, 1500.00, 375.00, 25.00, 1),
-- Agent 5: 15% profit percent (<= parent 25%)
(2, 5, 1, 500.00, 75.00, 15.00, 1),
(2, 5, 2, 800.00, 120.00, 15.00, 1),
(2, 5, 3, 1500.00, 225.00, 15.00, 1)
ON DUPLICATE KEY UPDATE `pop_profit_percent` = VALUES(`pop_profit_percent`);

-- Reseller Wallet Credits
INSERT INTO `reseller_ledger` (`tenant_id`, `user_id`, `debit`, `credit`, `reference_type`, `notes`, `created_by`) VALUES
(2, 3, 0.00, 25000.00, 'ADMIN_TOPUP', 'Initial POP Wallet Recharge', 2),
(2, 4, 0.00, 10000.00, 'RESELLER_TOPUP', 'Dealer Wallet Allocation', 3),
(2, 5, 0.00, 3000.00, 'SUBRESELLER_TOPUP', 'Agent Petty Cash', 4);

-- Sample Customers
INSERT INTO `customers` (`customer_id`, `tenant_id`, `customer_code`, `customer_type`, `full_name`, `email`, `phone`, `installation_address`, `status`, `billing_status`, `connection_date`, `owner_id`, `owner_role`, `owner_role_level`) VALUES
(1, 2, 'CUST000001', 'individual', 'Tanvir Ahmed', 'tanvir@gmail.com', '01711223344', 'House 12, Road 27, Dhanmondi', 'active', 'Paid', '2026-01-01', 2, 'admin', 100),
(2, 2, 'CUST000002', 'individual', 'Sadia Islam', 'sadia@gmail.com', '01822334455', 'Flat 4B, Gulshan 1, Dhaka', 'active', 'Paid', '2026-01-15', 3, 'reseller', 80),
(3, 2, 'CUST000003', 'business', 'Nexus Tech Ltd.', 'info@nexustech.bd', '01933445566', 'Plot 18, Road 15, Dhanmondi', 'active', 'Paid', '2026-02-01', 4, 'sub_reseller', 60),
(4, 2, 'CUST000004', 'individual', 'Mahmudul Hasan', 'mahmud@gmail.com', '01644556677', 'House 5, Mirpur 10, Dhaka', 'pending_activation', 'Pending', '2026-02-10', 5, 'agent', 40)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

-- Customer Services
INSERT INTO `customer_services` (`customer_service_id`, `tenant_id`, `customer_id`, `access_profile_id`, `network_device_id`, `protocol`, `billing_cycle`, `status`, `starts_at`, `expires_at`, `created_by`) VALUES
(1, 2, 1, 2, 1, 'pppoe', 'monthly', 'active', '2026-02-01 00:00:00', '2026-03-03 23:59:59', 2),
(2, 2, 2, 1, 1, 'pppoe', 'monthly', 'active', '2026-02-05 00:00:00', '2026-03-07 23:59:59', 3),
(3, 2, 3, 3, 1, 'pppoe', 'monthly', 'active', '2026-02-01 00:00:00', '2026-03-03 23:59:59', 4)
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- Customer Network Accounts (MikroTik PPPoE Secrets)
INSERT INTO `customer_network_accounts` (`network_account_id`, `tenant_id`, `customer_id`, `network_device_id`, `protocol`, `username`, `password`, `remote_address`, `status`, `is_online`, `current_ip`, `uptime_seconds`, `upload_bytes`, `download_bytes`) VALUES
(1, 2, 1, 1, 'pppoe', 'tanvir_dhn', 'pass123', '10.10.20.101', 'active', 1, '10.10.20.101', 86400, 1073741824, 5368709120),
(2, 2, 2, 1, 1, 'pppoe', 'sadia_gls', 'pass123', '10.10.20.102', 'active', 1, '43200', 524288000, 2147483648),
(3, 2, 3, 1, 1, 'pppoe', 'nexustech', 'pass123', '10.10.20.103', 'active', 0, NULL, 0, 0)
ON DUPLICATE KEY UPDATE `username` = VALUES(`username`);

-- Invoices
INSERT INTO `invoices` (`invoice_id`, `tenant_id`, `customer_id`, `customer_service_id`, `invoice_number`, `invoice_date`, `due_date`, `status`, `subtotal`, `total_amount`, `paid_amount`, `balance_due`, `base_price`, `sell_price`, `commission_percent`, `commission_amount`, `collected_by`) VALUES
(1, 2, 1, 1, 'INV-2026-0001', '2026-02-01', '2026-02-10', 'paid', 800.00, 800.00, 800.00, 0.00, 800.00, 800.00, 0.00, 0.00, 2),
(2, 2, 2, 2, 'INV-2026-0002', '2026-02-05', '2026-02-15', 'paid', 500.00, 500.00, 500.00, 0.00, 500.00, 500.00, 30.00, 150.00, 3),
(3, 2, 3, 3, 'INV-2026-0003', '2026-02-01', '2026-02-10', 'paid', 1500.00, 1500.00, 1500.00, 0.00, 1500.00, 1500.00, 25.00, 375.00, 4)
ON DUPLICATE KEY UPDATE `invoice_number` = VALUES(`invoice_number`);

-- Transactions
INSERT INTO `transactions` (`transaction_id`, `tenant_id`, `customer_id`, `transaction_ref`, `transaction_type`, `amount`, `method`, `initiator_user_id`, `initiator_role`, `collector_user_id`, `description`) VALUES
(1, 2, 1, 'TRX-BKASH-88310', 'GATEWAY_PAYMENT', 800.00, 'bkash', 2, 'admin', 2, 'Monthly bill payment via bKash'),
(2, 2, 2, 'TRX-CASH-99120', 'MANUAL_CASH', 500.00, 'cash', 3, 'reseller', 3, 'Cash payment collected by POP Rafiq'),
(3, 2, 3, 'TRX-BANK-10291', 'MANUAL_CASH', 1500.00, 'bank', 4, 'sub_reseller', 4, 'Corporate billing via cheque/bank')
ON DUPLICATE KEY UPDATE `transaction_ref` = VALUES(`transaction_ref`);

-- SMS Templates
INSERT INTO `sms_templates` (`tenant_id`, `template_key`, `is_enabled`, `body`) VALUES
(2, 'CUSTOMER_WELCOME', 1, 'Dear {{name}}, Welcome to NetFix! Your User: {{username}}, Pass: {{password}}. Help: 01700000001'),
(2, 'BILL_GENERATED', 1, 'Dear {{name}}, Your bill of BDT {{amount}} for {{package}} is due on {{due_date}}. Pay to avoid suspension.'),
(2, 'PAYMENT_CONFIRMATION', 1, 'Thank you {{name}}, we received BDT {{amount}} for bill {{invoice_number}}. Expiry: {{expiry_date}}.'),
(2, 'EXPIRY_ALERT', 1, 'Alert! Dear {{name}}, your Internet account expires on {{expiry_date}}. Please recharge soon.')
ON DUPLICATE KEY UPDATE `body` = VALUES(`body`);

SET FOREIGN_KEY_CHECKS = 1;
