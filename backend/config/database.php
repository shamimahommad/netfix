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

    public static function getConnection(): PDO {
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
                PDO::ATTR_EMULATE_PREPARES   => true,
                PDO::MYSQL_ATTR_MULTI_STATEMENTS => true,
            ];
            self::$instance = new PDO($dsn, $user, $pass, $options);
            self::ensureTables(self::$instance);
            return self::$instance;
        } catch (Throwable $e) {
            // Log real server error to internal logs
            error_log('Database connection error: ' . $e->getMessage());
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(503);
            echo json_encode([
                'success' => false,
                'message' => 'Service temporarily unavailable. Please try again later.',
            ]);
            exit;
        }
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

    public static function ensureTables(PDO $pdo): void {
        static $checked = false;
        if ($checked) return;
        $checked = true;

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
                }
            }
        } catch (Throwable $e) {
            error_log('Database auto-migration warning: ' . $e->getMessage());
        }
    }
}
