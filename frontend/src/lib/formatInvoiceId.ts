/**
 * Display invoice id/number with leading letters removed (only digits shown).
 * e.g. "INV-12345" or "INV12345" → "12345"
 */
export function formatInvoiceIdDisplay(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const digitsOnly = value.replace(/^[^0-9]+/i, '').trim();
  return digitsOnly !== '' ? digitsOnly : value;
}

/**
 * Display real TRX ID without prefix (e.g. "RCH-14DA69A8" → "14DA69A8", "TOPUP-CB51B6AB" → "CB51B6AB", "TRX-43" → "43")
 */
export function formatRealTrxId(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  if (/^TXG-\d{8}-/i.test(value)) {
    return value.replace(/^TXG-\d{8}-/i, '');
  }
  const cleaned = value.replace(/^(TRX[-_]RENEW|TRX[-_]BKASH|TEST[-_]UNMATCHED|BKASH|TRX|RCH|TOPUP|WT|TXG|TX)[-_]/i, '').trim();
  return cleaned !== '' ? cleaned : value;
}
