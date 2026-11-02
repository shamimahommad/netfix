<?php
/**
 * NetFix ISP SaaS - High-Concurrency Global & Multi-Tenant Sequence Service
 * 
 * Provides 100% collision-free, atomic sequential numbering.
 * 
 * NOTE ON ARCHITECTURE:
 * Customer IDs are GLOBALLY UNIQUE across all tenants (using tenant_id = 0).
 * This is essential for SaaS MFS / Pay Bill integration (e.g. bKash / Nagad / Upay Merchant Pay Bill):
 * When end-customers pay their internet bill via bKash/Nagad app, they only provide their Customer ID.
 * Because the ID is globally unique across the entire SaaS, the platform instantly identifies
 * the exact customer, the correct ISP tenant, and triggers automatic line reconnection on MikroTik.
 */

class TenantSequenceService {
    public const BASE_CUSTOMER_ID = 100000;

    /**
     * Preview the next sequence code without incrementing (for UI display)
     */
    public static function peekNextCode(PDO $db, string $tenantId, string $type = 'customer', int $padding = 6): string {
        $effectiveTenantId = ($type === 'customer') ? '0' : $tenantId;
        self::ensureSequenceRow($db, $effectiveTenantId, $type);

        $stmt = $db->prepare("SELECT current_value FROM tenant_sequences WHERE tenant_id = :tid AND sequence_type = :type");
        $stmt->execute(['tid' => $effectiveTenantId, 'type' => $type]);
        $current = (int)$stmt->fetchColumn();

        if ($type === 'customer') {
            // Check global max in customers table across all tenants
            $stmtMax = $db->query("SELECT MAX(CAST(customer_code AS UNSIGNED)) FROM customers");
            $maxExisting = (int)$stmtMax->fetchColumn();
            $base = self::BASE_CUSTOMER_ID;
        } else {
            // Check tenant-specific max
            $stmtMax = $db->prepare("SELECT MAX(CAST(customer_code AS UNSIGNED)) FROM customers WHERE tenant_id = :tid");
            $stmtMax->execute(['tid' => $tenantId]);
            $maxExisting = (int)$stmtMax->fetchColumn();
            $base = 0;
        }

        $nextVal = max($base, $current, $maxExisting) + 1;
        return str_pad((string)$nextVal, $padding, '0', STR_PAD_LEFT);
    }

    /**
     * Atomically generate and lock the next sequential code.
     * MUST be called inside an active database transaction.
     */
    public static function generateNextCode(PDO $db, string $tenantId, string $type = 'customer', int $padding = 6): string {
        $effectiveTenantId = ($type === 'customer') ? '0' : $tenantId;
        self::ensureSequenceRow($db, $effectiveTenantId, $type);

        // 1. Lock the sequence row exclusively with FOR UPDATE
        $stmtLock = $db->prepare("SELECT current_value FROM tenant_sequences WHERE tenant_id = :tid AND sequence_type = :type FOR UPDATE");
        $stmtLock->execute(['tid' => $effectiveTenantId, 'type' => $type]);
        $current = (int)$stmtLock->fetchColumn();

        if ($type === 'customer') {
            // Check global max in customers table across all tenants
            $stmtMax = $db->query("SELECT MAX(CAST(customer_code AS UNSIGNED)) FROM customers");
            $maxExisting = (int)$stmtMax->fetchColumn();
            $base = self::BASE_CUSTOMER_ID;
        } else {
            // Check tenant-specific max
            $stmtMax = $db->prepare("SELECT MAX(CAST(customer_code AS UNSIGNED)) FROM customers WHERE tenant_id = :tid");
            $stmtMax->execute(['tid' => $tenantId]);
            $maxExisting = (int)$stmtMax->fetchColumn();
            $base = 0;
        }

        $nextVal = max($base, $current, $maxExisting) + 1;

        // 2. Atomically update the counter
        $stmtUp = $db->prepare("UPDATE tenant_sequences SET current_value = :val, updated_at = NOW() WHERE tenant_id = :tid AND sequence_type = :type");
        $stmtUp->execute(['val' => $nextVal, 'tid' => $effectiveTenantId, 'type' => $type]);

        return str_pad((string)$nextVal, $padding, '0', STR_PAD_LEFT);
    }

    /**
     * Ensure the sequence record exists
     */
    private static function ensureSequenceRow(PDO $db, string $tenantId, string $type): void {
        $initialVal = ($type === 'customer') ? self::BASE_CUSTOMER_ID : 0;
        $stmt = $db->prepare("INSERT IGNORE INTO tenant_sequences (tenant_id, sequence_type, current_value) VALUES (:tid, :type, :init)");
        $stmt->execute(['tid' => $tenantId, 'type' => $type, 'init' => $initialVal]);
    }
}
