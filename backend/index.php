<?php
/**
 * Core PHP Unified REST API Router
 * Single Entry Point for ISP Billing SaaS Backend
 */

require_once __DIR__ . '/config/cors.php';
handleCors();

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/lib/Response.php';
require_once __DIR__ . '/lib/JWT.php';

// Controllers
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/DashboardController.php';
require_once __DIR__ . '/controllers/SubscriberController.php';
require_once __DIR__ . '/controllers/RouterController.php';
require_once __DIR__ . '/controllers/PackageController.php';
require_once __DIR__ . '/controllers/BillingController.php';
require_once __DIR__ . '/controllers/ResellerController.php';
require_once __DIR__ . '/controllers/HotspotController.php';
require_once __DIR__ . '/controllers/TicketController.php';
require_once __DIR__ . '/controllers/PaymentController.php';
require_once __DIR__ . '/controllers/CoverageController.php';
require_once __DIR__ . '/controllers/TenantController.php';

// Parse Path and Method
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Strip base prefix if hosted in subfolder or cPanel
$uri = preg_replace('#^/backend#', '', $uri);
$uri = rtrim($uri, '/');

// Intelligent Multi-Tenant Resolver (Header -> Token -> Domain -> Default)
function getTenantId(): string {
    // 1. Check Bearer Token
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!empty($authHeader)) {
        $token = str_replace('Bearer ', '', $authHeader);
        $payload = JWT::decode($token);
        if ($payload && !empty($payload['tenant_id'])) {
            return $payload['tenant_id'];
        }
    }

    // 2. Check X-Tenant-Id Header
    if (!empty($headers['X-Tenant-Id']) || !empty($headers['x-tenant-id'])) {
        return $headers['X-Tenant-Id'] ?? $headers['x-tenant-id'];
    }

    // 3. Check Domain / Subdomain (White-label Custom Domain)
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (!empty($host)) {
        $domain = explode(':', $host)[0];
        $subdomain = explode('.', $domain)[0];

        try {
            $db = Database::getConnection();
            $stmt = $db->prepare("SELECT id FROM tenants WHERE custom_domain = :domain LIMIT 1");
            $stmt->execute(['domain' => $domain]);
            $row = $stmt->fetch();
            if ($row) return $row['id'];

            if ($subdomain !== 'localhost' && $subdomain !== '127' && $subdomain !== 'www') {
                $stmt = $db->prepare("SELECT id FROM tenants WHERE subdomain = :subdomain LIMIT 1");
                $stmt->execute(['subdomain' => $subdomain]);
                $row = $stmt->fetch();
                if ($row) return $row['id'];
            }
        } catch (Throwable $e) {}
    }

    // Default to seeded demo tenant
    return 'tenant-cloudnet-001';
}

$tenantId = getTenantId();

// -------------------------------------------------------------
// Route Dispatcher
// -------------------------------------------------------------

// 1. Healthcheck
if ($uri === '/health' || $uri === '/api/health') {
    Response::json([
        'status' => 'healthy',
        'system' => 'ISP Billing SaaS Core PHP Engine',
        'version' => '1.0.0',
        'php_version' => PHP_VERSION,
        'timestamp' => date('c'),
    ]);
}

// 2. White-Label Tenant Info
if ($method === 'GET' && ($uri === '/api/tenant/info' || $uri === '/tenant/info')) {
    TenantController::info();
}
if ($method === 'POST' && ($uri === '/api/tenant/settings' || $uri === '/tenant/settings')) {
    TenantController::updateSettings($tenantId);
}
if ($method === 'GET' && ($uri === '/api/tenants' || $uri === '/tenants')) {
    TenantController::index();
}

// 3. Auth Routes
if ($method === 'POST' && ($uri === '/api/auth/login' || $uri === '/auth/login')) {
    AuthController::login();
}
if ($method === 'GET' && ($uri === '/api/auth/me' || $uri === '/auth/me')) {
    AuthController::me();
}

// 4. Dashboard Stats
if ($method === 'GET' && ($uri === '/api/dashboard/stats' || $uri === '/dashboard/stats')) {
    DashboardController::stats($tenantId);
}

