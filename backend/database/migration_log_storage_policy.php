<?php
/**
 * NetFix ISP SaaS - Migration: Add Log Storage Policy to tenants table
 * Supports Redis (Short-Term Live Ephemeral) & VictoriaLogs (Long-Term Compressed Storage)
 */

require_once __DIR__ . '/../config/database.php';

try {
    $db = Database::getConnection();
    echo "Running migration: Add Log Storage Policy to `tenants`...\n";

    // Check existing columns
    $stmt = $db->query("SHOW COLUMNS FROM `tenants` LIKE 'log_storage_mode'");
    $hasCol = $stmt->fetch();

    if (!$hasCol) {
        $sql = "ALTER TABLE `tenants` 
                ADD COLUMN `log_storage_mode` ENUM('short_term_redis', 'long_term_victoria', 'disabled') NOT NULL DEFAULT 'short_term_redis' AFTER `metadata`,
                ADD COLUMN `log_retention_days` INT UNSIGNED NOT NULL DEFAULT 1 AFTER `log_storage_mode`,
                ADD COLUMN `max_live_logs` INT UNSIGNED NOT NULL DEFAULT 1000 AFTER `log_retention_days`";
        $db->exec($sql);
        echo "[SUCCESS] Added log_storage_mode, log_retention_days, max_live_logs to `tenants` table.\n";
    } else {
        echo "[INFO] `log_storage_mode` already exists in `tenants` table.\n";
    }

    echo "Migration completed successfully.\n";
} catch (\Throwable $e) {
    echo "[ERROR] Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}

