<?php
/**
 * 1-Click MySQL Database Importer for ISP SaaS
 * Automatically creates the database and imports schema.sql with seed data.
 */

require_once __DIR__ . '/../config/database.php';

echo "==========================================================" . PHP_EOL;
echo " ISP SaaS - Automated MySQL Database Importer" . PHP_EOL;
echo "==========================================================" . PHP_EOL;

$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = getenv('DB_PORT') ?: '3306';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';
$dbName = getenv('DB_NAME') ?: 'ispsaas_db';

echo "Connecting to MySQL server at {$host}:{$port} as {$user}..." . PHP_EOL;

try {
    $pdo = new PDO("mysql:host={$host};port={$port}", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    echo "✔ Successfully connected to MySQL server!" . PHP_EOL;
} catch (Exception $e) {
    echo "✖ Failed to connect to MySQL: " . $e->getMessage() . PHP_EOL;
    echo "  (Tip: If running XAMPP, ensure MySQL module is started in XAMPP Control Panel)" . PHP_EOL;
    exit(1);
}

try {
    echo "Creating database `{$dbName}` if it doesn't exist..." . PHP_EOL;
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `{$dbName}`");
    echo "✔ Using database `{$dbName}`" . PHP_EOL;

    $schemaFile = __DIR__ . '/schema.sql';
    if (!file_exists($schemaFile)) {
        throw new Exception("schema.sql not found at {$schemaFile}");
    }

    echo "Reading schema.sql..." . PHP_EOL;
    $sql = file_get_contents($schemaFile);

    echo "Executing database migration..." . PHP_EOL;
    $pdo->exec($sql);

    echo "✔ Schema and seed data successfully imported into `{$dbName}`!" . PHP_EOL;
    echo "✔ Tables created: tenants, users, mikrotik_routers, packages, resellers, subscribers, invoices, payments, hotspot_vouchers, tickets, fiber_boxes, sms_logs." . PHP_EOL;
    echo "==========================================================" . PHP_EOL;
    echo " Database setup complete! You can now run the application." . PHP_EOL;
    echo "==========================================================" . PHP_EOL;
} catch (Exception $e) {
    echo "✖ Migration failed: " . $e->getMessage() . PHP_EOL;
    exit(1);
}
