-- =====================================================================
-- ISP BILLING & BANDWIDTH MANAGEMENT SAAS - MySQL DATABASE SCHEMA
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `ispsaas_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `ispsaas_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tenants (ISP Companies on SaaS)
DROP TABLE IF EXISTS `tenants`;
CREATE TABLE `tenants` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `subdomain` VARCHAR(100) NOT NULL UNIQUE,
  `contact_name` VARCHAR(100) DEFAULT NULL,
  `contact_phone` VARCHAR(30) DEFAULT NULL,
  `contact_email` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `status` ENUM('ACTIVE', 'SUSPENDED', 'TRIAL') DEFAULT 'ACTIVE',
  `subscription_plan` ENUM('TRIAL', 'BASIC', 'PRO', 'ENTERPRISE') DEFAULT 'BASIC',
  `billing_cycle` VARCHAR(20) DEFAULT 'MONTHLY',
  `max_subscribers` INT DEFAULT 1000,
  `max_routers` INT DEFAULT 5,
  `sms_balance` INT DEFAULT 100,
  `sms_masking` VARCHAR(50) DEFAULT NULL,
  `logo_url` VARCHAR(255) DEFAULT NULL,
  `custom_domain` VARCHAR(150) DEFAULT NULL UNIQUE,
  `brand_color` VARCHAR(20) DEFAULT '#4f46e5',
  `currency` VARCHAR(10) DEFAULT '৳',
  `support_phone` VARCHAR(30) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Users (Super Admin, ISP Admin, Staff, Reseller, Technician, Collector)
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` VARCHAR(36) PRIMARY KEY,
  `tenant_id` VARCHAR(36) DEFAULT NULL,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `phone` VARCHAR(30) DEFAULT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('SUPER_ADMIN', 'ISP_ADMIN', 'MANAGER', 'BILL_COLLECTOR', 'TECHNICIAN', 'RESELLER', 'SUBSCRIBER') DEFAULT 'MANAGER',
  `status` ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  `reseller_id` VARCHAR(36) DEFAULT NULL,
  `permissions` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. MikroTik Routers (NAS)
DROP TABLE IF EXISTS `mikrotik_routers`;
CREATE TABLE `mikrotik_routers` (
  `id` VARCHAR(36) PRIMARY KEY,
  `tenant_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `ip_address` VARCHAR(50) NOT NULL,
  `api_port` INT DEFAULT 8728,
  `username` VARCHAR(50) NOT NULL,
  `password` VARCHAR(100) NOT NULL,
  `connection_type` ENUM('DIRECT_API', 'CLOUD_TUNNEL', 'RADIUS') DEFAULT 'DIRECT_API',
  `status` ENUM('ONLINE', 'OFFLINE', 'UNREACHABLE') DEFAULT 'OFFLINE',
  `ros_version` VARCHAR(50) DEFAULT NULL,
  `board_name` VARCHAR(100) DEFAULT NULL,
  `cpu_load` INT DEFAULT 0,
  `uptime` VARCHAR(100) DEFAULT NULL,
  `total_memory` BIGINT DEFAULT 0,
  `free_memory` BIGINT DEFAULT 0,
  `last_synced_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bandwidth Packages
DROP TABLE IF EXISTS `packages`;
CREATE TABLE `packages` (
  `id` VARCHAR(36) PRIMARY KEY,
  `tenant_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) DEFAULT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `validity_days` INT DEFAULT 30,
  `download_speed` INT DEFAULT 10,
  `upload_speed` INT DEFAULT 10,
  `rate_limit` VARCHAR(50) DEFAULT '10M/10M',
  `mikrotik_profile` VARCHAR(100) DEFAULT NULL,
  `pool_name` VARCHAR(100) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Resellers
