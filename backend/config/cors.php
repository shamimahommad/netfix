<?php
/**
 * Cross-Origin Resource Sharing (CORS) Configuration
 */

require_once __DIR__ . '/database.php';

function handleCors(): void {
    // Security Hardening Headers
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header("Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; base-uri 'self'");

    $appEnv = strtolower(getenv('APP_ENV') ?: ($_ENV['APP_ENV'] ?? 'production'));
    if ($appEnv === 'production' || $appEnv === 'live') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }

    // Strict CORS allowlist (never reflect arbitrary origins or emit wildcard *)
    $allowedOriginsRaw = getenv('CORS_ALLOWED_ORIGINS') ?: ($_ENV['CORS_ALLOWED_ORIGINS'] ?? '');
    $frontendUrl = getenv('FRONTEND_URL') ?: ($_ENV['FRONTEND_URL'] ?? '');

    $allowedOrigins = [];
    foreach (array_merge([$frontendUrl], explode(',', $allowedOriginsRaw)) as $item) {
        $item = rtrim(trim($item), '/');
        if ($item !== '' && $item !== '*') {
            $allowedOrigins[] = strtolower($item);
        }
    }
    if ($appEnv !== 'production') {
        $allowedOrigins = array_merge($allowedOrigins, ['http://localhost:4001', 'http://127.0.0.1:4001', 'http://localhost:5173']);
    }
    $allowedOrigins = array_values(array_unique($allowedOrigins));

    $origin = rtrim(trim($_SERVER['HTTP_ORIGIN'] ?? ''), '/');
    if ($origin !== '' && in_array(strtolower($origin), $allowedOrigins, true)) {
        header("Access-Control-Allow-Origin: {$origin}");
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');
    }

    // Access-Control headers are received during OPTIONS requests
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Tenant-Id');
        exit(0);
    }
}
