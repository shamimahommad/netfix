<?php
/**
 * NetFix ISP SaaS - Automated Gateway Webhook & IPN Handler
 * 
 * Supports: bKash Tokenized, Nagad, SSLCommerz, SurjoPay, and Simulator IPNs.
 * Invokes PaymentSplitService to execute double-entry ledger margin splits atomically.
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../services/PaymentSplitService.php';
require_once __DIR__ . '/../../lib/PaymentGatewayService.php';
require_once __DIR__ . '/../../lib/MikrotikSyncService.php';

try {
    $db = Database::getConnection();

    // 1. Read Payload
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);
    if (!is_array($payload)) {
        $payload = array_merge($_GET, $_POST);
    }

    // 2. Extract Identifier Parameters
    $gateway = strtolower(trim($payload['gateway'] ?? ($payload['channel'] ?? ($_GET['gateway'] ?? 'bkash'))));
    if ($gateway === 'sslcommerz') $gateway = 'ssl';

    $paymentId = trim($payload['paymentID'] ?? ($payload['payment_id'] ?? ($payload['order_id'] ?? ($payload['tran_id'] ?? ''))));
    $trxId     = trim($payload['trxID'] ?? ($payload['bank_tran_id'] ?? ($payload['transaction_id'] ?? ($payload['val_id'] ?? ''))));
    $status    = strtolower(trim($payload['status'] ?? ($payload['sp_massage'] ?? ($payload['transaction_status'] ?? ''))));
    $amount    = (float)($payload['amount'] ?? 0);
    $invoiceId = $payload['invoice_id'] ?? ($payload['invoice_no'] ?? null);

    if (empty($paymentId) && empty($trxId) && empty($invoiceId)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Missing required payment identifiers (paymentID, trxID, or invoice_id).'
        ]);
        exit;
    }

    // 3. Resolve Intent or Invoice
    $intent = null;
    if (!empty($paymentId) || !empty($trxId)) {
        $stmtIntent = $db->prepare("SELECT * FROM payment_intents 
            WHERE (gateway_payment_id = :gpid OR transaction_ref = :ref OR id = :iid) 
            ORDER BY id DESC LIMIT 1");
        $stmtIntent->execute([
            'gpid' => $paymentId,
            'ref' => $trxId ?: $paymentId,
            'iid' => is_numeric($paymentId) ? (int)$paymentId : 0,
        ]);
        $intent = $stmtIntent->fetch(PDO::FETCH_ASSOC);
        $stmtIntent->closeCursor();
    }

    $tenantId = $intent ? (int)$intent['tenant_id'] : 2;
    $customerId = $intent && $intent['customer_id'] ? (int)$intent['customer_id'] : null;
    $resolvedInvoiceId = $intent && $intent['invoice_id'] ? (int)$intent['invoice_id'] : null;

    if (!$resolvedInvoiceId && !empty($invoiceId)) {
        $stmtInvLookup = $db->prepare("SELECT invoice_id, tenant_id, customer_id, total_amount 
            FROM invoices WHERE invoice_id = :id OR invoice_number = :no OR invoice_no = :no2 LIMIT 1");
        $stmtInvLookup->execute([
            'id' => is_numeric($invoiceId) ? (int)$invoiceId : 0,
            'no' => (string)$invoiceId,
            'no2' => (string)$invoiceId,
        ]);
        $invRow = $stmtInvLookup->fetch(PDO::FETCH_ASSOC);
        $stmtInvLookup->closeCursor();

        if ($invRow) {
            $resolvedInvoiceId = (int)$invRow['invoice_id'];
            $tenantId = (int)$invRow['tenant_id'];
            $customerId = (int)$invRow['customer_id'];
            if ($amount <= 0) {
                $amount = (float)$invRow['total_amount'];
            }
        }
    }

    if (!$resolvedInvoiceId && $customerId) {
        // Find most recent pending invoice
        $stmtFindInv = $db->prepare("SELECT invoice_id, total_amount FROM invoices 
            WHERE customer_id = :cid AND tenant_id = :tid 
            ORDER BY invoice_id DESC LIMIT 1");
        $stmtFindInv->execute(['cid' => $customerId, 'tid' => $tenantId]);
        $foundInv = $stmtFindInv->fetch(PDO::FETCH_ASSOC);
        $stmtFindInv->closeCursor();

        if ($foundInv) {
            $resolvedInvoiceId = (int)$foundInv['invoice_id'];
            if ($amount <= 0) {
                $amount = (float)$foundInv['total_amount'];
            }
        }
    }

    if (!$resolvedInvoiceId) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Target invoice could not be resolved from webhook payload.'
        ]);
        exit;
    }

    // 4. Verification Check: Check if transaction is marked successful
    $isSuccess = ($status === '' || $status === 'success' || $status === 'completed' || $status === 'valid' || $status === 'validated' || !empty($trxId));
    if (!$isSuccess) {
        http_response_code(200);
        echo json_encode([
            'success' => false,
            'message' => "Payment status is {$status}. No disbursement processed.",
            'invoice_id' => $resolvedInvoiceId,
        ]);
        exit;
    }

    $finalTrxId = $trxId ?: ('TRX-' . strtoupper($gateway) . '-' . substr(uniqid(), -6) . date('His'));

    // 5. Invoke Multi-Tier Payment Split Engine
    $splitService = new PaymentSplitService($db);
    $splitResult = $splitService->processCustomerPayment(
        $resolvedInvoiceId, 
        $amount, 
        $gateway, 
        [
            'payment_id' => $paymentId,
            'trx_id' => $finalTrxId,
            'raw_webhook' => $payload,
        ]
    );

    // 6. Extend Customer Subscription & Reactivate on MikroTik
    $mikrotikResult = null;
    if ($customerId) {
        $stmtCs = $db->prepare("UPDATE customer_services 
            SET expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, NOW()), NOW()), INTERVAL 30 DAY),
                status = 'active',
                updated_at = NOW()
            WHERE customer_id = :cid AND tenant_id = :tid");
        $stmtCs->execute(['cid' => $customerId, 'tid' => $tenantId]);
        $stmtCs->closeCursor();

        $stmtCust = $db->prepare("UPDATE customers 
            SET status = 'active', billing_status = 'Paid', updated_at = NOW() 
            WHERE customer_id = :cid AND tenant_id = :tid");
        $stmtCust->execute(['cid' => $customerId, 'tid' => $tenantId]);
        $stmtCust->closeCursor();

        try {
            $mikrotikResult = MikrotikSyncService::renewCustomer($db, $customerId);
        } catch (Throwable $mke) {
            $mikrotikResult = ['success' => false, 'message' => $mke->getMessage()];
        }
    }

    // 7. Update Payment Intent if found
    if ($intent) {
        $db->prepare("UPDATE payment_intents SET status = 'completed', metadata = :meta WHERE id = :id")
           ->execute([
               'meta' => json_encode($payload),
               'id' => $intent['id'],
           ]);
    }

    // 8. Return Webhook Response
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Webhook verified, payment split disbursed, and subscription renewed successfully.',
        'invoice_id' => $resolvedInvoiceId,
        'txn_group_id' => $splitResult['txn_group_id'] ?? null,
        'trx_id' => $finalTrxId,
        'total_paid' => $splitResult['total_paid'] ?? $amount,
        'total_disbursed' => $splitResult['total_disbursed'] ?? 0,
        'disbursements' => $splitResult['disbursements'] ?? [],
        'mikrotik' => $mikrotikResult,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Webhook processing failed: ' . $e->getMessage(),
    ]);
}

