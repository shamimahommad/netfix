/**
 * Format customer code for display: always 6 digits, numbers only.
 * Handles both new 6-digit codes and legacy codes (e.g. CUST000001).
 */
export function formatCustomerIdDisplay(code: string | null | undefined): string {
  if (code == null || code === '') return '—';
  const digits = code.replace(/\D/g, '');
  if (digits === '') return '—';
  return String(parseInt(digits, 10) || 0).padStart(6, '0');
}
