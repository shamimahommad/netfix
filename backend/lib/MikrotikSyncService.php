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
        $uptime = trim($uptime);
        if (is_numeric($uptime)) return (int)$uptime;
        
        $seconds = 0;
        // Check for "Xw" (weeks)
        if (preg_match('/(\d+)\s*w/i', $uptime, $m)) {
            $seconds += (int)$m[1] * 7 * 86400;
        }
        // Check for "Xd" (days)
        if (preg_match('/(\d+)\s*d/i', $uptime, $m)) {
            $seconds += (int)$m[1] * 86400;
        }
        // Check for "Xh" (hours)
        if (preg_match('/(\d+)\s*h/i', $uptime, $m)) {
            $seconds += (int)$m[1] * 3600;
        }
        // Check for "Xm" (minutes)
        if (preg_match('/(\d+)\s*m/i', $uptime, $m)) {
            $seconds += (int)$m[1] * 60;
        }
        // Check for "Xs" (seconds)
        if (preg_match('/(\d+)\s*s/i', $uptime, $m)) {
            $seconds += (int)$m[1];
        }
        // Check for HH:MM:SS or HH:MM format (e.g. "14d 06:22:15" or alone "06:22:15")
        if (preg_match('/(?:^|\s+|d)(\d{1,2}):(\d{2})(?::(\d{2}))?/', $uptime, $m)) {
            $seconds += (int)$m[1] * 3600;
            $seconds += (int)$m[2] * 60;
            if (!empty($m[3])) {
                $seconds += (int)$m[3];
            }
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

        if ($api->connect($ip, $user, $pass, $port)) {
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
                $net['uptime_seconds'] = 0; // Strictly 0 when offline

                // Query secret to get last logout time, disconnect reason, and caller ID
                $secList = $api->comm('/ppp/secret/print', ['?name' => $username]);
                if (!empty($secList[0])) {
                    $sec = $secList[0];
                    if (!empty($sec['last-logged-out'])) {
                        $net['last_offline_at'] = $sec['last-logged-out'];
                    }
                    if (!empty($sec['last-disconnect-reason'])) {
                        $net['last_disconnect_reason'] = $sec['last-disconnect-reason'];
                    }
                    if (empty($net['mac_address'])) {
                        $lastCaller = $sec['last-caller-id'] ?? $sec['caller-id'] ?? null;
                        if ($lastCaller) {
                            $net['mac_address'] = $lastCaller;
                        }
                    }
                }

                $db->prepare("UPDATE customer_network_accounts 
                    SET is_online = 0, uptime_seconds = 0, 
                        last_offline_at = COALESCE(:off, last_offline_at),
                        last_disconnect_reason = COALESCE(:reason, last_disconnect_reason),
                        mac_address = COALESCE(:mac, mac_address)
                    WHERE customer_id = :cid")
                   ->execute([
                       'off' => $net['last_offline_at'] ?? null,
                       'reason' => $net['last_disconnect_reason'] ?? null,
                       'mac' => $net['mac_address'] ?? null,
                       'cid' => $customerId,
                   ]);
            }

            // If last_offline_at is still empty, populate from secret
            if (empty($net['last_offline_at'])) {
                $secList = $api->comm('/ppp/secret/print', ['?name' => $username]);
                if (!empty($secList[0])) {
                    if (!empty($secList[0]['last-logged-out'])) {
                        $net['last_offline_at'] = $secList[0]['last-logged-out'];
                    }
                    if (!empty($secList[0]['last-disconnect-reason'])) {
                        $net['last_disconnect_reason'] = $secList[0]['last-disconnect-reason'];
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
    public static function syncCustomer(PDO $db, $customerId, ?int $tenantId = null, bool $allowProvision = false): array {
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

            $lastLoggedOut = null;
            $disconnectReason = null;
            $secretExists = false;

            // 2. Check PPPoE Secret
            $secList = $api->comm('/ppp/secret/print', ['?name' => $username]);
            if (!empty($secList)) {
                $sec = $secList[0];
                $secretExists = true;
                $isDisabled = ($sec['disabled'] ?? 'false') === 'true';
                $lines[] = "PPPoE Secret: Found on Router";
                $lines[] = "Profile: " . ($sec['profile'] ?? 'default');
                $lines[] = "Account State: " . ($isDisabled ? 'DISABLED / SUSPENDED' : 'ENABLED / ACTIVE');
                $lines[] = "Bound Caller ID: " . (!empty($sec['caller-id']) ? $sec['caller-id'] : 'None (Unbound)');
                
                $rawLogout = trim($sec['last-logged-out'] ?? '');
                if (!empty($rawLogout) && !str_starts_with($rawLogout, '1970') && !str_starts_with($rawLogout, 'jan/01/1970') && $rawLogout !== '0000-00-00 00:00:00') {
                    $lastLoggedOut = $rawLogout;
                    $lines[] = "Last Logged Out: " . $lastLoggedOut;
                } else {
                    $lines[] = "Last Logged Out: Never (No session history)";
                }

                if (!empty($sec['last-disconnect-reason'])) {
                    $disconnectReason = $sec['last-disconnect-reason'];
                    $lines[] = "Disconnect Reason: " . $disconnectReason;
                }
                if (!$callerId && !empty($sec['last-caller-id'])) {
                    $callerId = $sec['last-caller-id'];
                }
            } elseif ($allowProvision) {
                // User explicitly triggered Provision to Router
                $lines[] = "PPPoE Secret: Provisioning new secret to router...";
                $pkgProfile = $cust['profile_name'] ?: 'default';
                if (!empty($pkgProfile) && strtolower($pkgProfile) !== 'default') {
                    $allProfs = $api->comm('/ppp/profile/print');
                    foreach ($allProfs as $p) {
                        if (isset($p['name']) && strcasecmp($p['name'], $pkgProfile) === 0) {
                            $pkgProfile = $p['name'];
                            break;
                        }
                    }
                }
                $api->comm('/ppp/secret/add', [
                    '=name=' . $username,
                    '=password=' . ($cust['password'] ?: '123456'),
                    '=profile=' . $pkgProfile,
                    '=service=pppoe',
                    '=disabled=no',
                    '=comment=' . "{$cust['full_name']} | {$cust['customer_code']}",
                ]);
                $lines[] = "PPPoE Secret: Successfully created on router with profile '{$pkgProfile}'";
                $secretExists = true;
            } else {
                // Pure Sync inspection: Truthfully report that secret does NOT exist on MikroTik
                $lines[] = "PPPoE Secret: NOT FOUND on Router";
                $lines[] = "Account State: Not Provisioned on MikroTik";
                $lines[] = "Notice: User '{$username}' does not exist in router's PPPoE secrets.";
            }

            // Update database with latest live values
            $upStmt = $db->prepare("UPDATE customer_network_accounts SET 
                is_online = :online,
                current_ip = :ip,
                mac_address = COALESCE(:mac, mac_address),
                uptime_seconds = :uptime,
                last_offline_at = COALESCE(:off, last_offline_at),
                last_disconnect_reason = COALESCE(:reason, last_disconnect_reason),
                last_online_at = CASE WHEN :online1 = 1 THEN NOW() ELSE last_online_at END
                WHERE customer_id = :cid");
            $upStmt->execute([
                'online' => $isOnline ? 1 : 0,
                'ip' => $currentIp,
                'mac' => $callerId,
                'uptime' => $isOnline ? self::parseUptime($uptime) : 0,
                'off' => $lastLoggedOut,
                'reason' => $disconnectReason,
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
            'message' => $secretExists 
                ? 'MikroTik live session and secret synchronized successfully'
                : "Customer '{$username}' is not provisioned on router {$router['device_name']}",
            'data' => [
                'username' => $username,
                'isOnline' => $isOnline,
                'secretExists' => $secretExists,
                'currentIp' => $currentIp,
                'macAddress' => $callerId,
                'uptime' => $uptime,
                'mikrotikDetailLines' => $lines,
            ],
        ];
    }

    /**
     * Explicitly push and provision customer secret to MikroTik
     */
    public static function provisionSecret(PDO $db, $customerId, ?int $tenantId = null): array {
        return self::syncCustomer($db, $customerId, $tenantId, true);
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
            // 1. Verify profile on router, resolve exact casing or auto-create with rate limit if missing
            if (!empty($profileName) && strtolower($profileName) !== 'default') {
                $allProfs = $api->comm('/ppp/profile/print');
                $matchedProf = null;
                foreach ($allProfs as $p) {
                    if (isset($p['name']) && strcasecmp($p['name'], $profileName) === 0) {
                        $matchedProf = $p['name'];
                        break;
                    }
                }
                if ($matchedProf) {
                    $profileName = $matchedProf;
                } else {
                    $rateLimit = $cust['rate_limit'] ?? ($cust['bandwidth_limit'] ?? '10M/10M');
                    $api->comm('/ppp/profile/add', [
                        '=name=' => $profileName,
                        '=rate-limit=' => $rateLimit,
                    ]);
                }
            }

            // 2. Secret check and set/add with disabled=no
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
            // 1. Verify profile on router, resolve exact casing or auto-create with rate limit if missing
            if (!empty($profileName) && strtolower($profileName) !== 'default') {
                $allProfs = $api->comm('/ppp/profile/print');
                $matchedProf = null;
                foreach ($allProfs as $p) {
                    if (isset($p['name']) && strcasecmp($p['name'], $profileName) === 0) {
                        $matchedProf = $p['name'];
                        break;
                    }
                }
                if ($matchedProf) {
                    $profileName = $matchedProf;
                } else {
                    $rateLimit = $cust['rate_limit'] ?? ($cust['bandwidth_limit'] ?? '10M/10M');
                    $api->comm('/ppp/profile/add', [
                        '=name=' => $profileName,
                        '=rate-limit=' => $rateLimit,
                    ]);
                }
            }

            // 2. Secret check and set/add with disabled=no
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

    /**
     * Check if customer's MAC address is strictly BOUND in MikroTik PPPoE secret caller-id
     */
    public static function getMacBindingStatus(PDO $db, $customerId, ?int $tenantId = null): array {
        $stmt = $db->prepare("SELECT c.tenant_id, na.username, na.mac_address, na.current_ip, na.is_online 
            FROM customers c 
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id 
            WHERE c.customer_id = :cid LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $row = $stmt->fetch();

        if (!$row || empty($row['username'])) {
            return [
                'hasCallerId' => false,
                'callerId' => null,
                'detectedMac' => null,
            ];
        }

        $username = trim($row['username']);
        $router = self::getRouter($db, $customerId, $tenantId ?: (int)$row['tenant_id']);

        $hasCallerId = false;
        $callerId = null;
        $detectedMac = !empty($row['mac_address']) ? $row['mac_address'] : null;

        if ($router) {
            $api = self::connect($router, 3);
            if ($api) {
                try {
                    $secList = $api->comm('/ppp/secret/print', ['?name' => $username]);
                    if (!empty($secList[0])) {
                        $sec = $secList[0];
                        $secretCallerId = trim($sec['caller-id'] ?? '');
                        if (!empty($secretCallerId)) {
                            $hasCallerId = true;
                            $callerId = $secretCallerId;
                        }
                        if (empty($detectedMac) && !empty($sec['last-caller-id'])) {
                            $detectedMac = $sec['last-caller-id'];
                        }
                    }

                    // If not bound, also check active session for live MAC
                    if (!$hasCallerId) {
                        $actList = $api->comm('/ppp/active/print', ['?name' => $username]);
                        if (!empty($actList[0]['caller-id'])) {
                            $detectedMac = $actList[0]['caller-id'];
                        }
                    }
                } catch (\Throwable $e) {
                } finally {
                    $api->disconnect();
                }
            }
        }

        return [
            'hasCallerId' => $hasCallerId,
            'callerId' => $callerId,
            'detectedMac' => $detectedMac,
        ];
    }

    /**
     * Ping customer CPE IP directly from their MikroTik gateway router
     */
    public static function pingCustomer(PDO $db, $customerId, ?int $tenantId = null): array {
        $stmt = $db->prepare("SELECT c.customer_id, c.tenant_id, c.full_name, c.customer_code, 
                na.username, na.current_ip, na.remote_address, na.is_online, na.uptime_seconds 
            FROM customers c 
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id 
            WHERE c.customer_id = :cid LIMIT 1");
        $stmt->execute(['cid' => $customerId]);
        $row = $stmt->fetch();

        if (!$row) {
            return [
                'success' => false,
                'error' => 'Customer account not found',
                'lines' => [],
                'bandwidthLines' => [],
            ];
        }

        $username = trim($row['username'] ?? '');
        $router = self::getRouter($db, $customerId, $tenantId ?: (int)$row['tenant_id']);
        if (!$router) {
            return [
                'success' => false,
                'error' => 'No active MikroTik router found for this customer.',
                'lines' => [],
                'bandwidthLines' => [],
            ];
        }

        $api = self::connect($router, 5);
        if (!$api) {
            return [
                'success' => false,
                'error' => "Could not connect to router {$router['device_name']} ({$router['management_ip']}).",
                'lines' => [],
                'bandwidthLines' => [],
            ];
        }

        $ip = trim($row['current_ip'] ?: $row['remote_address'] ?: '');
        $isOnline = (bool)($row['is_online'] ?? false);
        $uptimeStr = 'Offline';

        try {
            // Check live active session on MikroTik to get exact current IP
            if (!empty($username)) {
                $actList = $api->comm('/ppp/active/print', ['?name' => $username]);
                if (!empty($actList[0]['address'])) {
                    $ip = $actList[0]['address'];
                    $isOnline = true;
                    $uptimeStr = $actList[0]['uptime'] ?? 'Online';
                }
            }

            if (empty($ip)) {
                return [
                    'success' => false,
                    'error' => "Customer '{$username}' is currently offline with no assigned IP address.",
                    'lines' => ["Target: {$username}", "Status: OFFLINE (No IP assigned)"],
                    'bandwidthLines' => [],
                ];
            }

            // Run real ICMP ping from MikroTik to Customer IP
            $pingResults = $api->comm('/ping', [
                '=address=' . $ip,
                '=count=4',
            ]);

            $lines = [];
            $lines[] = "PING {$ip} from {$router['device_name']} ({$router['management_ip']}): 56 data bytes";

            $sent = 0;
            $received = 0;
            $minRtt = null;
            $avgRtt = null;
            $maxRtt = null;

            foreach ($pingResults as $p) {
                $sent++;
                $seq = (int)($p['seq'] ?? ($sent - 1)) + 1;
                $host = $p['host'] ?? $ip;

                if (!empty($p['status']) && $p['status'] === 'timeout') {
                    $lines[] = "Request timeout for icmp_seq {$seq}";
                } elseif (!empty($p['time'])) {
                    $received++;
                    $ttl = $p['ttl'] ?? '64';
                    $time = $p['time'];
                    $lines[] = "64 bytes from {$host}: icmp_seq={$seq} ttl={$ttl} time={$time}";
                } elseif (!empty($p['packet-loss']) && (int)$p['packet-loss'] === 100) {
                    $lines[] = "Request timeout for icmp_seq {$seq}";
                } else {
                    $lines[] = "64 bytes from {$host}: icmp_seq={$seq}";
                    $received++;
                }

                if (isset($p['min-rtt'])) $minRtt = $p['min-rtt'];
                if (isset($p['avg-rtt'])) $avgRtt = $p['avg-rtt'];
                if (isset($p['max-rtt'])) $maxRtt = $p['max-rtt'];
            }

            $loss = $sent > 0 ? round((($sent - $received) / $sent) * 100) : 100;
            $lines[] = "--- {$ip} ping statistics ---";
            $lines[] = "{$sent} packets transmitted, {$received} packets received, {$loss}% packet loss";
            if ($minRtt && $avgRtt && $maxRtt && $received > 0) {
                $lines[] = "rtt min/avg/max = {$minRtt} / {$avgRtt} / {$maxRtt}";
            }

            // Query live interface traffic
            $bandwidthLines = [];
            if (!empty($username)) {
                $iface = $api->comm('/interface/print', ['?name' => '<pppoe-' . $username . '>']);
                if (!empty($iface[0])) {
                    $rx = (float)($iface[0]['rx-byte'] ?? 0);
                    $tx = (float)($iface[0]['tx-byte'] ?? 0);
                    $bandwidthLines[] = "Interface: <pppoe-{$username}> (Active Link)";
                    $bandwidthLines[] = "Total Session Tx: " . self::formatBytes($tx) . " | Rx: " . self::formatBytes($rx);
                    if (!empty($iface[0]['last-link-up-time'])) {
                        $bandwidthLines[] = "Connected Since: {$iface[0]['last-link-up-time']}";
                    }
                } else {
                    $secList = $api->comm('/ppp/secret/print', ['?name' => $username]);
                    if (!empty($secList[0]['profile'])) {
                        $bandwidthLines[] = "Configured Profile: {$secList[0]['profile']}";
                    }
                    if (!$isOnline) {
                        $bandwidthLines[] = "Session Status: Offline (No active interface)";
                    }
                }
            }

            return [
                'success' => ($received > 0),
                'address' => $ip,
                'uptime' => $uptimeStr,
                'lines' => $lines,
                'bandwidthLines' => $bandwidthLines,
                'error' => ($received === 0) ? "Host {$ip} did not respond to ICMP ping (100% loss)" : null,
                'data' => [
                    'sent' => $sent,
                    'received' => $received,
                    'loss' => $loss,
                    'rtt' => $avgRtt,
                ],
            ];
        } finally {
            $api->disconnect();
        }
    }

    public static function formatBytes(float $bytes): string {
        if ($bytes >= 1073741824) return round($bytes / 1073741824, 2) . ' GB';
        if ($bytes >= 1048576) return round($bytes / 1048576, 2) . ' MB';
        if ($bytes >= 1024) return round($bytes / 1024, 2) . ' KB';
        return $bytes . ' B';
    }
}
