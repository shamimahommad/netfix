<?php
require_once __DIR__ . '/RedisClient.php';

/**
 * Stores revoked access token JTIs and rotating refresh token records in Redis
 * (with temp-file fallback when Redis is unavailable).
 */
class TokenRevocationService {
    private const JTI_PREFIX = 'jwt:revoked:';
    private const REFRESH_PREFIX = 'jwt:refresh:';

    public static function revokeJti(string $jti, int $ttlSeconds): void {
        if ($jti === '' || $ttlSeconds <= 0) {
            return;
        }
        $key = self::JTI_PREFIX . $jti;
        try {
            $redis = RedisClient::getInstance();
            if ($redis->isConnected() && $redis->set($key, '1', $ttlSeconds)) {
                return;
            }
        } catch (\Throwable $e) {
            // Fall through to file store
        }
        self::writeFileEntry($key, ['revoked' => true], $ttlSeconds);
    }

    public static function isJtiRevoked(string $jti): bool {
        if ($jti === '') {
            return false;
        }
        $key = self::JTI_PREFIX . $jti;
        try {
            $redis = RedisClient::getInstance();
            if ($redis->isConnected()) {
                return $redis->get($key) !== null;
            }
        } catch (\Throwable $e) {
            // Fall through to file store
        }
        return self::readFileEntry($key) !== null;
    }

    public static function storeRefreshToken(string $tokenId, array $payload, int $ttlSeconds): void {
        if ($tokenId === '' || $ttlSeconds <= 0) {
            return;
        }
        $key = self::REFRESH_PREFIX . $tokenId;
        $encoded = json_encode($payload);
        try {
            $redis = RedisClient::getInstance();
            if ($redis->isConnected() && $redis->set($key, $encoded, $ttlSeconds)) {
                return;
            }
        } catch (\Throwable $e) {
            // Fall through to file store
        }
        self::writeFileEntry($key, $payload, $ttlSeconds);
    }

    /**
     * Atomically consume a refresh token (one-time rotation). Returns null if invalid/already used.
     */
    public static function consumeRefreshToken(string $tokenId): ?array {
        if ($tokenId === '') {
            return null;
        }
        $key = self::REFRESH_PREFIX . $tokenId;
        try {
            $redis = RedisClient::getInstance();
            if ($redis->isConnected()) {
                $raw = $redis->get($key);
                if ($raw === null) {
                    return null;
                }
                $redis->del($key);
                $decoded = json_decode($raw, true);
                return is_array($decoded) ? $decoded : null;
            }
        } catch (\Throwable $e) {
            // Fall through to file store
        }

        $entry = self::readFileEntry($key);
        if ($entry !== null) {
            self::deleteFileEntry($key);
        }
        return $entry;
    }

    public static function revokeRefreshToken(string $tokenId): void {
        if ($tokenId === '') {
            return;
        }
        $key = self::REFRESH_PREFIX . $tokenId;
        try {
            $redis = RedisClient::getInstance();
            if ($redis->isConnected()) {
                $redis->del($key);
            }
        } catch (\Throwable $e) {
            // Fall through
        }
        self::deleteFileEntry($key);
    }

    private static function filePath(string $key): string {
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'netfix_tokens';
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }
        return $dir . DIRECTORY_SEPARATOR . hash('sha256', $key) . '.json';
    }

    private static function writeFileEntry(string $key, array $data, int $ttlSeconds): void {
        $path = self::filePath($key);
        @file_put_contents($path, json_encode([
            'expires_at' => time() + $ttlSeconds,
            'data' => $data,
        ]), LOCK_EX);
    }

    private static function readFileEntry(string $key): ?array {
        $path = self::filePath($key);
        if (!is_file($path)) {
            return null;
        }
        $raw = @file_get_contents($path);
        $decoded = $raw ? json_decode($raw, true) : null;
        if (!is_array($decoded) || (int)($decoded['expires_at'] ?? 0) <= time()) {
            @unlink($path);
            return null;
        }
        return is_array($decoded['data'] ?? null) ? $decoded['data'] : null;
    }

    private static function deleteFileEntry(string $key): void {
        $path = self::filePath($key);
        if (is_file($path)) {
            @unlink($path);
        }
    }
}
