<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';

class CoverageController {
    public static function index(string $tenantId): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT * FROM fiber_boxes WHERE tenant_id = :tenant_id ORDER BY created_at DESC");
        $stmt->execute(['tenant_id' => $tenantId]);
        $boxes = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'boxes' => $boxes,
        ]);
    }

    public static function create(string $tenantId): void {
        $data = json_decode(file_get_contents('php://input'), true);
        $name = trim($data['name'] ?? '');
        $code = trim($data['code'] ?? '');
        $type = $data['type'] ?? 'TJ_BOX';
        $area = trim($data['area'] ?? '');
        $capacity = (int)($data['capacity'] ?? 8);
        $coreColor = $data['coreColor'] ?? $data['core_color'] ?? 'Blue';

        if (empty($name) || empty($area)) {
            Response::error('Name and Area are required', 400);
        }

        $db = Database::getConnection();
        $id = 'box-' . uniqid();

        $stmt = $db->prepare("INSERT INTO fiber_boxes (id, tenant_id, name, code, type, area, capacity, used_ports, core_color) 
                              VALUES (:id, :tenant_id, :name, :code, :type, :area, :capacity, 0, :core_color)");
        $stmt->execute([
            'id' => $id,
            'tenant_id' => $tenantId,
            'name' => $name,
            'code' => $code ?: 'BOX-' . rand(10, 99),
            'type' => $type,
            'area' => $area,
            'capacity' => $capacity,
            'core_color' => $coreColor,
        ]);

        Response::json([
            'success' => true,
            'message' => 'Distribution box added successfully',
            'id' => $id,
        ], 201);
    }
}
