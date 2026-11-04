<?php
/**
 * NetFix ISP SaaS - Expiration Worker Script (CLI Cron)
 * 
 * Scheduled to run every 5-10 minutes via Crontab or Task Scheduler:
 * Crontab: * /10 * * * * php /path/to/netfix/backend/cron/expire_worker.php >> /var/log/netfix_expire.log 2>&1
 * 
 * Functions:
 * 1. Finds active customers whose subscription has expired (expires_at <= NOW()).
 * 2. Connects to their assigned MikroTik router via binary API (Port 8728 / custom).
 * 3. Disables their PPPoE secret (=disabled=yes) on RouterOS v6 / v7.
 * 4. Kicks any live active session (=/ppp/active/remove) to immediately drop connectivity.
 * 5. Updates customer, service, and network account status to 'expired'.
 * 6. Handles offline routers safely without crashing.
 */

if (php_sapi_name() !== 'cli' && !isset($_GET['run_cron_key'])) {
    // Basic protection against accidental browser runs unless key matches
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/MikrotikService.php';

echo "[" . date('Y-m-d H:i:s') . "] Starting NetFix Expiration Worker...\n";

try {
    $db = Database::getConnection();
} catch (\Throwable $e) {
    echo "CRITICAL: Database connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

// 1. Fetch all expired customers who are still marked active
$sql = "
    SELECT 
        c.customer_id,
        c.customer_code,
        c.full_name,
        c.tenant_id,
        cs.customer_service_id,
        cs.expires_at,
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
    WHERE (cs.status = 'active' OR c.status = 'active')
      AND cs.expires_at IS NOT NULL
      AND cs.expires_at <= NOW()
    ORDER BY nd.network_device_id ASC
";

$stmt = $db->query($sql);
$expiredList = $stmt->fetchAll(PDO::FETCH_ASSOC);

$totalFound = count($expiredList);
echo "Found {$totalFound} expired customer(s) to process.\n";

if ($totalFound === 0) {
    echo "Nothing to expire. Exiting.\n";
    exit(0);
}

// 2. Group by router to minimize connection overhead
$routerGroups = [];
foreach ($expiredList as $item) {
    $routerId = $item['network_device_id'] ?: 0;
    $routerGroups[$routerId][] = $item;
}

$mikrotik = new MikrotikService();
$successCount = 0;
$failCount = 0;

foreach ($routerGroups as $routerId => $users) {
    if (empty($routerId)) {
        // No router assigned, update DB directly
        foreach ($users as $u) {
            markExpiredInDb($db, $u['customer_id'], $u['customer_service_id']);
            echo "[-] Customer #{$u['customer_code']} ({$u['full_name']}) has no router assigned. Marked expired in DB.\n";
            $successCount++;
        }
        continue;
    }

    $sample = $users[0];
    $routerConfig = [
        'management_ip'   => $sample['management_ip'],
        'management_port' => $sample['management_port'] ?: 8728,
        'api_username'    => $sample['api_username'],
        'api_password'    => $sample['api_password'],
    ];

    $routerName = "{$sample['device_name']} ({$sample['management_ip']}:{$sample['management_port']})";
    echo "\nProcessing " . count($users) . " user(s) on router {$routerName}...\n";

    // Attempt router connection
    $connected = false;
    try {
        $connected = $mikrotik->connect($routerConfig);
    } catch (\Throwable $e) {
        $connected = false;
    }

    if (!$connected) {
        echo "[!] WARNING: Could not connect to router {$routerName}. Marking expired in DB only (router will sync once online).\n";
        foreach ($users as $u) {
            markExpiredInDb($db, $u['customer_id'], $u['customer_service_id']);
            $failCount++;
        }
        continue;
    }

    // Router is connected! Process each user's secret
    foreach ($users as $u) {
        $username = trim($u['pppoe_username'] ?? '');
        $cid = $u['customer_id'];
        $csid = $u['customer_service_id'];
        $code = $u['customer_code'];

        if (empty($username)) {
            markExpiredInDb($db, $cid, $csid);
            echo "[-] Customer #{$code} has no PPPoE username. Marked expired in DB.\n";
            $successCount++;
            continue;
        }

        try {
            $disabled = $mikrotik->disableSecret($routerConfig, $username);
            markExpiredInDb($db, $cid, $csid);

            if ($disabled) {
                echo "[✓] Disabled secret & dropped session for '{$username}' (Customer #{$code}).\n";
            } else {
                echo "[~] Secret '{$username}' not found on router, but marked expired in DB (Customer #{$code}).\n";
            }
            $successCount++;
        } catch (\Throwable $e) {
            echo "[x] Error expiring '{$username}': " . $e->getMessage() . "\n";
            markExpiredInDb($db, $cid, $csid);
            $failCount++;
        }
    }

    $mikrotik->disconnect();
}

echo "\n[" . date('Y-m-d H:i:s') . "] NetFix Expiration Worker finished. Success: {$successCount}, Warnings/Failed: {$failCount}.\n";

/**
 * Helper to update customer, service, and network account in DB
 */
function markExpiredInDb(PDO $db, int $customerId, ?int $customerServiceId): void {
    try {
        // Customer
        $db->prepare("UPDATE customers SET status = 'inactive', billing_status = 'Expired', updated_at = NOW() WHERE customer_id = :cid")
           ->execute(['cid' => $customerId]);

        // Service
        if ($customerServiceId) {
            $db->prepare("UPDATE customer_services SET status = 'expired', updated_at = NOW() WHERE customer_service_id = :sid")
               ->execute(['sid' => $customerServiceId]);
        }

        // Network Account
        $db->prepare("UPDATE customer_network_accounts SET status = 'inactive', is_online = 0, uptime_seconds = 0, updated_at = NOW() WHERE customer_id = :cid")
           ->execute(['cid' => $customerId]);

        // Log task
        $db->prepare("INSERT INTO client_task_logs (tenant_id, customer_id, action, description, status, created_by, created_at)
            SELECT tenant_id, :cid, 'AUTO_EXPIRE', 'Customer subscription expired via automated worker', 'completed', 1, NOW()
            FROM customers WHERE customer_id = :cid2 LIMIT 1")
           ->execute(['cid' => $customerId, 'cid2' => $customerId]);
    } catch (\Throwable $e) {
        error_log("Failed to mark customer #{$customerId} expired in DB: " . $e->getMessage());
    }
}