// 5. Subscriber Routes
if ($method === 'GET' && ($uri === '/api/subscribers' || $uri === '/subscribers')) {
    SubscriberController::index($tenantId);
}
if ($method === 'POST' && ($uri === '/api/subscribers' || $uri === '/subscribers')) {
    SubscriberController::create($tenantId);
}
if ($method === 'POST' && preg_match('#^/api/subscribers/([^/]+)/recharge$#', $uri, $matches)) {
    SubscriberController::recharge($tenantId, $matches[1]);
}
if ($method === 'POST' && preg_match('#^/api/subscribers/([^/]+)/kick$#', $uri, $matches)) {
    SubscriberController::kick($tenantId, $matches[1]);
}
if ($method === 'PATCH' && preg_match('#^/api/subscribers/([^/]+)/toggle-status$#', $uri, $matches)) {
    SubscriberController::toggleStatus($tenantId, $matches[1]);
}

// 6. Router Routes
if ($method === 'GET' && ($uri === '/api/routers' || $uri === '/routers')) {
    RouterController::index($tenantId);
}
if ($method === 'POST' && preg_match('#^/api/routers/([^/]+)/ping$#', $uri, $matches)) {
    RouterController::ping($tenantId, $matches[1]);
}
if ($method === 'GET' && preg_match('#^/api/routers/([^/]+)/active-sessions$#', $uri, $matches)) {
    RouterController::activeSessions($tenantId, $matches[1]);
}

// 7. Packages
if ($method === 'GET' && ($uri === '/api/packages' || $uri === '/packages')) {
    PackageController::index($tenantId);
}
if ($method === 'POST' && ($uri === '/api/packages' || $uri === '/packages')) {
    PackageController::create($tenantId);
}

// 8. Billing & Invoices
if ($method === 'GET' && ($uri === '/api/billing/invoices' || $uri === '/billing/invoices')) {
    BillingController::invoices($tenantId);
}
if ($method === 'POST' && preg_match('#^/api/billing/invoices/([^/]+)/collect$#', $uri, $matches)) {
    BillingController::collectPayment($tenantId, $matches[1]);
}
if ($method === 'POST' && ($uri === '/api/billing/generate-monthly-bills' || $uri === '/billing/generate-monthly-bills')) {
    BillingController::generateMonthlyBills($tenantId);
}

// 9. Resellers
if ($method === 'GET' && ($uri === '/api/resellers' || $uri === '/resellers')) {
    ResellerController::index($tenantId);
}
if ($method === 'POST' && preg_match('#^/api/resellers/([^/]+)/topup$#', $uri, $matches)) {
    ResellerController::topup($tenantId, $matches[1]);
}

// 10. Hotspot
if ($method === 'GET' && ($uri === '/api/hotspot' || $uri === '/hotspot')) {
    HotspotController::index($tenantId);
}
if ($method === 'POST' && ($uri === '/api/hotspot/generate-batch' || $uri === '/hotspot/generate-batch')) {
    HotspotController::generateBatch($tenantId);
}

// 11. Support Tickets
if ($method === 'GET' && ($uri === '/api/tickets' || $uri === '/tickets')) {
    TicketController::index($tenantId);
}
if ($method === 'POST' && ($uri === '/api/tickets' || $uri === '/tickets')) {
    TicketController::create($tenantId);
}
if ($method === 'PATCH' && preg_match('#^/api/tickets/([^/]+)/status$#', $uri, $matches)) {
    TicketController::updateStatus($tenantId, $matches[1]);
}

// 12. Optical FTTH & Coverage Boxes
if ($method === 'GET' && ($uri === '/api/coverage/boxes' || $uri === '/coverage/boxes')) {
    CoverageController::index($tenantId);
}
if ($method === 'POST' && ($uri === '/api/coverage/boxes' || $uri === '/coverage/boxes')) {
    CoverageController::create($tenantId);
}

// 13. Payment Gateways (bKash Instant Reconnect Webhook)
if ($method === 'POST' && ($uri === '/api/payments/bkash/callback' || $uri === '/payments/bkash/callback')) {
    PaymentController::bkashCallback();
}

// 404 Fallback
Response::error("Endpoint not found: {$method} {$uri}", 404);
