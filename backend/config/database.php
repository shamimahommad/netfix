<?php
/**
 * Smart Database Connection using PDO
 * Connects to MySQL/MariaDB in production;
 * Automatically falls back to SQLite for instant out-of-the-box local development!
 */

// Load .env file if available
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
            if (getenv($key) === false) {
                putenv("{$key}={$val}");
                $_ENV[$key] = $val;
                $_SERVER[$key] = $val;
            }
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
        $db   = getenv('DB_NAME') ?: 'ispsaas_db';
        $user = getenv('DB_USER') ?: 'root';
        $pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';

        // Try MySQL First
        try {
            $dsn = "mysql:host={$host};dbname={$db};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_TIMEOUT            => 1, // Quick 1 second check
            ];
            self::$instance = new PDO($dsn, $user, $pass, $options);
            return self::$instance;
        } catch (Throwable $e) {
            // MySQL not running locally yet -> Use SQLite fallback so app works immediately!
            $sqlitePath = __DIR__ . '/../database/ispsaas.sqlite';
            $isNew = !file_exists($sqlitePath);

            $dsn = "sqlite:" . $sqlitePath;
            self::$instance = new PDO($dsn, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);

            if ($isNew) {
                self::initSqliteTables(self::$instance);
            }

            return self::$instance;
        }
    }

    private static function initSqliteTables(PDO $db): void {
        $db->exec("
            CREATE TABLE IF NOT EXISTS tenants (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                subdomain TEXT NOT NULL UNIQUE,
                custom_domain TEXT UNIQUE,
                brand_color TEXT DEFAULT '#4f46e5',
                currency TEXT DEFAULT '৳',
                support_phone TEXT,
                contact_name TEXT,
                contact_phone TEXT,
                contact_email TEXT,
                status TEXT DEFAULT 'ACTIVE',
                subscription_plan TEXT DEFAULT 'BASIC',
                sms_balance INTEGER DEFAULT 100,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                tenant_id TEXT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'MANAGER',
                status TEXT DEFAULT 'ACTIVE',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS mikrotik_routers (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                name TEXT NOT NULL,
                ip_address TEXT NOT NULL,
                api_port INTEGER DEFAULT 8728,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                status TEXT DEFAULT 'OFFLINE',
                ros_version TEXT,
                board_name TEXT,
                cpu_load INTEGER DEFAULT 0,
                uptime TEXT,
                last_synced_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS packages (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                name TEXT NOT NULL,
                code TEXT,
                price REAL NOT NULL,
                validity_days INTEGER DEFAULT 30,
                download_speed INTEGER DEFAULT 10,
                upload_speed INTEGER DEFAULT 10,
                rate_limit TEXT DEFAULT '10M/10M',
                mikrotik_profile TEXT,
                is_active INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS resellers (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                name TEXT NOT NULL,
                mobile TEXT NOT NULL,
                email TEXT,
                area TEXT,
                balance REAL DEFAULT 0,
                commission_rate REAL DEFAULT 0,
                credit_limit REAL DEFAULT 0,
                status TEXT DEFAULT 'ACTIVE'
            );

            CREATE TABLE IF NOT EXISTS subscribers (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                customer_code TEXT NOT NULL,
                name TEXT NOT NULL,
                mobile TEXT NOT NULL,
                address TEXT,
                zone TEXT,
                box_number TEXT,
                connection_type TEXT DEFAULT 'PPPOE',
                pppoe_username TEXT NOT NULL,
                pppoe_password TEXT NOT NULL,
                package_id TEXT NOT NULL,
                router_id TEXT,
                monthly_fee REAL NOT NULL,
                discount REAL DEFAULT 0,
                expiry_date DATETIME NOT NULL,
                status TEXT DEFAULT 'ACTIVE',
                reseller_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                invoice_no TEXT NOT NULL,
                subscriber_id TEXT NOT NULL,
                package_id TEXT,
                billing_month TEXT NOT NULL,
                amount REAL NOT NULL,
                discount REAL DEFAULT 0,
                payable_amount REAL NOT NULL,
                paid_amount REAL DEFAULT 0,
                due_amount REAL DEFAULT 0,
                status TEXT DEFAULT 'UNPAID',
                due_date DATETIME NOT NULL,
                paid_at DATETIME,
                payment_method TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                invoice_id TEXT NOT NULL,
                subscriber_id TEXT NOT NULL,
                amount REAL NOT NULL,
                payment_method TEXT DEFAULT 'CASH',
                transaction_id TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS hotspot_vouchers (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                batch_code TEXT NOT NULL,
                voucher_code TEXT NOT NULL,
                pin TEXT NOT NULL,
                package_id TEXT NOT NULL,
                price REAL NOT NULL,
                time_limit TEXT,
                data_limit TEXT,
                status TEXT DEFAULT 'ACTIVE',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                ticket_no TEXT NOT NULL,
                subscriber_id TEXT NOT NULL,
                category TEXT DEFAULT 'FIBER_CUT',
                subject TEXT NOT NULL,
                description TEXT,
                priority TEXT DEFAULT 'MEDIUM',
                status TEXT DEFAULT 'OPEN',
                assigned_to_id TEXT,
                resolution_notes TEXT,
                resolved_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS fiber_boxes (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                name TEXT NOT NULL,
                code TEXT,
                type TEXT DEFAULT 'TJ_BOX',
                area TEXT,
                capacity INTEGER DEFAULT 8,
                used_ports INTEGER DEFAULT 0,
                core_color TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        ");

        // Seed initial data
        $db->exec("
            INSERT OR IGNORE INTO tenants (id, name, code, subdomain, custom_domain, brand_color, currency, support_phone, contact_name, contact_phone, contact_email, status, subscription_plan, sms_balance)
            VALUES ('tenant-cloudnet-001', 'CloudNet Broadband ISP', 'ISP-1001', 'cloudnet', 'billing.cloudnet.bd', '#4f46e5', '৳', '01711223344', 'Shuvo Ahmed', '01711223344', 'admin@cloudnet.bd', 'ACTIVE', 'PRO', 1250);

            INSERT OR IGNORE INTO users (id, tenant_id, name, email, phone, password, role, status)
            VALUES 
            ('usr-super-01', NULL, 'Super Admin', 'superadmin@ispsaas.com', '01700000000', 'password123', 'SUPER_ADMIN', 'ACTIVE'),
            ('usr-admin-01', 'tenant-cloudnet-001', 'Shuvo Ahmed', 'admin@cloudnet.bd', '01711223344', 'password123', 'ISP_ADMIN', 'ACTIVE');

            INSERT OR IGNORE INTO mikrotik_routers (id, tenant_id, name, ip_address, api_port, username, password, status, ros_version, board_name, cpu_load, uptime)
            VALUES ('router-01', 'tenant-cloudnet-001', 'Main Gateway (CCR2004-16G-2S+)', '172.16.10.1', 8728, 'api_admin', 'Pass@123', 'ONLINE', '7.15.2 (v7)', 'CCR2004-16G-2S+', 14, '42w 3d 14h');

            INSERT OR IGNORE INTO packages (id, tenant_id, name, code, price, validity_days, download_speed, upload_speed, rate_limit, mikrotik_profile)
            VALUES 
            ('pkg-01', 'tenant-cloudnet-001', '10 Mbps Basic', '10M-BASIC', 500.0, 30, 10, 10, '10M/10M', '10Mbps'),
            ('pkg-02', 'tenant-cloudnet-001', '20 Mbps Standard', '20M-STD', 800.0, 30, 20, 20, '20M/20M', '20Mbps'),
            ('pkg-03', 'tenant-cloudnet-001', '35 Mbps Pro Gamer', '35M-PRO', 1200.0, 30, 35, 35, '35M/35M', '35Mbps');

            INSERT OR IGNORE INTO resellers (id, tenant_id, name, mobile, email, area, balance, commission_rate, credit_limit)
            VALUES ('reseller-01', 'tenant-cloudnet-001', 'Rony WiFi & Telecom', '01718969000', 'roni@wifi.bd', 'Sariakandi Sub-Zone', 14500.0, 15.0, 10000.0);

            INSERT OR IGNORE INTO subscribers (id, tenant_id, customer_code, name, mobile, address, zone, box_number, connection_type, pppoe_username, pppoe_password, package_id, router_id, monthly_fee, expiry_date, status)
            VALUES 
            ('sub-01', 'tenant-cloudnet-001', 'C-100201', 'Kamrul Hassan', '01811223344', 'Flat 4A, Green Villa, Road 4', 'Uttara Sector 7', 'TJ-07-02', 'PPPOE', 'kamrul_uttara', 'pass@123', 'pkg-02', 'router-01', 800.0, datetime('now', '+18 days'), 'ACTIVE'),
            ('sub-02', 'tenant-cloudnet-001', 'C-100202', 'Tanvir Rahman', '01922334455', 'House 12, Lake Drive', 'Gulshan 1', 'TJ-G1-04', 'PPPOE', 'tanvir_g1', 'pass@123', 'pkg-03', 'router-01', 1200.0, datetime('now', '+2 days'), 'ACTIVE'),
            ('sub-03', 'tenant-cloudnet-001', 'C-100203', 'Monir Hossain', '01733445566', 'Plot 5, Wireless Gate', 'Mohakhali', 'TJ-M-01', 'PPPOE', 'monir_mk', 'pass@123', 'pkg-01', 'router-01', 500.0, datetime('now', '-3 days'), 'EXPIRED');

            INSERT OR IGNORE INTO invoices (id, tenant_id, invoice_no, subscriber_id, package_id, billing_month, amount, payable_amount, paid_amount, due_amount, status, due_date, paid_at, payment_method)
            VALUES 
            ('inv-01', 'tenant-cloudnet-001', 'INV-202610-100201', 'sub-01', 'pkg-02', '2026-10', 800.0, 800.0, 800.0, 0.0, 'PAID', datetime('now'), datetime('now'), 'BKASH'),
            ('inv-02', 'tenant-cloudnet-001', 'INV-202610-100203', 'sub-03', 'pkg-01', '2026-10', 500.0, 500.0, 0.0, 500.0, 'UNPAID', datetime('now', '-5 days'), NULL, NULL);

            INSERT OR IGNORE INTO payments (id, tenant_id, invoice_id, subscriber_id, amount, payment_method, transaction_id, notes)
            VALUES ('pay-01', 'tenant-cloudnet-001', 'inv-01', 'sub-01', 800.0, 'BKASH', 'TRX_BKASH_994821', 'Automated bKash payment');

            INSERT OR IGNORE INTO fiber_boxes (id, tenant_id, name, code, type, area, capacity, used_ports, core_color)
            VALUES 
            ('box-01', 'tenant-cloudnet-001', 'OLT-Central-01', 'OLT-01', 'OLT', 'Central Server Room', 16, 8, 'Blue'),
            ('box-02', 'tenant-cloudnet-001', 'TJ-Box-Uttara-07', 'TJ-07', 'TJ_BOX', 'Uttara Sector 7', 16, 12, 'Blue'),
            ('box-03', 'tenant-cloudnet-001', 'Splitter-Gulshan-04', 'SPL-04', 'SPLITTER', 'Gulshan 1', 8, 6, 'Orange');
        ");
    }
}
