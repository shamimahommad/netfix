<?php
require_once __DIR__ . '/../config/database.php';

$db = Database::getConnection();

$db->exec("CREATE TABLE IF NOT EXISTS mac_vendor_cache (
    oui VARCHAR(20) NOT NULL PRIMARY KEY,
    vendor_name VARCHAR(191) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_oui (oui)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

echo "Table mac_vendor_cache created or already exists.\n";

