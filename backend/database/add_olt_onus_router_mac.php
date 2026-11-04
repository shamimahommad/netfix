<?php
require_once __DIR__ . '/../config/database.php';
$db = Database::getConnection();

try {
    $db->exec("ALTER TABLE olt_onus ADD COLUMN router_mac VARCHAR(30) NULL AFTER mac_address");
    echo "Added router_mac column to olt_onus\n";
} catch (\Throwable $e) {
    echo "router_mac: " . $e->getMessage() . "\n";
}

try {
    $db->exec("ALTER TABLE olt_onus ADD COLUMN pppoe_username VARCHAR(100) NULL AFTER router_mac");
    echo "Added pppoe_username column to olt_onus\n";
} catch (\Throwable $e) {
    echo "pppoe_username: " . $e->getMessage() . "\n";
}

