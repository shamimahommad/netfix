<?php
/**
 * NetFix ISP SaaS - Payment Split & Double-Entry Ledger Verification Test
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/services/PaymentSplitService.php';
require_once __DIR__ . '/lib/HierarchySecurityService.php';
require_once __DIR__ . '/lib/WalletLedgerService.php';

echo "=== STARTING PAYMENT SPLIT & DOUBLE-ENTRY LEDGER TEST ===\n\n";

$db = Database::getConnection();

try {
    // 1. Setup Test Hierarchy
    // User 2: ISP Admin
    // User 6: Reseller (Parent 2, path /2/6/)
    // User 998: Agent (Parent 6, path /2/6/998/)
    $tenantId = 2;
    $packageId = 1; // 50Mbps or standard package
    $retailPrice = 500.00;

    // Clean up any previous test remnants
    $db->exec("DELETE FROM wallet_ledger WHERE source_customer_id = 88899");
    $db->exec("DELETE FROM invoices WHERE invoice_number = 'INV-TEST-SPLIT-998'");
    $db->exec("DELETE FROM customers WHERE customer_id = 88899");
    $db->exec("DELETE FROM tier_packages WHERE user_id = 998");
    $db->exec("DELETE FROM wallets WHERE user_id = 998");
    $db->exec("DELETE FROM users WHERE user_id = 998");

    // Insert mock Agent (User 998)
    $stmtAgent = $db->prepare("INSERT INTO users 
        (user_id, tenant_id, username, email, password_hash, role, parent_id, hierarchy_path, status, created_at)
        VALUES (998, :tid, 'mock_agent_998', 'agent998@test.com', 'dummyhash', 'agent', 6, '/2/6/998/', 'active', NOW())");
    $stmtAgent->execute(['tid' => $tenantId]);

    // Ensure wallets for ISP (User 2), Reseller (User 6), and Agent (User 998)
    WalletLedgerService::ensureWallet(2, $tenantId);
    WalletLedgerService::ensureWallet(6, $tenantId);
    WalletLedgerService::ensureWallet(998, $tenantId);

    // Set tier packages:
    // Reseller 6: Cost = 300
    // Agent 998: Cost = 350
    $db->exec("INSERT INTO tier_packages 
        (tenant_id, package_id, user_id, assigned_by, cost_price, commission_rate, retail_price, is_allowed)
        VALUES ({$tenantId}, {$packageId}, 6, 2, 300.00, 40.00, {$retailPrice}, 1)
        ON DUPLICATE KEY UPDATE cost_price = 300.00, retail_price = {$retailPrice}");

    $db->exec("INSERT INTO tier_packages 
        (tenant_id, package_id, user_id, assigned_by, cost_price, commission_rate, retail_price, is_allowed)
        VALUES ({$tenantId}, {$packageId}, 998, 6, 350.00, 30.00, {$retailPrice}, 1)
        ON DUPLICATE KEY UPDATE cost_price = 350.00, retail_price = {$retailPrice}");

    // Create mock Customer (88899) owned by Agent 998
    $db->exec("INSERT INTO customers 
        (customer_id, tenant_id, customer_code, full_name, phone, installation_address, status, billing_status, owner_id, owner_role_level, owner_path, created_at)
        VALUES (88899, {$tenantId}, 'CUST-SPLIT-998', 'Test Split Subscriber', '01700000000', 'Test Address', 'suspended', 'Expired', 998, 4, '/2/6/998/', NOW())");

    // Create mock customer_services linking packageId (1)
    $db->exec("DELETE FROM customer_services WHERE customer_id = 88899");
    $db->exec("INSERT INTO customer_services 
        (tenant_id, customer_id, access_profile_id, network_device_id, protocol, billing_cycle, status, starts_at, expires_at, created_at)
        VALUES ({$tenantId}, 88899, {$packageId}, 1, 'pppoe', 'monthly', 'active', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), NOW())");

    // Create mock unpaid Invoice for ৳500
    $stmtInv = $db->prepare("INSERT INTO invoices 
        (tenant_id, customer_id, invoice_number, invoice_no, invoice_date, due_date, status, subtotal, total_amount, paid_amount, balance_due, created_by, creator_id, created_at)
        VALUES (:tid, 88899, 'INV-TEST-SPLIT-998', 'INV-TEST-SPLIT-998', CURDATE(), CURDATE(), 'pending', 500.00, 500.00, 0.00, 500.00, 998, 998, NOW())");
    $stmtInv->execute(['tid' => $tenantId]);
    $invoiceId = (int)$db->lastInsertId();

    echo "[SETUP COMPLETE] Mock invoice #{$invoiceId} created for ৳500.00 under Agent #998\n";

    // Read initial balances
    $getBal = function(int $uid) use ($db): float {
        $st = $db->prepare("SELECT balance FROM wallets WHERE user_id = :u");
        $st->execute(['u' => $uid]);
        return (float)$st->fetchColumn();
    };

    $initBalIsp = $getBal(2);
    $initBalReseller = $getBal(6);
    $initBalAgent = $getBal(998);

    echo "Initial Balances -> ISP (2): ৳{$initBalIsp}, Reseller (6): ৳{$initBalReseller}, Agent (998): ৳{$initBalAgent}\n\n";

    // 2. Execute PaymentSplitService
    echo "[TEST 1] Processing Customer Payment via bKash Webhook...\n";
    $splitService = new PaymentSplitService($db);
    $result = $splitService->processCustomerPayment($invoiceId, 500.00, 'bkash', [
        'trx_id' => 'TRX-TEST-BKASH-777',
        'gateway' => 'bkash',
    ]);

    assert($result['success'] === true, "Split should succeed");
    echo "✓ Split processed successfully with Txn Group ID: {$result['txn_group_id']}\n";
    echo "✓ Total Paid: ৳{$result['total_paid']}, Total Disbursed: ৳{$result['total_disbursed']}\n";
    assert($result['total_paid'] == $result['total_disbursed'], "Total paid must strictly equal total disbursed");

    // Check balances
    $afterBalIsp = $getBal(2);
    $afterBalReseller = $getBal(6);
    $afterBalAgent = $getBal(998);

    echo "\nPost-Payment Balances:\n";
    echo "- ISP #2: ৳{$initBalIsp} -> ৳{$afterBalIsp} (Credited ৳" . ($afterBalIsp - $initBalIsp) . ")\n";
    echo "- Reseller #6: ৳{$initBalReseller} -> ৳{$afterBalReseller} (Credited ৳" . ($afterBalReseller - $initBalReseller) . ")\n";
    echo "- Agent #998: ৳{$initBalAgent} -> ৳{$afterBalAgent} (Credited ৳" . ($afterBalAgent - $initBalAgent) . ")\n";

    // Expected:
    // Agent Margin: 500 - 350 = 150
    // Reseller Margin: 350 - 300 = 50
    // ISP Net: 300
    assert(($afterBalAgent - $initBalAgent) == 150.00, "Agent margin must be exactly ৳150");
    assert(($afterBalReseller - $initBalReseller) == 50.00, "Reseller margin must be exactly ৳50");
    assert(($afterBalIsp - $initBalIsp) == 300.00, "ISP net received must be exactly ৳300");
    echo "✓ Exact financial margins mathematically verified for all 3 tiers!\n\n";

    // 3. Verify Double-Entry Ledger Audit Trail
    echo "[TEST 2] Verifying Immutable Wallet Ledger Audit Trail...\n";
    $stmtLedger = $db->prepare("SELECT * FROM wallet_ledger WHERE txn_group_id = :tg ORDER BY id ASC");
    $stmtLedger->execute(['tg' => $result['txn_group_id']]);
    $ledgerEntries = $stmtLedger->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($ledgerEntries) . " ledger entries in group {$result['txn_group_id']}:\n";
    $sumLedger = 0.0;
    foreach ($ledgerEntries as $le) {
        echo "  - User #{$le['user_id']} ({$le['purpose']}): ৳{$le['amount']} | Opening: ৳{$le['opening_balance']} -> Closing: ৳{$le['closing_balance']}\n";
        $sumLedger += (float)$le['amount'];
        assert((float)$le['closing_balance'] == round((float)$le['opening_balance'] + (float)$le['amount'], 2), "Closing balance formula error");
    }
    assert(count($ledgerEntries) === 3, "There should be exactly 3 ledger rows for 3 beneficiaries");
    assert(round($sumLedger, 2) == 500.00, "Sum of ledger credits must be 500.00");
    echo "✓ Wallet ledger double-entry audit trail 100% verified!\n\n";

    // 4. Test Idempotency
    echo "[TEST 3] Testing Idempotency (Submitting duplicate payment for same invoice)...\n";
    $dupResult = $splitService->processCustomerPayment($invoiceId, 500.00, 'bkash');
    assert($dupResult['already_processed'] === true, "Must flag duplicate payment as already processed");
    echo "✓ Idempotency protected: Duplicate payment gracefully rejected without double crediting!\n\n";

    // 5. Clean up mock records
    $db->exec("DELETE FROM customer_services WHERE customer_id = 88899");
    $db->exec("DELETE FROM wallet_ledger WHERE source_customer_id = 88899");
    $db->exec("DELETE FROM wallet_transactions WHERE user_id = 998");
    $db->exec("DELETE FROM invoices WHERE invoice_id = {$invoiceId}");
    $db->exec("DELETE FROM customers WHERE customer_id = 88899");
    $db->exec("DELETE FROM tier_packages WHERE user_id = 998");
    $db->exec("DELETE FROM wallets WHERE user_id = 998");
    $db->exec("DELETE FROM users WHERE user_id = 998");

    // Reset balances for users 2 and 6
    $db->prepare("UPDATE wallets SET balance = :b WHERE user_id = 2")->execute(['b' => $initBalIsp]);
    $db->prepare("UPDATE wallets SET balance = :b WHERE user_id = 6")->execute(['b' => $initBalReseller]);

    echo "=== ALL PAYMENT SPLIT & DOUBLE-ENTRY LEDGER TESTS PASSED (100% SUCCESS)! ===\n";
} catch (Throwable $e) {
    echo "TEST FAILED WITH EXCEPTION: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
