<?php
/**
 * NetFix ISP SaaS - Service Area & Sub-Area Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class ServiceAreaController {
    public static function listAreas(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT 
            service_area_id as id,
            name,
            description,
            created_at as createdAt,
            updated_at as updatedAt
            FROM service_areas 
            WHERE tenant_id = :tid 
            ORDER BY name ASC");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        $areas = array_map(function($r) {
            return [
                'id' => (string)$r['id'],
                'name' => $r['name'],
                'description' => $r['description'],
                'createdAt' => $r['createdAt'],
                'updatedAt' => $r['updatedAt'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $areas,
        ]);
    }

    public static function createArea(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $name = trim($data['name'] ?? '');
        if (empty($name)) {
            Response::error('Area name is required', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO service_areas (tenant_id, name, description, created_by) VALUES (:tid, :name, :desc, :uid)");
        $stmt->execute([
            'tid' => $tenantId,
            'name' => $name,
            'desc' => $data['description'] ?? null,
            'uid' => $user['user_id'],
        ]);

        $id = $db->lastInsertId();

        Response::json([
            'success' => true,
            'data' => [
                'id' => (string)$id,
                'name' => $name,
                'description' => $data['description'] ?? null,
            ],
        ], 201);
    }

    public static function updateArea(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE service_areas SET name = :name, description = :desc WHERE service_area_id = :id AND tenant_id = :tid");
        $stmt->execute([
            'name' => $data['name'] ?? '',
            'desc' => $data['description'] ?? null,
            'id' => $id,
            'tid' => $tenantId,
        ]);

        Response::json([
            'success' => true,
            'data' => [
                'id' => $id,
                'name' => $data['name'] ?? '',
                'description' => $data['description'] ?? null,
            ],
        ]);
    }

    public static function deleteArea(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("DELETE FROM service_areas WHERE service_area_id = :id AND tenant_id = :tid");
        $stmt->execute(['id' => $id, 'tid' => $tenantId]);

        Response::json(['success' => true]);
    }

    public static function listSubAreas(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $serviceAreaId = $_GET['serviceAreaId'] ?? null;
        $db = Database::getConnection();

        $where = ["tenant_id = :tid"];
        $params = ['tid' => $tenantId];

        if ($serviceAreaId) {
            $where[] = "service_area_id = :aid";
            $params['aid'] = $serviceAreaId;
        }

        $whereSql = implode(' AND ', $where);

        $stmt = $db->prepare("SELECT 
            sub_area_id as id,
            service_area_id as serviceAreaId,
            name,
            description,
            created_at as createdAt,
            updated_at as updatedAt
            FROM sub_areas 
            WHERE {$whereSql} 
            ORDER BY name ASC");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $subAreas = array_map(function($r) {
            return [
                'id' => (string)$r['id'],
                'serviceAreaId' => (string)$r['serviceAreaId'],
                'name' => $r['name'],
                'description' => $r['description'],
                'createdAt' => $r['createdAt'],
                'updatedAt' => $r['updatedAt'],
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => $subAreas,
        ]);
    }

    public static function createSubArea(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $name = trim($data['name'] ?? '');
        $serviceAreaId = $data['serviceAreaId'] ?? null;

        if (empty($name) || !$serviceAreaId) {
            Response::error('Sub-area name and Service Area ID are required', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO sub_areas (tenant_id, service_area_id, name, description) VALUES (:tid, :aid, :name, :desc)");
        $stmt->execute([
            'tid' => $tenantId,
            'aid' => $serviceAreaId,
            'name' => $name,
            'desc' => $data['description'] ?? null,
        ]);

        $id = $db->lastInsertId();

        Response::json([
            'success' => true,
            'data' => [
                'id' => (string)$id,
                'serviceAreaId' => (string)$serviceAreaId,
                'name' => $name,
                'description' => $data['description'] ?? null,
            ],
        ], 201);
    }

    public static function updateSubArea(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE sub_areas SET name = :name, description = :desc WHERE sub_area_id = :id AND tenant_id = :tid");
        $stmt->execute([
            'name' => $data['name'] ?? '',
            'desc' => $data['description'] ?? null,
            'id' => $id,
            'tid' => $tenantId,
        ]);

        Response::json([
            'success' => true,
            'data' => [
                'id' => $id,
                'name' => $data['name'] ?? '',
                'description' => $data['description'] ?? null,
            ],
        ]);
    }

    public static function deleteSubArea(string $id): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("DELETE FROM sub_areas WHERE sub_area_id = :id AND tenant_id = :tid");
        $stmt->execute(['id' => $id, 'tid' => $tenantId]);

        Response::json(['success' => true]);
    }
}

