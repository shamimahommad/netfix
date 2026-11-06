<?php
require_once __DIR__ . '/../config/database.php';
$db = Database::getConnection();
$sql = file_get_contents(__DIR__ . '/create_customer_id_reservations.sql');
$db->exec($sql);
echo "customer_id_reservations table ready.\n";

