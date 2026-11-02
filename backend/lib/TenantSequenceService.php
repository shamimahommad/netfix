<?php
/**
 * NetFix ISP SaaS - High-Concurrency Multi-Tenant Sequence Service
 * 
 * Provides 100% collision-free, atomic sequential numbering per ISP tenant.
 * Uses MySQL row-level locking (FOR UPDATE) and tenant_sequences table to guarantee
 * that even under heavy concurrent traffic from 200+ ISPs and hundreds of operators,
 * no duplicate customer codes can ever be generated.
 */

class TenantSequenceService {
    /**
     * Preview the next customer sequence code without incrementing (for UI display)
     */
    public static function peekNextCode(PDO $db, string $tenantId, string $type = 'customer', int $padding = 6): string {
        self::ensureSequenceRow($db, $tenantId, $type);

        $stmt = $db->prepare("SELECT current_value FROM tenant_sequences WHERE tenant_id = :tid AND sequence_type = :type");
        $stmt->execute(['tid' => $tenantId, 'type' => $type]);
        $current = (int)$stmt->fetchColumn();

        // Also check actual max in customers table to avoid drift
        $stmtMax = $db->prepare("SELECT MAX(CAST(customer_code AS UNSIGNED)) FROM customers WHERE tenant_id = :tid");
        $stmtMax->execute(['tid' => $tenantId]);
        $maxExisting = (int)$stmtMax->fetchColumn();

        $nextVal = max($current, $maxExisting) + 1;
        return str_pad((string)$nextVal, $padding, '0', STR_PAD_LEFT);
    }

    /**
     * Atomically generate and lock the next sequential code for this tenant.
     * MUST be called inside an active database transaction.
     */
    public static function generateNextCode(PDO $db, string $tenantId, string $type = 'customer', int $padding = 6): string {
        self::ensureSequenceRow($db, $tenantId, $type);

        // 1. Lock the specific tenant sequence row exclusively
        $stmtLock = $db->prepare("SELECT current_value FROM tenant_sequences WHERE tenant_id = :tid AND sequence_type = :type FOR UPDATE");
        $stmtLock->execute(['tid' => $tenantId, 'type' => $type]);
        $current = (int)$stmtLock->fetchColumn();

        // 2. Check if table has higher numeric code
        $stmtMax = $db->prepare("SELECT MAX(CAST(customer_code AS UNSIGNED)) FROM customers WHERE tenant_id = :tid");
        $stmtMax->execute(['tid' => $tenantId]);
        $maxExisting = (int)$stmtMax->fetchColumn();

        $nextVal = max($current, $maxExisting) + 1;

        // 3. Atomically update the counter
        $stmtUp = $db->prepare("UPDATE tenant_sequences SET current_value = :val, updated_at = NOW() WHERE tenant_id = :tid AND sequence_type = :type");
        $stmtUp->execute(['val' => $nextVal, 'tid' => $tenantId, 'type' => $type]);

        return str_pad((string)$nextVal, $padding, '0', STR_PAD_LEFT);
    }

    /**
     * Ensure the sequence record exists for this tenant
     */
    private static function ensureSequenceRow(PDO $db, string $tenantId, string $type): void {
        $stmt = $db->prepare("INSERT IGNORE INTO tenant_sequences (tenant_id, sequence_type, current_value) VALUES (:tid, :type, 0)");
        $stmt->execute(['tid' => $tenantId, 'type' => $type]);
    }
}
