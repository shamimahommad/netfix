/**
 * Display invoice id/number with leading letters removed (only digits shown).
 * e.g. "INV-12345" or "INV12345" → "12345"
 */
export function formatInvoiceIdDisplay(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const digitsOnly = value.replace(/^[^0-9]+/i, '').trim();
  return digitsOnly !== '' ? digitsOnly : value;
}
