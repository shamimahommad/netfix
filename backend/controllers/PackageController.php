<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';

class PackageController {
    public static function index(string $tenantId): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT p.*, COUNT(s.id) as subscriber_count 
                               FROM packages p 
                               LEFT JOIN subscribers s ON p.id = s.package_id 
                               WHERE p.tenant_id = :tenant_id 
                               GROUP BY p.id 
                               ORDER BY p.price ASC");
        $stmt->execute(['tenant_id' => $tenantId]);
        $packages = $stmt->fetchAll();

        Response::json(['success' => true, 'packages' => $packages]);
    }

    public static function create(string $tenantId): void {
        $data = json_decode(file_get_contents('php://input'), true);
        $name = trim($data['name'] ?? '');
        $price = (float)($data['price'] ?? 0);
        $downloadSpeed = (int)($data['downloadSpeed'] ?? 10);
        $uploadSpeed = (int)($data['uploadSpeed'] ?? 10);
        $rateLimit = $data['rateLimit'] ?? "{$downloadSpeed}M/{$uploadSpeed}M";
        $profile = $data['mikrotikProfile'] ?? $name;

        if (empty($name) || $price <= 0) {
            Response::error('Package name and valid price are required', 400);
        }

        $id = 'pkg-' . uniqid();
        $code = strtoupper(str_replace(' ', '-', $name));

        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO packages 
            (id, tenant_id, name, code, price, validity_days, download_speed, upload_speed, rate_limit, mikrotik_profile) 
            VALUES (:id, :tenant_id, :name, :code, :price, 30, :dl, :ul, :limit, :profile)");
        
        $stmt->execute([
            'id' => $id,
            'tenant_id' => $tenantId,
            'name' => $name,
            'code' => $code,
            'price' => $price,
            'dl' => $downloadSpeed,
            'ul' => $uploadSpeed,
            'limit' => $rateLimit,
            'profile' => $profile,
        ]);

        Response::json(['success' => true, 'message' => 'Package created successfully', 'packageId' => $id], 201);
    }
}
