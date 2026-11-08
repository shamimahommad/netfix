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
            sa.service_area_id as id,
            sa.service_area_id as serviceAreaId,
            sa.name,
            sa.description,
            sa.created_at as createdAt,
            sa.updated_at as updatedAt,
            COUNT(DISTINCT c.customer_id) as totalUsers,
            COUNT(DISTINCT CASE WHEN c.status = 'active' AND COALESCE(c.billing_status, '') NOT IN ('Expired', 'Left') THEN c.customer_id END) as activeUsers,
            COUNT(DISTINCT CASE WHEN c.billing_status = 'Expired' OR (cs.expires_at IS NOT NULL AND cs.expires_at < NOW() AND c.status = 'active') THEN c.customer_id END) as expiredUsers,
            COUNT(DISTINCT CASE WHEN c.status IN ('cancelled', 'terminated', 'left') OR c.billing_status = 'Left' THEN c.customer_id END) as leftUsers,
            COUNT(DISTINCT CASE WHEN c.status = 'pending_activation' OR c.billing_status = 'Pending' THEN c.customer_id END) as pendingUsers,
            COUNT(DISTINCT CASE WHEN COALESCE(na.protocol, cs.protocol, 'pppoe') = 'pppoe' AND c.customer_id IS NOT NULL THEN c.customer_id END) as pppoeUsers,
            COUNT(DISTINCT CASE WHEN COALESCE(na.protocol, cs.protocol) = 'hotspot' THEN c.customer_id END) as hotspotUsers,
            COUNT(DISTINCT CASE WHEN c.customer_type = 'free' 
                    OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.is_free'))) = 'true' 
                    OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.customer_type'))) = 'free' 
                    OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.type'))) = 'free' 
                THEN c.customer_id END) as freeUsers,
            COUNT(DISTINCT CASE WHEN c.customer_type = 'vip' 
                    OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.is_vip'))) = 'true' 
                    OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.customer_type'))) = 'vip' 
                    OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.type'))) = 'vip' 
                THEN c.customer_id END) as vipUsers
            FROM service_areas sa
            LEFT JOIN customers c ON c.tenant_id = sa.tenant_id AND (
                sa.service_area_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.service_area_id')) AS UNSIGNED)
                OR sa.name = JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.service_area_id'))
                OR sa.name = JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.area_name'))
                OR sa.name = JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.area'))
            )
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id AND cs.status = 'active'
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            WHERE sa.tenant_id = :tid 
            GROUP BY sa.service_area_id, sa.name, sa.description, sa.created_at, sa.updated_at
            ORDER BY sa.name ASC");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        $areas = array_map(function($r) {
            return [
                'id' => (string)$r['id'],
                'serviceAreaId' => (string)$r['serviceAreaId'],
                'name' => $r['name'],
                'description' => $r['description'],
                'totalUsers' => (int)$r['totalUsers'],
                'activeUsers' => (int)$r['activeUsers'],
                'expiredUsers' => (int)$r['expiredUsers'],
                'leftUsers' => (int)$r['leftUsers'],
                'pendingUsers' => (int)$r['pendingUsers'],
                'pppoeUsers' => (int)$r['pppoeUsers'],
                'hotspotUsers' => (int)$r['hotspotUsers'],
                'freeUsers' => (int)$r['freeUsers'],
                'vipUsers' => (int)$r['vipUsers'],
                'isUnassigned' => false,
                'createdAt' => $r['createdAt'],
                'updatedAt' => $r['updatedAt'],
            ];
        }, $rows);

        // Also check if unassigned customers exist for this tenant
        $unassignedStmt = $db->prepare("
            SELECT 
                COUNT(DISTINCT c.customer_id) as totalUsers,
                COUNT(DISTINCT CASE WHEN c.status = 'active' AND COALESCE(c.billing_status, '') NOT IN ('Expired', 'Left') THEN c.customer_id END) as activeUsers,
                COUNT(DISTINCT CASE WHEN c.billing_status = 'Expired' OR (cs.expires_at IS NOT NULL AND cs.expires_at < NOW() AND c.status = 'active') THEN c.customer_id END) as expiredUsers,
                COUNT(DISTINCT CASE WHEN c.status IN ('cancelled', 'terminated', 'left') OR c.billing_status = 'Left' THEN c.customer_id END) as leftUsers,
                COUNT(DISTINCT CASE WHEN c.status = 'pending_activation' OR c.billing_status = 'Pending' THEN c.customer_id END) as pendingUsers,
                COUNT(DISTINCT CASE WHEN COALESCE(na.protocol, cs.protocol, 'pppoe') = 'pppoe' AND c.customer_id IS NOT NULL THEN c.customer_id END) as pppoeUsers,
                COUNT(DISTINCT CASE WHEN COALESCE(na.protocol, cs.protocol) = 'hotspot' THEN c.customer_id END) as hotspotUsers,
                COUNT(DISTINCT CASE WHEN c.customer_type = 'free' 
                        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.is_free'))) = 'true' 
                        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.customer_type'))) = 'free' 
                        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.type'))) = 'free' 
                    THEN c.customer_id END) as freeUsers,
                COUNT(DISTINCT CASE WHEN c.customer_type = 'vip' 
                        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.is_vip'))) = 'true' 
                        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.customer_type'))) = 'vip' 
                        OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.type'))) = 'vip' 
                    THEN c.customer_id END) as vipUsers
            FROM customers c
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id AND cs.status = 'active'
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            WHERE c.tenant_id = :tid AND NOT EXISTS (
                SELECT 1 FROM service_areas sa WHERE sa.tenant_id = c.tenant_id AND (
                    sa.service_area_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.service_area_id')) AS UNSIGNED)
                    OR sa.name = JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.service_area_id'))
                    OR sa.name = JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.area_name'))
                    OR sa.name = JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.area'))
                )
            )
        ");
        $unassignedStmt->execute(['tid' => $tenantId]);
        $unassigned = $unassignedStmt->fetch();
        if ($unassigned && (int)$unassigned['totalUsers'] > 0) {
            $areas[] = [
                'id' => 'unassigned',
                'serviceAreaId' => 'unassigned',
                'name' => 'Unassigned / Other',
                'description' => 'Customers not mapped to any registered service area',
                'totalUsers' => (int)$unassigned['totalUsers'],
                'activeUsers' => (int)$unassigned['activeUsers'],
                'expiredUsers' => (int)$unassigned['expiredUsers'],
                'leftUsers' => (int)$unassigned['leftUsers'],
                'pendingUsers' => (int)$unassigned['pendingUsers'],
                'pppoeUsers' => (int)$unassigned['pppoeUsers'],
                'hotspotUsers' => (int)$unassigned['hotspotUsers'],
                'freeUsers' => (int)$unassigned['freeUsers'],
                'vipUsers' => (int)$unassigned['vipUsers'],
                'isUnassigned' => true,
                'createdAt' => null,
                'updatedAt' => null,
            ];
        }

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

