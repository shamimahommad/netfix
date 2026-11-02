<?php
/**
 * NetFix ISP SaaS - High-Concurrency Global & Multi-Tenant Sequence Service
 * 
 * Provides 100% collision-free, atomic sequential numbering.
 * 
 * NOTE ON ARCHITECTURE:
 * 1. Customer IDs:   GLOBALLY UNIQUE pure numeric (Base 100000 -> 100001, 100002...)
 * 2. Invoices/Bills: GLOBALLY UNIQUE pure numeric (Base 200000 -> 200001, 200002...)
 * 3. Network Devices (MikroTik/OLT): GLOBALLY UNIQUE pure numeric (Base 300000 -> 300001, 300002...)
 * 
 * Zero letters, zero dashes, zero collisions across all 200+ ISP tenants.
 * This enables SaaS operators and support teams to immediately identify the entity from its ID
 * and allows MFS Pay Bill (bKash/Nagad) webhooks to automatically match customer and invoice.
 */

class TenantSequenceService {
    public const BASE_CUSTOMER_ID = 100000;
    public const BASE_INVOICE_ID  = 200000;
    public const BASE_DEVICE_ID   = 300000;

    /**
     * Preview the next sequence code without incrementing (for UI display)
     */
    public static function peekNextCode(PDO $db, string $tenantId, string $type = 'customer', int $padding = 6): string {
        $isGlobal = self::isGlobalType($type);
        $effectiveTenantId = $isGlobal ? '0' : $tenantId;
        $base = self::getBaseForType($type);

        self::ensureSequenceRow($db, $effectiveTenantId, $type, $base);

        $stmt = $db->prepare("SELECT current_value FROM tenant_sequences WHERE tenant_id = :tid AND sequence_type = :type");
        $stmt->execute(['tid' => $effectiveTenantId, 'type' => $type]);
        $current = (int)$stmt->fetchColumn();

        if ($isGlobal) {
            if ($current <= $base) {
                $maxExisting = self::getMaxFromTable($db, $type);
                $nextVal = max($base, $maxExisting) + 1;
            } else {
                $nextVal = $current + 1;
            }
        } else {
            $stmtMax = $db->prepare("SELECT MAX(CAST(customer_code AS UNSIGNED)) FROM customers WHERE tenant_id = :tid");
            $stmtMax->execute(['tid' => $tenantId]);
            $maxExisting = (int)$stmtMax->fetchColumn();
            $nextVal = max(0, $current, $maxExisting) + 1;
        }

        return str_pad((string)$nextVal, $padding, '0', STR_PAD_LEFT);
    }

    /**
     * Atomically generate and lock the next sequential code.
     * MUST be called inside an active database transaction.
     */
    public static function generateNextCode(PDO $db, string $tenantId, string $type = 'customer', int $padding = 6): string {
        $isGlobal = self::isGlobalType($type);
        $effectiveTenantId = $isGlobal ? '0' : $tenantId;
        $base = self::getBaseForType($type);

        self::ensureSequenceRow($db, $effectiveTenantId, $type, $base);

        // 1. Lock the sequence row exclusively with FOR UPDATE
        $stmtLock = $db->prepare("SELECT current_value FROM tenant_sequences WHERE tenant_id = :tid AND sequence_type = :type FOR UPDATE");
        $stmtLock->execute(['tid' => $effectiveTenantId, 'type' => $type]);
        $current = (int)$stmtLock->fetchColumn();

        if ($isGlobal) {
            // Ultra-fast O(1) atomic generation: never scans large tables once initialized
            if ($current <= $base) {
                $maxExisting = self::getMaxFromTable($db, $type);
                $nextVal = max($base, $maxExisting) + 1;
            } else {
                $nextVal = $current + 1;
            }
        } else {
            $stmtMax = $db->prepare("SELECT MAX(CAST(customer_code AS UNSIGNED)) FROM customers WHERE tenant_id = :tid");
            $stmtMax->execute(['tid' => $tenantId]);
            $maxExisting = (int)$stmtMax->fetchColumn();
            $nextVal = max(0, $current, $maxExisting) + 1;
        }

        // 2. Atomically update the counter
        $stmtUp = $db->prepare("UPDATE tenant_sequences SET current_value = :val, updated_at = NOW() WHERE tenant_id = :tid AND sequence_type = :type");
        $stmtUp->execute(['val' => $nextVal, 'tid' => $effectiveTenantId, 'type' => $type]);

        return str_pad((string)$nextVal, $padding, '0', STR_PAD_LEFT);
    }

    private static function isGlobalType(string $type): bool {
        return in_array($type, ['customer', 'invoice', 'device'], true);
    }

    private static function getBaseForType(string $type): int {
        return match($type) {
            'customer' => self::BASE_CUSTOMER_ID,
            'invoice'  => self::BASE_INVOICE_ID,
            'device'   => self::BASE_DEVICE_ID,
            default    => 0,
        };
    }

    private static function getMaxFromTable(PDO $db, string $type): int {
        return match($type) {
            'customer' => (int)$db->query("SELECT MAX(CAST(customer_code AS UNSIGNED)) FROM customers")->fetchColumn(),
            'invoice'  => (int)$db->query("SELECT MAX(CAST(invoice_number AS UNSIGNED)) FROM invoices")->fetchColumn(),
            'device'   => (int)$db->query("SELECT MAX(CAST(device_code AS UNSIGNED)) FROM network_devices")->fetchColumn(),
            default    => 0,
        };
    }

    /**
     * Ensure the sequence record exists
     */
    private static function ensureSequenceRow(PDO $db, string $tenantId, string $type, int $initialVal = 0): void {
        $stmt = $db->prepare("INSERT IGNORE INTO tenant_sequences (tenant_id, sequence_type, current_value) VALUES (:tid, :type, :init)");
        $stmt->execute(['tid' => $tenantId, 'type' => $type, 'init' => $initialVal]);
    }
}
