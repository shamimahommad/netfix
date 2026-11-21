<?php
/**
 * Seed initial sample FTTH Boxes and Fiber Cables if empty
 */
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/FtthService.php';

$db = Database::getConnection();
$count = (int)$db->query("SELECT COUNT(*) FROM ftth_boxes")->fetchColumn();
if ($count > 0) {
    echo "FTTH boxes already populated ({$count} boxes).\n";
    exit(0);
}

echo "Seeding initial FTTH boxes and fiber cables...\n";

// Sample boxes around Dhaka area (Dhanmondi / Mirpur / Banani)
$sampleBoxes = [
    [
        'tenant_id' => 1,
        'box_name' => 'FDB-Dhanmondi-R4-Pole12',
        'box_code' => 'BOX-101',
        'box_type' => 'splitter_box',
        'latitude' => 23.746100,
        'longitude' => 90.374200,
        'address' => 'Road #4, House #12, Dhanmondi, Dhaka',
        'pole_number' => 'DP-12',
        'total_ports' => 8,
        'splitter_ratio' => '1:8',
        'optical_input_power' => -14.20,
        'notes' => 'Primary distribution box on electric pole near Lake Park',
    ],
    [
        'tenant_id' => 1,
        'box_name' => 'FDB-Dhanmondi-R8-Pole05',
        'box_code' => 'BOX-102',
        'box_type' => 'splitter_box',
        'latitude' => 23.749500,
        'longitude' => 90.376800,
        'address' => 'Road #8/A, Dhanmondi, Dhaka',
        'pole_number' => 'DP-05',
        'total_ports' => 8,
        'splitter_ratio' => '1:8',
        'optical_input_power' => -15.10,
        'notes' => 'Wall mounted box on corner plaza',
    ],
    [
        'tenant_id' => 1,
        'box_name' => 'TJ-Dhanmondi-Central-Hub',
        'box_code' => 'TJ-01',
        'box_type' => 'tj_box',
        'latitude' => 23.753200,
        'longitude' => 90.378900,
        'address' => 'Mirpur Road Joint Enclosure, Dhanmondi',
        'pole_number' => 'TJ-MAIN-1',
        'total_ports' => 16,
        'splitter_ratio' => '1:16',
        'optical_input_power' => -11.50,
        'notes' => 'Main 24-core termination joint connecting to OLT',
    ],
    [
        'tenant_id' => 1,
        'box_name' => 'FDB-Panthapath-Pole18',
        'box_code' => 'BOX-103',
        'box_type' => 'splitter_box',
        'latitude' => 23.751100,
        'longitude' => 90.384200,
        'address' => 'Panthapath Signal, Near Square Hospital',
        'pole_number' => 'DP-18',
        'total_ports' => 16,
        'splitter_ratio' => '1:16',
        'optical_input_power' => -16.40,
        'notes' => 'Commercial area high-density splitter box',
    ],
    [
        'tenant_id' => 1,
        'box_name' => 'FDB-Kalabagan-Pole09',
        'box_code' => 'BOX-104',
        'box_type' => 'splitter_box',
        'latitude' => 23.743200,
        'longitude' => 90.381100,
        'address' => 'Kalabagan 1st Lane, Dhaka',
        'pole_number' => 'DP-09',
        'total_ports' => 8,
        'splitter_ratio' => '1:8',
        'optical_input_power' => -15.80,
        'notes' => 'Residential lane box',
    ],
];

// Create boxes
$createdBoxIds = [];
foreach ($sampleBoxes as $bData) {
    $res = FtthService::createBox(1, $bData);
    $createdBoxIds[$bData['box_code']] = $res['id'];
}

// Assign a few sample customers to BOX-101 and BOX-102
$custs = $db->query("SELECT customer_id FROM customers WHERE tenant_id = 1 LIMIT 10")->fetchAll(PDO::FETCH_COLUMN);

if (!empty($custs) && isset($createdBoxIds['BOX-101'])) {
    $boxId = $createdBoxIds['BOX-101'];
    // Assign 5 ports
    for ($p = 1; $p <= min(5, count($custs)); $p++) {
        $cid = (int)$custs[$p - 1];
        FtthService::assignPort(1, $boxId, $p, $cid, "FHTT:00:1A:B{$p}", "Drop cable 45m");
    }
}

if (!empty($custs) && isset($createdBoxIds['BOX-102']) && count($custs) > 5) {
    $boxId = $createdBoxIds['BOX-102'];
    for ($p = 1; $p <= min(3, count($custs) - 5); $p++) {
        $cid = (int)$custs[5 + $p - 1];
        FtthService::assignPort(1, $boxId, $p, $cid, "FHTT:00:2B:C{$p}", "Drop cable 60m");
    }
}

// Create sample fiber cables connecting the boxes
if (isset($createdBoxIds['TJ-01']) && isset($createdBoxIds['BOX-101'])) {
    FtthService::saveCable(1, [
        'cable_name' => 'Central Trunk 24-Core -> Dhanmondi R4',
        'core_count' => 24,
        'from_type' => 'box',
        'from_id' => $createdBoxIds['TJ-01'],
        'to_box_id' => $createdBoxIds['BOX-101'],
        'color' => '#2563eb', // Blue
        'length_meters' => 650,
        'status' => 'active',
        'route_coords' => [
            [23.753200, 90.378900],
            [23.750500, 90.377500],
            [23.748200, 90.375800],
            [23.746100, 90.374200],
        ],
    ]);
}

if (isset($createdBoxIds['TJ-01']) && isset($createdBoxIds['BOX-102'])) {
    FtthService::saveCable(1, [
        'cable_name' => 'Feeder 12-Core -> Dhanmondi R8',
        'core_count' => 12,
        'from_type' => 'box',
        'from_id' => $createdBoxIds['TJ-01'],
        'to_box_id' => $createdBoxIds['BOX-102'],
        'color' => '#10b981', // Emerald
        'length_meters' => 420,
        'status' => 'active',
        'route_coords' => [
            [23.753200, 90.378900],
            [23.751200, 90.377900],
            [23.749500, 90.376800],
        ],
    ]);
}

if (isset($createdBoxIds['TJ-01']) && isset($createdBoxIds['BOX-103'])) {
    FtthService::saveCable(1, [
        'cable_name' => 'Branch 12-Core -> Panthapath Hub',
        'core_count' => 12,
        'from_type' => 'box',
        'from_id' => $createdBoxIds['TJ-01'],
        'to_box_id' => $createdBoxIds['BOX-103'],
        'color' => '#8b5cf6', // Violet
        'length_meters' => 580,
        'status' => 'active',
        'route_coords' => [
            [23.753200, 90.378900],
            [23.752500, 90.381200],
            [23.751100, 90.384200],
        ],
    ]);
}

echo "Successfully seeded FTTH topology sample data.\n";
