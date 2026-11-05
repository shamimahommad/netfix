<?php
/**
 * Clean JSON Response Helper
 */

class Response {
    public static function json(array $data, int $statusCode = 200): void {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('X-XSS-Protection: 1; mode=block');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        http_response_code($statusCode);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    public static function success(string $message, array $extra = [], int $statusCode = 200): void {
        self::json(array_merge([
            'success' => true,
            'message' => $message
        ], $extra), $statusCode);
    }

    public static function error(string $message, int $statusCode = 400, array $extra = []): void {
        self::json(array_merge([
            'success' => false,
            'message' => $message
        ], $extra), $statusCode);
    }
}
