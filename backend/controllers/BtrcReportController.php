<?php
/**
 * NetFix ISP SaaS - BTRC Monthly Return Report Controller
 * 
 * Generates BTRC prescribed Excel data and summaries:
 * 1. Operator License & Upstream Profile
 * 2. Category-wise Summary (Home, Corporate, SME) with Bandwidth & Revenue
 * 3. Bandwidth Slab Distribution (<10M, 10-20M, 20-50M, 50-100M, >100M)
 * 4. Standard 17-column BTRC Subscriber KYC Roster
 * 5. Batch Classification & License Configuration
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
        $filterCategory = trim($_GET['category'] ?? 'all'); // 'all', 'home', 'corporate', 'sme'
        $filterStatus = trim($_GET['status'] ?? 'all');     // 'all', 'active', 'expired', 'left'
        $search = trim($_GET['search'] ?? '');
        $export = trim($_GET['export'] ?? '');             // 'all' or empty
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(500, max(10, (int)($_GET['limit'] ?? 50)));
        if ($export === 'all') {
            $limit = 15000;
            $page = 1;
        }

        $startDate = sprintf('%04d-%02d-01 00:00:00', $year, $month);
        $endDate = date('Y-m-t 23:59:59', strtotime($startDate));
        $prevEndDate = date('Y-m-d 23:59:59', strtotime("$startDate -1 second"));

        // 1. Fetch Tenant Profile & BTRC License Settings
        $stmtTenant = $db->prepare("SELECT tenant_id, tenant_name, business_email, business_phone, support_phone, business_address, logo_url FROM tenants WHERE tenant_id = :tid");
        $stmtTenant->execute(['tid' => $tenantId]);
        $tenant = $stmtTenant->fetch(PDO::FETCH_ASSOC) ?: [];

        $stmtSettings = $db->prepare("SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = :tid AND setting_key LIKE 'btrc_%'");
        $stmtSettings->execute(['tid' => $tenantId]);
        $rawSettings = $stmtSettings->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        $btrcProfile = [
            'operator_name' => $tenant['tenant_name'] ?? 'ISP Network',
            'license_no' => $rawSettings['btrc_license_no'] ?? 'BTRC/LL/ISP-' . ($tenant['tenant_id'] ?? '1001'),
            'license_category' => $rawSettings['btrc_license_category'] ?? 'Nationwide',
            'purchased_bandwidth_mbps' => (float)($rawSettings['btrc_purchased_bandwidth_mbps'] ?? 2000),
            'contact_person' => $rawSettings['btrc_contact_person'] ?? ($tenant['tenant_name'] . ' Operations'),
            'contact_designation' => $rawSettings['btrc_contact_designation'] ?? 'Authorized Representative / Head of NOC',
            'contact_phone' => $rawSettings['btrc_contact_phone'] ?? ($tenant['support_phone'] ?: $tenant['business_phone'] ?: '01700000000'),
            'contact_email' => $rawSettings['btrc_contact_email'] ?? ($tenant['business_email'] ?? 'support@isp.net'),
            'address' => $tenant['business_address'] ?? 'Dhaka, Bangladesh',
            'default_thana' => $rawSettings['btrc_default_thana'] ?? 'Sariyakandi',
            'default_district' => $rawSettings['btrc_default_district'] ?? 'Bogura',
            'reporting_month' => date('F', strtotime($startDate)),
            'reporting_year' => $year,
            'reporting_period' => date('F Y', strtotime($startDate)),
        ];

        // 2. Downward Scope Clause
        $scope = HierarchySecurityService::getDownwardScopeClause((int)$user['user_id'], $tenantId, 'c', 'u');
        $scopeWhere = !empty($scope['whereSql']) ? $scope['whereSql'] : "c.tenant_id = :tid";
        $scopeParams = $scope['params'];
        if (empty($scopeParams['scope_tenant_id']) && empty($scopeParams['tid'])) {
            $scopeParams['tid'] = $tenantId;
        }

        // 3. Category Summary (Home, Corporate, SME)
        // Auto-classify: if btrc_category is explicitly set, use it; else if customer_type = 'business' or ap.price >= 2500 -> 'corporate' / 'sme', else 'home'
        $categorySql = "SELECT 
            CASE 
                WHEN c.btrc_category IN ('home', 'corporate', 'sme') THEN c.btrc_category
                WHEN c.customer_type = 'business' THEN 'corporate'
                WHEN ap.price >= 3000 THEN 'corporate'
                WHEN ap.price >= 1500 THEN 'sme'
                ELSE 'home'
            END as category_key,
            COUNT(DISTINCT c.customer_id) as total_customers,
            COUNT(DISTINCT CASE WHEN c.status = 'active' AND COALESCE(c.billing_status, '') NOT IN ('Expired', 'Left') THEN c.customer_id END) as active_customers,
            COUNT(DISTINCT CASE WHEN (c.connection_date >= :start_date AND c.connection_date <= :end_date) OR (c.created_at >= :start_date AND c.created_at <= :end_date) THEN c.customer_id END) as new_connected,
            COUNT(DISTINCT CASE WHEN (c.billing_status = 'Left' OR c.status IN ('terminated', 'cancelled')) AND (c.updated_at >= :start_date AND c.updated_at <= :end_date) THEN c.customer_id END) as disconnected,
            COUNT(DISTINCT CASE WHEN c.billing_status = 'Expired' OR (cs.expires_at IS NOT NULL AND cs.expires_at < NOW() AND c.status = 'active') THEN c.customer_id END) as expired_customers,
            COALESCE(SUM(CASE WHEN c.status = 'active' AND COALESCE(c.billing_status, '') NOT IN ('Expired', 'Left') THEN ROUND(COALESCE(ap.download_speed_kbps, 0) / 1024, 2) ELSE 0 END), 0) as total_download_mbps,
            COALESCE(SUM(CASE WHEN c.status = 'active' AND COALESCE(c.billing_status, '') NOT IN ('Expired', 'Left') THEN ROUND(COALESCE(ap.upload_speed_kbps, 0) / 1024, 2) ELSE 0 END), 0) as total_upload_mbps,
            COALESCE(SUM(CASE WHEN c.status = 'active' AND COALESCE(c.billing_status, '') NOT IN ('Expired', 'Left') THEN COALESCE(ap.price, 0) ELSE 0 END), 0) as total_revenue_bdt
        FROM customers c
        LEFT JOIN users u ON u.user_id = c.owner_id
        LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
        LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
        WHERE {$scopeWhere}
        GROUP BY category_key";

        $catParams = array_merge($scopeParams, [
            'start_date' => $startDate,
            'end_date' => $endDate,
        ]);

        $stmtCat = $db->prepare($categorySql);
        $stmtCat->execute($catParams);
        $rawCategoryRows = $stmtCat->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Normalize categories into standard 3: home, corporate, sme
        $categorySummaries = [
            'home' => [
                'category_name' => 'Home (Residential)',
                'btrc_code' => 'Home',
                'total_subscribers' => 0,
                'active_subscribers' => 0,
                'new_connections' => 0,
                'disconnected' => 0,
                'expired' => 0,
                'prev_month_active' => 0,
                'total_bandwidth_mbps' => 0.0,
                'total_upload_mbps' => 0.0,
                'avg_bandwidth_mbps' => 0.0,
                'total_revenue_bdt' => 0.0,
            ],
            'corporate' => [
                'category_name' => 'Corporate (Enterprise / Large Inst.)',
                'btrc_code' => 'Corporate',
                'total_subscribers' => 0,
                'active_subscribers' => 0,
                'new_connections' => 0,
                'disconnected' => 0,
                'expired' => 0,
                'prev_month_active' => 0,
                'total_bandwidth_mbps' => 0.0,
                'total_upload_mbps' => 0.0,
                'avg_bandwidth_mbps' => 0.0,
                'total_revenue_bdt' => 0.0,
            ],
            'sme' => [
                'category_name' => 'SME (Small & Medium Enterprise)',
                'btrc_code' => 'SME',
                'total_subscribers' => 0,
                'active_subscribers' => 0,
                'new_connections' => 0,
                'disconnected' => 0,
                'expired' => 0,
                'prev_month_active' => 0,
                'total_bandwidth_mbps' => 0.0,
                'total_upload_mbps' => 0.0,
                'avg_bandwidth_mbps' => 0.0,
                'total_revenue_bdt' => 0.0,
            ],
        ];

        foreach ($rawCategoryRows as $r) {
            $k = strtolower($r['category_key']);
            if (!isset($categorySummaries[$k])) {
                $k = 'home';
            }
            $act = (int)$r['active_customers'];
            $new = (int)$r['new_connected'];
            $disc = (int)$r['disconnected'];
            $bw = round((float)$r['total_download_mbps'], 2);
            $upBw = round((float)$r['total_upload_mbps'], 2);
            $rev = round((float)$r['total_revenue_bdt'], 2);

            $categorySummaries[$k]['total_subscribers'] += (int)$r['total_customers'];
            $categorySummaries[$k]['active_subscribers'] += $act;
            $categorySummaries[$k]['new_connections'] += $new;
            $categorySummaries[$k]['disconnected'] += $disc;
            $categorySummaries[$k]['expired'] += (int)$r['expired_customers'];
            $categorySummaries[$k]['total_bandwidth_mbps'] += $bw;
            $categorySummaries[$k]['total_upload_mbps'] += $upBw;
            $categorySummaries[$k]['total_revenue_bdt'] += $rev;
            $categorySummaries[$k]['prev_month_active'] = max(0, $act - $new + $disc);
            $categorySummaries[$k]['avg_bandwidth_mbps'] = $act > 0 ? round($bw / $act, 2) : 0.0;
        }

        // Totals
        $grandTotals = [
            'total_subscribers' => 0,
            'active_subscribers' => 0,
            'new_connections' => 0,
            'disconnected' => 0,
            'expired' => 0,
            'prev_month_active' => 0,
            'total_bandwidth_mbps' => 0.0,
            'total_upload_mbps' => 0.0,
            'avg_bandwidth_mbps' => 0.0,
            'total_revenue_bdt' => 0.0,
        ];
        foreach ($categorySummaries as $item) {
            $grandTotals['total_subscribers'] += $item['total_subscribers'];
            $grandTotals['active_subscribers'] += $item['active_subscribers'];
            $grandTotals['new_connections'] += $item['new_connections'];
            $grandTotals['disconnected'] += $item['disconnected'];
            $grandTotals['expired'] += $item['expired'];
            $grandTotals['prev_month_active'] += $item['prev_month_active'];
            $grandTotals['total_bandwidth_mbps'] += $item['total_bandwidth_mbps'];
            $grandTotals['total_upload_mbps'] += $item['total_upload_mbps'];
            $grandTotals['total_revenue_bdt'] += $item['total_revenue_bdt'];
        }
        $grandTotals['avg_bandwidth_mbps'] = $grandTotals['active_subscribers'] > 0 
            ? round($grandTotals['total_bandwidth_mbps'] / $grandTotals['active_subscribers'], 2) 
            : 0.0;

        // 4. Bandwidth Slabs Breakdown (BTRC Standard Speed Slabs)
        $slabSql = "SELECT 
            CASE 
                WHEN (COALESCE(ap.download_speed_kbps, 0) / 1024) < 10 THEN 'below_10'
                WHEN (COALESCE(ap.download_speed_kbps, 0) / 1024) >= 10 AND (COALESCE(ap.download_speed_kbps, 0) / 1024) < 20 THEN '10_to_20'
                WHEN (COALESCE(ap.download_speed_kbps, 0) / 1024) >= 20 AND (COALESCE(ap.download_speed_kbps, 0) / 1024) < 50 THEN '20_to_50'
                WHEN (COALESCE(ap.download_speed_kbps, 0) / 1024) >= 50 AND (COALESCE(ap.download_speed_kbps, 0) / 1024) < 100 THEN '50_to_100'
                ELSE '100_and_above'
            END as speed_slab,
            CASE 
                WHEN c.btrc_category IN ('home', 'corporate', 'sme') THEN c.btrc_category
                WHEN c.customer_type = 'business' THEN 'corporate'
                WHEN ap.price >= 3000 THEN 'corporate'
                WHEN ap.price >= 1500 THEN 'sme'
                ELSE 'home'
            END as category_key,
            COUNT(DISTINCT c.customer_id) as subscriber_count,
            COALESCE(SUM(ROUND(COALESCE(ap.download_speed_kbps, 0) / 1024, 2)), 0) as slab_bandwidth_mbps
        FROM customers c
        LEFT JOIN users u ON u.user_id = c.owner_id
        LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
        LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
        WHERE {$scopeWhere} AND c.status = 'active' AND COALESCE(c.billing_status, '') NOT IN ('Expired', 'Left')
        GROUP BY speed_slab, category_key";

        $stmtSlab = $db->prepare($slabSql);
        $stmtSlab->execute($scopeParams);
        $rawSlabs = $stmtSlab->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $bandwidthSlabs = [
            'below_10' => ['label' => '< 10 Mbps', 'home' => 0, 'corporate' => 0, 'sme' => 0, 'total' => 0, 'total_mbps' => 0.0],
            '10_to_20' => ['label' => '10 Mbps - 20 Mbps', 'home' => 0, 'corporate' => 0, 'sme' => 0, 'total' => 0, 'total_mbps' => 0.0],
            '20_to_50' => ['label' => '20 Mbps - 50 Mbps', 'home' => 0, 'corporate' => 0, 'sme' => 0, 'total' => 0, 'total_mbps' => 0.0],
            '50_to_100' => ['label' => '50 Mbps - 100 Mbps', 'home' => 0, 'corporate' => 0, 'sme' => 0, 'total' => 0, 'total_mbps' => 0.0],
            '100_and_above' => ['label' => '100 Mbps & Above', 'home' => 0, 'corporate' => 0, 'sme' => 0, 'total' => 0, 'total_mbps' => 0.0],
        ];

        foreach ($rawSlabs as $rs) {
            $slabKey = $rs['speed_slab'];
            $catKey = strtolower($rs['category_key']);
            if (!isset($bandwidthSlabs[$slabKey])) continue;
            if (!in_array($catKey, ['home', 'corporate', 'sme'])) $catKey = 'home';

            $cnt = (int)$rs['subscriber_count'];
            $bw = round((float)$rs['slab_bandwidth_mbps'], 2);

            $bandwidthSlabs[$slabKey][$catKey] += $cnt;
            $bandwidthSlabs[$slabKey]['total'] += $cnt;
            $bandwidthSlabs[$slabKey]['total_mbps'] += $bw;
        }

        // 5. Connectivity Media Distribution
        $mediaSql = "SELECT 
            COALESCE(c.connectivity_type, 'fiber') as media_type,
            COUNT(DISTINCT c.customer_id) as count,
            COALESCE(SUM(ROUND(COALESCE(ap.download_speed_kbps, 0) / 1024, 2)), 0) as bandwidth_mbps
        FROM customers c
        LEFT JOIN users u ON u.user_id = c.owner_id
        LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
        LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
        WHERE {$scopeWhere} AND c.status = 'active' AND COALESCE(c.billing_status, '') NOT IN ('Expired', 'Left')
        GROUP BY media_type";

        $stmtMedia = $db->prepare($mediaSql);
        $stmtMedia->execute($scopeParams);
        $rawMedia = $stmtMedia->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $mediaDistribution = [
            'fiber' => ['label' => 'Wired (FTTH / Optical Fiber)', 'count' => 0, 'bandwidth_mbps' => 0.0],
            'copper' => ['label' => 'Wired (UTP / Cat6 Copper)', 'count' => 0, 'bandwidth_mbps' => 0.0],
            'wireless' => ['label' => 'Wireless (Radio Link)', 'count' => 0, 'bandwidth_mbps' => 0.0],
        ];

        foreach ($rawMedia as $m) {
            $k = strtolower($m['media_type']);
            if (!isset($mediaDistribution[$k])) $k = 'fiber';
            $mediaDistribution[$k]['count'] += (int)$m['count'];
            $mediaDistribution[$k]['bandwidth_mbps'] += round((float)$m['bandwidth_mbps'], 2);
        }

        // 6. Detailed Subscriber List (BTRC Standard 17 Columns)
        $whereFilters = ["{$scopeWhere}"];
        $queryParams = $scopeParams;

        if ($filterCategory !== 'all') {
            $whereFilters[] = "(CASE 
                WHEN c.btrc_category IN ('home', 'corporate', 'sme') THEN c.btrc_category
                WHEN c.customer_type = 'business' THEN 'corporate'
                WHEN ap.price >= 3000 THEN 'corporate'
                WHEN ap.price >= 1500 THEN 'sme'
                ELSE 'home'
            END) = :f_category";
            $queryParams['f_category'] = $filterCategory;
        }

        if ($filterStatus === 'active') {
            $whereFilters[] = "c.status = 'active' AND COALESCE(c.billing_status, '') NOT IN ('Expired', 'Left')";
        } elseif ($filterStatus === 'expired') {
            $whereFilters[] = "(c.billing_status = 'Expired' OR (cs.expires_at IS NOT NULL AND cs.expires_at < NOW() AND c.status = 'active'))";
        } elseif ($filterStatus === 'left') {
            $whereFilters[] = "(c.billing_status = 'Left' OR c.status IN ('terminated', 'cancelled'))";
        }

        if ($search !== '') {
            $whereFilters[] = "(c.customer_code LIKE :search OR c.full_name LIKE :search OR c.phone LIKE :search OR na.username LIKE :search OR na.current_ip LIKE :search OR c.national_id LIKE :search)";
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

        $offset = ($page - 1) * $limit;

        $listSql = "SELECT 
            c.customer_id,
            c.customer_code,
            c.full_name,
            c.phone,
            c.alternate_phone,
            COALESCE(c.national_id, c.tax_identifier, 'N/A') as national_id,
            c.installation_address,
            COALESCE(c.thana, sa.name, :def_thana) as thana,
            COALESCE(c.district, c.city, :def_dist) as district,
            c.status,
            c.billing_status,
            COALESCE(c.connection_date, DATE(c.created_at)) as activation_date,
            CASE 
                WHEN c.btrc_category IN ('home', 'corporate', 'sme') THEN c.btrc_category
                WHEN c.customer_type = 'business' THEN 'corporate'
                WHEN ap.price >= 3000 THEN 'corporate'
                WHEN ap.price >= 1500 THEN 'sme'
                ELSE 'home'
            END as btrc_category,
            COALESCE(c.connectivity_type, 'fiber') as connectivity_type,
            COALESCE(na.protocol, cs.protocol, 'pppoe') as protocol,
            ROUND(COALESCE(ap.download_speed_kbps, 0) / 1024, 2) as bandwidth_mbps,
            ROUND(COALESCE(ap.upload_speed_kbps, 0) / 1024, 2) as upload_mbps,
            COALESCE(NULLIF(na.current_ip, ''), NULLIF(na.remote_address, ''), 'Dynamic') as allocated_ip,
            COALESCE(ap.price, 0) as monthly_fee,
            COALESCE(ap.profile_name, 'Standard') as package_name,
            u.username as reseller_username,
            sa.name as area_name
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
            'def_thana' => $btrcProfile['default_thana'],
            'def_dist' => $btrcProfile['default_district'],
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

        // Format each subscriber row to standard BTRC format
        $operatorName = $btrcProfile['operator_name'];
        $formattedSubscribers = [];
        $slStart = $offset + 1;
        foreach ($subscribers as $idx => $sub) {
            $catLabel = ucfirst($sub['btrc_category']);
            $mediaLabel = $sub['connectivity_type'] === 'fiber' ? 'Wired (FTTH)' : ($sub['connectivity_type'] === 'wireless' ? 'Wireless' : 'Wired (UTP)');
            $speedDesc = $sub['bandwidth_mbps'] > 0 ? "{$sub['bandwidth_mbps']} Mbps" : "{$sub['package_name']}";

            $formattedSubscribers[] = [
                'sl' => $slStart + $idx,
                'customer_id' => (int)$sub['customer_id'],
                'operator_name' => $operatorName,
                'client_id' => $sub['customer_code'] ?: (string)$sub['customer_id'],
                'client_name' => $sub['full_name'],
                'client_type' => $catLabel, // 'Home', 'Corporate', 'SME'
                'btrc_category' => $sub['btrc_category'],
                'connection_type' => strtoupper($sub['protocol'] ?: 'PPPOE'),
                'connectivity_media' => $mediaLabel,
                'connectivity_type' => $sub['connectivity_type'],
                'bandwidth_mbps' => (float)$sub['bandwidth_mbps'],
                'upload_mbps' => (float)$sub['upload_mbps'],
                'bandwidth_display' => $speedDesc,
                'allocated_ip' => $sub['allocated_ip'] ?: '10.0.0.0',
                'phone' => $sub['phone'],
                'national_id' => $sub['national_id'] ?: 'N/A',
                'installation_address' => $sub['installation_address'] ?: 'Customer Premise',
                'thana' => $sub['thana'] ?: $btrcProfile['default_thana'],
                'district' => $sub['district'] ?: $btrcProfile['default_district'],
                'activation_date' => $sub['activation_date'] ? date('d-m-Y', strtotime($sub['activation_date'])) : date('d-m-Y'),
                'monthly_bill' => (float)$sub['monthly_fee'],
                'status' => ucfirst($sub['status']),
                'billing_status' => $sub['billing_status'],
                'package_name' => $sub['package_name'],
                'area_name' => $sub['area_name'] ?? 'Main Area',
            ];
        }

        Response::json([
            'success' => true,
            'data' => [
                'btrc_profile' => $btrcProfile,
                'category_summaries' => $categorySummaries,
                'grand_totals' => $grandTotals,
                'bandwidth_slabs' => array_values($bandwidthSlabs),
                'media_distribution' => array_values($mediaDistribution),
                'subscribers' => $formattedSubscribers,
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
            'btrc_license_no',
            'btrc_license_category',
            'btrc_purchased_bandwidth_mbps',
            'btrc_contact_person',
            'btrc_contact_designation',
            'btrc_contact_phone',
            'btrc_contact_email',
            'btrc_default_thana',
            'btrc_default_district',
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

        ActivityLogger::log($tenantId, (int)$user['user_id'], 'Updated BTRC License & Upstream Profile Settings', 'btrc_settings', $tenantId);

        Response::json([
            'success' => true,
            'message' => 'BTRC License and Profile settings updated successfully.',
        ]);
    }

    public static function bulkUpdateCustomerCategory(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = (int)AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $customerIds = $input['customer_ids'] ?? [];
        $category = trim($input['btrc_category'] ?? ''); // 'home', 'corporate', 'sme'
        $connectivity = trim($input['connectivity_type'] ?? ''); // 'fiber', 'wireless', 'copper'
        $thana = trim($input['thana'] ?? '');
        $district = trim($input['district'] ?? '');

        if (empty($customerIds) || !is_array($customerIds)) {
            Response::error('Invalid or empty customer_ids provided.', 400);
            return;
        }

        $validCategories = ['home', 'corporate', 'sme', 'cyber_cafe', 'institutional'];
        if (!in_array($category, $validCategories, true)) {
            Response::error('Invalid category. Must be home, corporate, or sme.', 400);
            return;
        }

        $ids = array_map('intval', $customerIds);
        $ids = array_filter($ids, fn($id) => $id > 0);
        if (empty($ids)) {
            Response::error('No valid customer IDs given.', 400);
            return;
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        
        $updateFields = ["btrc_category = ?"];
        $params = [$category];

        if ($connectivity !== '' && in_array($connectivity, ['fiber', 'wireless', 'copper'], true)) {
            $updateFields[] = "connectivity_type = ?";
            $params[] = $connectivity;
        }
        if ($thana !== '') {
            $updateFields[] = "thana = ?";
            $params[] = $thana;
        }
        if ($district !== '') {
            $updateFields[] = "district = ?";
            $params[] = $district;
        }

        $updateFields[] = "updated_at = NOW()";

        $sql = "UPDATE customers SET " . implode(', ', $updateFields) . " 
            WHERE tenant_id = ? AND customer_id IN ({$placeholders})";
        
        $execParams = array_merge($params, [$tenantId], $ids);

        $stmt = $db->prepare($sql);
        $stmt->execute($execParams);
        $affected = $stmt->rowCount();

        ActivityLogger::log($tenantId, (int)$user['user_id'], "Bulk updated {$affected} customers to BTRC category: {$category}", 'customers', 0);

        Response::json([
            'success' => true,
            'message' => "Successfully updated {$affected} subscribers to BTRC {$category}.",
            'affected' => $affected,
        ]);
    }
}
