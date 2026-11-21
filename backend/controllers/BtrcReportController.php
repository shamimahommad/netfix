<?php
/**
 * NetFix ISP SaaS - BTRC Monthly Return Report Controller
 * 
 * Generates exact BTRC & ISPbills standard Excel format:
 * Exactly 15 standard columns:
 * 1. client_type ('Home', 'Corporate', 'SME')
 * 2. connection_type ('Wired', 'Wireless')
 * 3. client_username (Subscriber numeric ID / code)
 * 4. bandwidth_distribution_point ('NOC' / Area)
 * 5. connectivity_type ('Shared', 'Dedicated')
 * 6. activation_date ('YYYY-MM-DD')
 * 7. bandwidth_allocation (Mbps as integer/number)
 * 8. allocated_ip (PPPoE Username / IP address)
 * 9. division ('Rajshahi')
 * 10. district ('Bogura')
 * 11. thana ('Shariakandi')
 * 12. address (Installation address or empty string)
 * 13. client_mobile (Mobile phone)
 * 14. client_email (Email or empty string)
 * 15. selling_price_bdt_excluding_vat (Monthly price excluding 5% VAT)
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';
require_once __DIR__ . '/../lib/ActivityLogger.php';

class BtrcReportController {

    public static function getReportData(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = (int)AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $year = isset($_GET['year']) && is_numeric($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
        $month = isset($_GET['month']) && is_numeric($_GET['month']) ? (int)$_GET['month'] : (int)date('n');
        $filterCategory = trim($_GET['client_type'] ?? $_GET['category'] ?? 'all'); // 'all', 'Home', 'Corporate', 'SME'
        $filterStatus = trim($_GET['status'] ?? 'active'); // 'all', 'active', 'expired'
        $search = trim($_GET['search'] ?? '');
        $export = trim($_GET['export'] ?? '');
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(500, max(10, (int)($_GET['limit'] ?? 50)));
        if ($export === 'all') {
            $limit = 20000;
            $page = 1;
        }

        // Fetch BTRC Settings from tenant_settings
        $stmtSettings = $db->prepare("SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = :tid AND setting_key LIKE 'btrc_%'");
        $stmtSettings->execute(['tid' => $tenantId]);
        $rawSettings = $stmtSettings->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        $defaultDivision = $rawSettings['btrc_default_division'] ?? 'Rajshahi';
        $defaultDistrict = $rawSettings['btrc_default_district'] ?? 'Bogura';
        $defaultThana = $rawSettings['btrc_default_thana'] ?? 'Shariakandi';
        $defaultDistPoint = $rawSettings['btrc_distribution_point'] ?? 'NOC';
        $vatPct = isset($rawSettings['btrc_vat_percentage']) && is_numeric($rawSettings['btrc_vat_percentage']) 
            ? (float)$rawSettings['btrc_vat_percentage'] 
            : 5.0;

        // Downward Scope Clause
        $scope = HierarchySecurityService::getDownwardScopeClause((int)$user['user_id'], $tenantId, 'c', 'u');
        $scopeWhere = !empty($scope['whereSql']) ? $scope['whereSql'] : "c.tenant_id = :tid";
        $scopeParams = $scope['params'];
        if (empty($scopeParams['scope_tenant_id']) && empty($scopeParams['tid'])) {
            $scopeParams['tid'] = $tenantId;
        }

        $whereFilters = ["{$scopeWhere}"];
        $queryParams = $scopeParams;

        // Status Filter: default to active since BTRC report is for active subscriber return
        if ($filterStatus === 'active') {
            $whereFilters[] = "c.status = 'active' AND COALESCE(c.billing_status, '') NOT IN ('Expired', 'Left')";
        } elseif ($filterStatus === 'expired') {
            $whereFilters[] = "(c.billing_status = 'Expired' OR (cs.expires_at IS NOT NULL AND cs.expires_at < NOW() AND c.status = 'active'))";
        } elseif ($filterStatus === 'left') {
            $whereFilters[] = "(c.billing_status = 'Left' OR c.status IN ('terminated', 'cancelled'))";
        }

        if (strtolower($filterCategory) !== 'all' && $filterCategory !== '') {
            $whereFilters[] = "LOWER(CASE 
                WHEN c.btrc_category IN ('home', 'corporate', 'sme') THEN c.btrc_category
                WHEN c.customer_type = 'business' THEN 'corporate'
                WHEN ap.price >= 3000 THEN 'corporate'
                WHEN ap.price >= 1500 THEN 'sme'
                ELSE 'home'
            END) = :f_category";
            $queryParams['f_category'] = strtolower($filterCategory);
        }

        if ($search !== '') {
            $whereFilters[] = "(c.customer_code LIKE :search OR c.customer_id LIKE :search OR c.full_name LIKE :search OR c.phone LIKE :search OR na.username LIKE :search OR na.current_ip LIKE :search)";
            $queryParams['search'] = '%' . $search . '%';
        }

        $detailWhereSql = implode(' AND ', $whereFilters);

        // Count total matching subscribers
        $countSql = "SELECT COUNT(DISTINCT c.customer_id) 
            FROM customers c
            LEFT JOIN users u ON u.user_id = c.owner_id
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            WHERE {$detailWhereSql}";

        $stmtCount = $db->prepare($countSql);
        $stmtCount->execute($queryParams);
        $totalRows = (int)$stmtCount->fetchColumn();

        // Summary Aggregates for Top Cards
        $aggSql = "SELECT 
            COUNT(DISTINCT c.customer_id) as total_active,
            COUNT(DISTINCT CASE WHEN LOWER(COALESCE(c.btrc_category, 'home')) = 'home' AND c.customer_type != 'business' THEN c.customer_id END) as home_count,
            COUNT(DISTINCT CASE WHEN LOWER(COALESCE(c.btrc_category, '')) = 'corporate' OR c.customer_type = 'business' THEN c.customer_id END) as corporate_count,
            COUNT(DISTINCT CASE WHEN LOWER(COALESCE(c.btrc_category, '')) = 'sme' THEN c.customer_id END) as sme_count,
            COALESCE(SUM(ROUND(COALESCE(ap.download_speed_kbps, 0) / 1024, 0)), 0) as total_bandwidth_mbps,
            COALESCE(SUM(COALESCE(ap.price, 0)), 0) as total_revenue_inc_vat
        FROM customers c
        LEFT JOIN users u ON u.user_id = c.owner_id
        LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
        LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
        WHERE {$scopeWhere} AND c.status = 'active' AND COALESCE(c.billing_status, '') NOT IN ('Expired', 'Left')";

        $stmtAgg = $db->prepare($aggSql);
        $stmtAgg->execute($scopeParams);
        $aggData = $stmtAgg->fetch(PDO::FETCH_ASSOC) ?: [];

        $totalRevIncVat = (float)($aggData['total_revenue_inc_vat'] ?? 0);
        $vatFactor = 1 + ($vatPct / 100);
        $totalRevExVat = round($totalRevIncVat / $vatFactor, 2);

        $offset = ($page - 1) * $limit;

        $listSql = "SELECT 
            c.customer_id,
            c.customer_code,
            c.full_name,
            c.phone,
            c.email,
            c.installation_address,
            COALESCE(c.division, c.state_province, :def_div) as division,
            COALESCE(c.district, c.city, :def_dist) as district,
            COALESCE(c.thana, sa.name, :def_thana) as thana,
            COALESCE(c.distribution_point, :def_point) as bandwidth_distribution_point,
            COALESCE(c.connectivity_sharing, CASE WHEN c.customer_type = 'business' OR ap.price >= 3000 THEN 'Dedicated' ELSE 'Shared' END) as connectivity_type,
            COALESCE(c.connection_date, DATE(c.created_at)) as activation_date,
            CASE 
                WHEN c.btrc_category = 'corporate' THEN 'Corporate'
                WHEN c.btrc_category = 'sme' THEN 'SME'
                WHEN c.btrc_category = 'home' THEN 'Home'
                WHEN c.customer_type = 'business' THEN 'Corporate'
                WHEN ap.price >= 3000 THEN 'Corporate'
                WHEN ap.price >= 1500 THEN 'SME'
                ELSE 'Home'
            END as client_type,
            CASE 
                WHEN c.connectivity_type = 'wireless' THEN 'Wireless'
                ELSE 'Wired'
            END as connection_type,
            ROUND(COALESCE(ap.download_speed_kbps, 0) / 1024, 0) as bandwidth_allocation,
            COALESCE(NULLIF(na.username, ''), NULLIF(na.current_ip, ''), NULLIF(na.remote_address, ''), c.customer_code) as allocated_ip,
            COALESCE(ap.price, 0) as price_inc_vat,
            c.status,
            c.billing_status
        FROM customers c
        LEFT JOIN users u ON u.user_id = c.owner_id
        LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
        LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
        LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
        LEFT JOIN service_areas sa ON sa.tenant_id = c.tenant_id AND (
            sa.service_area_id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.area_id')), '') AS UNSIGNED)
            OR sa.name = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.area')), '')
            OR sa.name = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.area_name')), '')
        )
        WHERE {$detailWhereSql}
        GROUP BY c.customer_id
        ORDER BY c.customer_id ASC
        LIMIT :limit OFFSET :offset";

        $listParams = array_merge($queryParams, [
            'def_div' => $defaultDivision,
            'def_dist' => $defaultDistrict,
            'def_thana' => $defaultThana,
            'def_point' => $defaultDistPoint,
            'limit' => $limit,
            'offset' => $offset,
        ]);

        $stmtList = $db->prepare($listSql);
        foreach ($listParams as $k => $v) {
            if ($k === 'limit' || $k === 'offset') {
                $stmtList->bindValue(":$k", (int)$v, PDO::PARAM_INT);
            } else {
                $stmtList->bindValue(":$k", $v);
            }
        }
        $stmtList->execute();
        $subscribers = $stmtList->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Format into exact 15-column BTRC structure
        $formattedRows = [];
        foreach ($subscribers as $sub) {
            $rawPrice = (float)$sub['price_inc_vat'];
            // Price excluding 5% VAT: 500 / 1.05 = 476, 1000 / 1.05 = 952
            $priceExVat = (int)round($rawPrice / $vatFactor);
            $bwMbps = (int)$sub['bandwidth_allocation'];
            if ($bwMbps <= 0) $bwMbps = 20; // default minimum BTRC broadband

            $formattedRows[] = [
                'client_type' => $sub['client_type'], // 'Home', 'Corporate', 'SME'
                'connection_type' => $sub['connection_type'], // 'Wired', 'Wireless'
                'client_username' => (string)($sub['customer_code'] ?: $sub['customer_id']),
                'bandwidth_distribution_point' => $sub['bandwidth_distribution_point'] ?: 'NOC',
                'connectivity_type' => $sub['connectivity_type'] ?: 'Shared', // 'Shared', 'Dedicated'
                'activation_date' => $sub['activation_date'] ? date('Y-m-d', strtotime($sub['activation_date'])) : date('Y-m-d'),
                'bandwidth_allocation' => $bwMbps,
                'allocated_ip' => (string)$sub['allocated_ip'], // PPPoE username as expected by BTRC ISPbills
                'division' => (string)$sub['division'],
                'district' => (string)$sub['district'],
                'thana' => (string)$sub['thana'],
                'address' => (string)($sub['installation_address'] ?: ''),
                'client_mobile' => (string)$sub['phone'],
                'client_email' => (string)($sub['email'] ?: ''),
                'selling_price_bdt_excluding_vat' => $priceExVat,
                // auxiliary metadata for UI table
                'customer_id' => (int)$sub['customer_id'],
                'full_name' => $sub['full_name'],
                'status' => $sub['status'],
                'billing_status' => $sub['billing_status'],
            ];
        }

        Response::json([
            'success' => true,
            'data' => [
                'summary' => [
                    'total_subscribers' => (int)($aggData['total_active'] ?? 0),
                    'home_count' => (int)($aggData['home_count'] ?? 0),
                    'corporate_count' => (int)($aggData['corporate_count'] ?? 0),
                    'sme_count' => (int)($aggData['sme_count'] ?? 0),
                    'total_bandwidth_mbps' => (float)($aggData['total_bandwidth_mbps'] ?? 0),
                    'total_revenue_ex_vat' => $totalRevExVat,
                    'total_revenue_inc_vat' => $totalRevIncVat,
                ],
                'settings' => [
                    'division' => $defaultDivision,
                    'district' => $defaultDistrict,
                    'thana' => $defaultThana,
                    'distribution_point' => $defaultDistPoint,
                    'vat_percentage' => $vatPct,
                ],
                'rows' => $formattedRows,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $totalRows,
                    'total_pages' => $limit > 0 ? (int)ceil($totalRows / $limit) : 1,
                ],
            ],
        ]);
    }

    public static function updateBtrcSettings(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = (int)AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $allowedKeys = [
            'btrc_default_division',
            'btrc_default_district',
            'btrc_default_thana',
            'btrc_distribution_point',
            'btrc_vat_percentage',
        ];

        $stmt = $db->prepare("INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, created_at, updated_at) 
            VALUES (:tid, :key, :val, NOW(), NOW())
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()");

        foreach ($allowedKeys as $key) {
            if (isset($input[$key])) {
                $stmt->execute([
                    'tid' => $tenantId,
                    'key' => $key,
                    'val' => trim((string)$input[$key]),
                ]);
            }
        }

        ActivityLogger::log($tenantId, (int)$user['user_id'], 'Updated BTRC ISPbills Report Settings', 'btrc_settings', $tenantId);

        Response::json([
            'success' => true,
            'message' => 'BTRC settings updated successfully.',
        ]);
    }

    public static function bulkUpdateCustomerCategory(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = (int)AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $customerIds = $input['customer_ids'] ?? [];
        $clientType = trim($input['client_type'] ?? $input['btrc_category'] ?? ''); // 'Home', 'Corporate', 'SME'
        $connectivitySharing = trim($input['connectivity_type'] ?? $input['connectivity_sharing'] ?? ''); // 'Shared', 'Dedicated'
        $connectionType = trim($input['connection_type'] ?? ''); // 'Wired', 'Wireless'
        $distributionPoint = trim($input['distribution_point'] ?? '');
        $division = trim($input['division'] ?? '');
        $district = trim($input['district'] ?? '');
        $thana = trim($input['thana'] ?? '');

        if (empty($customerIds) || !is_array($customerIds)) {
            Response::error('Invalid or empty customer_ids provided.', 400);
            return;
        }

        $ids = array_map('intval', $customerIds);
        $ids = array_filter($ids, fn($id) => $id > 0);
        if (empty($ids)) {
            Response::error('No valid customer IDs given.', 400);
            return;
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        
        $updateFields = [];
        $params = [];

        if ($clientType !== '') {
            $catLower = strtolower($clientType);
            if (in_array($catLower, ['home', 'corporate', 'sme'], true)) {
                $updateFields[] = "btrc_category = ?";
                $params[] = $catLower;
            }
        }

        if ($connectivitySharing !== '' && in_array(ucfirst(strtolower($connectivitySharing)), ['Shared', 'Dedicated'], true)) {
            $updateFields[] = "connectivity_sharing = ?";
            $params[] = ucfirst(strtolower($connectivitySharing));
        }

        if ($connectionType !== '' && in_array(strtolower($connectionType), ['wired', 'wireless'], true)) {
            $updateFields[] = "connectivity_type = ?";
            $params[] = strtolower($connectionType) === 'wireless' ? 'wireless' : 'fiber';
        }

        if ($distributionPoint !== '') {
            $updateFields[] = "distribution_point = ?";
            $params[] = $distributionPoint;
        }
        if ($division !== '') {
            $updateFields[] = "division = ?";
            $params[] = $division;
        }
        if ($district !== '') {
            $updateFields[] = "district = ?";
            $params[] = $district;
        }
        if ($thana !== '') {
            $updateFields[] = "thana = ?";
            $params[] = $thana;
        }

        if (empty($updateFields)) {
            Response::error('No valid fields to update.', 400);
            return;
        }

        $updateFields[] = "updated_at = NOW()";

        $sql = "UPDATE customers SET " . implode(', ', $updateFields) . " 
            WHERE tenant_id = ? AND customer_id IN ({$placeholders})";
        
        $execParams = array_merge($params, [$tenantId], $ids);

        $stmt = $db->prepare($sql);
        $stmt->execute($execParams);
        $affected = $stmt->rowCount();

        ActivityLogger::log($tenantId, (int)$user['user_id'], "Bulk updated {$affected} customers for BTRC report", 'customers', 0);

        Response::json([
            'success' => true,
            'message' => "Successfully updated {$affected} subscribers for BTRC report.",
            'affected' => $affected,
        ]);
    }
}
