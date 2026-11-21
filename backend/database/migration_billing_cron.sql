-- ========================================================
-- NetFix ISP SaaS - Migration: Auto-Cutoff & Billing Cron Engine
-- ========================================================

CREATE TABLE IF NOT EXISTS `billing_cron_runs` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `tenant_id` BIGINT UNSIGNED NULL,
    `trigger_type` ENUM('scheduled', 'manual', 'api') NOT NULL DEFAULT 'scheduled',
    `status` ENUM('running', 'completed', 'failed') NOT NULL DEFAULT 'running',
    `expired_processed` INT UNSIGNED NOT NULL DEFAULT 0,
    `mikrotik_disabled` INT UNSIGNED NOT NULL DEFAULT 0,
    `mikrotik_restored` INT UNSIGNED NOT NULL DEFAULT 0,
    `invoices_generated` INT UNSIGNED NOT NULL DEFAULT 0,
    `sms_sent` INT UNSIGNED NOT NULL DEFAULT 0,
    `error_count` INT UNSIGNED NOT NULL DEFAULT 0,
    `details` JSON NULL,
    `duration_ms` INT UNSIGNED NOT NULL DEFAULT 0,
    `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `completed_at` DATETIME NULL,
    INDEX `idx_tenant_started` (`tenant_id`, `started_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
