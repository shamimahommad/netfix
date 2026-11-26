<?php
/**
 * NetFix ISP SaaS - Activity & Audit Logger Service
 */

require_once __DIR__ . '/../config/database.php';

class ActivityLogger {
    /**
     * Parse simple browser and OS from user agent
     */
    public static function parseUserAgent(?string $ua): array {
        if (!$ua) {
            return ['browser' => 'Unknown', 'platform' => 'Unknown'];
        }

        $browser = 'Other';
        if (stripos($ua, 'Firefox') !== false) {
            $browser = 'Firefox';
        } elseif (stripos($ua, 'Edg') !== false || stripos($ua, 'Edge') !== false) {
            $browser = 'Edge';
        } elseif (stripos($ua, 'Chrome') !== false) {
            $browser = 'Chrome';
        } elseif (stripos($ua, 'Safari') !== false) {
            $browser = 'Safari';
        } elseif (stripos($ua, 'Opera') !== false || stripos($ua, 'OPR') !== false) {
            $browser = 'Opera';
        }

        $platform = 'Other';
        if (stripos($ua, 'Windows') !== false) {
            $platform = 'Windows';
        } elseif (stripos($ua, 'Android') !== false) {
            $platform = 'Android';
        } elseif (stripos($ua, 'iPhone') !== false || stripos($ua, 'iPad') !== false) {
            $platform = 'iOS';
        } elseif (stripos($ua, 'Mac') !== false) {
            $platform = 'macOS';
        } elseif (stripos($ua, 'Linux') !== false) {
            $platform = 'Linux';
        }

        return ['browser' => $browser, 'platform' => $platform];
    }

    /**
     * Get client IP address
     */
    public static function getClientIp(): string {
        $remote = trim((string)($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'));
        $isTrustedProxy = $remote !== '' && filter_var($remote, FILTER_VALIDATE_IP) !== false
            && filter_var($remote, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;

        if ($isTrustedProxy) {
            $headers = [
                'HTTP_CF_CONNECTING_IP',
                'HTTP_X_REAL_IP',
                'HTTP_X_FORWARDED_FOR',
            ];
            foreach ($headers as $h) {
                if (!empty($_SERVER[$h])) {
                    $ips = explode(',', (string)$_SERVER[$h]);
                    $ip = trim($ips[0]);
                    if (filter_var($ip, FILTER_VALIDATE_IP)) {
                        return $ip;
                    }
                }
            }
        }
        return $remote !== '' ? $remote : '127.0.0.1';
    }

    /**
     * Record an audit log entry
     */
    public static function log(array $params): bool {
        try {
            $db = Database::getConnection();
            self::ensureTable($db);

            $tenantId = (int)($params['tenant_id'] ?? 1);
            $userId = isset($params['user_id']) ? (int)$params['user_id'] : null;
            $logType = $params['log_type'] ?? 'activity';
            $action = $params['action'] ?? 'action';
            $module = $params['module'] ?? null;
            $targetId = isset($params['target_id']) ? (string)$params['target_id'] : null;
            $targetType = $params['target_type'] ?? null;
            $description = $params['description'] ?? null;

            $metadata = null;
            if (isset($params['metadata'])) {
                $metadata = is_array($params['metadata']) ? json_encode($params['metadata'], JSON_UNESCAPED_UNICODE) : (string)$params['metadata'];
            }

            $ip = $params['ip_address'] ?? self::getClientIp();
            $ua = $params['user_agent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? null);

            $parsed = self::parseUserAgent($ua);
            $browser = $params['browser'] ?? $parsed['browser'];
            $platform = $params['platform'] ?? $parsed['platform'];

            $stmt = $db->prepare("INSERT INTO activity_logs (
                tenant_id, user_id, log_type, action, module, 
                target_id, target_type, description, metadata, 
                ip_address, user_agent, browser, platform, created_at
            ) VALUES (
                :tenant_id, :user_id, :log_type, :action, :module, 
                :target_id, :target_type, :description, :metadata, 
                :ip_address, :user_agent, :browser, :platform, NOW()
            )");

            return $stmt->execute([
                ':tenant_id'   => $tenantId,
                ':user_id'     => $userId,
                ':log_type'    => $logType,
                ':action'      => $action,
                ':module'      => $module,
                ':target_id'   => $targetId,
                ':target_type' => $targetType,
                ':description' => $description,
                ':metadata'    => $metadata,
                ':ip_address'  => substr($ip, 0, 45),
                ':user_agent'  => substr($ua ?? '', 0, 255),
                ':browser'     => substr($browser, 0, 100),
                ':platform'    => substr($platform, 0, 100),
            ]);
        } catch (Throwable $e) {
            error_log('ActivityLogger error: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Ensure activity_logs table exists
     */
    public static function ensureTable(PDO $pdo): void {
        static $ensured = false;
        if ($ensured) return;
        $ensured = true;

        $pdo->exec("CREATE TABLE IF NOT EXISTS `activity_logs` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `tenant_id` BIGINT UNSIGNED NOT NULL,
            `user_id` BIGINT UNSIGNED DEFAULT NULL,
            `log_type` ENUM('activity', 'login', 'client_task', 'plan_update') NOT NULL DEFAULT 'activity',
            `action` VARCHAR(100) NOT NULL,
            `module` VARCHAR(100) DEFAULT NULL,
            `target_id` VARCHAR(100) DEFAULT NULL,
            `target_type` VARCHAR(50) DEFAULT NULL,
            `description` TEXT DEFAULT NULL,
            `metadata` LONGTEXT DEFAULT NULL,
            `ip_address` VARCHAR(45) DEFAULT NULL,
            `user_agent` VARCHAR(255) DEFAULT NULL,
            `browser` VARCHAR(100) DEFAULT NULL,
            `platform` VARCHAR(100) DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_act_tenant_type_created` (`tenant_id`, `log_type`, `created_at` DESC),
            KEY `idx_act_tenant_user_created` (`tenant_id`, `user_id`, `created_at` DESC),
            KEY `idx_act_tenant_action` (`tenant_id`, `action`),
            KEY `idx_act_target` (`tenant_id`, `target_type`, `target_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    }
}
