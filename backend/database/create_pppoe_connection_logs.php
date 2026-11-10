<?php
/**
 * NetFix ISP SaaS - Migration: Create pppoe_connection_logs & add syslog_token to network_devices
 */

require_once __DIR__ . '/../config/database.php';

function runPppoeLogsMigration(): void {
    $db = Database::getConnection();

    echo "1. Creating pppoe_connection_logs table...\n";
    $tableSql = "CREATE TABLE IF NOT EXISTS `pppoe_connection_logs` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        `tenant_id` BIGINT UNSIGNED NOT NULL,
        `router_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
        `username` VARCHAR(100) NOT NULL,
        `event_type` ENUM('connected', 'disconnected', 'auth_failed', 'info') NOT NULL,
        `assigned_ip` VARCHAR(45) DEFAULT NULL,
        `caller_mac` VARCHAR(20) DEFAULT NULL,
        `interface_name` VARCHAR(100) DEFAULT NULL,
        `session_time_seconds` INT UNSIGNED DEFAULT NULL,
        `bytes_uploaded` BIGINT UNSIGNED DEFAULT NULL,
        `bytes_downloaded` BIGINT UNSIGNED DEFAULT NULL,
        `disconnect_reason` VARCHAR(255) DEFAULT NULL,
        `raw_message` VARCHAR(500) DEFAULT NULL,
        `logged_at` DATETIME NOT NULL,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`, `logged_at`),
        KEY `idx_tenant_logged` (`tenant_id`, `logged_at` DESC),
        KEY `idx_tenant_user_logged` (`tenant_id`, `username`, `logged_at` DESC),
        KEY `idx_tenant_router_logged` (`tenant_id`, `router_id`, `logged_at` DESC),
        KEY `idx_tenant_event_logged` (`tenant_id`, `event_type`, `logged_at` DESC),
        KEY `idx_caller_mac` (`caller_mac`),
        KEY `idx_assigned_ip` (`assigned_ip`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    $db->exec($tableSql);
    echo "pppoe_connection_logs table verified/created!\n";

    echo "2. Checking syslog_token in network_devices...\n";
    Database::ensureColumn($db, 'network_devices', 'syslog_token', 'VARCHAR(64) DEFAULT NULL UNIQUE');

    // Populate missing tokens for existing routers
    $routers = $db->query("SELECT network_device_id, tenant_id FROM network_devices WHERE (syslog_token IS NULL OR syslog_token = '') AND device_type = 'router'")->fetchAll(PDO::FETCH_ASSOC);
    if (!empty($routers)) {
        $upStmt = $db->prepare("UPDATE network_devices SET syslog_token = :token WHERE network_device_id = :id");
        foreach ($routers as $r) {
            $token = 'RTR_' . $r['tenant_id'] . '_' . $r['network_device_id'] . '_' . substr(bin2hex(random_bytes(4)), 0, 6);
            $upStmt->execute(['token' => $token, 'id' => $r['network_device_id']]);
        }
        echo "Generated syslog_tokens for " . count($routers) . " existing routers.\n";
    }

    echo "Migration completed successfully!\n";
}

if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    runPppoeLogsMigration();
}
