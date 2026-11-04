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
            // Log and exit with JSON error
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Database connection failed: ' . $e->getMessage(),
            ]);
            exit;
        }
    }

    public static function ensureTables(PDO $pdo): void {
        static $checked = false;
        if ($checked) return;
        $checked = true;

        try {
            // Check if users table exists in the current database
            $stmt = $pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users' LIMIT 1");
            if ($stmt && $stmt->fetchColumn()) {
                return; // Tables already exist!
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