DROP TABLE IF EXISTS `resellers`;
CREATE TABLE `resellers` (
  `id` VARCHAR(36) PRIMARY KEY,
  `tenant_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `mobile` VARCHAR(30) NOT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `area` VARCHAR(100) DEFAULT NULL,
  `balance` DECIMAL(12,2) DEFAULT 0.00,
  `commission_rate` DECIMAL(5,2) DEFAULT 0.00,
  `credit_limit` DECIMAL(12,2) DEFAULT 0.00,
  `status` ENUM('ACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Subscribers (Customers)
DROP TABLE IF EXISTS `subscribers`;
CREATE TABLE `subscribers` (
  `id` VARCHAR(36) PRIMARY KEY,
  `tenant_id` VARCHAR(36) NOT NULL,
  `customer_code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `mobile` VARCHAR(30) NOT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `zone` VARCHAR(100) DEFAULT NULL,
  `sub_zone` VARCHAR(100) DEFAULT NULL,
  `box_number` VARCHAR(50) DEFAULT NULL,
  `connection_type` ENUM('PPPOE', 'STATIC', 'HOTSPOT') DEFAULT 'PPPOE',
  `pppoe_username` VARCHAR(100) NOT NULL,
  `pppoe_password` VARCHAR(100) NOT NULL,
  `ip_address` VARCHAR(50) DEFAULT NULL,
  `mac_address` VARCHAR(50) DEFAULT NULL,
  `package_id` VARCHAR(36) NOT NULL,
  `router_id` VARCHAR(36) DEFAULT NULL,
  `monthly_fee` DECIMAL(10,2) NOT NULL,
  `discount` DECIMAL(10,2) DEFAULT 0.00,
  `billing_type` ENUM('PREPAID', 'POSTPAID') DEFAULT 'PREPAID',
  `billing_cycle_day` INT DEFAULT 1,
  `joined_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `expiry_date` DATETIME NOT NULL,
  `status` ENUM('ACTIVE', 'EXPIRED', 'SUSPENDED', 'PENDING', 'LEFT') DEFAULT 'ACTIVE',
  `reseller_id` VARCHAR(36) DEFAULT NULL,
  `nid` VARCHAR(50) DEFAULT NULL,
  `auto_disable` TINYINT(1) DEFAULT 1,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`),
  FOREIGN KEY (`router_id`) REFERENCES `mikrotik_routers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`reseller_id`) REFERENCES `resellers`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `idx_tenant_sub_pppoe` (`tenant_id`, `pppoe_username`),
  UNIQUE KEY `idx_tenant_sub_code` (`tenant_id`, `customer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Invoices
