<?php
/**
 * NetFix ISP Billing & Bandwidth Management SaaS - Core PHP API Engine
 * Unified Single Entry Point with Clean URL Routing
 * Full REST API Implementation matching NestJS and React contracts
 */

require_once __DIR__ . '/config/cors.php';
handleCors();

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/lib/Response.php';
require_once __DIR__ . '/lib/JWT.php';
require_once __DIR__ . '/lib/AuthMiddleware.php';

// Global Exception Handler for Clean JSON Responses
set_exception_handler(function (Throwable $e) {
    Response::error($e->getMessage(), 500);
});

// Controllers
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/DashboardController.php';
require_once __DIR__ . '/controllers/CustomersController.php';
require_once __DIR__ . '/controllers/BillingController.php';
require_once __DIR__ . '/controllers/PaymentsController.php';
require_once __DIR__ . '/controllers/ResellersController.php';
require_once __DIR__ . '/controllers/AccessProfilesController.php';
require_once __DIR__ . '/controllers/NetworkController.php';
require_once __DIR__ . '/controllers/ServiceAreaController.php';
require_once __DIR__ . '/controllers/SmsController.php';
require_once __DIR__ . '/controllers/TenantsController.php';
require_once __DIR__ . '/controllers/CustomerPortalController.php';
require_once __DIR__ . '/controllers/UsersController.php';
require_once __DIR__ . '/controllers/SearchController.php';
require_once __DIR__ . '/controllers/TaskLogsController.php';

// Parse Request Path and Method
$rawUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Normalize URI (strip /backend, /api/v1, /api prefixes)
$uri = preg_replace('#^/backend#', '', $rawUri);
$uri = preg_replace('#^/api/v1#', '', $uri);
$uri = preg_replace('#^/api#', '', $uri);
$uri = rtrim($uri, '/');
if ($uri === '') {
    $uri = '/';
}

// ---------------------------------------------------------------------
// HEALTH CHECK & SYSTEM INIT
// ---------------------------------------------------------------------
if ($uri === '/' || $uri === '/health') {
    $dbStatus = 'disconnected';
    try {
        $db = Database::getConnection();
        $count = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $dbStatus = "Connected to MySQL netfix_db ({$count} users)";
    } catch (Throwable $e) {
        $dbStatus = "Database error: " . $e->getMessage();
    }

    Response::json([
        'status' => 'healthy',
        'service' => 'NetFix ISP SaaS Pure PHP REST API Engine',
        'version' => '1.0.0',
        'php_version' => PHP_VERSION,
        'database' => $dbStatus,
        'timestamp' => date('c'),
    ]);
}

if ($uri === '/system/init-db') {
    try {
        $db = Database::getConnection();
        Database::ensureTables($db);
        $count = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();
        Response::json([
            'success' => true,
            'message' => "Database auto-migrated successfully. Found {$count} registered users.",
            'users_count' => $count,
        ]);
    } catch (Throwable $e) {
        Response::error('Failed to initialize database: ' . $e->getMessage(), 500);
    }
}

// ---------------------------------------------------------------------
// AUTHENTICATION ROUTES
// ---------------------------------------------------------------------
if ($method === 'POST' && $uri === '/auth/login') {
    AuthController::login();
}
if ($method === 'POST' && $uri === '/auth/customer-login') {
    AuthController::customerLogin();
}
if ($method === 'GET' && $uri === '/auth/me') {
    AuthController::me();
}
if ($method === 'POST' && $uri === '/auth/change-password') {
    AuthController::changePassword();
}
if ($method === 'GET' && preg_match('#^/auth/impersonate/can/([^/]+)$#', $uri, $m)) {
    AuthController::canImpersonate($m[1]);
}
if ($method === 'GET' && $uri === '/auth/impersonate/can-batch') {
    AuthController::canImpersonateBatch();
}
if ($method === 'POST' && preg_match('#^/auth/impersonate/exit$#', $uri)) {
    AuthController::exitImpersonate();
}
if ($method === 'POST' && preg_match('#^/auth/impersonate/([^/]+)$#', $uri, $m)) {
    AuthController::impersonate($m[1]);
}

// ---------------------------------------------------------------------
// DASHBOARD ROUTES
// ---------------------------------------------------------------------
if ($method === 'GET' && $uri === '/dashboard/stats') {
    DashboardController::stats();
}
if ($method === 'GET' && $uri === '/dashboard/charts') {
    DashboardController::charts();
}
if ($method === 'GET' && $uri === '/dashboard/recent-activity') {
    DashboardController::recentActivity();
}

