<?php
/**
 * Pure PHP JSON Web Token (JWT) Implementation
 * Zero composer dependency, fast & secure HS256 algorithm
 */

class JWT {
    private static function getSecret(): string {
        return getenv('JWT_SECRET') ?: 'your_jwt_secret_key_change_this_in_production';
    }

    public static function encode(array $payload, int $expirySeconds = 86400): string {
        $header = ['typ' => 'JWT', 'alg' => 'HS256'];
        $payload['iat'] = time();
        $payload['exp'] = time() + $expirySeconds;

        $base64UrlHeader = self::base64UrlEncode(json_encode($header));
        $base64UrlPayload = self::base64UrlEncode(json_encode($payload));

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, self::getSecret(), true);
        $base64UrlSignature = self::base64UrlEncode($signature);

        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    public static function decode(string $jwt): ?array {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return null;
        }

        [$base64UrlHeader, $base64UrlPayload, $base64UrlSignature] = $parts;

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, self::getSecret(), true);
        $expectedSignature = self::base64UrlEncode($signature);

        if (!hash_equals($expectedSignature, $base64UrlSignature)) {
            return null; // Invalid signature
        }

        $payload = json_decode(self::base64UrlDecode($base64UrlPayload), true);

        // Check expiration
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null; // Expired token
        }

        return $payload;
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
