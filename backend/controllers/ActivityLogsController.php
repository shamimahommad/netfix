<?php
/**
 * NetFix ISP SaaS - Activity & Audit Logs Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';
require_once __DIR__ . '/../lib/ActivityLogger.php';
require_once __DIR__ . '/../lib/HierarchySecurityService.php';

class ActivityLogsController {

    /**
     * Seed or sync initial logs from existing login_logs & sample audit trail if empty
     */
    public static function syncInitialLogsIfEmpty(PDO $db, int $tenantId): void {
        ActivityLogger::ensureTable($db);

        $stmtCnt = $db->prepare("SELECT COUNT(*) FROM activity_logs WHERE tenant_id = :tid");
        $stmtCnt->execute(['tid' => $tenantId]);
        $count = (int)$stmtCnt->fetchColumn();
        if ($count > 5) {
            return;
        }

        // 1. Sync from login_logs
        try {
            $stmt = $db->prepare("SELECT l.*, u.tenant_id 
                FROM login_logs l 
                LEFT JOIN users u ON u.user_id = l.user_id 
                WHERE (u.tenant_id = :tid1 OR (u.tenant_id IS NULL AND :tid2 IN (1, 2))) 
                ORDER BY l.id ASC LIMIT 100");
            $stmt->execute(['tid1' => $tenantId, 'tid2' => $tenantId]);
            $loginRows = $stmt->fetchAll();

            $insertStmt = $db->prepare("INSERT INTO activity_logs (
                tenant_id, user_id, log_type, action, module, 
                description, ip_address, browser, platform, created_at
            ) VALUES (
                :tid, :uid, 'login', 'user_login', 'auth', 
                :desc, :ip, :browser, :platform, :created_at
            )");

            foreach ($loginRows as $lr) {
                $insertStmt->execute([
                    ':tid' => $tenantId,
                    ':uid' => $lr['user_id'],
                    ':desc' => "User authenticated via " . ($lr['method'] ?: 'web') . " portal",
                    ':ip' => $lr['ip'] ?: '127.0.0.1',
                    ':browser' => $lr['browser'] ?: 'Chrome',
                    ':platform' => $lr['os'] ?: 'Windows',
                    ':created_at' => $lr['created_at'],
                ]);
            }
        } catch (Throwable $e) {
            // Ignore
        }
    }

    /**
     * GET /activity-logs/stats
     * Return counts for dashboard cards & tab badges
     */
    public static function stats(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        self::syncInitialLogsIfEmpty($db, $tenantId);

        $callerId = (int)$user['user_id'];
        $role = strtolower($user['role'] ?? '');
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $role === 'saas_admin');

        $where = ["l.tenant_id = :tid"];
        $params = ['tid' => $tenantId];

        if (!$isLevel0) {
            $rawPath = $user['hierarchy_path'] ?? "/{$callerId}/";
            $userPath = '/' . trim($rawPath, '/') . '/';
            $params['scope_uid'] = $callerId;
            $params['scope_path_wildcard'] = $userPath . '%';
            $where[] = "(l.user_id = :scope_uid OR u.hierarchy_path LIKE :scope_path_wildcard)";
        }

        $whereSql = implode(' AND ', $where);

        $sql = "SELECT 
            COUNT(*) as all_total,
            SUM(CASE WHEN DATE(l.created_at) = CURDATE() THEN 1 ELSE 0 END) as all_today,
            
            SUM(CASE WHEN l.log_type = 'activity' THEN 1 ELSE 0 END) as act_total,
            SUM(CASE WHEN l.log_type = 'activity' AND DATE(l.created_at) = CURDATE() THEN 1 ELSE 0 END) as act_today,
            
            SUM(CASE WHEN l.log_type = 'login' THEN 1 ELSE 0 END) as login_total,
            SUM(CASE WHEN l.log_type = 'login' AND DATE(l.created_at) = CURDATE() THEN 1 ELSE 0 END) as login_today,
            
            SUM(CASE WHEN l.log_type = 'client_task' THEN 1 ELSE 0 END) as task_total,
            SUM(CASE WHEN l.log_type = 'client_task' AND DATE(l.created_at) = CURDATE() THEN 1 ELSE 0 END) as task_today,
            
            SUM(CASE WHEN l.log_type = 'plan_update' THEN 1 ELSE 0 END) as plan_total,
            SUM(CASE WHEN l.log_type = 'plan_update' AND DATE(l.created_at) = CURDATE() THEN 1 ELSE 0 END) as plan_today
            FROM activity_logs l
            LEFT JOIN users u ON u.user_id = l.user_id
            WHERE {$whereSql}";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch() ?: [];

        Response::json([
            'success' => true,
            'data' => [
                'allTotal' => (int)($row['all_total'] ?? 0),
                'allToday' => (int)($row['all_today'] ?? 0),
                'actTotal' => (int)($row['act_total'] ?? 0),
                'actToday' => (int)($row['act_today'] ?? 0),
                'loginTotal' => (int)($row['login_total'] ?? 0),
                'loginToday' => (int)($row['login_today'] ?? 0),
                'taskTotal' => (int)($row['task_total'] ?? 0),
                'taskToday' => (int)($row['task_today'] ?? 0),
                'planTotal' => (int)($row['plan_total'] ?? 0),
                'planToday' => (int)($row['plan_today'] ?? 0),
            ]
        ]);
    }

    /**
     * GET /activity-logs/filters
     * Distinct options for dropdowns
     */
    public static function filters(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        self::syncInitialLogsIfEmpty($db, $tenantId);

        $callerId = (int)$user['user_id'];
        $role = strtolower($user['role'] ?? '');
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $role === 'saas_admin');

        $userWhere = ["tenant_id = :tid"];
        $userParams = ['tid' => $tenantId];

        if (!$isLevel0) {
            $rawPath = $user['hierarchy_path'] ?? "/{$callerId}/";
            $userPath = '/' . trim($rawPath, '/') . '/';
            $userParams['scope_uid'] = $callerId;
            $userParams['scope_path_wildcard'] = $userPath . '%';
            $userWhere[] = "(user_id = :scope_uid OR hierarchy_path LIKE :scope_path_wildcard)";
        }

        $userSql = "SELECT user_id, username, first_name, last_name, role 
            FROM users 
            WHERE " . implode(' AND ', $userWhere) . " 
            ORDER BY username ASC";
        $uStmt = $db->prepare($userSql);
        $uStmt->execute($userParams);
        $users = $uStmt->fetchAll();

        $stmtMod = $db->prepare("SELECT DISTINCT module FROM activity_logs WHERE tenant_id = :tid AND module IS NOT NULL AND module != '' ORDER BY module ASC");
        $stmtMod->execute(['tid' => $tenantId]);
        $modules = $stmtMod->fetchAll(PDO::FETCH_COLUMN) ?: [];

        $stmtAct = $db->prepare("SELECT DISTINCT action FROM activity_logs WHERE tenant_id = :tid AND action IS NOT NULL AND action != '' ORDER BY action ASC");
        $stmtAct->execute(['tid' => $tenantId]);
        $actions = $stmtAct->fetchAll(PDO::FETCH_COLUMN) ?: [];

        Response::json([
            'success' => true,
            'data' => [
                'users' => array_map(function($u) {
                    $fullName = trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
                    return [
                        'userId' => (int)$u['user_id'],
                        'username' => $u['username'],
                        'name' => $fullName ?: $u['username'],
                        'role' => $u['role'] ?: 'staff',
                    ];
                }, $users),
                'modules' => $modules,
                'actions' => $actions,
            ]
        ]);
    }

    /**
     * GET /activity-logs/list
     * Paginated audit logs with search, tab, and filters
     */
    public static function list(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        self::syncInitialLogsIfEmpty($db, $tenantId);

        $callerId = (int)$user['user_id'];
        $role = strtolower($user['role'] ?? '');
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $role === 'saas_admin');

        $where = ["l.tenant_id = :tid"];
        $params = ['tid' => $tenantId];

        if (!$isLevel0) {
            $rawPath = $user['hierarchy_path'] ?? "/{$callerId}/";
            $userPath = '/' . trim($rawPath, '/') . '/';
            $params['scope_uid'] = $callerId;
            $params['scope_path_wildcard'] = $userPath . '%';
            $where[] = "(l.user_id = :scope_uid OR u.hierarchy_path LIKE :scope_path_wildcard)";
        }

        // Tab filter (log_type)
        $type = trim($_GET['type'] ?? 'all');
        if ($type !== '' && $type !== 'all') {
            $where[] = "l.log_type = :log_type";
            $params['log_type'] = $type;
        }

        // User filter
        if (!empty($_GET['user_id'])) {
            $where[] = "l.user_id = :filter_user_id";
            $params['filter_user_id'] = (int)$_GET['user_id'];
        }

        // Module filter
        if (!empty($_GET['module'])) {
            $where[] = "l.module = :filter_module";
            $params['filter_module'] = trim($_GET['module']);
        }

        // Action filter
        if (!empty($_GET['action'])) {
            $where[] = "l.action = :filter_action";
            $params['filter_action'] = trim($_GET['action']);
        }

        // Customer / Target ID filter
        if (!empty($_GET['customer_id'])) {
            $where[] = "(l.target_id = :filter_target_id OR l.description LIKE :filter_target_like)";
            $params['filter_target_id'] = trim($_GET['customer_id']);
            $params['filter_target_like'] = '%' . trim($_GET['customer_id']) . '%';
        }

        // Date range
        if (!empty($_GET['date_from'])) {
            $where[] = "DATE(l.created_at) >= :date_from";
            $params['date_from'] = trim($_GET['date_from']);
        }
        if (!empty($_GET['date_to'])) {
            $where[] = "DATE(l.created_at) <= :date_to";
            $params['date_to'] = trim($_GET['date_to']);
        }

        // Search text
        if (!empty($_GET['search'])) {
            $q = trim($_GET['search']);
            $where[] = "(l.action LIKE :search_q OR l.module LIKE :search_q OR l.description LIKE :search_q OR l.target_id LIKE :search_q OR l.ip_address LIKE :search_q OR u.username LIKE :search_q OR u.first_name LIKE :search_q OR u.last_name LIKE :search_q)";
            $params['search_q'] = "%{$q}%";
        }

        $whereSql = implode(' AND ', $where);

        // Count total
        $countSql = "SELECT COUNT(*) FROM activity_logs l LEFT JOIN users u ON u.user_id = l.user_id WHERE {$whereSql}";
        $cStmt = $db->prepare($countSql);
        $cStmt->execute($params);
        $total = (int)$cStmt->fetchColumn();

        // Pagination
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = max(1, min(200, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $totalPages = max(1, ceil($total / $limit));

        // Fetch records
        $sql = "SELECT 
            l.id,
            l.tenant_id,
            l.user_id,
            l.log_type,
            l.action,
            l.module,
            l.target_id,
            l.target_type,
            l.description,
            l.metadata,
            l.ip_address,
            l.user_agent,
            l.browser,
            l.platform,
            DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
            u.username,
            u.first_name,
            u.last_name,
            u.role,
            u.avatar_url
            FROM activity_logs l
            LEFT JOIN users u ON u.user_id = l.user_id
            WHERE {$whereSql}
            ORDER BY l.id DESC
            LIMIT :offset, :limit";

        $stmt = $db->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue(':' . $k, $v);
        }
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $items = array_map(function($r) {
            $fullName = trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? ''));
            $meta = null;
            if (!empty($r['metadata'])) {
                $decoded = json_decode($r['metadata'], true);
                $meta = (json_last_error() === JSON_ERROR_NONE) ? $decoded : $r['metadata'];
            }

            return [
                'id' => (int)$r['id'],
                'logType' => $r['log_type'],
                'action' => $r['action'],
                'module' => $r['module'],
                'targetId' => $r['target_id'],
                'targetType' => $r['target_type'],
                'description' => $r['description'],
                'metadata' => $meta,
                'ipAddress' => $r['ip_address'],
                'userAgent' => $r['user_agent'],
                'browser' => $r['browser'],
                'platform' => $r['platform'],
                'createdAt' => $r['created_at'],
                'user' => [
                    'id' => $r['user_id'] ? (int)$r['user_id'] : null,
                    'username' => $r['username'] ?? 'System',
                    'name' => $fullName ?: ($r['username'] ?? 'System'),
                    'role' => $r['role'] ?? 'system',
                    'avatar' => $r['avatar_url'] ?? null,
                ]
            ];
        }, $rows);

        Response::json([
            'success' => true,
            'data' => [
                'items' => $items,
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => $totalPages,
            ]
        ]);
    }

    /**
     * GET /activity-logs/detail/{id}
     */
    public static function detail(string $id): void {
        $user = AuthMiddleware::requireAuth();
        if (($user['role'] ?? '') === 'customer' || ($user['user_type'] ?? '') === 'customer') {
            Response::error('Forbidden', 403);
        }
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT l.*, u.username, u.first_name, u.last_name, u.role, u.avatar_url 
            FROM activity_logs l 
            LEFT JOIN users u ON u.user_id = l.user_id 
            WHERE l.id = :id AND l.tenant_id = :tid LIMIT 1");
        $stmt->execute(['id' => $id, 'tid' => $tenantId]);
        $row = $stmt->fetch();

        if (!$row) {
            Response::error('Log entry not found', 404);
            return;
        }

        $role = strtolower((string)($user['role'] ?? ''));
        $isLevel0 = (HierarchySecurityService::getHierarchyLevel($role) === 0 || $role === 'saas_admin');
        if (!$isLevel0) {
            $callerId = (int)$user['user_id'];
            $logUserId = (int)($row['user_id'] ?? 0);
            if ($logUserId <= 0 || ($logUserId !== $callerId && !HierarchySecurityService::canAccessUser($callerId, $logUserId))) {
                Response::error('Access denied', 403);
                return;
            }
        }

        $fullName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        $meta = null;
        if (!empty($row['metadata'])) {
            $decoded = json_decode($row['metadata'], true);
            $meta = (json_last_error() === JSON_ERROR_NONE) ? $decoded : $row['metadata'];
        }

        Response::json([
            'success' => true,
            'data' => [
                'id' => (int)$row['id'],
                'logType' => $row['log_type'],
                'action' => $row['action'],
                'module' => $row['module'],
                'targetId' => $row['target_id'],
                'targetType' => $row['target_type'],
                'description' => $row['description'],
                'metadata' => $meta,
                'ipAddress' => $row['ip_address'],
                'userAgent' => $row['user_agent'],
                'browser' => $row['browser'],
                'platform' => $row['platform'],
                'createdAt' => $row['created_at'],
                'user' => [
                    'id' => $row['user_id'] ? (int)$row['user_id'] : null,
                    'username' => $row['username'] ?? 'System',
                    'name' => $fullName ?: ($row['username'] ?? 'System'),
                    'role' => $row['role'] ?? 'system',
                    'avatar' => $row['avatar_url'] ?? null,
                ]
            ]
        ]);
    }
}
