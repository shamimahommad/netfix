<?php
/**
 * NetFix ISP SaaS - FTTH Splitter & Box Management Service
 * Provides complete topology management, GIS mapping, visual port assignment,
 * optical power budget tracking, and nearest box feasibility checks.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/ActivityLogger.php';

class FtthService {

    /**
     * Get all FTTH boxes with live port statistics for a tenant
     */
    public static function getBoxes(int $tenantId, array $filters = []): array {
        $db = Database::getConnection();

        $where = ["b.tenant_id = :tid"];
        $params = ['tid' => $tenantId];

        if (!empty($filters['status'])) {
            $where[] = "b.status = :status";
            $params['status'] = $filters['status'];
        }
        if (!empty($filters['box_type'])) {
            $where[] = "b.box_type = :box_type";
            $params['box_type'] = $filters['box_type'];
        }
        if (!empty($filters['search'])) {
            $where[] = "(b.box_name LIKE :search OR b.box_code LIKE :search OR b.pole_number LIKE :search OR b.address LIKE :search)";
            $params['search'] = '%' . $filters['search'] . '%';
        }

        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT 
                b.id,
                b.tenant_id,
                b.box_name,
                b.box_code,
                b.box_type,
                b.latitude,
                b.longitude,
                b.address,
                b.pole_number,
                b.total_ports,
                b.splitter_ratio,
                b.olt_device_id,
                b.pon_port,
                b.upstream_box_id,
                b.optical_input_power,
                b.status,
                b.notes,
                b.created_at,
                b.updated_at,
                nd.device_name AS olt_name,
                COALESCE(SUM(CASE WHEN p.status = 'occupied' THEN 1 ELSE 0 END), 0) AS occupied_ports,
                COALESCE(SUM(CASE WHEN p.status = 'available' THEN 1 ELSE 0 END), 0) AS available_ports,
                COALESCE(SUM(CASE WHEN p.status = 'damaged' THEN 1 ELSE 0 END), 0) AS damaged_ports,
                COALESCE(SUM(CASE WHEN p.status = 'reserved' THEN 1 ELSE 0 END), 0) AS reserved_ports
            FROM ftth_boxes b
            LEFT JOIN ftth_box_ports p ON p.box_id = b.id
            LEFT JOIN network_devices nd ON nd.network_device_id = b.olt_device_id
            WHERE {$whereSql}
            GROUP BY b.id
            ORDER BY b.id DESC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $boxes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($boxes as &$box) {
            $box['id'] = (int)$box['id'];
            $box['latitude'] = (float)$box['latitude'];
            $box['longitude'] = (float)$box['longitude'];
            $box['total_ports'] = (int)$box['total_ports'];
            $box['occupied_ports'] = (int)$box['occupied_ports'];
            $box['available_ports'] = (int)$box['available_ports'];
            $box['damaged_ports'] = (int)$box['damaged_ports'];
            $box['reserved_ports'] = (int)$box['reserved_ports'];
            $box['utilization_pct'] = $box['total_ports'] > 0 
                ? (int)round(($box['occupied_ports'] / $box['total_ports']) * 100) 
                : 0;
            if ($box['optical_input_power'] !== null) {
                $box['optical_input_power'] = (float)$box['optical_input_power'];
            }
        }

        return $boxes;
    }

    /**
     * Get single box detail with full port grid and assigned customer info
     */
    public static function getBoxDetail(int $tenantId, int $boxId): ?array {
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT 
                b.*,
                nd.device_name AS olt_name
            FROM ftth_boxes b
            LEFT JOIN network_devices nd ON nd.network_device_id = b.olt_device_id
            WHERE b.id = :id AND b.tenant_id = :tid
            LIMIT 1
        ");
        $stmt->execute(['id' => $boxId, 'tid' => $tenantId]);
        $box = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$box) {
            return null;
        }

        $box['id'] = (int)$box['id'];
        $box['latitude'] = (float)$box['latitude'];
        $box['longitude'] = (float)$box['longitude'];
        $box['total_ports'] = (int)$box['total_ports'];

        // Fetch all ports for this box
        $portStmt = $db->prepare("
            SELECT 
                p.id AS port_record_id,
                p.port_number,
                p.status AS port_status,
                p.onu_mac,
                p.optical_rx_power,
                p.cable_color,
                p.core_number,
                p.notes AS port_notes,
                c.customer_id,
                c.customer_code,
                c.full_name AS customer_name,
                c.phone AS customer_phone,
                c.status AS customer_status,
                c.billing_status,
                na.username AS pppoe_username,
                ap.profile_name AS package_name,
                onu.rx_power_dbm AS live_rx_power
            FROM ftth_box_ports p
            LEFT JOIN customers c ON c.customer_id = p.customer_id
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id AND cs.status = 'active'
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            LEFT JOIN olt_onus onu ON (onu.mac_address = p.onu_mac OR onu.pppoe_username = na.username)
            WHERE p.box_id = :bid AND p.tenant_id = :tid
            ORDER BY p.port_number ASC
        ");
        $portStmt->execute(['bid' => $boxId, 'tid' => $tenantId]);
        $ports = $portStmt->fetchAll(PDO::FETCH_ASSOC);

        $box['ports'] = array_map(function ($p) {
            return [
                'portRecordId'   => (int)$p['port_record_id'],
                'portNumber'     => (int)$p['port_number'],
                'status'         => $p['port_status'],
                'onuMac'         => $p['onu_mac'],
                'opticalRxPower' => $p['live_rx_power'] !== null ? (float)$p['live_rx_power'] : ($p['optical_rx_power'] !== null ? (float)$p['optical_rx_power'] : null),
                'cableColor'     => $p['cable_color'],
                'coreNumber'     => $p['core_number'] ? (int)$p['core_number'] : null,
                'notes'          => $p['port_notes'],
                'customer'       => $p['customer_id'] ? [
                    'customerId'    => (int)$p['customer_id'],
                    'customerCode'  => $p['customer_code'],
                    'name'          => $p['customer_name'],
                    'phone'         => $p['customer_phone'],
                    'username'      => $p['pppoe_username'],
                    'package'       => $p['package_name'],
                    'status'        => $p['customer_status'],
                    'billingStatus' => $p['billing_status'],
                ] : null,
            ];
        }, $ports);

        return $box;
    }

    /**
     * Create a new FTTH box and auto-initialize ports
     */
    public static function createBox(int $tenantId, array $data): array {
        $db = Database::getConnection();

        $boxName = trim($data['box_name'] ?? '');
        if (empty($boxName)) {
            throw new InvalidArgumentException('Box name is required');
        }

        $lat = (float)($data['latitude'] ?? 0);
        $lng = (float)($data['longitude'] ?? 0);
        if ($lat == 0 || $lng == 0) {
            throw new InvalidArgumentException('Valid latitude and longitude are required');
        }

        $totalPorts = max(4, min(64, (int)($data['total_ports'] ?? 8)));
        $ratio = trim($data['splitter_ratio'] ?? ("1:" . $totalPorts));
        $boxType = $data['box_type'] ?? 'splitter_box';
        $pole = !empty($data['pole_number']) ? trim($data['pole_number']) : null;
        $address = !empty($data['address']) ? trim($data['address']) : null;
        $oltId = !empty($data['olt_device_id']) ? (int)$data['olt_device_id'] : null;
        $ponPort = !empty($data['pon_port']) ? trim($data['pon_port']) : null;
        $inputPower = isset($data['optical_input_power']) && $data['optical_input_power'] !== '' 
            ? (float)$data['optical_input_power'] : null;
        $notes = !empty($data['notes']) ? trim($data['notes']) : null;

        // Auto-generate code if empty
        $code = trim($data['box_code'] ?? '');
        if (empty($code)) {
            $nextSeq = (int)$db->query("SELECT COUNT(*) + 1 FROM ftth_boxes WHERE tenant_id = {$tenantId}")->fetchColumn();
            $code = 'BOX-' . str_pad($nextSeq, 3, '0', STR_PAD_LEFT);
        }

        $stmt = $db->prepare("
            INSERT INTO ftth_boxes 
                (tenant_id, box_name, box_code, box_type, latitude, longitude, address, pole_number, total_ports, splitter_ratio, olt_device_id, pon_port, optical_input_power, notes)
            VALUES 
                (:tid, :name, :code, :type, :lat, :lng, :addr, :pole, :ports, :ratio, :olt, :pon, :pwr, :notes)
        ");

        $stmt->execute([
            'tid'   => $tenantId,
            'name'  => $boxName,
            'code'  => $code,
            'type'  => $boxType,
            'lat'   => $lat,
            'lng'   => $lng,
            'addr'  => $address,
            'pole'  => $pole,
            'ports' => $totalPorts,
            'ratio' => $ratio,
            'olt'   => $oltId,
            'pon'   => $ponPort,
            'pwr'   => $inputPower,
            'notes' => $notes,
        ]);

        $boxId = (int)$db->lastInsertId();

        // Standard fiber core colors: Blue, Orange, Green, Brown, Slate, White, Red, Black, Yellow, Violet, Rose, Aqua
        $fiberColors = ['Blue', 'Orange', 'Green', 'Brown', 'Slate', 'White', 'Red', 'Black', 'Yellow', 'Violet', 'Rose', 'Aqua'];

        // Auto-populate ports 1 to $totalPorts
        $portInsert = $db->prepare("
            INSERT INTO ftth_box_ports 
                (tenant_id, box_id, port_number, status, cable_color, core_number)
            VALUES 
                (:tid, :bid, :pnum, 'available', :color, :core)
        ");

        for ($i = 1; $i <= $totalPorts; $i++) {
            $color = $fiberColors[($i - 1) % count($fiberColors)];
            $portInsert->execute([
                'tid'   => $tenantId,
                'bid'   => $boxId,
                'pnum'  => $i,
                'color' => $color,
                'core'  => $i,
            ]);
        }

        return self::getBoxDetail($tenantId, $boxId);
    }

    /**
     * Update an existing box
     */
    public static function updateBox(int $tenantId, int $boxId, array $data): bool {
        $db = Database::getConnection();

        $fields = [];
        $params = ['id' => $boxId, 'tid' => $tenantId];

        if (isset($data['box_name'])) {
            $fields[] = "box_name = :name";
            $params['name'] = trim($data['box_name']);
        }
        if (isset($data['box_code'])) {
            $fields[] = "box_code = :code";
            $params['code'] = trim($data['box_code']);
        }
        if (isset($data['box_type'])) {
            $fields[] = "box_type = :type";
            $params['type'] = trim($data['box_type']);
        }
        if (isset($data['latitude'])) {
            $fields[] = "latitude = :lat";
            $params['lat'] = (float)$data['latitude'];
        }
        if (isset($data['longitude'])) {
            $fields[] = "longitude = :lng";
            $params['lng'] = (float)$data['longitude'];
        }
        if (isset($data['address'])) {
            $fields[] = "address = :addr";
            $params['addr'] = trim($data['address']);
        }
        if (isset($data['pole_number'])) {
            $fields[] = "pole_number = :pole";
            $params['pole'] = trim($data['pole_number']);
        }
        if (isset($data['splitter_ratio'])) {
            $fields[] = "splitter_ratio = :ratio";
            $params['ratio'] = trim($data['splitter_ratio']);
        }
        if (isset($data['optical_input_power'])) {
            $fields[] = "optical_input_power = :pwr";
            $params['pwr'] = $data['optical_input_power'] !== '' ? (float)$data['optical_input_power'] : null;
        }
        if (isset($data['status'])) {
            $fields[] = "status = :status";
            $params['status'] = trim($data['status']);
        }
        if (isset($data['notes'])) {
            $fields[] = "notes = :notes";
            $params['notes'] = trim($data['notes']);
        }

        if (empty($fields)) {
            return true;
        }

        $sql = "UPDATE ftth_boxes SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = :id AND tenant_id = :tid";
        $stmt = $db->prepare($sql);
        return $stmt->execute($params);
    }

    /**
     * Delete an FTTH box (and all unassigned ports)
     */
    public static function deleteBox(int $tenantId, int $boxId): bool {
        $db = Database::getConnection();

        // Check if any port is assigned to a customer
        $occupied = (int)$db->query("
            SELECT COUNT(*) FROM ftth_box_ports 
            WHERE box_id = {$boxId} AND tenant_id = {$tenantId} AND customer_id IS NOT NULL
        ")->fetchColumn();

        if ($occupied > 0) {
            throw new RuntimeException("Cannot delete box: {$occupied} customer(s) are currently connected to this box. Please disconnect or transfer them first.");
        }

        $db->prepare("DELETE FROM ftth_box_ports WHERE box_id = :bid AND tenant_id = :tid")->execute(['bid' => $boxId, 'tid' => $tenantId]);
        $db->prepare("DELETE FROM ftth_cables WHERE (to_box_id = :bid OR (from_type = 'box' AND from_id = :bid)) AND tenant_id = :tid")->execute(['bid' => $boxId, 'tid' => $tenantId]);
        $db->prepare("DELETE FROM ftth_boxes WHERE id = :bid AND tenant_id = :tid")->execute(['bid' => $boxId, 'tid' => $tenantId]);

        return true;
    }

    /**
     * Assign customer to a specific port
     */
    public static function assignPort(int $tenantId, int $boxId, int $portNumber, int $customerId, ?string $onuMac = null, string $notes = ''): bool {
        $db = Database::getConnection();

        // Check customer exists and belongs to tenant
        $custStmt = $db->prepare("SELECT customer_id, full_name, customer_code FROM customers WHERE customer_id = :cid AND tenant_id = :tid LIMIT 1");
        $custStmt->execute(['cid' => $customerId, 'tid' => $tenantId]);
        $cust = $custStmt->fetch(PDO::FETCH_ASSOC);
        if (!$cust) {
            throw new InvalidArgumentException("Customer #{$customerId} not found.");
        }

        // Fetch ONU rx power if onuMac is provided or match from customer PPPoE
        $liveRx = null;
        if (!empty($onuMac)) {
            $onuStmt = $db->prepare("SELECT rx_power_dbm FROM olt_onus WHERE tenant_id = :tid AND mac_address = :mac LIMIT 1");
            $onuStmt->execute(['tid' => $tenantId, 'mac' => $onuMac]);
            $liveRx = $onuStmt->fetchColumn();
        }

        $stmt = $db->prepare("
            UPDATE ftth_box_ports SET 
                customer_id = :cid,
                onu_mac = :mac,
                optical_rx_power = :rx,
                status = 'occupied',
                notes = :notes,
                updated_at = NOW()
            WHERE box_id = :bid AND port_number = :pnum AND tenant_id = :tid
        ");

        $stmt->execute([
            'cid'   => $customerId,
            'mac'   => $onuMac,
            'rx'    => $liveRx !== false ? $liveRx : null,
            'notes' => $notes,
            'bid'   => $boxId,
            'pnum'  => $portNumber,
            'tid'   => $tenantId,
        ]);

        // Check if box is now full
        $avail = (int)$db->query("
            SELECT COUNT(*) FROM ftth_box_ports 
            WHERE box_id = {$boxId} AND status = 'available'
        ")->fetchColumn();

        if ($avail === 0) {
            $db->prepare("UPDATE ftth_boxes SET status = 'full' WHERE id = :bid")->execute(['bid' => $boxId]);
        } else {
            $db->prepare("UPDATE ftth_boxes SET status = 'active' WHERE id = :bid AND status = 'full'")->execute(['bid' => $boxId]);
        }

        return true;
    }

    /**
     * Unassign a customer from a port (free up port)
     */
    public static function unassignPort(int $tenantId, int $boxId, int $portNumber): bool {
        $db = Database::getConnection();

        $stmt = $db->prepare("
            UPDATE ftth_box_ports SET 
                customer_id = NULL,
                onu_mac = NULL,
                optical_rx_power = NULL,
                status = 'available',
                notes = NULL,
                updated_at = NOW()
            WHERE box_id = :bid AND port_number = :pnum AND tenant_id = :tid
        ");
        $stmt->execute(['bid' => $boxId, 'pnum' => $portNumber, 'tid' => $tenantId]);

        // Box is no longer full
        $db->prepare("UPDATE ftth_boxes SET status = 'active' WHERE id = :bid AND status = 'full'")->execute(['bid' => $boxId]);

        return true;
    }

    /**
     * Feasibility Check: Find nearest boxes with available ports from given GPS coordinates
     */
    public static function findNearest(int $tenantId, float $lat, float $lng, float $maxRadiusKm = 10.0): array {
        $db = Database::getConnection();

        // Haversine formula in SQL (earth radius ~ 6371 km)
        $sql = "
            SELECT 
                b.id,
                b.box_name,
                b.box_code,
                b.box_type,
                b.latitude,
                b.longitude,
                b.address,
                b.pole_number,
                b.splitter_ratio,
                b.total_ports,
                b.optical_input_power,
                b.status,
                (6371000 * acos(
                    cos(radians(:lat)) * cos(radians(b.latitude)) * cos(radians(b.longitude) - radians(:lng)) + 
                    sin(radians(:lat)) * sin(radians(b.latitude))
                )) AS distance_meters,
                COALESCE(SUM(CASE WHEN p.status = 'available' THEN 1 ELSE 0 END), 0) AS available_ports,
                COALESCE(SUM(CASE WHEN p.status = 'occupied' THEN 1 ELSE 0 END), 0) AS occupied_ports
            FROM ftth_boxes b
            LEFT JOIN ftth_box_ports p ON p.box_id = b.id
            WHERE b.tenant_id = :tid
              AND b.status != 'damaged'
            GROUP BY b.id
            HAVING distance_meters <= (:max_km * 1000)
            ORDER BY distance_meters ASC
            LIMIT 10
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute([
            'lat'    => $lat,
            'lng'    => $lng,
            'tid'    => $tenantId,
            'max_km' => $maxRadiusKm,
        ]);

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($r) {
            $dist = (int)round((float)$r['distance_meters']);
            return [
                'boxId'             => (int)$r['id'],
                'boxName'           => $r['box_name'],
                'boxCode'           => $r['box_code'],
                'boxType'           => $r['box_type'],
                'latitude'          => (float)$r['latitude'],
                'longitude'         => (float)$r['longitude'],
                'address'           => $r['address'],
                'poleNumber'        => $r['pole_number'],
                'splitterRatio'     => $r['splitter_ratio'],
                'totalPorts'        => (int)$r['total_ports'],
                'availablePorts'    => (int)$r['available_ports'],
                'occupiedPorts'     => (int)$r['occupied_ports'],
                'distanceMeters'    => $dist,
                'distanceDisplay'   => $dist >= 1000 ? round($dist / 1000, 2) . ' km' : $dist . ' meters',
                'isFeasible'        => ((int)$r['available_ports'] > 0),
                'recommendedCable'  => $dist <= 150 ? 'Standard Drop Cable (1-Core)' : 'Reinforced Messenger Drop Cable',
            ];
        }, $results);
    }

    /**
     * Get all fiber cables/routes for map polylines
     */
    public static function getCables(int $tenantId): array {
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT 
                c.*,
                b_to.box_name AS to_box_name,
                b_to.latitude AS to_lat,
                b_to.longitude AS to_lng,
                CASE 
                    WHEN c.from_type = 'box' THEN b_from.box_name 
                    ELSE nd.device_name 
                END AS from_name,
                CASE 
                    WHEN c.from_type = 'box' THEN b_from.latitude 
                    ELSE NULL 
                END AS from_lat,
                CASE 
                    WHEN c.from_type = 'box' THEN b_from.longitude 
                    ELSE NULL 
                END AS from_lng
            FROM ftth_cables c
            LEFT JOIN ftth_boxes b_to ON b_to.id = c.to_box_id
            LEFT JOIN ftth_boxes b_from ON (c.from_type = 'box' AND b_from.id = c.from_id)
            LEFT JOIN network_devices nd ON (c.from_type = 'olt' AND nd.network_device_id = c.from_id)
            WHERE c.tenant_id = :tid
            ORDER BY c.id ASC
        ");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($c) {
            $coords = [];
            if (!empty($c['route_coords'])) {
                $coords = json_decode($c['route_coords'], true) ?: [];
            }
            // Fallback straight line between from and to if route_coords empty
            if (empty($coords) && !empty($c['from_lat']) && !empty($c['to_lat'])) {
                $coords = [
                    [(float)$c['from_lat'], (float)$c['from_lng']],
                    [(float)$c['to_lat'], (float)$c['to_lng']]
                ];
            }

            return [
                'id'           => (int)$c['id'],
                'cableName'    => $c['cable_name'],
                'coreCount'    => (int)$c['core_count'],
                'fromType'     => $c['from_type'],
                'fromId'       => $c['from_id'] ? (int)$c['from_id'] : null,
                'fromName'     => $c['from_name'] ?: 'NOC / OLT',
                'toBoxId'      => (int)$c['to_box_id'],
                'toBoxName'    => $c['to_box_name'] ?: 'Box #' . $c['to_box_id'],
                'color'        => $c['color'] ?: '#3b82f6',
                'lengthMeters' => $c['length_meters'] ? (int)$c['length_meters'] : null,
                'status'       => $c['status'],
                'routeCoords'  => $coords,
            ];
        }, $rows);
    }

    /**
     * Save/Create a fiber cable route
     */
    public static function saveCable(int $tenantId, array $data): array {
        $db = Database::getConnection();

        $name = trim($data['cable_name'] ?? '');
        $core = (int)($data['core_count'] ?? 12);
        $fromType = $data['from_type'] ?? 'olt';
        $fromId = !empty($data['from_id']) ? (int)$data['from_id'] : null;
        $toBoxId = (int)($data['to_box_id'] ?? 0);
        $color = $data['color'] ?? '#3b82f6';
        $length = !empty($data['length_meters']) ? (int)$data['length_meters'] : null;
        $status = $data['status'] ?? 'active';
        $coords = !empty($data['route_coords']) ? json_encode($data['route_coords']) : null;

        if (empty($name) || $toBoxId <= 0) {
            throw new InvalidArgumentException('Cable name and destination box are required');
        }

        $stmt = $db->prepare("
            INSERT INTO ftth_cables 
                (tenant_id, cable_name, core_count, from_type, from_id, to_box_id, color, length_meters, status, route_coords)
            VALUES 
                (:tid, :name, :core, :ftype, :fid, :toid, :col, :len, :stat, :coords)
        ");
        $stmt->execute([
            'tid'   => $tenantId,
            'name'  => $name,
            'core'  => $core,
            'ftype' => $fromType,
            'fid'   => $fromId,
            'toid'  => $toBoxId,
            'col'   => $color,
            'len'   => $length,
            'stat'  => $status,
            'coords'=> $coords,
        ]);

        $id = (int)$db->lastInsertId();
        return ['id' => $id, 'success' => true];
    }

    /**
     * Delete fiber cable
     */
    public static function deleteCable(int $tenantId, int $cableId): bool {
        $db = Database::getConnection();
        $stmt = $db->prepare("DELETE FROM ftth_cables WHERE id = :id AND tenant_id = :tid");
        return $stmt->execute(['id' => $cableId, 'tid' => $tenantId]);
    }

    /**
     * Summary Telemetry KPIs for FTTH Dashboard
     */
    public static function getStats(int $tenantId): array {
        $db = Database::getConnection();

        $totalBoxes = (int)$db->query("SELECT COUNT(*) FROM ftth_boxes WHERE tenant_id = {$tenantId}")->fetchColumn();
        $totalPorts = (int)$db->query("SELECT COALESCE(SUM(total_ports), 0) FROM ftth_boxes WHERE tenant_id = {$tenantId}")->fetchColumn();

        $portStats = $db->query("
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END), 0) AS occupied,
                COALESCE(SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END), 0) AS available,
                COALESCE(SUM(CASE WHEN status = 'damaged' THEN 1 ELSE 0 END), 0) AS damaged,
                COALESCE(SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END), 0) AS reserved
            FROM ftth_box_ports 
            WHERE tenant_id = {$tenantId}
        ")->fetch(PDO::FETCH_ASSOC);

        $occupied = (int)($portStats['occupied'] ?? 0);
        $available = (int)($portStats['available'] ?? 0);
        $damaged = (int)($portStats['damaged'] ?? 0);
        $reserved = (int)($portStats['reserved'] ?? 0);

        $totalCables = (int)$db->query("SELECT COUNT(*) FROM ftth_cables WHERE tenant_id = {$tenantId}")->fetchColumn();

        return [
            'totalBoxes'        => $totalBoxes,
            'totalPorts'        => $totalPorts,
            'occupiedPorts'     => $occupied,
            'availablePorts'    => $available,
            'damagedPorts'      => $damaged,
            'reservedPorts'     => $reserved,
            'totalCables'       => $totalCables,
            'utilizationRate'   => $totalPorts > 0 ? (int)round(($occupied / $totalPorts) * 100) : 0,
        ];
    }
}
