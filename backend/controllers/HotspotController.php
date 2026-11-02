<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';

class HotspotController {
    public static function index(string $tenantId): void {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT v.*, p.name as package_name 
                               FROM hotspot_vouchers v 
                               JOIN packages p ON v.package_id = p.id 
                               WHERE v.tenant_id = :tenant_id 
                               ORDER BY v.created_at DESC LIMIT 100");
        $stmt->execute(['tenant_id' => $tenantId]);
        $vouchers = $stmt->fetchAll();

        Response::json(['success' => true, 'vouchers' => $vouchers]);
    }

    public static function generateBatch(string $tenantId): void {
        $data = json_decode(file_get_contents('php://input'), true);
        $quantity = min(100, max(1, (int)($data['quantity'] ?? 20)));
        $packageId = $data['packageId'] ?? '';
        $price = (float)($data['price'] ?? 20);
        $timeLimit = $data['timeLimit'] ?? '4 Hours';
        $dataLimit = $data['dataLimit'] ?? '2 GB';

        if (empty($packageId)) {
            Response::error('Package is required', 400);
        }

        $db = Database::getConnection();
        $batchCode = 'BATCH-' . substr(time(), -5);

        for ($i = 0; $i < $quantity; $i++) {
            $code = (string)rand(100000, 999999);
            $pin = (string)rand(1000, 9999);
            $id = 'hsp-' . uniqid();

            $stmt = $db->prepare("INSERT INTO hotspot_vouchers 
                (id, tenant_id, batch_code, voucher_code, pin, package_id, price, time_limit, data_limit, status) 
                VALUES (:id, :tenant_id, :batch, :code, :pin, :pkg, :price, :time, :data, 'ACTIVE')");
            
            $stmt->execute([
                'id' => $id,
                'tenant_id' => $tenantId,
                'batch' => $batchCode,
                'code' => $code,
                'pin' => $pin,
                'pkg' => $packageId,
                'price' => $price,
                'time' => $timeLimit,
                'data' => $dataLimit,
            ]);
        }

        Response::json([
            'success' => true,
            'message' => "Generated {$quantity} vouchers in batch {$batchCode}",
            'batchCode' => $batchCode,
            'quantity' => $quantity,
        ], 201);
    }
}
