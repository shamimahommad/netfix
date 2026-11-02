<?php
/**
 * Clean JSON Response Helper
 */

class Response {
    public static function json(array $data, int $statusCode = 200): void {
        header('Content-Type: application/json; charset=utf-8');
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
