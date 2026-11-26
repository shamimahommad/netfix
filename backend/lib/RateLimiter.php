<?php
require_once __DIR__ . '/RedisClient.php';
require_once __DIR__ . '/Response.php';

/**
 * Redis-backed Fixed-Window Rate Limiter (with local temp-file fallback).
 */
class RateLimiter {
    public static function getClientIp(): string {
        $remote = trim((string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'));
        // Only trust forwarded headers when the direct TCP peer is a local/private reverse proxy
        $isTrustedProxy = $remote !== '' && filter_var($remote, FILTER_VALIDATE_IP) !== false
            && filter_var($remote, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;

        if ($isTrustedProxy) {
            $ip = trim((string)($_SERVER['HTTP_X_REAL_IP'] ?? ''));
            if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
        return $remote !== '' ? $remote : '0.0.0.0';
    }

    /**
     * Enforce rate limit for a bucket + identifier; terminates with HTTP 429 on breach.
     */
    public static function enforce(string $bucket, string $identifier, int $maxAttempts, int $windowSeconds): void {
        $safeId = preg_replace('/[^a-zA-Z0-9_.:-]/', '_', $identifier);
        $key = "rl:{$bucket}:{$safeId}";
        $count = null;

        try {
            $redis = RedisClient::getInstance();
            if ($redis->isConnected()) {
                $val = $redis->incr($key);
                if ($val !== false) {
                    if ($val === 1) {
                        $redis->expire($key, $windowSeconds);
                    }
                    $count = (int)$val;
                }
            }
        } catch (\Throwable $e) {
            $count = null;
        }

        if ($count === null) {
            $count = self::incrementFileCounter($key, $windowSeconds);
        }

        if ($count > $maxAttempts) {
            header("Retry-After: {$windowSeconds}");
            Response::error('Too many requests. Please try again later.', 429);
        }
    }

    private static function incrementFileCounter(string $key, int $windowSeconds): int {
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'netfix_ratelimit';
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }
        $file = $dir . DIRECTORY_SEPARATOR . hash('sha256', $key) . '.json';
        $fh = @fopen($file, 'c+');
        if (!$fh) {
            return 1;
        }

        $count = 1;
        if (@flock($fh, LOCK_EX)) {
            $raw = stream_get_contents($fh);
            $now = time();
            $data = $raw ? json_decode($raw, true) : null;
            if (is_array($data) && isset($data['expires_at'], $data['count']) && (int)$data['expires_at'] > $now) {
                $count = (int)$data['count'] + 1;
                $expiresAt = (int)$data['expires_at'];
            } else {
                $count = 1;
                $expiresAt = $now + $windowSeconds;
            }
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, json_encode(['count' => $count, 'expires_at' => $expiresAt]));
            fflush($fh);
            @flock($fh, LOCK_UN);
        }
        @fclose($fh);
        return $count;
    }
}
