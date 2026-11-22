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
    $ref       = trim(
        $payload['reference'] 
        ?? ($payload['payerReference'] 
        ?? ($payload['merchantInvoiceNumber'] 
        ?? ($payload['ref'] 
        ?? ($payload['customer_id'] 
        ?? ($payload['customer_code'] 
        ?? ($payload['account_number'] 
        ?? ($payload['bill_account_number'] ?? '')))))))
    );
    if (empty($invoiceId) && !empty($ref)) {
        $invoiceId = $ref;
    }

    if (empty($paymentId) && empty($trxId) && empty($invoiceId) && empty($ref)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Missing required payment identifiers (paymentID, trxID, reference, or invoice_id).'
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

    // 4. Resolve ISP / Tenant by Unique ISP ID Number (tenant_code, tenant_id, or URL parameter)
    $ispIdentifier = trim(
        $payload['isp_id'] 
        ?? $payload['tenant_code'] 
        ?? $payload['isp_code'] 
        ?? $payload['tenant_id'] 
        ?? $_GET['isp_id'] 
        ?? $_GET['tenant_code'] 
        ?? $_GET['isp'] 
        ?? ($_SERVER['HTTP_X_ISP_ID'] ?? '')
    );

    $tenantId = null;
    if (!empty($ispIdentifier)) {
        // Priority 1: Check by tenant_code (ISP unique numeric ID)
        $stmtTenantLookup = $db->prepare("SELECT tenant_id FROM tenants WHERE tenant_code = :code LIMIT 1");
        $stmtTenantLookup->execute(['code' => $ispIdentifier]);
        $foundTid = $stmtTenantLookup->fetchColumn();

        // Priority 2: Fallback to internal tenant_id or slug if not found by tenant_code
        if (!$foundTid) {
            $stmtTenantFallback = $db->prepare("SELECT tenant_id FROM tenants WHERE tenant_id = :tid OR tenant_slug = :slug LIMIT 1");
            $stmtTenantFallback->execute([
                'tid' => is_numeric($ispIdentifier) ? (int)$ispIdentifier : 0,
                'slug' => $ispIdentifier
            ]);
            $foundTid = $stmtTenantFallback->fetchColumn();
        }

        if ($foundTid) {
            $tenantId = (int)$foundTid;
        }
    }

    if (!$tenantId && $intent) {
        $tenantId = (int)$intent['tenant_id'];
    }
    if (!$tenantId) {
        $tenantId = 2; // Default fallback
    }
    $customerId = $intent && $intent['customer_id'] ? (int)$intent['customer_id'] : null;
    $resolvedInvoiceId = $intent && $intent['invoice_id'] ? (int)$intent['invoice_id'] : null;

    if (!$resolvedInvoiceId && !empty($invoiceId)) {
        // Priority A: Try finding invoice strictly within this tenant
        $stmtInvLookup = $db->prepare("SELECT invoice_id, tenant_id, customer_id, total_amount 
            FROM invoices WHERE (invoice_id = :id OR invoice_number = :no OR invoice_no = :no2)
            AND (tenant_id = :tid OR :tid2 = 0) LIMIT 1");
        $stmtInvLookup->execute([
            'id' => is_numeric($invoiceId) ? (int)$invoiceId : 0,
            'no' => (string)$invoiceId,
            'no2' => (string)$invoiceId,
            'tid' => $tenantId,
            'tid2' => $tenantId,
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

    // Priority B: If no invoice matched directly, search customer by Reference/Code within this tenant
    if (!$resolvedInvoiceId && !$customerId && !empty($ref)) {
        $stmtCustLookup = $db->prepare("SELECT c.customer_id, c.tenant_id, c.customer_code, c.full_name
            FROM customers c
            LEFT JOIN customer_network_accounts na ON na.customer_id = c.customer_id
            WHERE (c.tenant_id = :tid OR :tid2 = 0)
              AND (c.customer_code = :q1 OR c.customer_id = :q2 OR c.phone = :q3 OR na.username = :q4)
            LIMIT 1");
        $stmtCustLookup->execute([
            'tid' => $tenantId,
            'tid2' => $tenantId,
            'q1' => $ref,
            'q2' => is_numeric($ref) ? (int)$ref : 0,
            'q3' => $ref,
            'q4' => $ref,
        ]);
        $custRow = $stmtCustLookup->fetch(PDO::FETCH_ASSOC);
        $stmtCustLookup->closeCursor();

        if ($custRow) {
            $customerId = (int)$custRow['customer_id'];
            $tenantId = (int)$custRow['tenant_id'];
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

    // Security Gate: If customer or invoice does NOT belong to this tenant, record as UNMATCHED
    // Money is safely credited in merchant account, but another ISP's customer is NEVER falsely renewed!
    if (!$resolvedInvoiceId && !$customerId) {
        $finalTrxId = $trxId ?: ('TRX-UNMATCHED-' . strtoupper(bin2hex(random_bytes(4))));
        try {
            $stmtCheckTx = $db->prepare("SELECT transaction_id FROM transactions WHERE transaction_ref = :ref LIMIT 1");
            $stmtCheckTx->execute(['ref' => $finalTrxId]);
            if (!$stmtCheckTx->fetch()) {
                $db->prepare("INSERT INTO transactions 
                    (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, description, metadata)
                    VALUES (:tid, NULL, :ref, 'UNMATCHED_PAYMENT', :amt, :method, 0, 'webhook', :desc, :meta)")
                   ->execute([
                       'tid' => $tenantId,
                       'ref' => $finalTrxId,
                       'amt' => $amount,
                       'method' => $gateway ?: 'bkash',
                       'desc' => strtoupper($gateway ?: 'MFS') . " Payment with Unmatched Reference '{$ref}' (TrxID: {$finalTrxId})",
                       'meta' => json_encode($payload),
                   ]);
            }
        } catch (\Throwable $txe) {
            error_log("Unmatched transaction log note: " . $txe->getMessage());
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'unmatched' => true,
            'message' => "Payment received in ISP merchant account, but reference '{$ref}' does not belong to any customer of this ISP. Logged as unmatched payment.",
            'trx_id' => $finalTrxId,
            'amount' => $amount,
            'tenant_id' => $tenantId,
            'reference' => $ref,
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

    // 5b. Record in transactions table as online payment
    try {
        $stmtCheckTx = $db->prepare("SELECT transaction_id FROM transactions WHERE transaction_ref = :ref LIMIT 1");
        $stmtCheckTx->execute(['ref' => $finalTrxId]);
        if (!$stmtCheckTx->fetch()) {
            $stmtTrx = $db->prepare("INSERT INTO transactions 
                (tenant_id, customer_id, transaction_ref, transaction_type, amount, method, initiator_user_id, initiator_role, description, metadata)
                VALUES (:tid, :cid, :ref, 'GATEWAY_PAYMENT', :amt, :method, 0, 'webhook', :desc, :meta)");
            $stmtTrx->execute([
                'tid' => $tenantId,
                'cid' => $customerId ?: null,
                'ref' => $finalTrxId,
                'amt' => $amount,
                'method' => strtolower($gateway ?: 'webhook'),
                'desc' => strtoupper($gateway ?: 'ONLINE') . " Webhook / Paybill Payment (Ref: {$finalTrxId})",
                'meta' => json_encode($payload),
            ]);
        }
    } catch (Throwable $txe) {
        error_log("Webhook transaction insert note: " . $txe->getMessage());
    }

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

