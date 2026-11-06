<?php
/**
 * NetFix ISP SaaS - Customer ID Temporary Reservation & Lease Management Service
 * 
 * ACID-Compliant Concurrency Control:
 * - Prevents duplicate customer_code assignment when multiple admins open "Add Customer" simultaneously.
 * - Allocates lowest available sequential gap (e.g. 100001, 100002...).
 * - Auto-expires reservations after 15 minutes.
 * - Allows instant client-side release on cancel, tab close (sendBeacon/keepalive), or unmount.
 */

class CustomerIdReservationService {
    public const BASE_CUSTOMER_ID = 100001;
    public const LEASE_DURATION_MINUTES = 15;
    public const LOCK_NAME = 'netfix_customer_id_allocation_lock';
    public const LOCK_TIMEOUT_SECONDS = 10;

    /**
     * Clean up any expired or released reservations
     */
    public static function purgeExpired(PDO $db): int {
        try {
            $stmt = $db->exec("DELETE FROM customer_id_reservations 
                WHERE status = 'released' 
                   OR (status = 'reserved' AND expires_at < NOW())");
            return $stmt ?: 0;
        } catch (\Throwable $e) {
            error_log("Failed to purge expired reservations: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Reserve the lowest available Customer ID for 15 minutes
     */
    public static function reserve(PDO $db, int $tenantId, int $adminId, ?string $sessionToken = null): array {
        // Clean up stale rows first
        self::purgeExpired($db);

        // Generate a cryptographically secure token if not supplied
        if (empty($sessionToken)) {
            $sessionToken = bin2hex(random_bytes(24));
        }

        // 1. If this session/tab already has an active, non-expired reservation, renew it
        $checkStmt = $db->prepare("SELECT reserved_code, expires_at 
            FROM customer_id_reservations 
            WHERE session_token = :token 
              AND tenant_id = :tid 
              AND status = 'reserved' 
              AND expires_at > NOW() 
            LIMIT 1");
        $checkStmt->execute(['token' => $sessionToken, 'tid' => $tenantId]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            // Extend lease by 15 minutes
            $extStmt = $db->prepare("UPDATE customer_id_reservations 
                SET expires_at = DATE_ADD(NOW(), INTERVAL " . self::LEASE_DURATION_MINUTES . " MINUTE) 
                WHERE session_token = :token AND reserved_code = :code");
            $extStmt->execute(['token' => $sessionToken, 'code' => $existing['reserved_code']]);

            return [
                'success' => true,
                'customer_code' => $existing['reserved_code'],
                'lease_token' => $sessionToken,
                'expires_in' => self::LEASE_DURATION_MINUTES * 60,
                'reused' => true,
            ];
        }

        // 2. Acquire strict mutex lock to serialize ID gap finding across concurrent requests
        $lockStmt = $db->prepare("SELECT GET_LOCK(?, ?)");
        $lockStmt->execute([self::LOCK_NAME, self::LOCK_TIMEOUT_SECONDS]);
        $acquired = (int)$lockStmt->fetchColumn();

        if (!$acquired) {
            throw new \RuntimeException("System busy: Could not acquire Customer ID reservation lock within timeout.");
        }

        try {
            // 3. Find all currently taken codes (committed in customers table OR actively reserved)
            $takenStmt = $db->query("
                SELECT CAST(customer_code AS UNSIGNED) AS code FROM customers WHERE customer_code >= '100001'
                UNION
                SELECT CAST(reserved_code AS UNSIGNED) AS code FROM customer_id_reservations 
                WHERE status IN ('reserved', 'used') AND expires_at > NOW()
                ORDER BY code ASC
            ");
            $takenCodes = $takenStmt->fetchAll(PDO::FETCH_COLUMN);
            $takenSet = array_flip($takenCodes);

            // 4. Find the lowest non-used, non-reserved gap starting from BASE_CUSTOMER_ID
            $candidate = self::BASE_CUSTOMER_ID;
            while (isset($takenSet[$candidate])) {
                $candidate++;
            }
            $reservedCode = str_pad((string)$candidate, 6, '0', STR_PAD_LEFT);

            // 5. Insert reservation with lease
            $insStmt = $db->prepare("INSERT INTO customer_id_reservations 
                (tenant_id, reserved_code, admin_id, session_token, status, expires_at)
                VALUES (:tid, :code, :aid, :token, 'reserved', DATE_ADD(NOW(), INTERVAL " . self::LEASE_DURATION_MINUTES . " MINUTE))");
            $insStmt->execute([
                'tid' => $tenantId,
                'code' => $reservedCode,
                'aid' => $adminId,
                'token' => $sessionToken,
            ]);

            return [
                'success' => true,
                'customer_code' => $reservedCode,
                'lease_token' => $sessionToken,
                'expires_in' => self::LEASE_DURATION_MINUTES * 60,
                'reused' => false,
            ];
        } finally {
            $relStmt = $db->prepare("SELECT RELEASE_LOCK(?)");
            $relStmt->execute([self::LOCK_NAME]);
        }
    }

    /**
     * Release a reserved ID back to the free pool immediately
     */
    public static function release(PDO $db, string $code, string $sessionToken): bool {
        $cleanCode = preg_replace('/\D/', '', $code);
        $stmt = $db->prepare("DELETE FROM customer_id_reservations 
            WHERE reserved_code = :code AND session_token = :token");
        $stmt->execute([
            'code' => $cleanCode,
            'token' => $sessionToken,
        ]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Mark reservation as used upon successful customer creation
     */
    public static function markUsed(PDO $db, string $code, ?string $sessionToken = null): void {
        $cleanCode = preg_replace('/\D/', '', $code);
        if (!empty($sessionToken)) {
            $stmt = $db->prepare("UPDATE customer_id_reservations 
                SET status = 'used' 
                WHERE reserved_code = :code AND session_token = :token");
            $stmt->execute(['code' => $cleanCode, 'token' => $sessionToken]);
        } else {
            $stmt = $db->prepare("UPDATE customer_id_reservations 
                SET status = 'used' 
                WHERE reserved_code = :code");
            $stmt->execute(['code' => $cleanCode]);
        }
    }
}

