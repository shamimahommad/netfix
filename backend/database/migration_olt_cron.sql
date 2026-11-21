-- Migration: OLT Cron Scheduling & Telemetry History Engine
-- Creates olt_cron_runs table and sets default SaaS OLT sync interval

CREATE TABLE IF NOT EXISTS `olt_cron_runs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) unsigned DEFAULT NULL,
  `trigger_type` enum('scheduled','manual','api') NOT NULL DEFAULT 'scheduled',
  `status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
  `total_olts` int(11) NOT NULL DEFAULT 0,
  `synced_olts` int(11) NOT NULL DEFAULT 0,
  `failed_olts` int(11) NOT NULL DEFAULT 0,
  `skipped_olts` int(11) NOT NULL DEFAULT 0,
  `total_onus` int(11) NOT NULL DEFAULT 0,
  `online_onus` int(11) NOT NULL DEFAULT 0,
  `offline_onus` int(11) NOT NULL DEFAULT 0,
  `duration_ms` int(11) NOT NULL DEFAULT 0,
  `error_summary` text DEFAULT NULL,
  `started_at` datetime NOT NULL,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_olt_cron_tenant` (`tenant_id`),
  KEY `idx_olt_cron_status` (`status`),
  KEY `idx_olt_cron_started` (`started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Global SaaS OLT Sync Settings (tenant_id = 0)
INSERT INTO `tenant_settings` (`tenant_id`, `setting_key`, `setting_value`, `created_at`, `updated_at`)
VALUES 
  (0, 'olt_sync_enabled', '1', NOW(), NOW()),
  (0, 'olt_sync_interval', '120', NOW(), NOW()),
  (0, 'olt_sync_timeout', '30', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  `setting_value` = VALUES(`setting_value`),
  `updated_at` = NOW();
