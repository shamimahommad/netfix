<?php
/**
 * NetFix ISP SaaS - Invoice Renumbering Migration
 * 
 * Standardizes all existing invoices to pure sequential numbering starting from 1000 (1000, 1001, 1002...)
 * and updates references across wallet transactions and sequences.
 */

require_once __DIR__ . '/../config/database.php';

try {
    $db = Database::getConnection();
    $db->beginTransaction();

    echo "=== STARTING INVOICE RENUMBERING MIGRATION ===\n";

    // 1. Fetch all existing invoices ordered by invoice_id ASC
    $stmt = $db->query("SELECT invoice_id, invoice_number, invoice_no FROM invoices ORDER BY invoice_id ASC");
    $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($invoices) . " invoices to renumber.\n";

    $startNumber = 1000;
    $currentNumber = $startNumber;
    $mapping = []; // [invoice_id => ['old_number' => ..., 'old_no' => ..., 'new_number' => ...]]

    $updateStmt = $db->prepare("UPDATE invoices SET invoice_number = :new_num, invoice_no = :new_num WHERE invoice_id = :id");

    foreach ($invoices as $inv) {
        $id = (int)$inv['invoice_id'];
        $oldNumber = $inv['invoice_number'];
        $oldNo = $inv['invoice_no'];
        $newNumberStr = (string)$currentNumber;

        $updateStmt->execute([
            'new_num' => $newNumberStr,
            'id' => $id,
        ]);

        $mapping[$id] = [
            'old_number' => $oldNumber,
            'old_no' => $oldNo,
            'new_number' => $newNumberStr,
        ];

        echo "  Renumbered Invoice ID {$id}: '{$oldNumber}' -> '{$newNumberStr}'\n";
        $currentNumber++;
    }

    $lastNumber = $currentNumber - 1;
    echo "Completed renumbering. Range: {$startNumber} to {$lastNumber}.\n";

    // 2. Update wallet_transactions and wallet_ledger descriptions
    echo "\nUpdating descriptions in wallet_transactions & wallet_ledger...\n";

    $wtUpdate = $db->prepare("UPDATE wallet_transactions SET description = :desc WHERE transaction_id = :tid");
    $wlUpdate = $db->prepare("UPDATE wallet_ledger SET description = :desc WHERE id = :lid");

    // Fetch WT rows with Inv mentions
    $wtRows = $db->query("SELECT transaction_id, description FROM wallet_transactions WHERE description LIKE '%Inv #%' OR description LIKE '%INV%'")->fetchAll(PDO::FETCH_ASSOC);
    $wtUpdatedCount = 0;
    foreach ($wtRows as $row) {
        $origDesc = $row['description'];
        $newDesc = $origDesc;
        foreach ($mapping as $m) {
            if (!empty($m['old_number'])) {
                $newDesc = str_replace("Inv #{$m['old_number']}", "Inv #{$m['new_number']}", $newDesc);
                $newDesc = str_replace("#{$m['old_number']}", "#{$m['new_number']}", $newDesc);
            }
            if (!empty($m['old_no']) && $m['old_no'] !== $m['old_number']) {
                $newDesc = str_replace("Inv #{$m['old_no']}", "Inv #{$m['new_number']}", $newDesc);
                $newDesc = str_replace("#{$m['old_no']}", "#{$m['new_number']}", $newDesc);
            }
        }
        if ($newDesc !== $origDesc) {
            $wtUpdate->execute(['desc' => $newDesc, 'tid' => $row['transaction_id']]);
            $wtUpdatedCount++;
        }
    }
    echo "  Updated {$wtUpdatedCount} wallet_transactions descriptions.\n";

    // Fetch WL rows with Inv mentions
    $wlRows = $db->query("SELECT id, description, invoice_id FROM wallet_ledger WHERE description LIKE '%Inv #%' OR description LIKE '%INV%' OR invoice_id IS NOT NULL")->fetchAll(PDO::FETCH_ASSOC);
    $wlUpdatedCount = 0;
    foreach ($wlRows as $row) {
        $origDesc = $row['description'];
        $newDesc = $origDesc;
        foreach ($mapping as $invId => $m) {
            if (!empty($m['old_number'])) {
                $newDesc = str_replace("Inv #{$m['old_number']}", "Inv #{$m['new_number']}", $newDesc);
                $newDesc = str_replace("#{$m['old_number']}", "#{$m['new_number']}", $newDesc);
            }
            if (!empty($m['old_no']) && $m['old_no'] !== $m['old_number']) {
                $newDesc = str_replace("Inv #{$m['old_no']}", "Inv #{$m['new_number']}", $newDesc);
                $newDesc = str_replace("#{$m['old_no']}", "#{$m['new_number']}", $newDesc);
            }
        }
        if ($newDesc !== $origDesc) {
            $wlUpdate->execute(['desc' => $newDesc, 'lid' => $row['id']]);
            $wlUpdatedCount++;
        }
    }
    echo "  Updated {$wlUpdatedCount} wallet_ledger descriptions.\n";

    // 3. Update tenant_sequences counter
    echo "\nUpdating tenant_sequences counter for sequence_type = 'invoice'...\n";
    $seqCheck = $db->query("SELECT COUNT(*) FROM tenant_sequences WHERE sequence_type = 'invoice' AND tenant_id = '0'")->fetchColumn();
    if ($seqCheck > 0) {
        $db->prepare("UPDATE tenant_sequences SET current_value = :val, updated_at = NOW() WHERE sequence_type = 'invoice' AND tenant_id = '0'")
           ->execute(['val' => $lastNumber]);
    } else {
        $db->prepare("INSERT INTO tenant_sequences (tenant_id, sequence_type, current_value, updated_at) VALUES ('0', 'invoice', :val, NOW())")
           ->execute(['val' => $lastNumber]);
    }

    // Clean up any stray non-global invoice sequence rows
    $db->exec("DELETE FROM tenant_sequences WHERE sequence_type = 'invoice' AND tenant_id != '0'");

    $db->commit();
    echo "\n=== MIGRATION COMPLETED SUCCESSFULLY! ===\n";
    echo "Next generated invoice will be: " . ($lastNumber + 1) . "\n";

} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    echo "MIGRATION FAILED: " . $e->getMessage() . "\n";
    exit(1);
}