// ---------------------------------------------------------------------
// CUSTOMERS ROUTES
// ---------------------------------------------------------------------
if ($method === 'GET' && $uri === '/customers') {
    CustomersController::index();
}
if ($method === 'GET' && $uri === '/customers/next-code') {
    CustomersController::nextCode();
}
if ($method === 'GET' && $uri === '/customers/reports/reseller-wise') {
    CustomersController::reportsResellerWise();
}
if ($method === 'GET' && $uri === '/customers/reports/area-wise') {
    CustomersController::reportsAreaWise();
}
if ($method === 'GET' && $uri === '/customers/reports/server-wise') {
    CustomersController::reportsServerWise();
}
if ($method === 'POST' && $uri === '/customers/onboard') {
    CustomersController::onboard();
}
if ($method === 'POST' && $uri === '/customers') {
    CustomersController::create();
}
if ($method === 'GET' && preg_match('#^/customers/([^/]+)/services$#', $uri, $m)) {
    CustomersController::services($m[1]);
}
if ($method === 'GET' && preg_match('#^/customers/([^/]+)/network-accounts$#', $uri, $m)) {
    CustomersController::networkAccounts($m[1]);
}
if ($method === 'GET' && preg_match('#^/customers/([^/]+)/billing-summary$#', $uri, $m)) {
    CustomersController::billingSummary($m[1]);
}
if ($method === 'GET' && preg_match('#^/customers/([^/]+)$#', $uri, $m)) {
    CustomersController::show($m[1]);
}
if ($method === 'PATCH' && preg_match('#^/customers/([^/]+)$#', $uri, $m)) {
    CustomersController::update($m[1]);
}
if ($method === 'DELETE' && preg_match('#^/customers/([^/]+)$#', $uri, $m)) {
    CustomersController::delete($m[1]);
}

// ---------------------------------------------------------------------
// BILLING & INVOICES ROUTES
// ---------------------------------------------------------------------
if ($method === 'GET' && preg_match('#^/billing/accounts/([^/]+)$#', $uri, $m)) {
    BillingController::accounts($m[1]);
}
if ($method === 'GET' && $uri === '/billing/accounts') {
    BillingController::accounts('all');
}
if ($method === 'POST' && $uri === '/billing/renew') {
    BillingController::renew();
}
if ($method === 'POST' && $uri === '/billing/change-package') {
    BillingController::changePackage();
}
if ($method === 'GET' && $uri === '/billing/invoices') {
    BillingController::invoices();
}
if ($method === 'GET' && preg_match('#^/billing/invoices/([^/]+)$#', $uri, $m)) {
    BillingController::invoiceDetail($m[1]);
}

// ---------------------------------------------------------------------
// PAYMENTS & ONLINE TRANSACTIONS
// ---------------------------------------------------------------------
if ($method === 'POST' && $uri === '/payments') {
    PaymentsController::create();
}
if ($method === 'GET' && $uri === '/payments/online-transactions') {
    PaymentsController::onlineTransactions();
}
if ($method === 'GET' && $uri === '/payments/merchant-payments') {
    PaymentsController::merchantPayments();
}
if ($method === 'GET' && $uri === '/payments/recharge-history') {
    PaymentsController::rechargeHistory();
}
if ($method === 'POST' && $uri === '/payments/bkash/callback') {
    PaymentsController::bkashCallback();
}

// ---------------------------------------------------------------------
// RESELLERS & POP HIERARCHY
// ---------------------------------------------------------------------
if ($method === 'GET' && $uri === '/resellers') {
    ResellersController::index();
}
if ($method === 'GET' && $uri === '/resellers/pops') {
    ResellersController::pops();
}
if ($method === 'GET' && $uri === '/resellers/my-packages') {
    ResellersController::myPackages();
}
if ($method === 'POST' && $uri === '/resellers') {
    ResellersController::create();
}
if ($method === 'POST' && $uri === '/resellers/add-balance') {
    ResellersController::addBalance();
}
if ($method === 'POST' && $uri === '/resellers/transfer-balance') {
    ResellersController::transferBalance();
}
if ($method === 'GET' && preg_match('#^/resellers/([^/]+)/plan-permissions$#', $uri, $m)) {
    ResellersController::getPlanPermissions($m[1]);
}
if ($method === 'PUT' && preg_match('#^/resellers/([^/]+)/plan-permissions$#', $uri, $m)) {
    ResellersController::putPlanPermissions($m[1]);
}
if ($method === 'GET' && preg_match('#^/resellers/([^/]+)/ledger$#', $uri, $m)) {
    ResellersController::ledger($m[1]);
}
if ($method === 'GET' && preg_match('#^/resellers/([^/]+)/login-log$#', $uri, $m)) {
    ResellersController::loginLog($m[1]);
}
if ($method === 'POST' && preg_match('#^/resellers/([^/]+)/login-as$#', $uri, $m)) {
    ResellersController::loginAs($m[1]);
}
if ($method === 'PATCH' && preg_match('#^/resellers/([^/]+)/status$#', $uri, $m)) {
    ResellersController::setStatus($m[1]);
}
if ($method === 'GET' && preg_match('#^/resellers/([^/]+)$#', $uri, $m)) {
    ResellersController::show($m[1]);
}
if ($method === 'PATCH' && preg_match('#^/resellers/([^/]+)$#', $uri, $m)) {
    ResellersController::update($m[1]);
}
if ($method === 'DELETE' && preg_match('#^/resellers/([^/]+)$#', $uri, $m)) {
    ResellersController::delete($m[1]);
}

