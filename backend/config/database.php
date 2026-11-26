<?php
/**
 * NetFix ISP SaaS - Database Connection using PDO MySQL
 */

function loadEnvFile(string $path): void {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (strpos($line, '=') !== false) {
            list($key, $val) = explode('=', $line, 2);
            $key = trim($key);
            $val = trim($val, " \t\n\r\0\x0B\"'");
            putenv("{$key}={$val}");
            $_ENV[$key] = $val;
            $_SERVER[$key] = $val;
        }
    }
}

loadEnvFile(__DIR__ . '/../../.env');
loadEnvFile(__DIR__ . '/../.env');

class Database {
    private static ?PDO $instance = null;

    public static function tryConnection(): ?PDO {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $host = getenv('DB_HOST') ?: '127.0.0.1';
        $port = getenv('DB_PORT') ?: '3306';
        $db   = getenv('DB_NAME') ?: 'netfix_db';
        $user = getenv('DB_USER') ?: 'root';
        $pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';

        try {
            $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_MULTI_STATEMENTS => false,
            ];
            self::$instance = new PDO($dsn, $user, $pass, $options);
            self::ensureTables(self::$instance);
            return self::$instance;
        } catch (Throwable $e) {
            error_log('Database connection error: ' . $e->getMessage());
            return null;
        }
    }

    public static function getConnection(): PDO {
        $conn = self::tryConnection();
        if ($conn !== null) {
            return $conn;
        }

        header('Content-Type: application/json; charset=utf-8');
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'message' => 'Service temporarily unavailable. Please try again later.',
        ]);
        exit;
    }

    public static function ensureColumn(PDO $pdo, string $table, string $column, string $definition): void {
        try {
            $stmt = $pdo->prepare("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tbl AND COLUMN_NAME = :col LIMIT 1");
            $stmt->execute(['tbl' => $table, 'col' => $column]);
            if (!$stmt->fetchColumn()) {
                $pdo->exec("ALTER TABLE `{$table}` ADD `{$column}` {$definition}");
            }
        } catch (Throwable $e) {
            // Silently ignore if already exists or permission restricted
        }
    }

    public static function ensureIndex(PDO $pdo, string $table, string $indexName, string $columns): void {
        try {
            $stmt = $pdo->prepare("SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tbl AND INDEX_NAME = :idx LIMIT 1");
            $stmt->execute(['tbl' => $table, 'idx' => $indexName]);
            if (!$stmt->fetchColumn()) {
                $pdo->exec("ALTER TABLE `{$table}` ADD INDEX `{$indexName}` ({$columns})");
            }
        } catch (Throwable $e) {
            // Silently ignore if already exists or permission restricted
        }
    }

    public static function ensureTables(PDO $pdo, bool $force = false): void {
        static $checked = false;
        if ($checked && !$force) return;
        $checked = true;

        $cacheKey = md5((getenv('DB_HOST') ?: '127.0.0.1') . '|' . (getenv('DB_PORT') ?: '3306') . '|' . (getenv('DB_NAME') ?: 'netfix_db') . '|' . (@filemtime(__FILE__) ?: 0));
        $markerFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'netfix_schema_' . $cacheKey . '.ok';
        if (!$force && @file_exists($markerFile)) {
            return;
        }

        try {
            // Always ensure critical auxiliary tables exist even if main schema was already imported
            $pdo->exec("CREATE TABLE IF NOT EXISTS `customer_id_reservations` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // Ensure high-throughput pppoe_connection_logs table
            $pdo->exec("CREATE TABLE IF NOT EXISTS `pppoe_connection_logs` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // Ensure company profile columns on tenants
            self::ensureColumn($pdo, 'tenants', 'support_phone', 'VARCHAR(50) DEFAULT NULL');
            self::ensureColumn($pdo, 'tenants', 'logo_url', 'VARCHAR(255) DEFAULT NULL');
            self::ensureColumn($pdo, 'tenants', 'metadata', 'LONGTEXT DEFAULT NULL');

            // Ensure payment_gateway_settings table
            $pdo->exec("CREATE TABLE IF NOT EXISTS `payment_gateway_settings` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `tenant_id` BIGINT UNSIGNED NOT NULL,
                `gateway` VARCHAR(50) NOT NULL,
                `app_key` VARCHAR(255) DEFAULT NULL,
                `app_secret` VARCHAR(255) DEFAULT NULL,
                `username` VARCHAR(100) DEFAULT NULL,
                `password` VARCHAR(255) DEFAULT NULL,
                `api_context_root` VARCHAR(255) DEFAULT NULL,
                `is_sandbox` TINYINT(1) NOT NULL DEFAULT 1,
                `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uq_tenant_gateway` (`tenant_id`, `gateway`),
                KEY `idx_pgw_tenant` (`tenant_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // Ensure payment_intents table
            $pdo->exec("CREATE TABLE IF NOT EXISTS `payment_intents` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `tenant_id` BIGINT UNSIGNED NOT NULL,
                `customer_id` BIGINT UNSIGNED DEFAULT NULL,
                `invoice_id` BIGINT UNSIGNED DEFAULT NULL,
                `amount` DECIMAL(15,2) NOT NULL,
                `gateway` VARCHAR(50) NOT NULL,
                `gateway_payment_id` VARCHAR(150) DEFAULT NULL,
                `transaction_ref` VARCHAR(100) DEFAULT NULL,
                `status` ENUM('initiated','completed','failed','cancelled') NOT NULL DEFAULT 'initiated',
                `metadata` TEXT DEFAULT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_pi_tenant` (`tenant_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // Ensure billing_cron_runs table
            $pdo->exec("CREATE TABLE IF NOT EXISTS `billing_cron_runs` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // Ensure olt_cron_runs table
            $pdo->exec("CREATE TABLE IF NOT EXISTS `olt_cron_runs` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `tenant_id` BIGINT UNSIGNED DEFAULT NULL,
                `trigger_type` ENUM('scheduled','manual','api') NOT NULL DEFAULT 'scheduled',
                `status` ENUM('running','completed','failed') NOT NULL DEFAULT 'running',
                `total_olts` INT(11) NOT NULL DEFAULT 0,
                `synced_olts` INT(11) NOT NULL DEFAULT 0,
                `failed_olts` INT(11) NOT NULL DEFAULT 0,
                `skipped_olts` INT(11) NOT NULL DEFAULT 0,
                `total_onus` INT(11) NOT NULL DEFAULT 0,
                `online_onus` INT(11) NOT NULL DEFAULT 0,
                `offline_onus` INT(11) NOT NULL DEFAULT 0,
                `duration_ms` INT(11) NOT NULL DEFAULT 0,
                `error_summary` TEXT DEFAULT NULL,
                `started_at` DATETIME NOT NULL,
                `completed_at` DATETIME DEFAULT NULL,
                PRIMARY KEY (`id`),
                KEY `idx_olt_cron_tenant` (`tenant_id`),
                KEY `idx_olt_cron_status` (`status`),
                KEY `idx_olt_cron_started` (`started_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // Ensure can_debit_balance permission exists in permissions table if table exists
            try {
                $pdo->exec("INSERT IGNORE INTO `permissions` (`permission_code`, `permission_name`, `module`, `description`) 
                    VALUES ('can_debit_balance', 'Debit Downline Balance', 'reseller', 'Permission to manually debit balance from downline resellers and agents')");
            } catch (Throwable $ignored) {}

            // Ensure transactions support UNMATCHED_PAYMENT
            try {
                $pdo->exec("ALTER TABLE `transactions` MODIFY COLUMN `transaction_type` VARCHAR(50) NOT NULL DEFAULT 'GATEWAY_PAYMENT'");
            } catch (Throwable $ignored) {}

            self::ensureColumn($pdo, 'payment_gateway_settings', 'api_context_root', 'VARCHAR(255) DEFAULT NULL');

            // Ensure sms_gateway_settings table
            $pdo->exec("CREATE TABLE IF NOT EXISTS `sms_gateway_settings` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `tenant_id` BIGINT UNSIGNED NOT NULL,
                `provider` VARCHAR(50) NOT NULL DEFAULT 'mim_sms',
                `api_key` VARCHAR(255) DEFAULT NULL,
                `sender_id` VARCHAR(100) DEFAULT NULL,
                `balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_sms_gw_tenant` (`tenant_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            self::ensureColumn($pdo, 'sms_gateway_settings', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

            // Ensure sms_log table
            $pdo->exec("CREATE TABLE IF NOT EXISTS `sms_log` (
                `sms_log_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `tenant_id` BIGINT UNSIGNED NOT NULL,
                `provider_name` VARCHAR(100) NOT NULL,
                `to_number` VARCHAR(20) NOT NULL,
                `message` TEXT NOT NULL,
                `status` VARCHAR(20) NOT NULL,
                `sms_type` VARCHAR(50) DEFAULT NULL,
                `trxn_id` VARCHAR(100) DEFAULT NULL,
                `error_message` VARCHAR(500) DEFAULT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`sms_log_id`),
                KEY `idx_sms_log_tenant` (`tenant_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // Ensure sms_templates table
            $pdo->exec("CREATE TABLE IF NOT EXISTS `sms_templates` (
                `sms_template_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `tenant_id` BIGINT UNSIGNED NOT NULL,
                `template_key` VARCHAR(80) NOT NULL,
                `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
                `body` TEXT NOT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`sms_template_id`),
                UNIQUE KEY `uk_tenant_tpl_key` (`tenant_id`, `template_key`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // Ensure syslog_token on network_devices
            self::ensureColumn($pdo, 'network_devices', 'syslog_token', 'VARCHAR(64) DEFAULT NULL UNIQUE');

            // Ensure critical columns in customer_network_accounts
            self::ensureColumn($pdo, 'customer_network_accounts', 'last_disconnect_reason', 'VARCHAR(100) DEFAULT NULL');
            self::ensureColumn($pdo, 'customer_network_accounts', 'last_offline_at', 'DATETIME DEFAULT NULL');
            self::ensureColumn($pdo, 'customer_network_accounts', 'last_online_at', 'DATETIME DEFAULT NULL');
            self::ensureColumn($pdo, 'customer_network_accounts', 'device_vendor', 'VARCHAR(255) DEFAULT NULL');
            self::ensureColumn($pdo, 'customer_network_accounts', 'vendor_source', 'VARCHAR(50) DEFAULT NULL');
            self::ensureColumn($pdo, 'customer_network_accounts', 'uptime_seconds', 'INT(11) DEFAULT 0');

            // Ensure critical columns in customers
            self::ensureColumn($pdo, 'customers', 'customer_type', "ENUM('individual', 'business') DEFAULT 'individual'");
            self::ensureColumn($pdo, 'customers', 'billing_status', "ENUM('Paid','Due','Expired','Left','Suspended','Pending') DEFAULT 'Paid'");
            self::ensureColumn($pdo, 'customers', 'connection_date', 'DATE DEFAULT NULL');
            self::ensureColumn($pdo, 'customers', 'credit_limit', 'DECIMAL(15,2) DEFAULT 0.00');
            self::ensureColumn($pdo, 'customers', 'metadata', 'LONGTEXT DEFAULT NULL');
            self::ensureColumn($pdo, 'customers', 'internal_notes', 'TEXT DEFAULT NULL');
            self::ensureColumn($pdo, 'customers', 'owner_id', 'BIGINT(20) UNSIGNED DEFAULT NULL');
            self::ensureColumn($pdo, 'customers', 'owner_role', 'VARCHAR(50) DEFAULT NULL');
            self::ensureColumn($pdo, 'customers', 'owner_role_level', 'INT(11) DEFAULT NULL');
            self::ensureColumn($pdo, 'customers', 'owner_path', 'VARCHAR(255) DEFAULT NULL');

            // Ensure high performance composite indexes for Materialized Path hierarchy queries
            self::ensureIndex($pdo, 'customers', 'idx_cust_tenant_owner_path', '`tenant_id`, `owner_path`');
            self::ensureIndex($pdo, 'customers', 'idx_cust_tenant_owner', '`tenant_id`, `owner_id`');
            self::ensureIndex($pdo, 'users', 'idx_users_tenant_hierarchy', '`tenant_id`, `hierarchy_path`');

            // Ensure critical columns in access_profiles
            self::ensureColumn($pdo, 'access_profiles', 'color_hex', "VARCHAR(20) NOT NULL DEFAULT '#2563EB'");
            self::ensureColumn($pdo, 'access_profiles', 'download_speed_kbps', 'INT(10) UNSIGNED NOT NULL DEFAULT 10240');
            self::ensureColumn($pdo, 'access_profiles', 'upload_speed_kbps', 'INT(10) UNSIGNED NOT NULL DEFAULT 10240');
            self::ensureColumn($pdo, 'access_profiles', 'validity_days', 'INT(10) UNSIGNED NOT NULL DEFAULT 30');
            self::ensureColumn($pdo, 'access_profiles', 'validity_hours', 'INT(10) UNSIGNED NOT NULL DEFAULT 0');
            self::ensureColumn($pdo, 'access_profiles', 'data_volume_type', "ENUM('unlimited','gb') NOT NULL DEFAULT 'unlimited'");
            self::ensureColumn($pdo, 'access_profiles', 'data_volume_gb', 'INT(10) UNSIGNED DEFAULT NULL');
            self::ensureColumn($pdo, 'access_profiles', 'mikrotik_profile_id', 'VARCHAR(200) DEFAULT NULL');
            self::ensureColumn($pdo, 'access_profiles', 'mikrotik_profile_name', 'VARCHAR(200) DEFAULT NULL');

            // Ensure FTTH Splitter/Box Tables
            $pdo->exec("CREATE TABLE IF NOT EXISTS `ftth_boxes` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `tenant_id` BIGINT UNSIGNED NOT NULL,
                `box_name` VARCHAR(100) NOT NULL,
                `box_code` VARCHAR(50) NOT NULL,
                `box_type` ENUM('splitter_box', 'tj_box', 'odf', 'pole_box') NOT NULL DEFAULT 'splitter_box',
                `latitude` DECIMAL(10, 8) NOT NULL,
                `longitude` DECIMAL(11, 8) NOT NULL,
                `address` VARCHAR(255) DEFAULT NULL,
                `pole_number` VARCHAR(50) DEFAULT NULL,
                `total_ports` INT UNSIGNED NOT NULL DEFAULT 8,
                `splitter_ratio` VARCHAR(20) NOT NULL DEFAULT '1:8',
                `olt_device_id` BIGINT UNSIGNED DEFAULT NULL,
                `pon_port` VARCHAR(50) DEFAULT NULL,
                `upstream_box_id` BIGINT UNSIGNED DEFAULT NULL,
                `optical_input_power` DECIMAL(5,2) DEFAULT NULL,
                `status` ENUM('active', 'full', 'maintenance', 'damaged') NOT NULL DEFAULT 'active',
                `notes` TEXT DEFAULT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uk_tenant_box_code` (`tenant_id`, `box_code`),
                KEY `idx_ftth_box_tenant` (`tenant_id`),
                KEY `idx_ftth_box_location` (`latitude`, `longitude`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            $pdo->exec("CREATE TABLE IF NOT EXISTS `ftth_box_ports` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `tenant_id` BIGINT UNSIGNED NOT NULL,
                `box_id` BIGINT UNSIGNED NOT NULL,
                `port_number` INT UNSIGNED NOT NULL,
                `customer_id` BIGINT UNSIGNED DEFAULT NULL,
                `onu_mac` VARCHAR(30) DEFAULT NULL,
                `optical_rx_power` DECIMAL(5,2) DEFAULT NULL,
                `status` ENUM('available', 'occupied', 'reserved', 'damaged') NOT NULL DEFAULT 'available',
                `cable_color` VARCHAR(30) DEFAULT NULL,
                `core_number` INT UNSIGNED DEFAULT NULL,
                `notes` VARCHAR(255) DEFAULT NULL,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uk_box_port` (`box_id`, `port_number`),
                KEY `idx_port_tenant` (`tenant_id`),
                KEY `idx_port_customer` (`customer_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            $pdo->exec("CREATE TABLE IF NOT EXISTS `ftth_cables` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `tenant_id` BIGINT UNSIGNED NOT NULL,
                `cable_name` VARCHAR(100) NOT NULL,
                `core_count` INT UNSIGNED NOT NULL DEFAULT 12,
                `from_type` ENUM('olt', 'box', 'noc') NOT NULL DEFAULT 'olt',
                `from_id` BIGINT UNSIGNED DEFAULT NULL,
                `from_noc_id` BIGINT UNSIGNED DEFAULT NULL,
                `to_box_id` BIGINT UNSIGNED NOT NULL,
                `color` VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
                `length_meters` INT UNSIGNED DEFAULT NULL,
                `status` ENUM('active', 'cut', 'high_loss', 'maintenance') NOT NULL DEFAULT 'active',
                `route_coords` JSON DEFAULT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_ftth_cable_tenant` (`tenant_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // Ensure FTTH NOC / Office Stations Table
            $pdo->exec("CREATE TABLE IF NOT EXISTS `ftth_noc_stations` (
                `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                `tenant_id` BIGINT UNSIGNED NOT NULL,
                `name` VARCHAR(100) NOT NULL,
                `station_type` ENUM('main_office', 'sub_pop', 'server_room') NOT NULL DEFAULT 'main_office',
                `latitude` DECIMAL(10, 8) NOT NULL,
                `longitude` DECIMAL(11, 8) NOT NULL,
                `address` VARCHAR(255) DEFAULT NULL,
                `contact_phone` VARCHAR(50) DEFAULT NULL,
                `coverage_radius_km` DECIMAL(5, 2) DEFAULT 5.00,
                `notes` TEXT DEFAULT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_noc_tenant` (`tenant_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            self::ensureColumn($pdo, 'network_devices', 'noc_station_id', 'BIGINT UNSIGNED DEFAULT NULL');
            self::ensureColumn($pdo, 'network_devices', 'latitude', 'DECIMAL(10, 8) DEFAULT NULL');
            self::ensureColumn($pdo, 'network_devices', 'longitude', 'DECIMAL(11, 8) DEFAULT NULL');
            self::ensureColumn($pdo, 'network_devices', 'address', 'VARCHAR(255) DEFAULT NULL');
            self::ensureColumn($pdo, 'ftth_cables', 'from_noc_id', 'BIGINT UNSIGNED DEFAULT NULL');

            // Ensure BTRC reporting columns on customers
            self::ensureColumn($pdo, 'customers', 'btrc_category', "ENUM('home', 'corporate', 'sme', 'cyber_cafe', 'institutional') NOT NULL DEFAULT 'home'");
            self::ensureColumn($pdo, 'customers', 'connectivity_type', "ENUM('fiber', 'wireless', 'copper') NOT NULL DEFAULT 'fiber'");
            self::ensureColumn($pdo, 'customers', 'division', 'VARCHAR(100) DEFAULT NULL');
            self::ensureColumn($pdo, 'customers', 'district', 'VARCHAR(100) DEFAULT NULL');
            self::ensureColumn($pdo, 'customers', 'thana', 'VARCHAR(100) DEFAULT NULL');
            self::ensureColumn($pdo, 'customers', 'distribution_point', "VARCHAR(100) DEFAULT 'NOC'");
            self::ensureColumn($pdo, 'customers', 'connectivity_sharing', "ENUM('Shared', 'Dedicated') NOT NULL DEFAULT 'Shared'");
            self::ensureIndex($pdo, 'customers', 'idx_cust_btrc_cat', 'tenant_id, btrc_category');

            // Check if users table exists in the current database
            $stmt = $pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users' LIMIT 1");
            if ($stmt && $stmt->fetchColumn()) {
                // Ensure multi-tier reseller tables exist if missing
                try {
                    $tierCheck = $pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'tier_packages' LIMIT 1");
                    if (!$tierCheck || !$tierCheck->fetchColumn()) {
                        $migFile = __DIR__ . '/../database/run_multi_tier_migration.php';
                        if (file_exists($migFile)) {
                            require_once $migFile;
                        }
                    }

                    $ledgerCheck = $pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'wallet_ledger' LIMIT 1");
                    if (!$ledgerCheck || !$ledgerCheck->fetchColumn()) {
                        $ledgerMig = __DIR__ . '/../database/run_payment_split_migration.php';
                        if (file_exists($ledgerMig)) {
                            require_once $ledgerMig;
                        }
                    }
                } catch (Throwable $t) {
                    error_log('Multi-tier tables ensure notice: ' . $t->getMessage());
                }
                @file_put_contents($markerFile, (string)time());
                return; // Core tables already exist!
            }

            // Tables missing - locate schema.sql
            $paths = [
                __DIR__ . '/../database/schema.sql',
                '/var/www/html/backend/database/schema.sql',
                dirname(__DIR__, 2) . '/backend/database/schema.sql',
            ];
            $schemaFile = null;
            foreach ($paths as $p) {
                if (file_exists($p)) {
                    $schemaFile = $p;
                    break;
                }
            }

            if ($schemaFile && file_exists($schemaFile)) {
                $sql = file_get_contents($schemaFile);
                if ($sql) {
                    $pdo->exec("SET FOREIGN_KEY_CHECKS=0;");
                    try {
                        $pdo->exec($sql);
                    } catch (Throwable $multiErr) {
                        // Split queries if multi-statement execution throws
                        $queries = preg_split('/;\s*[\r\n]+/', $sql);
                        foreach ($queries as $query) {
                            $query = trim($query);
                            if ($query !== '' && !str_starts_with($query, '--') && !str_starts_with($query, '/*')) {
                                try {
                                    $pdo->exec($query);
                                } catch (Throwable $ignored) {}
                            }
                        }
                    }
                    $pdo->exec("SET FOREIGN_KEY_CHECKS=1;");
                    @file_put_contents($markerFile, (string)time());
                }
            }
        } catch (Throwable $e) {
            error_log('Database auto-migration warning: ' . $e->getMessage());
        }
    }
}
