<?php
/**
 * NetFix ISP SaaS - Automated Database Schema Export Tool
 *
 * Exports the live database schema (structure only) to:
 * - backend/database/schema_structure_only.sql
 *
 * Automatically sanitizes AUTO_INCREMENT counters and dump timestamps
 * to keep git diffs strictly focused on structural changes.
 */

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = Database::getConnection();
} catch (Throwable $e) {
    echo "[SCHEMA SYNC ERROR] Could not connect to database: " . $e->getMessage() . PHP_EOL;
    exit(1);
}

$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'netfix_db';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';

$targetFile = __DIR__ . '/schema_structure_only.sql';

// Try using mysqldump first if available
$mysqldump = trim((string)shell_exec(PHP_OS_FAMILY === 'Windows' ? 'where.exe mysqldump' : 'which mysqldump'));
$success = false;

if (!empty($mysqldump) && !str_starts_with($mysqldump, 'INFO:')) {
    $passArg = $dbPass !== '' ? "-p" . escapeshellarg($dbPass) : '';
    $cmd = sprintf(
        'mysqldump -h %s -P %s -u %s %s --no-data --skip-comments --default-character-set=utf8mb4 %s',
        escapeshellarg($dbHost),
        escapeshellarg($dbPort),
        escapeshellarg($dbUser),
        $passArg,
        escapeshellarg($dbName)
    );
    
    $output = shell_exec($cmd);
    if (!empty($output) && strpos($output, 'CREATE TABLE') !== false) {
        // Strip AUTO_INCREMENT counters and dump timestamp comments for clean git tracking
        $cleanOutput = preg_replace('/AUTO_INCREMENT=\d+\s*/', '', $output);
        $cleanOutput = preg_replace('/-- Dump completed on .*\n?/', '', $cleanOutput);
        file_put_contents($targetFile, $cleanOutput);
        $success = true;
        echo "[SCHEMA SYNC] Exported clean structure-only schema to: backend/database/schema_structure_only.sql" . PHP_EOL;
    }
}

// Fallback to pure PDO export if mysqldump is not available
if (!$success) {
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $out = "-- NetFix ISP SaaS Schema Dump (Structure Only)\n";
    $out .= "-- Database: {$dbName}\n\n";
    $out .= "SET FOREIGN_KEY_CHECKS=0;\n\n";

    foreach ($tables as $table) {
        $out .= "DROP TABLE IF EXISTS `{$table}`;\n";
        $row = $pdo->query("SHOW CREATE TABLE `{$table}`")->fetch(PDO::FETCH_ASSOC);
        if (isset($row['Create Table'])) {
            $createSql = $row['Create Table'];
            $createSql = preg_replace('/AUTO_INCREMENT=\d+\s*/', '', $createSql);
            $out .= $createSql . ";\n\n";
        }
    }

    $out .= "SET FOREIGN_KEY_CHECKS=1;\n";
    file_put_contents($targetFile, $out);
    echo "[SCHEMA SYNC] Exported clean structure-only schema via PDO to: backend/database/schema_structure_only.sql" . PHP_EOL;
}
