<?php
require_once __DIR__ . '/../config/database.php';

$db = Database::getConnection();

// Check if vlan_id exists
$check = $db->query("SHOW COLUMNS FROM olt_onus LIKE 'vlan_id'");
if ($check->rowCount() === 0) {
    $db->exec("ALTER TABLE olt_onus ADD COLUMN vlan_id INT NULL AFTER router_mac");
    echo "Added vlan_id to olt_onus table successfully.\n";
} else {
    echo "vlan_id already exists in olt_onus table.\n";
}
