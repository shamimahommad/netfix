-- ========================================================
-- NetFix ISP SaaS - Customer ID Reservation & Lease Table
-- Multi-Tenant & Multi-Admin Concurrency Safe
-- ========================================================

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

