/**
 * Backend uses 2099-12-31 for Free (Lifetime) customers.
 * Show "Lifetime" when expiry is this far-future date.
 */
const LIFETIME_EXPIRY_YEAR = 2090;

export function isLifetimeExpiry(expiryDate: string | null | undefined): boolean {
  if (!expiryDate) return false;
  const year = new Date(expiryDate).getFullYear();
  return year >= LIFETIME_EXPIRY_YEAR;
}

/**
 * Format expiry for display: "Lifetime" for Free/far-future, else formatted date.
 */
export function formatExpiryDisplay(
  expiryDate: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!expiryDate) return '—';
  const d = new Date(expiryDate);
  if (d.getFullYear() >= LIFETIME_EXPIRY_YEAR) return 'Lifetime';
  const opts = options ?? { year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-US', opts);
}
