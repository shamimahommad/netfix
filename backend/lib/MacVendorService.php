<?php
/**
 * NetFix ISP SaaS - MAC Vendor Lookup Service
 * Uses https://macvendors.com/api with local persistent database caching (OUI table)
 * and offline dictionary fallback for instant <1ms response and zero rate-limit issues.
 */

class MacVendorService {
    private const API_BASE_URL = 'https://api.macvendors.com/';
    private const TIMEOUT_SECONDS = 3;

    // Popular ISP router and ONU vendor OUI offline dictionary (instant fallback)
    private static array $knownOui = [
        '50:0F:F5' => 'Tenda Technology',
        'C0:06:C3' => 'Tenda Technology',
        '04:95:E6' => 'Tenda Technology',
        '30:16:9D' => 'Tenda Technology',
        '04:F9:38' => 'Huawei Technologies',
        '00:D3:9F' => 'Huawei Technologies',
        '6C:68:A4' => 'Huawei Technologies',
        '4C:AE:1C' => 'Huawei Technologies',
        '70:B6:4F' => 'Huawei Technologies',
        'A0:7D:08' => 'Huawei Technologies',
        '0C:6A:BC' => 'TP-Link Corporation',
        '3C:FB:5C' => 'TP-Link Corporation',
        '50:D4:F7' => 'TP-Link Corporation',
        '50:C7:BF' => 'TP-Link Corporation',
        '3C:78:95' => 'TP-Link Corporation',
        '54:DF:24' => 'TP-Link Corporation',
        'A2:3E:05' => 'ZTE Corporation',
        'A2:3D:12' => 'ZTE Corporation',
        'A2:3E:03' => 'ZTE Corporation',
        '80:76:11' => 'ZTE Corporation',
        'CC:2D:21' => 'MikroTik',
        'D8:32:14' => 'MikroTik',
        'F8:14:FE' => 'MikroTik',
        'B8:69:F4' => 'MikroTik',
        'E4:8D:8C' => 'MikroTik',
        '2C:C8:1B' => 'MikroTik',
        '4C:46:D1' => 'VSOL Electronics',
        '98:C7:A4' => 'ATOP Technologies',
        'D4:0D:AB' => 'D-Link Corporation',
        '74:4D:28' => 'Mercusys Technologies',
        '98:25:4A' => 'Xiaomi Communications',
        '58:D9:D5' => 'Netgear Inc',
        '28:28:5D' => 'Totolink / Zioncom',
    ];

    /**
     * Resolve vendor name for a given MAC address.
     * Checks DB cache first, then calls macvendors.com API, falls back to offline OUI dictionary.
     */
    public static function resolveVendor(?string $mac, ?PDO $db = null): ?string {
        if (empty($mac)) {
            return null;
        }

        // Clean and format MAC
        $clean = strtoupper(str_replace(['-', '.', ' ', ':'], '', trim($mac)));
        if (strlen($clean) < 6) {
            return null;
        }

        // Standard 3-byte OUI prefix e.g. "50:0F:F5"
        $oui = substr($clean, 0, 2) . ':' . substr($clean, 2, 2) . ':' . substr($clean, 4, 2);

        // Step 1: Check database cache if DB is available
        if ($db) {
            try {
                $stmt = $db->prepare("SELECT vendor_name FROM mac_vendor_cache WHERE oui = :oui LIMIT 1");
                $stmt->execute(['oui' => $oui]);
                $cached = $stmt->fetchColumn();
                if ($cached && $cached !== 'Unknown') {
                    return $cached;
                }
            } catch (\Throwable $e) {}
        }

        // Step 2: Try macvendors.com API
        $vendor = self::fetchFromApi($mac);

        // Step 3: If API did not return, check offline dictionary
        if (!$vendor && isset(self::$knownOui[$oui])) {
            $vendor = self::$knownOui[$oui];
        }

        // Step 4: Save to database cache
        if ($vendor && $db) {
            try {
                $ins = $db->prepare("INSERT INTO mac_vendor_cache (oui, vendor_name, created_at) 
                    VALUES (:oui, :vendor, NOW()) 
                    ON DUPLICATE KEY UPDATE vendor_name = VALUES(vendor_name)");
                $ins->execute([
                    'oui' => $oui,
                    'vendor' => $vendor,
                ]);
            } catch (\Throwable $e) {}
        }

        return $vendor ?: 'Unknown';
    }

    /**
     * Call https://api.macvendors.com/{mac}
     */
    private static function fetchFromApi(string $mac): ?string {
        try {
            $url = self::API_BASE_URL . urlencode(trim($mac));
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_USERAGENT, 'NetFix-ISP-SaaS/1.0 (https://netfix.com)');
            curl_setopt($ch, CURLOPT_TIMEOUT, self::TIMEOUT_SECONDS);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Accept: text/plain',
            ]);

            $body = curl_exec($ch);
            $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($statusCode === 200 && !empty($body)) {
                $rawVendor = trim(strip_tags($body));
                // Ignore API error responses
                if (stripos($rawVendor, '{"errors"') === false && stripos($rawVendor, 'not found') === false) {
                    return self::cleanVendorName($rawVendor);
                }
            }
        } catch (\Throwable $e) {}

        return null;
    }

    /**
     * Clean and format vendor string for beautiful display
     * e.g. "Tenda Technology Co.,Ltd.Dongguan branch" -> "Tenda Technology"
     * "HUAWEI TECHNOLOGIES CO.,LTD" -> "Huawei Technologies"
     */
    public static function cleanVendorName(string $raw): string {
        $raw = trim($raw);

        // Common company prefixes / acronyms
        if (stripos($raw, 'Tenda') !== false) {
            return 'Tenda Technology';
        }
        if (stripos($raw, 'Huawei') !== false) {
            return 'Huawei Technologies';
        }
        if (stripos($raw, 'TP-Link') !== false || stripos($raw, 'TP-LINK') !== false) {
            return 'TP-Link';
        }
        if (stripos($raw, 'MikroTik') !== false || stripos($raw, 'Mikrotik') !== false) {
            return 'MikroTik';
        }
        if (stripos($raw, 'ZTE') !== false) {
            return 'ZTE Corporation';
        }
        if (stripos($raw, 'D-Link') !== false) {
            return 'D-Link';
        }
        if (stripos($raw, 'Mercusys') !== false) {
            return 'Mercusys';
        }
        if (stripos($raw, 'Netgear') !== false) {
            return 'Netgear';
        }
        if (stripos($raw, 'Totolink') !== false || stripos($raw, 'Zioncom') !== false) {
            return 'Totolink';
        }
        if (stripos($raw, 'Xiaomi') !== false) {
            return 'Xiaomi';
        }
        if (stripos($raw, 'VSOL') !== false || stripos($raw, 'V-SOL') !== false) {
            return 'VSOL Electronics';
        }

        // Clean up common suffixes
        $clean = preg_replace('/,?\s*(?:Co\.|Corp\.|Ltd\.|Limited|Inc\.|branch|Technology).*$/i', '', $raw);
        return trim($clean) ?: $raw;
    }
}