// ---------------------------------------------------------------------
// ACCESS PROFILES & BANDWIDTH PACKAGES
// ---------------------------------------------------------------------
if ($method === 'GET' && ($uri === '/access-profiles/dropdown' || $uri === '/network/packages/dropdown')) {
    AccessProfilesController::dropdown();
}
if ($method === 'GET' && ($uri === '/access-profiles' || $uri === '/network/packages')) {
    AccessProfilesController::index();
}
if ($method === 'POST' && ($uri === '/access-profiles' || $uri === '/network/packages')) {
    AccessProfilesController::create();
}
if ($method === 'PUT' && preg_match('#^/(access-profiles|network/packages)/([^/]+)$#', $uri, $m)) {
    AccessProfilesController::update($m[2]);
}
if ($method === 'DELETE' && preg_match('#^/(access-profiles|network/packages)/([^/]+)$#', $uri, $m)) {
    AccessProfilesController::delete($m[2]);
}

// ---------------------------------------------------------------------
// NETWORK & MIKROTIK & OLT
// ---------------------------------------------------------------------
if ($method === 'GET' && $uri === '/network/devices') {
    NetworkController::index();
}
if ($method === 'GET' && $uri === '/network/devices/next-code') {
    NetworkController::nextCode();
}
if ($method === 'GET' && $uri === '/network/devices/dropdown') {
    NetworkController::dropdown();
}
if ($method === 'GET' && $uri === '/network/devices/ping-status') {
    NetworkController::pingStatus();
}
if ($method === 'POST' && $uri === '/network/devices') {
    NetworkController::create();
}
if ($method === 'POST' && $uri === '/network/devices/olt') {
    NetworkController::createOlt();
}
if ($method === 'GET' && preg_match('#^/network/devices/([^/]+)/olt-status$#', $uri, $m)) {
    NetworkController::oltStatus($m[1]);
}
if ($method === 'GET' && preg_match('#^/network/devices/([^/]+)/onus$#', $uri, $m)) {
    NetworkController::oltOnus($m[1]);
}
if ($method === 'POST' && preg_match('#^/network/devices/([^/]+)/sync-olt$#', $uri, $m)) {
    NetworkController::syncOlt($m[1]);
}
if ($method === 'POST' && preg_match('#^/network/devices/([^/]+)/ping-now$#', $uri, $m)) {
    NetworkController::pingNow($m[1]);
}
if ($method === 'GET' && preg_match('#^/network/devices/([^/]+)/profiles$#', $uri, $m)) {
    NetworkController::getProfiles($m[1]);
}
if ($method === 'GET' && preg_match('#^/network/devices/([^/]+)$#', $uri, $m)) {
    NetworkController::show($m[1]);
}
if ($method === 'PUT' && preg_match('#^/network/devices/([^/]+)$#', $uri, $m)) {
    NetworkController::update($m[1]);
}
if ($method === 'DELETE' && preg_match('#^/network/devices/([^/]+)$#', $uri, $m)) {
    NetworkController::delete($m[1]);
}
if ($method === 'GET' && $uri === '/network/mikrotik/live-traffic') {
    NetworkController::liveTraffic();
}

// ---------------------------------------------------------------------
// SERVICE AREAS & SUB-AREAS
// ---------------------------------------------------------------------
if ($method === 'GET' && $uri === '/service-area/areas') {
    ServiceAreaController::listAreas();
}
if ($method === 'POST' && $uri === '/service-area/areas') {
    ServiceAreaController::createArea();
}
if ($method === 'PUT' && preg_match('#^/service-area/areas/([^/]+)$#', $uri, $m)) {
    ServiceAreaController::updateArea($m[1]);
}
if ($method === 'DELETE' && preg_match('#^/service-area/areas/([^/]+)$#', $uri, $m)) {
    ServiceAreaController::deleteArea($m[1]);
}
if ($method === 'GET' && $uri === '/service-area/sub-areas') {
    ServiceAreaController::listSubAreas();
}
if ($method === 'POST' && $uri === '/service-area/sub-areas') {
    ServiceAreaController::createSubArea();
}
if ($method === 'PUT' && preg_match('#^/service-area/sub-areas/([^/]+)$#', $uri, $m)) {
    ServiceAreaController::updateSubArea($m[1]);
}
if ($method === 'DELETE' && preg_match('#^/service-area/sub-areas/([^/]+)$#', $uri, $m)) {
    ServiceAreaController::deleteSubArea($m[1]);
}

