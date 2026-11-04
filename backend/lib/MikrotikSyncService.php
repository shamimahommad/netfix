<?php
/**
 * NetFix ISP SaaS - MikroTik Real Hardware Sync & Provisioning Engine
 * Communicates with RouterOS v6/v7 to manage PPPoE secrets, active sessions,
 * MAC binding, bandwidth profiles, and live online telemetry.
 */

require_once __DIR__ . '/RouterosAPI.php';

class MikrotikSyncService {
    /**
     * Parse RouterOS uptime string into integer seconds
     */
    public static function parseUptime(?string $uptime): int {
        if (empty($uptime)) return 0;
        $seconds = 0;
        if (preg_match('/(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/', $uptime, $m)) {
            $w = !empty($m[1]) ? (int)$m[1] : 0;
            $d = !empty($m[2]) ? (int)$m[2] : 0;
            $h = !empty($m[3]) ? (int)$m[3] : 0;
            $i = !empty($m[4]) ? (int)$m[4] : 0;
            $s = !empty($m[5]) ? (int)$m[5] : 0;
            $seconds = ($w * 7 * 86400) + ($d * 86400) + ($h * 3600) + ($i * 60) + $s;
        }
        return $seconds;
    }

    /**
     * Resolve the MikroTik router for a customer
     */
    public static function getRouter(PDO $db, $customerId, ?int $tenantId = null): ?array {
        // First check customer_network_accounts
        $stmt = $db->prepare("SELECT nd.* 
            FROM customer_network_accounts na
            JOIN network_devices nd ON nd.network_device_id = na.network_device_id
            WHERE na.customer_id = :cid AND nd.device_type != 'olt' LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $router = $stmt->fetch();
        if ($router) return $router;

        // Second check customer_services
        $stmt = $db->prepare("SELECT nd.* 
            FROM customer_services cs
            JOIN network_devices nd ON nd.network_device_id = cs.network_device_id
            WHERE cs.customer_id = :cid AND nd.device_type != 'olt' LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $router = $stmt->fetch();
        if ($router) return $router;

        // Fallback to active router for tenant
        if ($tenantId) {
            $stmt = $db->prepare("SELECT * FROM network_devices 
                WHERE tenant_id = :tid AND (device_type = 'router' OR vendor = 'mikrotik') AND device_type != 'olt' AND status = 'active' 
                ORDER BY network_device_id ASC LIMIT 1");
            $stmt->execute(['tid' => $tenantId]);
            return $stmt->fetch() ?: null;
        }

        // Global fallback
        $stmt = $db->query("SELECT * FROM network_devices 
            WHERE (device_type = 'router' OR vendor = 'mikrotik') AND device_type != 'olt' AND status = 'active' 
            ORDER BY network_device_id ASC LIMIT 1");
        return $stmt->fetch() ?: null;
    }

    /**
     * Connect to a MikroTik router using RouterosAPI with real validation
     */
    public static function connect(array $router, int $timeout = 3): ?RouterosAPI {
        $ip = trim($router['management_ip'] ?? '');
        if (empty($ip)) return null;

        $user = $router['api_username'] ?: 'admin';
        $pass = $router['api_password'] ?: '';
        $port = (int)($router['management_port'] ?: 8728);

        $api = new RouterosAPI();
        $api->port = $port;
        $api->timeout = $timeout;
        $api->attempts = 1;

        if ($api->connect($ip, $user, $pass)) {
            // Verify it is NOT simulation mode
            if ($api->isSimulation) {
                $api->disconnect();
                return null;
            }
            return $api;
        }

        return null;
    }

    /**
     * Quick check customer live status from MikroTik (fast timeout for page view)
     */
    public static function checkCustomerLiveStatus(PDO $db, $customerId, array &$net): void {
        $username = trim($net['username'] ?? '');
        if (empty($username)) return;

        $tenantId = !empty($net['tenant_id']) ? (int)$net['tenant_id'] : null;
        $router = self::getRouter($db, $customerId, $tenantId);
        if (!$router) return;

        $api = self::connect($router, 2);
        if (!$api) return;

        try {
            $activeList = $api->comm('/ppp/active/print', ['?name' => $username]);
            if (!empty($activeList) && isset($activeList[0]['address'])) {
                $act = $activeList[0];
                $net['is_online'] = 1;
                $net['current_ip'] = $act['address'];
                $net['mac_address'] = $act['caller-id'] ?? $net['mac_address'];
                $net['uptime_seconds'] = self::parseUptime($act['uptime'] ?? '');

                // Keep local DB updated
                $upStmt = $db->prepare("UPDATE customer_network_accounts 
                    SET is_online = 1, current_ip = :ip, mac_address = :mac, uptime_seconds = :uptime, last_online_at = NOW() 
                    WHERE customer_id = :cid");
                $upStmt->execute([
                    'ip' => $net['current_ip'],
                    'mac' => $net['mac_address'],
                    'uptime' => $net['uptime_seconds'],
                    'cid' => $customerId,
                ]);
            } else {
                $net['is_online'] = 0;
                // Query secret to get last caller id if mac_address is empty
                if (empty($net['mac_address'])) {
                    $secList = $api->comm('/ppp/secret/print', ['?name' => $username]);
                    if (!empty($secList)) {
                        $lastCaller = $secList[0]['last-caller-id'] ?? $secList[0]['caller-id'] ?? null;
                        if ($lastCaller) {
                            $net['mac_address'] = $lastCaller;
                            $db->prepare("UPDATE customer_network_accounts SET mac_address = :mac WHERE customer_id = :cid")
                               ->execute(['mac' => $lastCaller, 'cid' => $customerId]);
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
        } finally {
            $api->disconnect();
        }
    }

    /**
     * Full Sync of a customer with MikroTik and match with OLT ONU
     */
    public static function syncCustomer(PDO $db, $customerId, ?int $tenantId = null): array {
        // Fetch customer and network account
        $stmt = $db->prepare("SELECT c.*, na.username, na.password, na.mac_address, na.current_ip, na.network_device_id, na.protocol, cs.access_profile_id, COALESCE(ap.mikrotik_profile_name, ap.profile_name) as profile_name
            FROM customers c
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
            LEFT JOIN access_profiles ap ON ap.access_profile_id = cs.access_profile_id
            WHERE c.customer_id = :cid LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $cust = $stmt->fetch();

        if (!$cust) {
            return [
                'success' => false,
                'message' => 'Customer not found',
            ];
        }

        $username = trim($cust['username'] ?: $cust['phone'] ?: 'customer_' . $customerId);
        $router = self::getRouter($db, $customerId, $tenantId ?: (int)$cust['tenant_id']);

        if (!$router) {
            return [
                'success' => false,
                'message' => 'No active MikroTik router found for this customer.',
                'username' => $username,
            ];
        }

        $api = self::connect($router, 4);
        if (!$api) {
            return [
                'success' => false,
                'message' => "Could not connect to MikroTik router '{$router['device_name']}' at {$router['management_ip']}:{$router['management_port']}.",
                'username' => $username,
            ];
        }

        $lines = [];
        $lines[] = "Router: {$router['device_name']} ({$router['management_ip']})";
        $lines[] = "Target User: {$username}";
        $lines[] = "---------------------------------------------";

        $isOnline = false;
        $currentIp = null;
        $callerId = null;
        $uptime = null;

        try {
            // 1. Check Active Session
            $activeList = $api->comm('/ppp/active/print', ['?name' => $username]);
            if (!empty($activeList)) {
                $act = $activeList[0];
                $isOnline = true;
                $currentIp = $act['address'] ?? null;
                $callerId = $act['caller-id'] ?? null;
                $uptime = $act['uptime'] ?? null;

                $lines[] = "Session Status: ONLINE";
                $lines[] = "IP Address: " . ($currentIp ?: 'N/A');
                $lines[] = "Caller ID (MAC): " . ($callerId ?: 'N/A');
                $lines[] = "Active Uptime: " . ($uptime ?: 'N/A');
                $lines[] = "Encoding: " . ($act['encoding'] ?? 'N/A');
            } else {
                $lines[] = "Session Status: OFFLINE (No active PPPoE session)";
            }

            // 2. Check PPPoE Secret
            $secList = $api->comm('/ppp/secret/print', ['?name' => $username]);
            if (!empty($secList)) {
                $sec = $secList[0];
                $isDisabled = ($sec['disabled'] ?? 'false') === 'true';
                $lines[] = "PPPoE Secret: Found on Router";
                $lines[] = "Profile: " . ($sec['profile'] ?? 'default');
                $lines[] = "Account State: " . ($isDisabled ? 'DISABLED / SUSPENDED' : 'ENABLED / ACTIVE');
                $lines[] = "Bound Caller ID: " . (!empty($sec['caller-id']) ? $sec['caller-id'] : 'None (Unbound)');
                if (!empty($sec['last-logged-out'])) {
                    $lines[] = "Last Logged Out: " . $sec['last-logged-out'];
                }
                if (!empty($sec['last-disconnect-reason'])) {
                    $lines[] = "Disconnect Reason: " . $sec['last-disconnect-reason'];
                }
                if (!$callerId && !empty($sec['last-caller-id'])) {
                    $callerId = $sec['last-caller-id'];
                }
            } else {
                // Secret does not exist on MikroTik, auto provision
                $lines[] = "PPPoE Secret: Not found on router. Auto-provisioning...";
                $pkgProfile = $cust['profile_name'] ?: 'default';
                $api->comm('/ppp/secret/add', [
                    '=name=' . $username,
                    '=password=' . ($cust['password'] ?: '123456'),
                    '=profile=' . $pkgProfile,
                    '=service=pppoe',
                    '=comment=' . "{$cust['full_name']} | {$cust['customer_code']}",
                ]);
                $lines[] = "PPPoE Secret: Successfully created with profile '{$pkgProfile}'";
            }

            // Update database with latest live values
            $upStmt = $db->prepare("UPDATE customer_network_accounts SET 
                is_online = :online,
                current_ip = :ip,
                mac_address = COALESCE(:mac, mac_address),
                uptime_seconds = :uptime,
                last_online_at = CASE WHEN :online1 = 1 THEN NOW() ELSE last_online_at END
                WHERE customer_id = :cid");
            $upStmt->execute([
                'online' => $isOnline ? 1 : 0,
                'ip' => $currentIp,
                'mac' => $callerId,
                'uptime' => self::parseUptime($uptime),
                'online1' => $isOnline ? 1 : 0,
                'cid' => $customerId,
            ]);

            // 3. Match with OLT ONUs
            $finalMac = $callerId ?: $cust['mac_address'] ?: null;
            if (!empty($finalMac)) {
                $cleanMac = strtoupper(str_replace(['-', '.', ' '], ':', trim($finalMac)));
                $onuStmt = $db->prepare("SELECT o.*, nd.device_name 
                    FROM olt_onus o 
                    JOIN network_devices nd ON nd.network_device_id = o.network_device_id 
                    WHERE o.mac_address = :mac LIMIT 1");
                $onuStmt->execute(['mac' => $cleanMac]);
                $onu = $onuStmt->fetch();
                if ($onu) {
                    $lines[] = "---------------------------------------------";
                    $lines[] = "Matched OLT: {$onu['device_name']}";
                    $lines[] = "PON Port: {$onu['pon_port_name']} ({$onu['onu_id']})";
                    $lines[] = "Optical Signal (Rx): {$onu['rx_power_dbm']} dBm";
                    $lines[] = "Fiber Status: " . strtoupper($onu['status']);
                }
            }

        } finally {
            $api->disconnect();
        }

        return [
            'success' => true,
            'message' => 'MikroTik live session and secret synchronized successfully',
            'data' => [
                'username' => $username,
                'isOnline' => $isOnline,
                'currentIp' => $currentIp,
                'macAddress' => $callerId,
                'uptime' => $uptime,
                'mikrotikDetailLines' => $lines,
            ],
        ];
    }

    /**
     * Force Disconnect an active PPPoE session from MikroTik
     */
    public static function disconnect(PDO $db, $customerId, ?int $tenantId = null): array {
        $stmt = $db->prepare("SELECT na.username, c.tenant_id 
            FROM customer_network_accounts na 
            JOIN customers c ON c.customer_id = na.customer_id 
            WHERE na.customer_id = :cid LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $row = $stmt->fetch();

        if (!$row || empty($row['username'])) {
            return ['success' => false, 'message' => 'Customer PPPoE account not found'];
        }

        $username = trim($row['username']);
        $router = self::getRouter($db, $customerId, $tenantId ?: (int)$row['tenant_id']);
        if (!$router) {
            return ['success' => false, 'message' => 'No active router configured for this customer'];
        }

        $api = self::connect($router, 4);
        if (!$api) {
            return ['success' => false, 'message' => "Could not connect to router {$router['device_name']}"];
        }

        $disconnected = false;
        try {
            $activeList = $api->comm('/ppp/active/print', ['?name' => $username]);
            if (!empty($activeList)) {
                foreach ($activeList as $session) {
                    if (isset($session['.id'])) {
                        $api->comm('/ppp/active/remove', ['=.id=' . $session['.id']]);
                        $disconnected = true;
                    }
                }
            }
        } finally {
            $api->disconnect();
        }

        // Update database
        $db->prepare("UPDATE customer_network_accounts SET is_online = 0, last_offline_at = NOW() WHERE customer_id = :cid")
           ->execute(['cid' => $customerId]);

        return [
            'success' => true,
            'message' => $disconnected 
                ? "Active session for '{$username}' disconnected successfully from {$router['device_name']}."
                : "No active session was found on {$router['device_name']} for '{$username}'. Status updated to offline.",
        ];
    }

    /**
     * Toggle Suspend / Restore for a customer on MikroTik and Database
     */
    public static function toggleSuspend(PDO $db, $customerId, ?int $tenantId = null): array {
        $stmt = $db->prepare("SELECT c.status, na.username, c.tenant_id 
            FROM customers c 
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id 
            WHERE c.customer_id = :cid LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $cust = $stmt->fetch();

        if (!$cust) {
            return ['success' => false, 'message' => 'Customer not found'];
        }

        $newStatus = ($cust['status'] === 'suspended') ? 'active' : 'suspended';
        $username = trim($cust['username'] ?? '');

        // Update MikroTik Secret if router is accessible
        $router = self::getRouter($db, $customerId, $tenantId ?: (int)$cust['tenant_id']);
        if ($router && !empty($username)) {
            $api = self::connect($router, 4);
            if ($api) {
                try {
                    $secList = $api->comm('/ppp/secret/print', ['?name' => $username]);
                    if (!empty($secList)) {
                        $secId = $secList[0]['.id'];
                        $api->comm('/ppp/secret/set', [
                            '=.id=' . $secId,
                            '=disabled=' . ($newStatus === 'suspended' ? 'yes' : 'no'),
                        ]);
                    }

                    // If suspending, kick active session immediately
                    if ($newStatus === 'suspended') {
                        $activeList = $api->comm('/ppp/active/print', ['?name' => $username]);
                        foreach ($activeList as $s) {
                            if (isset($s['.id'])) {
                                $api->comm('/ppp/active/remove', ['=.id=' . $s['.id']]);
                            }
                        }
                    }
                } finally {
                    $api->disconnect();
                }
            }
        }

        // Update database
        $db->prepare("UPDATE customers SET status = :st, billing_status = :bs WHERE customer_id = :cid")
           ->execute([
               'st' => $newStatus,
               'bs' => ($newStatus === 'suspended' ? 'Suspended' : 'Paid'),
               'cid' => $customerId,
           ]);

        $db->prepare("UPDATE customer_network_accounts SET status = :nst, is_online = CASE WHEN :st1 = 'suspended' THEN 0 ELSE is_online END WHERE customer_id = :cid")
           ->execute([
               'nst' => ($newStatus === 'suspended' ? 'disabled' : 'active'),
               'st1' => $newStatus,
               'cid' => $customerId,
           ]);

        return [
            'success' => true,
            'message' => "Customer successfully " . ($newStatus === 'suspended' ? 'suspended' : 'restored') . " on MikroTik and database.",
            'action' => $newStatus,
            'isSuspended' => ($newStatus === 'suspended'),
        ];
    }

    /**
     * Bind or Unbind MAC address in MikroTik PPPoE secret
     */
    public static function bindMac(PDO $db, $customerId, ?string $mac = null, ?int $tenantId = null): array {
        $stmt = $db->prepare("SELECT na.username, na.mac_address, c.tenant_id 
            FROM customer_network_accounts na 
            JOIN customers c ON c.customer_id = na.customer_id 
            WHERE na.customer_id = :cid LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $row = $stmt->fetch();

        if (!$row || empty($row['username'])) {
            return ['success' => false, 'message' => 'Customer account not found'];
        }

        $username = trim($row['username']);
        $router = self::getRouter($db, $customerId, $tenantId ?: (int)$row['tenant_id']);
        if (!$router) {
            return ['success' => false, 'message' => 'No active router configured for this customer'];
        }

        $api = self::connect($router, 4);
        if (!$api) {
            return ['success' => false, 'message' => "Could not connect to router {$router['device_name']}"];
        }

        try {
            $secList = $api->comm('/ppp/secret/print', ['?name' => $username]);
            if (empty($secList)) {
                return ['success' => false, 'message' => "PPPoE secret '{$username}' not found on MikroTik"];
            }

            $sec = $secList[0];
            $currentCallerId = trim($sec['caller-id'] ?? '');

            if (!empty($currentCallerId) && empty($mac)) {
                // UNBIND: clear caller-id
                $api->comm('/ppp/secret/set', [
                    '=.id=' . $sec['.id'],
                    '=caller-id=',
                ]);
                $db->prepare("UPDATE customer_network_accounts SET mac_address = NULL WHERE customer_id = :cid")
                   ->execute(['cid' => $customerId]);

                return [
                    'success' => true,
                    'message' => "MAC address {$currentCallerId} unbound successfully from PPPoE secret.",
                    'bound' => false,
                    'callerId' => null,
                ];
            } else {
                // BIND: Determine MAC address
                $targetMac = $mac ?: $row['mac_address'];
                if (empty($targetMac)) {
                    // Try to get from active session
                    $actList = $api->comm('/ppp/active/print', ['?name' => $username]);
                    if (!empty($actList[0]['caller-id'])) {
                        $targetMac = $actList[0]['caller-id'];
                    } elseif (!empty($sec['last-caller-id'])) {
                        $targetMac = $sec['last-caller-id'];
                    }
                }

                if (empty($targetMac)) {
                    return ['success' => false, 'message' => 'No MAC address detected to bind. Customer must be online or MAC entered manually.'];
                }

                $cleanMac = strtoupper(str_replace(['-', '.', ' '], ':', trim($targetMac)));
                $api->comm('/ppp/secret/set', [
                    '=.id=' . $sec['.id'],
                    '=caller-id=' . $cleanMac,
                ]);

                $db->prepare("UPDATE customer_network_accounts SET mac_address = :mac WHERE customer_id = :cid")
                   ->execute(['mac' => $cleanMac, 'cid' => $customerId]);

                return [
                    'success' => true,
                    'message' => "MAC address {$cleanMac} bound successfully to PPPoE secret.",
                    'bound' => true,
                    'callerId' => $cleanMac,
                ];
            }
        } finally {
            $api->disconnect();
        }
    }

    /**
     * Automatic MikroTik renewal: Unblock, apply profile, refresh session
     */
    public static function renewCustomer(PDO $db, $customerId, ?int $planId = null): array {
        $stmt = $db->prepare("SELECT c.*, na.username, na.password, cs.access_profile_id, COALESCE(ap.mikrotik_profile_name, ap.profile_name) as profile_name
            FROM customers c
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            LEFT JOIN customer_services cs ON cs.customer_id = c.customer_id
            LEFT JOIN access_profiles ap ON ap.access_profile_id = COALESCE(:pid, cs.access_profile_id)
            WHERE c.customer_id = :cid LIMIT 1");
        $stmt->execute(['pid' => $planId, 'cid' => $customerId]);
        $cust = $stmt->fetch();

        if (!$cust || empty($cust['username'])) {
            return ['success' => false, 'message' => 'Customer or PPPoE username not found'];
        }

        $username = trim($cust['username']);
        $router = self::getRouter($db, $customerId, (int)$cust['tenant_id']);
        if (!$router) {
            return ['success' => false, 'message' => 'No active router configured for this customer'];
        }

        $api = self::connect($router, 4);
        if (!$api) {
            return ['success' => false, 'message' => "Could not connect to router {$router['device_name']}"];
        }

        $profileName = $cust['profile_name'] ?: 'default';

        try {
            $secList = $api->comm('/ppp/secret/print', ['?name' => $username]);
            if (!empty($secList)) {
                $sec = $secList[0];
                $setParams = [
                    '=.id=' . $sec['.id'],
                    '=disabled=no',
                ];
                if (!empty($profileName)) {
                    $setParams[] = '=profile=' . $profileName;
                }
                $api->comm('/ppp/secret/set', $setParams);
            } else {
                // Create secret if missing
                $api->comm('/ppp/secret/add', [
                    '=name=' . $username,
                    '=password=' . ($cust['password'] ?: '123456'),
                    '=profile=' . $profileName,
                    '=service=pppoe',
                    '=disabled=no',
                    '=comment=' . "{$cust['full_name']} | {$cust['customer_code']}",
                ]);
            }

            // Disconnect active session so client reconnects with new renewed profile / resets counters
            $activeList = $api->comm('/ppp/active/print', ['?name' => $username]);
            foreach ($activeList as $s) {
                if (isset($s['.id'])) {
                    $api->comm('/ppp/active/remove', ['=.id=' . $s['.id']]);
                }
            }

            // Update database network account status
            $db->prepare("UPDATE customer_network_accounts SET status = 'active' WHERE customer_id = :cid")
               ->execute(['cid' => $customerId]);

        } finally {
            $api->disconnect();
        }

        return [
            'success' => true,
            'message' => "Customer '{$username}' unblocked and renewed on MikroTik with profile '{$profileName}'.",
        ];
    }
}
