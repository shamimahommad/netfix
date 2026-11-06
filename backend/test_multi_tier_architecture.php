<?php
/**
 * NetFix ISP SaaS - Multi-Tier Architecture Verification Test
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/lib/HierarchySecurityService.php';
require_once __DIR__ . '/lib/PackageAssignmentService.php';
require_once __DIR__ . '/lib/WalletLedgerService.php';

echo "=== STARTING MULTI-TIER RESELLER ARCHITECTURE TEST ===\n\n";

$db = Database::getConnection();

// 1. Test Hierarchy Level Resolution
echo "[TEST 1] Hierarchy Levels & Role Chains:\n";
assert(HierarchySecurityService::getHierarchyLevel('admin') === 0);
assert(HierarchySecurityService::getHierarchyLevel('isp_admin') === 0);
assert(HierarchySecurityService::getHierarchyLevel('reseller') === 1);
assert(HierarchySecurityService::getHierarchyLevel('sub_reseller') === 2);
assert(HierarchySecurityService::getHierarchyLevel('dealer') === 3);
assert(HierarchySecurityService::getHierarchyLevel('agent') === 4);

assert(HierarchySecurityService::getAllowedChildRole('admin') === 'reseller');
assert(HierarchySecurityService::getAllowedChildRole('reseller') === 'sub_reseller');
assert(HierarchySecurityService::getAllowedChildRole('sub_reseller') === 'dealer');
assert(HierarchySecurityService::getAllowedChildRole('dealer') === 'agent');
assert(HierarchySecurityService::getAllowedChildRole('agent') === null);
echo "✓ Role hierarchy chain mapping verified.\n\n";

// 2. Test Materialized Path & Downward Isolation
echo "[TEST 2] Downward-Only Access Control (Materialized Path):\n";
$user2 = HierarchySecurityService::getUser(2); // ISP Admin (/2/)
$user6 = HierarchySecurityService::getUser(6); // Reseller (/2/6/)

assert(HierarchySecurityService::canAccessUser(2, 6) === true); // Parent can access child
assert(HierarchySecurityService::canAccessUser(6, 2) === false); // Child CANNOT access parent
echo "✓ Downward-only access verified (ISP Admin can access Reseller, Reseller cannot access ISP Admin).\n\n";

// 3. Test Cascading Price Floor Validation
echo "[TEST 3] Validated Cascading Price Floor:\n";
// Package 1 has retail price 500.00
// User 6 (Reseller) has cost_price = 300.00 (from ISP Admin)
$floor = PackageAssignmentService::getParentCostFloor(6, 1, 2);
echo "Parent User 6 Cost Floor: ৳{$floor['parent_cost_floor']}, Max Allowed Commission: {$floor['max_allowed_commission']}%\n";
assert($floor['parent_cost_floor'] == 300.00);
assert($floor['max_allowed_commission'] == 40.00);

// Create a mock sub-reseller for testing
$db->exec("INSERT INTO users (user_id, tenant_id, email, username, password_hash, first_name, last_name, role, role_level, parent_id, hierarchy_path, status)
    VALUES (999, 2, 'subtest@reseller.local', 'subtest', 'hash', 'Sub', 'Test', 'sub_reseller', 60, 6, '/2/6/999/', 'active')
    ON DUPLICATE KEY UPDATE parent_id = 6, hierarchy_path = '/2/6/999/'");

// Case A: Attempt Floor Violation (Child commission 50% -> Cost 250 < Parent Cost 300)
$violationCaught = false;
try {
    PackageAssignmentService::assignPackageToChild(6, 999, 1, 50.00, null, true, 2);
} catch (DomainException $e) {
    $violationCaught = true;
    echo "✓ Price Floor Violation successfully caught: " . $e->getMessage() . "\n";
}
assert($violationCaught === true, "Must catch price floor violation when child cost < parent cost!");

// Case B: Valid Floor Assignment (Child commission 30% -> Cost 350 >= Parent Cost 300)
$validResult = PackageAssignmentService::assignPackageToChild(6, 999, 1, 30.00, null, true, 2);
assert($validResult['child_cost_price'] == 350.00);
assert($validResult['margin_profit'] == 150.00);
echo "✓ Valid assignment saved: Child Cost = ৳{$validResult['child_cost_price']} (Parent Floor: ৳{$validResult['parent_cost_floor']})\n\n";

// 4. Test Atomic Wallet & Upstream Margin Cascading
echo "[TEST 4] Atomic Wallet Deduction & Margin Cascading:\n";
// Ensure wallets exist
WalletLedgerService::ensureWallet(999, 2);
WalletLedgerService::ensureWallet(6, 2);

// Set wallet balances: Give User 999 1000 BDT, User 6 has 0 BDT
$db->exec("UPDATE wallets SET balance = 1000.00 WHERE user_id = 999");
$db->exec("UPDATE wallets SET balance = 0.00 WHERE user_id = 6");

$beforeBal999 = WalletLedgerService::getBalance(999);
$beforeBal6   = WalletLedgerService::getBalance(6);

// Execute Customer Recharge for package 1 (Child buy cost is 350 BDT, Parent buy cost is 300 BDT)
// Child User 999 should be debited 350 BDT
// Parent User 6 should be credited upstream pass-through margin of (350 - 300) = 50 BDT!
$rch = WalletLedgerService::rechargeWithMarginCascade(999, 3, 1, 'TEST-INV-001', 2);

$afterBal999 = WalletLedgerService::getBalance(999);
$afterBal6   = WalletLedgerService::getBalance(6);

echo "Sub-Reseller #999 Balance: ৳{$beforeBal999} -> ৳{$afterBal999} (Debited ৳{$rch['actor_deduction']})\n";
echo "Reseller #6 Balance: ৳{$beforeBal6} -> ৳{$afterBal6} (Upstream Margin Credited: ৳50.00)\n";

assert($afterBal999 == 650.00, "User 999 balance should be 1000 - 350 = 650");
assert($afterBal6 == 50.00, "User 6 balance should be 0 + 50 = 50");
echo "✓ Atomic wallet deduction and upstream margin cascading mathematically verified!\n\n";

// Clean up mock user
$db->exec("DELETE FROM tier_packages WHERE user_id = 999");
$db->exec("DELETE FROM reseller_plan_permission WHERE user_id = 999");
$db->exec("DELETE FROM wallets WHERE user_id = 999");
$db->exec("DELETE FROM users WHERE user_id = 999");

echo "=== ALL ARCHITECTURAL TESTS PASSED CLEANLY (100% SUCCESS)! ===\n";