// ---------------------------------------------------------------------
// SMS GATEWAY & TEMPLATES
// ---------------------------------------------------------------------
if ($method === 'GET' && $uri === '/sms/templates') {
    SmsController::getTemplates();
}
if ($method === 'POST' && $uri === '/sms/templates') {
    SmsController::saveTemplates();
}
if ($method === 'GET' && $uri === '/sms/log') {
    SmsController::getLog();
}
if ($method === 'POST' && $uri === '/sms/send') {
    SmsController::send();
}
if ($method === 'GET' && $uri === '/sms/balance') {
    SmsController::getBalance();
}

// ---------------------------------------------------------------------
// TENANTS & MULTI-TENANCY
// ---------------------------------------------------------------------
if ($method === 'GET' && $uri === '/tenants') {
    TenantsController::index();
}
if ($method === 'GET' && $uri === '/tenants/sms-providers') {
    TenantsController::smsProviders();
}
if ($method === 'GET' && $uri === '/tenants/my/settings') {
    TenantsController::mySettings();
}
if ($method === 'POST' && $uri === '/tenants') {
    TenantsController::create();
}
if ($method === 'GET' && preg_match('#^/tenants/([^/]+)/profile$#', $uri, $m)) {
    TenantsController::profile($m[1]);
}
if ($method === 'PUT' && preg_match('#^/tenants/([^/]+)/features$#', $uri, $m)) {
    TenantsController::updateFeatures($m[1]);
}
if ($method === 'PUT' && preg_match('#^/tenants/([^/]+)/payment-gateways$#', $uri, $m)) {
    TenantsController::updatePaymentGateways($m[1]);
}
if ($method === 'PUT' && preg_match('#^/tenants/([^/]+)/sms-gateway$#', $uri, $m)) {
    TenantsController::updateSmsGateway($m[1]);
}
if ($method === 'PATCH' && preg_match('#^/tenants/([^/]+)/limits$#', $uri, $m)) {
    TenantsController::updateLimits($m[1]);
}
if ($method === 'POST' && preg_match('#^/tenants/([^/]+)/reset-admin-password$#', $uri, $m)) {
    TenantsController::resetAdminPassword($m[1]);
}
if ($method === 'GET' && preg_match('#^/tenants/([^/]+)$#', $uri, $m)) {
    TenantsController::show($m[1]);
}
if ($method === 'PUT' && preg_match('#^/tenants/([^/]+)$#', $uri, $m)) {
    TenantsController::update($m[1]);
}
if ($method === 'DELETE' && preg_match('#^/tenants/([^/]+)$#', $uri, $m)) {
    TenantsController::delete($m[1]);
}

// ---------------------------------------------------------------------
// CUSTOMER PORTAL
// ---------------------------------------------------------------------
if ($method === 'GET' && $uri === '/customer/dashboard') {
    CustomerPortalController::dashboard();
}
if ($method === 'GET' && $uri === '/customer/invoices') {
    CustomerPortalController::invoices();
}
if ($method === 'GET' && $uri === '/customer/payment-history') {
    CustomerPortalController::paymentHistory();
}
if ($method === 'GET' && $uri === '/customer/packages') {
    CustomerPortalController::packages();
}
if ($method === 'GET' && $uri === '/customer/payment-methods') {
    CustomerPortalController::paymentMethods();
}
if ($method === 'GET' && $uri === '/customer/tickets') {
    CustomerPortalController::tickets();
}
if ($method === 'POST' && $uri === '/customer/tickets') {
    CustomerPortalController::createTicket();
}

// ---------------------------------------------------------------------
// USERS & SEARCH & TASK LOGS
// ---------------------------------------------------------------------
if ($method === 'GET' && $uri === '/users/received-by-options') {
    UsersController::receivedByOptions();
}
if ($method === 'GET' && $uri === '/search/customers') {
    SearchController::customers();
}
if ($method === 'GET' && preg_match('#^/task-logs/customers/([^/]+)$#', $uri, $m)) {
    TaskLogsController::getByCustomerId($m[1]);
}
if ($method === 'GET' && $uri === '/task-logs/check') {
    TaskLogsController::check();
}

// ---------------------------------------------------------------------
// 404 NOT FOUND FALLBACK
// ---------------------------------------------------------------------
Response::json([
    'success' => false,
    'statusCode' => 404,
    'message' => "Endpoint not found: {$method} {$rawUri} (normalized: {$uri})",
], 404);
