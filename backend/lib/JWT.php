<?php
/**
 * Pure PHP JSON Web Token (JWT) Implementation
 * Zero composer dependency, fast & secure HS256 algorithm
 */

class JWT {
    private static function getSecret(): string {
        $secret = getenv('JWT_SECRET');
        if ($secret === false || $secret === '' || strlen($secret) < 32) {
            throw new RuntimeException('JWT_SECRET must be configured and at least 32 characters long.');
        }
        return $secret;
    }

    public static function encode(array $payload, int $expirySeconds = 900): string {
        $header = ['typ' => 'JWT', 'alg' => 'HS256'];
        $now = time();
        $payload['iat'] = $now;
        $payload['exp'] = $now + $expirySeconds;
        if (empty($payload['jti'])) {
            $payload['jti'] = bin2hex(random_bytes(16));
        }

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

        $headerJson = self::base64UrlDecode($base64UrlHeader);
        $header = json_decode($headerJson, true);
        if (!is_array($header) || ($header['alg'] ?? '') !== 'HS256' || ($header['typ'] ?? '') !== 'JWT') {
            return null;
        }

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, self::getSecret(), true);
        $expectedSignature = self::base64UrlEncode($signature);

        if (!hash_equals($expectedSignature, $base64UrlSignature)) {
            return null; // Invalid signature
        }

        $payload = json_decode(self::base64UrlDecode($base64UrlPayload), true);
        if (!is_array($payload)) {
            return null;
        }

        // Enforce required integer expiration timestamp
        if (!isset($payload['exp']) || !is_int($payload['exp']) || $payload['exp'] < time()) {
            return null; // Missing or expired token
        }

        return $payload;
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        $decoded = base64_decode(strtr($data, '-_', '+/'), true);
        return $decoded !== false ? $decoded : '';
    }
}