DROP TABLE IF EXISTS `invoices`;
CREATE TABLE `invoices` (
  `id` VARCHAR(36) PRIMARY KEY,
  `tenant_id` VARCHAR(36) NOT NULL,
  `invoice_no` VARCHAR(50) NOT NULL,
  `subscriber_id` VARCHAR(36) NOT NULL,
  `package_id` VARCHAR(36) DEFAULT NULL,
  `billing_month` VARCHAR(20) NOT NULL, -- e.g. '2026-10'
  `amount` DECIMAL(10,2) NOT NULL,
  `discount` DECIMAL(10,2) DEFAULT 0.00,
  `payable_amount` DECIMAL(10,2) NOT NULL,
  `paid_amount` DECIMAL(10,2) DEFAULT 0.00,
  `due_amount` DECIMAL(10,2) DEFAULT 0.00,
  `status` ENUM('UNPAID', 'PAID', 'PARTIAL', 'CANCELLED') DEFAULT 'UNPAID',
  `due_date` DATETIME NOT NULL,
  `paid_at` DATETIME DEFAULT NULL,
  `payment_method` VARCHAR(50) DEFAULT NULL,
  `collected_by_id` VARCHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`collected_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `idx_tenant_invoice_no` (`tenant_id`, `invoice_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Payments
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` VARCHAR(36) PRIMARY KEY,
  `tenant_id` VARCHAR(36) NOT NULL,
  `invoice_id` VARCHAR(36) NOT NULL,
  `subscriber_id` VARCHAR(36) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `payment_method` VARCHAR(50) DEFAULT 'CASH',
  `transaction_id` VARCHAR(100) DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `collected_by_id` VARCHAR(36) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`collected_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Hotspot Vouchers
DROP TABLE IF EXISTS `hotspot_vouchers`;
CREATE TABLE `hotspot_vouchers` (
  `id` VARCHAR(36) PRIMARY KEY,
  `tenant_id` VARCHAR(36) NOT NULL,
  `batch_code` VARCHAR(50) NOT NULL,
  `voucher_code` VARCHAR(50) NOT NULL,
  `pin` VARCHAR(50) NOT NULL,
  `package_id` VARCHAR(36) NOT NULL,
  `router_id` VARCHAR(36) DEFAULT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `time_limit` VARCHAR(50) DEFAULT NULL,
  `data_limit` VARCHAR(50) DEFAULT NULL,
  `status` ENUM('ACTIVE', 'USED', 'EXPIRED') DEFAULT 'ACTIVE',
  `used_by_mac` VARCHAR(50) DEFAULT NULL,
  `used_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`),
  FOREIGN KEY (`router_id`) REFERENCES `mikrotik_routers`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `idx_tenant_voucher` (`tenant_id`, `voucher_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Support Tickets (CRM)
DROP TABLE IF EXISTS `tickets`;
CREATE TABLE `tickets` (
  `id` VARCHAR(36) PRIMARY KEY,
  `tenant_id` VARCHAR(36) NOT NULL,
  `ticket_no` VARCHAR(50) NOT NULL,
  `subscriber_id` VARCHAR(36) NOT NULL,
  `category` ENUM('FIBER_CUT', 'ROUTER_PROBLEM', 'SLOW_SPEED', 'ONU_PROBLEM', 'BILLING_ISSUE', 'OTHER') DEFAULT 'FIBER_CUT',
  `subject` VARCHAR(200) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
  `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') DEFAULT 'OPEN',
  `assigned_to_id` VARCHAR(36) DEFAULT NULL,
  `resolution_notes` TEXT DEFAULT NULL,
  `resolved_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `idx_tenant_ticket_no` (`tenant_id`, `ticket_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Fiber Boxes (FTTH / Optical Network)
DROP TABLE IF EXISTS `fiber_boxes`;
CREATE TABLE `fiber_boxes` (
  `id` VARCHAR(36) PRIMARY KEY,
  `tenant_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) DEFAULT NULL,
  `type` ENUM('OLT', 'PON_PORT', 'SPLITTER', 'TJ_BOX') DEFAULT 'TJ_BOX',
  `area` VARCHAR(100) DEFAULT NULL,
  `capacity` INT DEFAULT 8,
  `used_ports` INT DEFAULT 0,
  `core_color` VARCHAR(50) DEFAULT NULL,
  `latitude` DECIMAL(10,8) DEFAULT NULL,
  `longitude` DECIMAL(11,8) DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. SMS Logs
DROP TABLE IF EXISTS `sms_logs`;
CREATE TABLE `sms_logs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `tenant_id` VARCHAR(36) NOT NULL,
  `subscriber_id` VARCHAR(36) DEFAULT NULL,
  `mobile` VARCHAR(30) NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('BILL_NOTIFICATION', 'PAYMENT_RECEIPT', 'EXPIRY_ALERT', 'PROMOTIONAL', 'OTP') DEFAULT 'BILL_NOTIFICATION',
  `status` ENUM('SENT', 'FAILED', 'DELIVERED') DEFAULT 'SENT',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- INITIAL SEED DATA
-- =====================================================================

-- 1. Demo Tenant
INSERT INTO `tenants` (`id`, `name`, `code`, `subdomain`, `custom_domain`, `contact_name`, `contact_phone`, `contact_email`, `status`, `subscription_plan`, `sms_balance`, `brand_color`, `currency`, `support_phone`)
VALUES ('tenant-cloudnet-001', 'CloudNet Broadband ISP', 'ISP-1001', 'cloudnet', 'billing.cloudnet.bd', 'Shuvo Ahmed', '01711223344', 'admin@cloudnet.bd', 'ACTIVE', 'PRO', 1250, '#4f46e5', '৳', '01711223344');

-- 2. Super Admin & Tenant Users (Password: password123 -> $2y$10$wTqg...)
INSERT INTO `users` (`id`, `tenant_id`, `name`, `email`, `phone`, `password`, `role`, `status`)
VALUES 
('usr-super-01', NULL, 'Super Admin', 'superadmin@ispsaas.com', '01700000000', '$2y$10$K9W8c9j32gEa6N/0aV1OteE5nZ.eQ1hN3qB4iL0wV5rT6kE2x.m9K', 'SUPER_ADMIN', 'ACTIVE'),
('usr-admin-01', 'tenant-cloudnet-001', 'Shuvo Ahmed', 'admin@cloudnet.bd', '01711223344', '$2y$10$K9W8c9j32gEa6N/0aV1OteE5nZ.eQ1hN3qB4iL0wV5rT6kE2x.m9K', 'ISP_ADMIN', 'ACTIVE'),
('usr-collector-01', 'tenant-cloudnet-001', 'Rafiqul Islam (Collector)', 'collector@cloudnet.bd', '01722334455', '$2y$10$K9W8c9j32gEa6N/0aV1OteE5nZ.eQ1hN3qB4iL0wV5rT6kE2x.m9K', 'BILL_COLLECTOR', 'ACTIVE'),
('usr-tech-01', 'tenant-cloudnet-001', 'Sumon Mia (Technician)', 'tech@cloudnet.bd', '01733445566', '$2y$10$K9W8c9j32gEa6N/0aV1OteE5nZ.eQ1hN3qB4iL0wV5rT6kE2x.m9K', 'TECHNICIAN', 'ACTIVE');

-- 3. MikroTik Router
INSERT INTO `mikrotik_routers` (`id`, `tenant_id`, `name`, `ip_address`, `api_port`, `username`, `password`, `status`, `ros_version`, `board_name`, `cpu_load`, `uptime`, `last_synced_at`)
VALUES ('router-01', 'tenant-cloudnet-001', 'Main Gateway (CCR2004-16G-2S+)', '172.16.10.1', 8728, 'api_admin', 'Pass@123', 'ONLINE', '7.15.2 (v7)', 'CCR2004-16G-2S+', 12, '42w 3d 14h', NOW());

-- 4. Packages
INSERT INTO `packages` (`id`, `tenant_id`, `name`, `code`, `price`, `validity_days`, `download_speed`, `upload_speed`, `rate_limit`, `mikrotik_profile`)
VALUES 
('pkg-01', 'tenant-cloudnet-001', '10 Mbps Basic', '10M-BASIC', 500.00, 30, 10, 10, '10M/10M', '10Mbps'),
('pkg-02', 'tenant-cloudnet-001', '20 Mbps Standard', '20M-STD', 800.00, 30, 20, 20, '20M/20M', '20Mbps'),
('pkg-03', 'tenant-cloudnet-001', '35 Mbps Pro Gamer', '35M-PRO', 1200.00, 30, 35, 35, '35M/35M', '35Mbps');

-- 5. Reseller
INSERT INTO `resellers` (`id`, `tenant_id`, `name`, `mobile`, `email`, `area`, `balance`, `commission_rate`, `credit_limit`)
VALUES ('reseller-01', 'tenant-cloudnet-001', 'Rony WiFi & Telecom', '01718969000', 'roni@wifi.bd', 'Sariakandi Sub-Zone', 14500.00, 15.00, 10000.00);

-- 6. Subscribers
INSERT INTO `subscribers` (`id`, `tenant_id`, `customer_code`, `name`, `mobile`, `address`, `zone`, `box_number`, `connection_type`, `pppoe_username`, `pppoe_password`, `package_id`, `router_id`, `monthly_fee`, `expiry_date`, `status`)
VALUES 
('sub-01', 'tenant-cloudnet-001', 'C-100201', 'Kamrul Hassan', '01811223344', 'Flat 4A, Green Villa, Road 4', 'Uttara Sector 7', 'TJ-07-02', 'PPPOE', 'kamrul_uttara', 'pass@123', 'pkg-02', 'router-01', 800.00, DATE_ADD(NOW(), INTERVAL 18 DAY), 'ACTIVE'),
('sub-02', 'tenant-cloudnet-001', 'C-100202', 'Tanvir Rahman', '01922334455', 'House 12, Lake Drive', 'Gulshan 1', 'TJ-G1-04', 'PPPOE', 'tanvir_g1', 'pass@123', 'pkg-03', 'router-01', 1200.00, DATE_ADD(NOW(), INTERVAL 2 DAY), 'ACTIVE'),
('sub-03', 'tenant-cloudnet-001', 'C-100203', 'Monir Hossain', '01733445566', 'Plot 5, Wireless Gate', 'Mohakhali', 'TJ-M-01', 'PPPOE', 'monir_mk', 'pass@123', 'pkg-01', 'router-01', 500.00, DATE_SUB(NOW(), INTERVAL 3 DAY), 'EXPIRED');

-- 7. Invoices & Payments
INSERT INTO `invoices` (`id`, `tenant_id`, `invoice_no`, `subscriber_id`, `package_id`, `billing_month`, `amount`, `payable_amount`, `paid_amount`, `due_amount`, `status`, `due_date`, `paid_at`, `payment_method`)
VALUES 
('inv-01', 'tenant-cloudnet-001', 'INV-202610-100201', 'sub-01', 'pkg-02', '2026-10', 800.00, 800.00, 800.00, 0.00, 'PAID', NOW(), NOW(), 'BKASH'),
('inv-02', 'tenant-cloudnet-001', 'INV-202610-100203', 'sub-03', 'pkg-01', '2026-10', 500.00, 500.00, 0.00, 500.00, 'UNPAID', DATE_SUB(NOW(), INTERVAL 5 DAY), NULL, NULL);

INSERT INTO `payments` (`id`, `tenant_id`, `invoice_id`, `subscriber_id`, `amount`, `payment_method`, `transaction_id`, `notes`)
VALUES ('pay-01', 'tenant-cloudnet-001', 'inv-01', 'sub-01', 800.00, 'BKASH', 'TRX_BKASH_994821', 'Automated bKash payment');

-- 8. Fiber Boxes
INSERT INTO `fiber_boxes` (`id`, `tenant_id`, `name`, `code`, `type`, `area`, `capacity`, `used_ports`, `core_color`)
VALUES 
('box-01', 'tenant-cloudnet-001', 'OLT-Central-01', 'OLT-01', 'OLT', 'Central Server Room', 16, 8, 'Blue'),
('box-02', 'tenant-cloudnet-001', 'TJ-Box-Uttara-07', 'TJ-07', 'TJ_BOX', 'Uttara Sector 7', 16, 12, 'Blue'),
('box-03', 'tenant-cloudnet-001', 'Splitter-Gulshan-04', 'SPL-04', 'SPLITTER', 'Gulshan 1', 8, 6, 'Orange');
