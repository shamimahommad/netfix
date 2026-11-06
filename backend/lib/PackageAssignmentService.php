<?php
/**
 * NetFix ISP SaaS - Package Assignment & Cascading Price Floor Validation Service
 * Strictly enforces: Child Cost Price >= Parent Cost Price (Never trust frontend input).
 * Inside atomic database transactions.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/HierarchySecurityService.php';

class PackageAssignmentService {
    /**
     * Retrieve Parent's Cost Floor for a specific package
     */
    public static function getParentCostFloor(int $parentUserId, int $packageId, ?int $tenantId = null): array {
        $db = Database::getConnection();
        $parent = HierarchySecurityService::getUser($parentUserId);
        if (!$parent) {
            throw new InvalidArgumentException("Parent user #{$parentUserId} not found");
        }

        // Fetch package retail price
        $pkgStmt = $db->prepare("SELECT access_profile_id, profile_name, price as retail_price 
            FROM access_profiles WHERE access_profile_id = :pid LIMIT 1");
        $pkgStmt->execute(['pid' => $packageId]);
        $pkg = $pkgStmt->fetch(PDO::FETCH_ASSOC);
        $pkgStmt->closeCursor();

        if (!$pkg) {
            throw new InvalidArgumentException("Internet package #{$packageId} not found");
        }

        $retailPrice = (float)$pkg['retail_price'];
        $level = HierarchySecurityService::getHierarchyLevel($parent['role']);

        // Level 0: ISP Admin (Company) is the source of all packages.
        // Base cost floor = 0.00, maximum commission allowed = 100%
        if ($level === 0 || $parent['role'] === 'saas_admin') {
            return [
                'package_id' => $packageId,
                'package_name' => $pkg['profile_name'],
                'retail_price' => $retailPrice,
                'parent_cost_floor' => 0.00,
                'parent_commission_rate' => 100.00,
                'max_allowed_commission' => 100.00,
                'is_isp_root' => true,
            ];
        }

        // Tier Level 1, 2, 3: Must read parent's assigned buy cost
        $tpStmt = $db->prepare("SELECT cost_price, commission_rate, is_allowed 
            FROM tier_packages 
            WHERE user_id = :uid AND package_id = :pid LIMIT 1");
        $tpStmt->execute(['uid' => $parentUserId, 'pid' => $packageId]);
        $tp = $tpStmt->fetch(PDO::FETCH_ASSOC);
        $tpStmt->closeCursor();

        // Fallback to legacy reseller_plan_permission if not yet in tier_packages
        if (!$tp) {
            $rppStmt = $db->prepare("SELECT sell_price as cost_price, pop_profit_percent as commission_rate, is_allowed 
                FROM reseller_plan_permission 
                WHERE user_id = :uid AND access_profile_id = :pid LIMIT 1");
            $rppStmt->execute(['uid' => $parentUserId, 'pid' => $packageId]);
            $tp = $rppStmt->fetch(PDO::FETCH_ASSOC);
            $rppStmt->closeCursor();
        }

        if (!$tp || empty($tp['is_allowed'])) {
            throw new DomainException(
                "Parent {$parent['username']} (Level {$level}) is not authorized to sell package '{$pkg['profile_name']}'."
            );
        }

        $parentCost = (float)$tp['cost_price'];
        $parentCommission = (float)$tp['commission_rate'];

        // Maximum commission child can receive without violating parent cost floor
        $maxAllowedCommission = $retailPrice > 0 
            ? round((($retailPrice - $parentCost) / $retailPrice) * 100.0, 2)
            : 0.00;

        return [
            'package_id' => $packageId,
            'package_name' => $pkg['profile_name'],
            'retail_price' => $retailPrice,
            'parent_cost_floor' => $parentCost,
            'parent_commission_rate' => $parentCommission,
            'max_allowed_commission' => $maxAllowedCommission,
            'is_isp_root' => false,
        ];
    }

    /**
     * Set package pricing and commission for child tier with strict cascading floor validation
     */
    public static function assignPackageToChild(
        int $parentUserId,
        int $childUserId,
        int $packageId,
        float $commissionRate,
        ?float $overrideCostPrice = null,
        bool $isAllowed = true,
        ?int $tenantId = null
    ): array {
        $db = Database::getConnection();

        // 1. Authorization: Verify downward relationship
        if (!HierarchySecurityService::canAccessUser($parentUserId, $childUserId)) {
            throw new DomainException("Access Denied: Child user #{$childUserId} is not in your downline hierarchy.");
        }

        $parentUser = HierarchySecurityService::getUser($parentUserId);
        $childUser = HierarchySecurityService::getUser($childUserId);

        if (!$parentUser || !$childUser) {
            throw new InvalidArgumentException("Invalid parent or child user identifier.");
        }

        $effectiveTenantId = $tenantId ?: (int)($childUser['tenant_id'] ?: 1);

        // 2. Fetch parent cost floor & retail price
        $floorInfo = self::getParentCostFloor($parentUserId, $packageId, $effectiveTenantId);
        $retailPrice = (float)$floorInfo['retail_price'];
        $parentCostFloor = (float)$floorInfo['parent_cost_floor'];
        $maxAllowedCommission = (float)$floorInfo['max_allowed_commission'];

        // 3. Calculate child cost price
        if ($overrideCostPrice !== null && $overrideCostPrice > 0) {
            $childCost = round($overrideCostPrice, 2);
            $commissionRate = $retailPrice > 0 ? round((($retailPrice - $childCost) / $retailPrice) * 100.0, 2) : 0.00;
        } else {
            $commissionRate = round($commissionRate, 2);
            $childCost = round($retailPrice - ($retailPrice * ($commissionRate / 100.0)), 2);
        }

        // 4. Strict Financial Floor Validations
        if ($childCost < $parentCostFloor) {
            throw new DomainException(
                "Price Floor Violation: Child cost price (৳{$childCost}) cannot be lower than parent cost floor (৳{$parentCostFloor}). " .
                "Maximum commission allowed for this package is {$maxAllowedCommission}%."
            );
        }

        if ($commissionRate > $maxAllowedCommission) {
            throw new DomainException(
                "Commission Cap Violation: Commission rate of {$commissionRate}% exceeds maximum allowable cap of {$maxAllowedCommission}%."
            );
        }

        if ($childCost > $retailPrice) {
            throw new DomainException("Child cost price (৳{$childCost}) cannot exceed retail price (৳{$retailPrice}).");
        }

        if ($commissionRate < 0.00) {
            throw new DomainException("Commission rate cannot be negative.");
        }

        // 5. Database Transaction to atomic persist
        $db->beginTransaction();
        try {
            // Persist to tier_packages
            $tpStmt = $db->prepare("INSERT INTO tier_packages 
                (tenant_id, package_id, user_id, assigned_by, cost_price, commission_rate, retail_price, is_allowed)
                VALUES (:tid, :pid, :uid, :assigned_by, :cost, :comm, :retail, :allowed)
                ON DUPLICATE KEY UPDATE 
                    cost_price = VALUES(cost_price),
                    commission_rate = VALUES(commission_rate),
                    retail_price = VALUES(retail_price),
                    is_allowed = VALUES(is_allowed),
                    assigned_by = VALUES(assigned_by),
                    updated_at = NOW()");
            $tpStmt->execute([
                'tid' => $effectiveTenantId,
                'pid' => $packageId,
                'uid' => $childUserId,
                'assigned_by' => $parentUserId,
                'cost' => $childCost,
                'comm' => $commissionRate,
                'retail' => $retailPrice,
                'allowed' => $isAllowed ? 1 : 0,
            ]);
            $tpStmt->closeCursor();

            // Synchronize with legacy reseller_plan_permission
            $profit = round($retailPrice - $childCost, 2);
            $rppStmt = $db->prepare("INSERT INTO reseller_plan_permission 
                (tenant_id, user_id, access_profile_id, sell_price, pop_profit, pop_profit_percent, is_allowed)
                VALUES (:tid, :uid, :pid, :sell, :profit, :profit_pct, :allowed)
                ON DUPLICATE KEY UPDATE 
                    sell_price = VALUES(sell_price),
                    pop_profit = VALUES(pop_profit),
                    pop_profit_percent = VALUES(pop_profit_percent),
                    is_allowed = VALUES(is_allowed)");
            $rppStmt->execute([
                'tid' => $effectiveTenantId,
                'uid' => $childUserId,
                'pid' => $packageId,
                'sell' => $childCost,
                'profit' => $profit,
                'profit_pct' => $commissionRate,
                'allowed' => $isAllowed ? 1 : 0,
            ]);
            $rppStmt->closeCursor();

            $db->commit();

            return [
                'success' => true,
                'package_id' => $packageId,
                'package_name' => $floorInfo['package_name'],
                'retail_price' => $retailPrice,
                'parent_cost_floor' => $parentCostFloor,
                'child_cost_price' => $childCost,
                'commission_rate' => $commissionRate,
                'margin_profit' => $profit,
                'is_allowed' => $isAllowed,
            ];
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    /**
     * Retrieve full pricing matrix for child with parent cost floors
     */
    public static function getPricingMatrix(int $parentUserId, int $childUserId, ?int $tenantId = null): array {
        $db = Database::getConnection();
        $parent = HierarchySecurityService::getUser($parentUserId);
        $child = HierarchySecurityService::getUser($childUserId);

        if (!$parent || !$child) {
            return [];
        }

        $effectiveTenantId = $tenantId ?: (int)($child['tenant_id'] ?: 1);

        // Fetch all active packages
        $pkgStmt = $db->prepare("SELECT access_profile_id as id, profile_name, price, download_speed_kbps, upload_speed_kbps 
            FROM access_profiles WHERE tenant_id = :tid AND status = 'enabled' ORDER BY price ASC");
        $pkgStmt->execute(['tid' => $effectiveTenantId]);
        $packages = $pkgStmt->fetchAll(PDO::FETCH_ASSOC);
        $pkgStmt->closeCursor();

        $matrix = [];
        foreach ($packages as $pkg) {
            $pid = (int)$pkg['id'];
            try {
                $floor = self::getParentCostFloor($parentUserId, $pid, $effectiveTenantId);
            } catch (Throwable) {
                // If parent does not have access, skip or mark restricted
                continue;
            }

            // Fetch child's current assignment if exists
            $childTpStmt = $db->prepare("SELECT cost_price, commission_rate, is_allowed 
                FROM tier_packages WHERE user_id = :uid AND package_id = :pid LIMIT 1");
            $childTpStmt->execute(['uid' => $childUserId, 'pid' => $pid]);
            $childTp = $childTpStmt->fetch(PDO::FETCH_ASSOC);
            $childTpStmt->closeCursor();

            $retailPrice = (float)$pkg['price'];
            $parentCost = (float)$floor['parent_cost_floor'];
            $maxComm = (float)$floor['max_allowed_commission'];

            $currentCost = $childTp ? (float)$childTp['cost_price'] : $retailPrice;
            $currentComm = $childTp ? (float)$childTp['commission_rate'] : 0.00;
            $isAllowed = $childTp ? (bool)$childTp['is_allowed'] : true;

            $matrix[] = [
                'package_id' => $pid,
                'package_name' => $pkg['profile_name'],
                'retail_price' => $retailPrice,
                'download_speed_kbps' => (int)$pkg['download_speed_kbps'],
                'upload_speed_kbps' => (int)$pkg['upload_speed_kbps'],
                'parent_cost_floor' => $parentCost,
                'max_allowed_commission' => $maxComm,
                'child_cost_price' => $currentCost,
                'commission_rate' => $currentComm,
                'is_allowed' => $isAllowed,
            ];
        }

        return $matrix;
    }
}

