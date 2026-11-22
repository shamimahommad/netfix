<?php
/**
 * NetFix ISP SaaS - Auto-Cutoff & Billing Cron Engine Service
 * Handles automated subscriber expiry cutoff, MikroTik session drops,
 * grace period enforcement, SMS reminders, and run telemetry.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/ActivityLogger.php';
require_once __DIR__ . '/MikrotikService.php';

class BillingCronService {

    /**
     * Get settings for a tenant with sensible defaults
     */
    public static function getSettings(int $tenantId): array {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = :tid");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];

        return [
            'autoCutoffEnabled'  => ($rows['auto_cutoff_enabled'] ?? '1') === '1',
            'gracePeriodDays'    => (int)($rows['grace_period_days'] ?? 0),
            'cutoffTime'         => $rows['cutoff_time'] ?? '10:00',
            'cutoffAction'       => $rows['cutoff_action'] ?? 'disable_secret', // 'disable_secret' or 'suspended_profile'
            'suspendedProfileName' => $rows['suspended_profile_name'] ?? 'SUSPENDED',
            'sendCutoffSms'      => ($rows['send_cutoff_sms'] ?? '0') === '1',
            'autoInvoiceEnabled' => ($rows['auto_invoice_enabled'] ?? '1') === '1',
            'invoiceDueDays'     => (int)($rows['invoice_due_days'] ?? 5),
        ];
    }

    /**
     * Save/update settings for a tenant
     */
    public static function saveSettings(int $tenantId, array $settings): bool {
        $db = Database::getConnection();

        $map = [
            'auto_cutoff_enabled'    => isset($settings['autoCutoffEnabled']) ? ($settings['autoCutoffEnabled'] ? '1' : '0') : null,
            'grace_period_days'      => isset($settings['gracePeriodDays']) ? (string)max(0, (int)$settings['gracePeriodDays']) : null,
            'cutoff_time'            => !empty($settings['cutoffTime']) ? trim($settings['cutoffTime']) : null,
            'cutoff_action'          => !empty($settings['cutoffAction']) ? trim($settings['cutoffAction']) : null,
            'suspended_profile_name' => !empty($settings['suspendedProfileName']) ? trim($settings['suspendedProfileName']) : null,
            'send_cutoff_sms'        => isset($settings['sendCutoffSms']) ? ($settings['sendCutoffSms'] ? '1' : '0') : null,
            'auto_invoice_enabled'   => isset($settings['autoInvoiceEnabled']) ? ($settings['autoInvoiceEnabled'] ? '1' : '0') : null,
            'invoice_due_days'       => isset($settings['invoiceDueDays']) ? (string)max(1, (int)$settings['invoiceDueDays']) : null,
        ];

        $stmt = $db->prepare("INSERT INTO tenant_settings (tenant_id, setting_key, setting_value) 
            VALUES (:tid, :k, :v) 
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()");

        foreach ($map as $k => $v) {
            if ($v !== null) {
                $stmt->execute(['tid' => $tenantId, 'k' => $k, 'v' => $v]);
            }
        }
        return true;
    }

    /**
     * Run Auto-Cutoff Routine
     */
    public static function runAutoCutoff(?int $tenantId = null, string $triggerType = 'scheduled'): array {
        $startTime = microtime(true);
        $db = Database::getConnection();

        // 1. Initialize run record in billing_cron_runs
        $runStmt = $db->prepare("INSERT INTO billing_cron_runs (tenant_id, trigger_type, status, started_at) 
            VALUES (:tid, :trigger, 'running', NOW())");
        $runStmt->execute([
            'tid' => $tenantId,
            'trigger' => $triggerType,
        ]);
        $runId = (int)$db->lastInsertId();

        $processedCount = 0;
        $mikrotikDisabledCount = 0;
        $errorCount = 0;
        $affectedSubscribers = [];

        try {
            // 2. Fetch list of tenants to process
            $tenants = [];
            if ($tenantId !== null && $tenantId > 0) {
                $tenants[] = $tenantId;
            } else {
                $tenants = $db->query("SELECT tenant_id FROM tenants WHERE status = 'active' ORDER BY tenant_id ASC")
                              ->fetchAll(PDO::FETCH_COLUMN) ?: [1];
            }

            $mikrotik = new MikrotikService();

            foreach ($tenants as $tid) {
                $settings = self::getSettings((int)$tid);

                // If scheduled and auto-cutoff is turned off by tenant, skip
                if ($triggerType === 'scheduled' && !$settings['autoCutoffEnabled']) {
                    continue;
                }

                $graceDays = (int)$settings['gracePeriodDays'];
                $cutoffAction = $settings['cutoffAction'];
                $suspProfile = $settings['suspendedProfileName'];
                $cutoffTime = $settings['cutoffTime'] ?? '10:00';
                if (strlen($cutoffTime) === 5) {
                    $cutoffTime .= ':00';
                }

                // 3. Find expired customers for this tenant based on daily cutoff time & grace period
                $query = "
                    SELECT 
                        c.customer_id,
                        c.customer_code,
                        c.full_name,
                        c.phone,
                        c.tenant_id,
                        cs.customer_service_id,
                        cs.expires_at,
                        cs.access_profile_id,
                        na.username as pppoe_username,
                        nd.network_device_id,
                        nd.device_name,
                        nd.management_ip,
                        nd.management_port,
                        nd.api_username,
                        nd.api_password
                    FROM customer_services cs
                    JOIN customers c ON c.customer_id = cs.customer_id
                    LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
                    LEFT JOIN network_devices nd ON nd.network_device_id = COALESCE(na.network_device_id, cs.network_device_id)
                    WHERE c.tenant_id = :tid
                      AND (cs.status = 'active' OR c.status = 'active')
                      AND cs.expires_at IS NOT NULL
                      AND TIMESTAMP(DATE_ADD(DATE(cs.expires_at), INTERVAL :grace DAY), :cutoff_time) <= NOW()
                    ORDER BY nd.network_device_id ASC
                ";

                $stmtCust = $db->prepare($query);
                $stmtCust->execute(['tid' => $tid, 'grace' => $graceDays, 'cutoff_time' => $cutoffTime]);
                $expiredSubscribers = $stmtCust->fetchAll(PDO::FETCH_ASSOC);

                if (empty($expiredSubscribers)) {
                    continue;
                }

                // Group by Router
                $routerGroups = [];
                foreach ($expiredSubscribers as $s) {
                    $rId = (int)($s['network_device_id'] ?: 0);
                    $routerGroups[$rId][] = $s;
                }

                foreach ($routerGroups as $rId => $users) {
                    $routerConnected = false;
                    $routerConfig = null;

                    if ($rId > 0 && !empty($users[0]['management_ip'])) {
                        $sample = $users[0];
                        $routerConfig = [
                            'management_ip'   => $sample['management_ip'],
                            'management_port' => $sample['management_port'] ?: 8728,
                            'api_username'    => $sample['api_username'],
                            'api_password'    => $sample['api_password'],
                        ];
                        try {
                            $routerConnected = $mikrotik->connect($routerConfig);
                        } catch (\Throwable $e) {
                            $routerConnected = false;
                        }
                    }

                    foreach ($users as $u) {
                        $cid = (int)$u['customer_id'];
                        $csid = (int)$u['customer_service_id'];
                        $uname = trim($u['pppoe_username'] ?? '');
                        $code = $u['customer_code'] ?: "CUST-{$cid}";
                        $routerActionStatus = 'db_only';

                        // 1. MikroTik Operation (fast batch on single open socket)
                        if ($routerConnected && !empty($uname)) {
                            try {
                                if ($cutoffAction === 'suspended_profile') {
                                    // Change profile to suspended and drop session on open socket
                                    $changed = $mikrotik->setSecretProfileOnOpenSocket($uname, $suspProfile);
                                    $routerActionStatus = $changed ? 'profile_suspended' : 'not_found';
                                } else {
                                    // Default: disable secret & drop session on open socket
                                    $disabled = $mikrotik->disableSecretOnOpenSocket($uname);
                                    $routerActionStatus = $disabled ? 'secret_disabled' : 'not_found';
                                }
                                $mikrotikDisabledCount++;
                            } catch (\Throwable $mEx) {
                                $errorCount++;
                                $routerActionStatus = 'router_error: ' . $mEx->getMessage();
                            }
                        }

                        // 2. Update Database Record
                        self::markCustomerExpiredInDb($db, $cid, $csid);
                        $processedCount++;

                        // 3. Log Audit Activity
                        try {
                            ActivityLogger::log([
                                'tenant_id' => $tid,
                                'user_id' => null, // Automated system cron
                                'log_type' => 'client_task',
                                'action' => 'auto_cutoff',
                                'module' => 'billing',
                                'target_id' => (string)$cid,
                                'target_type' => 'customer',
                                'description' => "Auto-Cutoff: Suspended customer #{$code} ({$u['full_name']}) due to subscription expiry ({$u['expires_at']}) [MikroTik: {$routerActionStatus}]",
                                'metadata' => [
                                    'customer_id' => $cid,
                                    'customer_code' => $code,
                                    'expires_at' => $u['expires_at'],
                                    'router_action' => $routerActionStatus,
                                    'run_id' => $runId,
                                ],
                            ]);
                        } catch (\Throwable $actEx) {}

                        $affectedSubscribers[] = [
                            'customerId' => $cid,
                            'customerCode' => $code,
                            'name' => $u['full_name'],
                            'pppoeUsername' => $uname,
                            'expiresAt' => $u['expires_at'],
                            'routerStatus' => $routerActionStatus,
                        ];
                    }

                    if ($routerConnected) {
                        try {
                            $mikrotik->disconnect();
                        } catch (\Throwable $e) {}
                    }
                }
            }

            $durationMs = (int)round((microtime(true) - $startTime) * 1000);

            // 4. Update run record to completed
            $updateRun = $db->prepare("UPDATE billing_cron_runs SET 
                status = 'completed',
                expired_processed = :exp,
                mikrotik_disabled = :mt,
                error_count = :err,
                details = :det,
                duration_ms = :dur,
                completed_at = NOW()
                WHERE id = :rid");

            $updateRun->execute([
                'exp' => $processedCount,
                'mt' => $mikrotikDisabledCount,
                'err' => $errorCount,
                'det' => json_encode(array_slice($affectedSubscribers, 0, 50), JSON_UNESCAPED_UNICODE),
                'dur' => $durationMs,
                'rid' => $runId,
            ]);

            return [
                'success' => true,
                'runId' => $runId,
                'triggerType' => $triggerType,
                'status' => 'completed',
                'expiredProcessed' => $processedCount,
                'mikrotikDisabled' => $mikrotikDisabledCount,
                'errorCount' => $errorCount,
                'durationMs' => $durationMs,
                'affectedSubscribers' => $affectedSubscribers,
                'timestamp' => date('c'),
            ];

        } catch (\Throwable $e) {
            $durationMs = (int)round((microtime(true) - $startTime) * 1000);
            $db->prepare("UPDATE billing_cron_runs SET status = 'failed', error_count = 1, duration_ms = :dur, completed_at = NOW() WHERE id = :rid")
               ->execute(['dur' => $durationMs, 'rid' => $runId]);

            error_log("AutoCutoff Fatal Exception: " . $e->getMessage());
            return [
                'success' => false,
                'runId' => $runId,
                'error' => $e->getMessage(),
                'durationMs' => $durationMs,
            ];
        }
    }

    /**
     * Mark customer, service, and network account as inactive/expired in DB
     * Note: Expired customers keep status = 'active' (with billing_status = 'Expired')
     * so they are NOT confused with manually suspended accounts.
     */
    private static function markCustomerExpiredInDb(PDO $db, int $customerId, ?int $customerServiceId): void {
        try {
            $db->prepare("UPDATE customers SET billing_status = 'Expired', updated_at = NOW() WHERE customer_id = :cid AND status != 'suspended'")
               ->execute(['cid' => $customerId]);

            if ($customerServiceId) {
                $db->prepare("UPDATE customer_services SET status = 'inactive', updated_at = NOW() WHERE customer_service_id = :sid")
                   ->execute(['sid' => $customerServiceId]);
            }

            $db->prepare("UPDATE customer_network_accounts SET status = 'disabled', is_online = 0, uptime_seconds = 0, updated_at = NOW() WHERE customer_id = :cid")
               ->execute(['cid' => $customerId]);

            $db->prepare("INSERT INTO client_task_logs (tenant_id, customer_id, action, description, status, created_by, created_at)
                SELECT tenant_id, :cid, 'AUTO_EXPIRE', 'Customer subscription expired by auto-cutoff engine', 'completed', 1, NOW()
                FROM customers WHERE customer_id = :cid2 LIMIT 1")
               ->execute(['cid' => $customerId, 'cid2' => $customerId]);
        } catch (\Throwable $e) {
            error_log("Failed to mark customer #{$customerId} expired: " . $e->getMessage());
        }
    }

    /**
     * Get Live Status & Telemetry
     */
    public static function getStatus(?int $tenantId = null): array {
        $db = Database::getConnection();

        // 1. Last Run
        $lastRunStmt = $db->prepare("SELECT * FROM billing_cron_runs 
            WHERE (:tid IS NULL OR tenant_id = :tid OR tenant_id IS NULL) 
            ORDER BY id DESC LIMIT 1");
        $lastRunStmt->execute(['tid' => $tenantId]);
        $lastRun = $lastRunStmt->fetch(PDO::FETCH_ASSOC) ?: null;

        if ($lastRun && !empty($lastRun['details'])) {
            $lastRun['details'] = json_decode($lastRun['details'], true);
        }

        // 2. Settings & Cutoff Timing
        $settings = $tenantId ? self::getSettings($tenantId) : self::getSettings(1);
        $graceDays = (int)($settings['gracePeriodDays'] ?? 0);
        $cutoffTime = $settings['cutoffTime'] ?? '10:00';
        if (strlen($cutoffTime) === 5) {
            $cutoffTime .= ':00';
        }
        $cutoffExpr = "TIMESTAMP(DATE_ADD(DATE(cs.expires_at), INTERVAL {$graceDays} DAY), '{$cutoffTime}')";

        // 3. Metrics & Subscribers at risk
        $whereTid = $tenantId !== null && $tenantId > 0 ? "AND c.tenant_id = {$tenantId}" : "";

        $activeCount = (int)$db->query("SELECT COUNT(*) FROM customer_services cs JOIN customers c ON c.customer_id = cs.customer_id WHERE (cs.status = 'active' OR c.status = 'active') {$whereTid}")->fetchColumn();

        $expiringIn3Days = (int)$db->query("SELECT COUNT(*) FROM customer_services cs JOIN customers c ON c.customer_id = cs.customer_id WHERE (cs.status = 'active' OR c.status = 'active') AND cs.expires_at IS NOT NULL AND {$cutoffExpr} > NOW() AND {$cutoffExpr} <= DATE_ADD(NOW(), INTERVAL 3 DAY) {$whereTid}")->fetchColumn();

        $expiredReadyForCutoff = (int)$db->query("SELECT COUNT(*) FROM customer_services cs JOIN customers c ON c.customer_id = cs.customer_id WHERE (cs.status = 'active' OR c.status = 'active') AND cs.expires_at IS NOT NULL AND {$cutoffExpr} <= NOW() {$whereTid}")->fetchColumn();

        $suspendedCount = (int)$db->query("SELECT COUNT(*) FROM customer_services cs JOIN customers c ON c.customer_id = cs.customer_id WHERE (cs.status = 'suspended' OR c.status = 'inactive') {$whereTid}")->fetchColumn();

        // 4. Recent Runs History (last 10)
        $historyStmt = $db->prepare("SELECT id, tenant_id, trigger_type, status, expired_processed, mikrotik_disabled, error_count, duration_ms, started_at, completed_at 
            FROM billing_cron_runs 
            WHERE (:tid IS NULL OR tenant_id = :tid OR tenant_id IS NULL) 
            ORDER BY id DESC LIMIT 10");
        $historyStmt->execute(['tid' => $tenantId]);
        $history = $historyStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return [
            'engineStatus' => 'ready',
            'serverTime' => date('c'),
            'settings' => $settings,
            'metrics' => [
                'totalActive' => $activeCount,
                'expiringIn3Days' => $expiringIn3Days,
                'expiredReadyForCutoff' => $expiredReadyForCutoff,
                'totalSuspended' => $suspendedCount,
            ],
            'lastRun' => $lastRun ? [
                'id' => (int)$lastRun['id'],
                'triggerType' => $lastRun['trigger_type'],
                'status' => $lastRun['status'],
                'expiredProcessed' => (int)$lastRun['expired_processed'],
                'mikrotikDisabled' => (int)$lastRun['mikrotik_disabled'],
                'errorCount' => (int)$lastRun['error_count'],
                'durationMs' => (int)$lastRun['duration_ms'],
                'startedAt' => $lastRun['started_at'],
                'completedAt' => $lastRun['completed_at'],
            ] : null,
            'history' => $history,
        ];
    }
}
