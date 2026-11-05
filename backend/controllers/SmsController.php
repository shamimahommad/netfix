<?php
/**
 * NetFix ISP SaaS - SMS Gateway, Templates & Log Controller
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/Response.php';
require_once __DIR__ . '/../lib/AuthMiddleware.php';

class SmsController {
    public static function getTemplates(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT template_key, is_enabled, body FROM sms_templates WHERE tenant_id = :tid");
        $stmt->execute(['tid' => $tenantId]);
        $rows = $stmt->fetchAll();

        $templates = [];
        foreach ($rows as $r) {
            $templates[$r['template_key']] = [
                'enabled' => (bool)$r['is_enabled'],
                'body' => $r['body'],
            ];
        }

        // Defaults if empty
        if (empty($templates)) {
            $templates['CUSTOMER_WELCOME'] = ['enabled' => true, 'body' => 'Welcome to NetFix. User: {{username}}, Pass: {{password}}'];
            $templates['BILL_GENERATED'] = ['enabled' => true, 'body' => 'Bill of BDT {{amount}} is due on {{due_date}}.'];
            $templates['PAYMENT_CONFIRMATION'] = ['enabled' => true, 'body' => 'Payment of BDT {{amount}} received for invoice {{invoice_number}}.'];
            $templates['EXPIRY_ALERT'] = ['enabled' => true, 'body' => 'Your subscription expires on {{expiry_date}}. Please renew.'];
        }

        Response::json($templates);
    }

    public static function saveTemplates(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $templates = $data['templates'] ?? [];

        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO sms_templates (tenant_id, template_key, is_enabled, body)
            VALUES (:tid, :key, :en, :body)
            ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), body = VALUES(body)");

        foreach ($templates as $key => $val) {
            $stmt->execute([
                'tid' => $tenantId,
                'key' => $key,
                'en' => !empty($val['enabled']) ? 1 : 0,
                'body' => $val['body'] ?? '',
            ]);
        }

        Response::json(['success' => true]);
    }

    public static function getLog(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : 20;
        $offset = ($page - 1) * $limit;

        $where = ["tenant_id = :tid"];
        $params = ['tid' => $tenantId];

        if (!empty($_GET['status'])) {
            $where[] = "status = :status";
            $params['status'] = $_GET['status'];
        }

        if (!empty($_GET['search'])) {
            $where[] = "(to_number LIKE :s OR message LIKE :s)";
            $params['s'] = '%' . trim($_GET['search']) . '%';
        }

        $whereSql = implode(' AND ', $where);

        $countStmt = $db->prepare("SELECT COUNT(*) FROM sms_log WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $stmt = $db->prepare("SELECT * FROM sms_log WHERE {$whereSql} ORDER BY sms_log_id DESC LIMIT {$limit} OFFSET {$offset}");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $data = array_map(function($r) {
            return [
                'smsLogId' => (string)$r['sms_log_id'],
                'tenantId' => (string)$r['tenant_id'],
                'providerName' => $r['provider_name'],
                'toNumber' => $r['to_number'],
                'message' => $r['message'],
                'status' => $r['status'],
                'trxnId' => $r['trxn_id'],
                'errorMessage' => $r['error_message'],
                'createdAt' => $r['created_at'],
            ];
        }, $rows);

        Response::json([
            'data' => $data,
            'total' => $total,
        ]);
    }

    public static function send(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $toNumbers = $data['toNumbers'] ?? [];
        if (empty($toNumbers)) {
            $single = $data['recipient'] ?? $data['phone'] ?? $data['toNumber'] ?? null;
            if ($single) {
                $toNumbers = [$single];
            }
        } elseif (is_string($toNumbers)) {
            $toNumbers = [$toNumbers];
        }
        $message = trim($data['message'] ?? '');

        if (empty($toNumbers) || empty($message)) {
            Response::error('Recipients and message body are required', 400);
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO sms_log (tenant_id, provider_name, to_number, message, status, trxn_id)
            VALUES (:tid, 'mim_sms', :to, :msg, 'success', :trx)");

        $results = [];
        $sent = 0;
        foreach ($toNumbers as $num) {
            $trx = 'SMS-' . strtoupper(bin2hex(random_bytes(4)));
            $stmt->execute([
                'tid' => $tenantId,
                'to' => $num,
                'msg' => $message,
                'trx' => $trx,
            ]);
            $results[] = ['to' => $num, 'success' => true];
            $sent++;
        }

        Response::json([
            'sent' => $sent,
            'failed' => 0,
            'total' => count($toNumbers),
            'results' => $results,
        ]);
    }

    public static function getBalance(): void {
        $user = AuthMiddleware::requireAuth();
        $tenantId = AuthMiddleware::getTenantId();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT balance FROM sms_gateway_settings WHERE tenant_id = :tid LIMIT 1");
        $stmt->execute(['tid' => $tenantId]);
        $row = $stmt->fetch();

        Response::json([
            'balance' => $row ? (float)$row['balance'] : 450.00,
        ]);
    }
}

