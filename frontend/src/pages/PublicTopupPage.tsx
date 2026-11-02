import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Wallet, Search, User, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

const DEFAULT_TENANT_ID = import.meta.env.VITE_DEFAULT_TENANT_ID || '';

type PaymentMethodItem = {
  gateway: string;
  label: string;
  description: string;
};

type TenantOption = {
  tenant_id: string;
  tenant_code: string;
  tenant_name: string;
};

type LookupResultCustomer = {
  type: 'customer';
  tenant_id: string;
  customer_id: string;
  name: string;
  user_id: string;
  username: string | null;
  previous_balance: number;
  bill_amount: number;
  package_name: string;
  payable_amount: number;
  current_expire_date: string | null;
  new_expire_date: string | null;
};

type LookupResultReseller = {
  type: 'reseller';
  tenant_id: string;
  user_id: string;
  name: string;
  previous_balance: number;
};

type LookupResult = LookupResultCustomer | LookupResultReseller;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

const topupKeyframes = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes float {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
    50% { transform: translate(10px, -10px) scale(1.02); opacity: 0.8; }
  }
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(14, 165, 233, 0.2); }
    50% { box-shadow: 0 0 32px rgba(14, 165, 233, 0.35); }
  }
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes rowIn {
    from { opacity: 0; transform: translateX(-8px); }
    to { opacity: 1; transform: translateX(0); }
  }
  /* Premium background: animated gradient 15–20s */
  @keyframes gradientBg {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  /* Floating blobs: slow translate */
  @keyframes blobFloat1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(15px, -20px) scale(1.05); }
    66% { transform: translate(-10px, 10px) scale(0.98); }
  }
  @keyframes blobFloat2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-20px, 15px) scale(1.03); }
    66% { transform: translate(12px, -12px) scale(0.97); }
  }
  @keyframes blobFloat3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-15px, -15px) scale(1.04); }
  }
  @keyframes blobFloat4 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(18px, 8px) scale(0.99); }
  }
  /* Subtle particles: vertical drift */
  @keyframes particleFloat {
    0%, 100% { transform: translateY(0) translateX(0); opacity: 0.25; }
    50% { transform: translateY(-12px) translateX(4px); opacity: 0.45; }
  }
  @media (max-width: 640px) {
    .topup-particle { opacity: 0.12; }
    .topup-blob { filter: blur(40px); opacity: 0.25 !important; }
  }
`;

export default function PublicTopupPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resultParam = searchParams.get('result');

  // Tenant ID: address bar (?tenant_id= or ?isp=) overrides env (VITE_DEFAULT_TENANT_ID)
  const tenantId = useMemo(() => {
    const fromUrl = searchParams.get('tenant_id') || searchParams.get('isp') || '';
    return (fromUrl || DEFAULT_TENANT_ID).trim();
  }, [searchParams]);

  // Pre-fill search from URL ?q= (e.g. /topup?isp=2&q=customer_id)
  const qFromUrl = searchParams.get('q') || '';
  const [query, setQuery] = useState(qFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [amount, setAmount] = useState('');
  const [payLoading, setPayLoading] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const lastAutoSearchKey = useRef<string>('');

  // Fetch tenants to resolve selected ISP name for title
  useEffect(() => {
    if (!tenantId) {
      setTenantName(null);
      return;
    }
    api.get<TenantOption[]>('/public/topup/tenants')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        const found = list.find((t) => t.tenant_id === tenantId);
        setTenantName(found ? found.tenant_name : null);
      })
      .catch(() => setTenantName(null));
  }, [tenantId]);

  const runLookup = async (q: string) => {
    if (!tenantId || !q.trim()) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const { data } = await api.get<LookupResult>('/public/topup/lookup', {
        params: { q: q.trim(), tenant_id: tenantId },
      });
      setResult(data);
      if (data.type === 'customer') {
        setAmount(String(data.payable_amount || ''));
      } else {
        setAmount('');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Lookup failed';
      setError(typeof msg === 'string' ? msg : 'Account not found');
    } finally {
      setLoading(false);
    }
  };

  // When URL has both isp and q, pre-fill input and auto-run search once per (tenantId, q)
  useEffect(() => {
    const q = (qFromUrl || '').trim();
    if (!tenantId || !q) return;
    const key = `${tenantId}:${q}`;
    if (lastAutoSearchKey.current === key) return;
    lastAutoSearchKey.current = key;
    setQuery(q);
    runLookup(q);
  }, [tenantId, qFromUrl]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setError('Enter User ID, Customer ID, or Username');
      return;
    }
    if (!tenantId) {
      setError('ISP ID is not set. Add ?tenant_id=YOUR_ISP_ID in the URL or set VITE_DEFAULT_TENANT_ID in .env');
      return;
    }
    // Update URL with isp and q so address bar shows e.g. /topup?isp=2&q=customer_id
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('q', q);
      if (!next.has('isp') && !next.has('tenant_id') && tenantId) next.set('isp', tenantId);
      return next;
    });
    lastAutoSearchKey.current = `${tenantId}:${q}`;
    await runLookup(q);
  };

  useEffect(() => {
    if (!result?.tenant_id) {
      setPaymentMethods([]);
      return;
    }
    api.get<PaymentMethodItem[]>('/public/topup/payment-methods', { params: { tenant_id: result.tenant_id } })
      .then(({ data }) => setPaymentMethods(Array.isArray(data) ? data : []))
      .catch(() => setPaymentMethods([]));
  }, [result?.tenant_id]);

  const getPayAmount = (): number => {
    if (!result) return 0;
    if (result.type === 'customer') return Math.round(Number(result.payable_amount ?? result.bill_amount ?? 0));
    return Math.round(Number(amount));
  };

  const handlePay = async (gateway: string) => {
    if (!result) return;
    const amt = getPayAmount();
    if (amt < 1) {
      setError(result.type === 'reseller' ? 'Enter a valid amount (min 1)' : 'Invalid package amount');
      return;
    }
    setError(null);
    setPayLoading(gateway);
    try {
      const gw = gateway === 'sslcommerz' ? 'ssl' : gateway;
      const body: Record<string, unknown> = {
        tenant_id: result.tenant_id,
        amount: amt,
        gateway: gw,
      };
      if (result.type === 'customer') {
        body.type = 'customer';
        body.customer_id = result.customer_id;
      } else {
        body.type = 'reseller';
        body.user_id = result.user_id;
      }
      const { data } = await api.post<{ payment_url: string }>('/public/topup/initiate', body);
      if (data?.payment_url) {
        window.location.href = data.payment_url;
        return;
      }
      setError('Could not get payment link');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Payment initiation failed';
      setError(typeof msg === 'string' ? msg : 'Try again later');
    } finally {
      setPayLoading(null);
    }
  };

  // Show success/fail message when returning from gateway
  if (resultParam) {
    const isSuccess = resultParam === 'success';
    return (
      <>
        <style>{topupKeyframes}</style>
        <div className="min-h-0 w-full flex items-center justify-center p-3 sm:p-4 relative overflow-x-hidden overflow-y-auto">
          {/* A) Animated gradient background - full screen, 18s */}
          <div
            className="absolute inset-0 bg-[length:200%_200%] pointer-events-none z-0"
            style={{
              backgroundImage: 'linear-gradient(135deg, rgba(224, 242, 254, 0.95) 0%, rgba(204, 251, 241, 0.4) 35%, rgba(207, 250, 254, 0.5) 70%, rgba(186, 230, 253, 0.4) 100%)',
              animation: 'gradientBg 18s ease-in-out infinite',
            }}
          />
          <div
            className="absolute inset-0 bg-[length:200%_200%] pointer-events-none z-0 opacity-0 dark:opacity-100"
            style={{
              backgroundImage: 'linear-gradient(135deg, rgba(15, 23, 42, 0.97) 0%, rgba(12, 74, 110, 0.3) 50%, rgba(8, 51, 68, 0.4) 100%)',
              animation: 'gradientBg 20s ease-in-out infinite reverse',
            }}
          />
          {/* B) Floating gradient blobs - blur 80px, opacity 0.3-0.5 */}
          <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
            <div className="topup-blob absolute w-64 h-64 sm:w-96 sm:h-96 rounded-full bg-gradient-to-br from-sky-400/50 to-cyan-400/40 -top-20 -left-20 sm:-left-32" style={{ filter: 'blur(80px)', opacity: 0.4, animation: 'blobFloat1 20s ease-in-out infinite' }} />
            <div className="topup-blob absolute w-56 h-56 sm:w-80 sm:h-80 rounded-full bg-gradient-to-br from-teal-400/45 to-sky-500/35 bottom-0 right-0 sm:right-10" style={{ filter: 'blur(80px)', opacity: 0.35, animation: 'blobFloat2 22s ease-in-out infinite 2s' }} />
            <div className="topup-blob absolute w-48 h-48 sm:w-72 sm:h-72 rounded-full bg-cyan-400/40 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ filter: 'blur(80px)', opacity: 0.3, animation: 'blobFloat3 18s ease-in-out infinite 1s' }} />
          </div>
          {/* C) Subtle particles - CSS only; fewer on mobile */}
          <div className="absolute inset-0 pointer-events-none z-[1]" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <span
                key={i}
                className={`topup-particle absolute w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white/40 dark:bg-white/20 ${i >= 4 ? 'hidden sm:block' : ''}`}
                style={{
                  left: `${12 + i * 11}%`,
                  top: `${15 + (i % 4) * 22}%`,
                  animation: `particleFloat ${14 + (i % 5)}s ease-in-out infinite`,
                  animationDelay: `${i * 0.7}s`,
                }}
              />
            ))}
          </div>
          {/* Card - glassmorphism + smooth entry */}
          <div
            className="relative z-10 w-full max-w-md rounded-2xl sm:rounded-3xl overflow-hidden min-w-0 mx-1 border border-white/30 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 shadow-xl shadow-sky-500/10 dark:shadow-sky-900/20 transition-shadow duration-500 hover:shadow-2xl hover:shadow-sky-500/15"
            style={{ backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', animation: 'fadeInUp 0.6s ease-out both' }}
          >
            <div className="absolute top-0 right-0 w-28 h-28 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-sky-400/10 to-teal-400/10 -translate-y-1/2 translate-x-1/2 pointer-events-none" style={{ animation: 'float 6s ease-in-out infinite' }} />
            <div className="relative p-6 sm:p-10 text-center">
              {isSuccess ? (
                <>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30" style={{ animation: 'scaleIn 0.5s 0.15s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
                    <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1.5 sm:mb-2 px-2" style={{ animation: 'fadeInUp 0.4s 0.2s both' }}>Payment successful</h1>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6 sm:mb-8 px-2" style={{ animation: 'fadeInUp 0.4s 0.3s both' }}>Recharge has been completed. Balance will be updated shortly.</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-red-500/20" style={{ animation: 'scaleIn 0.5s 0.15s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
                    <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1.5 sm:mb-2 px-2" style={{ animation: 'fadeInUp 0.4s 0.2s both' }}>Payment failed or cancelled</h1>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6 sm:mb-8 px-2" style={{ animation: 'fadeInUp 0.4s 0.3s both' }}>You can try again from the top-up page.</p>
                </>
              )}
              <a
                href="/topup"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-[44px] px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white font-semibold text-sm sm:text-base shadow-lg shadow-sky-500/25 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
                style={{ animation: 'fadeInUp 0.4s 0.35s both' }}
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                Back to Top-up
              </a>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{topupKeyframes}</style>
      <div className="min-h-0 w-full min-w-0 px-3 py-4 sm:p-6 relative overflow-x-hidden overflow-y-auto">
        {/* A) Animated gradient background - full screen, 15-20s */}
        <div
          className="absolute inset-0 bg-[length:200%_200%] pointer-events-none z-0"
          style={{
            backgroundImage: 'linear-gradient(135deg, rgba(224, 242, 254, 0.98) 0%, rgba(204, 251, 241, 0.45) 35%, rgba(207, 250, 254, 0.55) 70%, rgba(186, 230, 253, 0.45) 100%)',
            animation: 'gradientBg 18s ease-in-out infinite',
          }}
        />
        <div
          className="absolute inset-0 bg-[length:200%_200%] pointer-events-none z-0 opacity-0 dark:opacity-100"
          style={{
            backgroundImage: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(12, 74, 110, 0.35) 50%, rgba(8, 51, 68, 0.45) 100%)',
            animation: 'gradientBg 20s ease-in-out infinite reverse',
          }}
        />
        {/* B) Floating gradient blobs - blur 80px+, reduced on mobile via .topup-blob */}
        <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
          <div className="topup-blob absolute w-56 h-56 sm:w-96 sm:h-96 rounded-full bg-gradient-to-br from-sky-400/50 to-cyan-400/40 -top-24 left-1/4 sm:left-0 sm:-left-24" style={{ filter: 'blur(80px)', opacity: 0.4, animation: 'blobFloat1 20s ease-in-out infinite' }} />
          <div className="topup-blob absolute w-48 h-48 sm:w-80 sm:h-80 rounded-full bg-gradient-to-br from-teal-400/45 to-sky-500/35 bottom-1/4 right-0 sm:right-10" style={{ filter: 'blur(80px)', opacity: 0.35, animation: 'blobFloat2 22s ease-in-out infinite 2s' }} />
          <div className="topup-blob absolute w-40 h-40 sm:w-72 sm:h-72 rounded-full bg-cyan-400/40 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ filter: 'blur(80px)', opacity: 0.3, animation: 'blobFloat3 18s ease-in-out infinite 1s' }} />
          <div className="topup-blob absolute w-36 h-36 sm:w-64 sm:h-64 rounded-full bg-sky-300/35 top-1/3 right-1/4" style={{ filter: 'blur(80px)', opacity: 0.25, animation: 'blobFloat4 19s ease-in-out infinite 0.5s' }} />
        </div>
        {/* C) Subtle moving particles - CSS only; hidden on mobile for index >= 5 */}
        <div className="absolute inset-0 pointer-events-none z-[1]" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <span
              key={i}
              className={`topup-particle absolute w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white/35 dark:bg-white/15 ${i >= 5 ? 'hidden sm:block' : ''}`}
              style={{
                left: `${8 + (i * 9) % 85}%`,
                top: `${10 + (i * 17) % 80}%`,
                animation: `particleFloat ${13 + (i % 6)}s ease-in-out infinite`,
                animationDelay: `${i * 0.5}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 w-full max-w-lg mx-auto min-w-0">
          {/* Header with icon */}
          <div className="text-center mb-5 sm:mb-8" style={{ animation: 'fadeInUp 0.6s 0.1s both' }}>
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-500 to-teal-600 text-white shadow-xl shadow-sky-500/25 mb-3 sm:mb-4 transition-transform duration-300 hover:scale-105" style={{ animation: 'glow 3s ease-in-out infinite' }}>
              <Wallet className="w-7 h-7 sm:w-10 sm:h-10" />
            </div>
            <h1 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 break-words px-1">
              {tenantName ? `${tenantName} Top-up` : 'Top-up'}
            </h1>
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 px-2">Enter User ID, Customer ID, or Username to recharge</p>
          </div>

          {/* Search form card - glassmorphism + smooth entry */}
          {!result && (
            <form
              onSubmit={handleSearch}
              className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/30 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 shadow-xl shadow-sky-500/10 dark:shadow-sky-900/20 transition-all duration-500 hover:shadow-2xl hover:shadow-sky-500/15 hover:border-white/40"
              style={{ backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', animation: 'fadeInUp 0.6s ease-out both' }}
            >
              <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-sky-400/10 to-teal-400/10 -translate-y-1/2 translate-x-1/2 pointer-events-none" style={{ animation: 'float 6s ease-in-out infinite' }} />
              <div className="relative p-4 sm:p-6 space-y-4 sm:space-y-5">
              {tenantId && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate" style={{ animation: 'fadeIn 0.4s 0.25s both' }}>
                  {tenantName ? (
                    <>ISP: <span className="font-semibold text-slate-600 dark:text-slate-300">{tenantName}</span></>
                  ) : (
                    <>ISP ID: <span className="font-medium text-slate-600 dark:text-slate-300">{tenantId}</span>
                      {searchParams.get('tenant_id') || searchParams.get('isp') ? ' (URL)' : ' (env)'}
                    </>
                  )}
                </p>
              )}
              <div style={{ animation: 'fadeInUp 0.4s 0.3s both' }}>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 shrink-0" />
                  <span className="min-w-0">User ID / Customer ID / Username</span>
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter ID or username"
                  className="w-full min-w-0 px-3 py-3 sm:px-4 sm:py-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-base focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all duration-300 focus:shadow-md focus:shadow-sky-500/10"
                />
              </div>
              {error && (
                <div className="p-3 sm:p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm font-medium" style={{ animation: 'fadeInUp 0.3s both' }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 disabled:opacity-50 text-white font-semibold text-sm sm:text-base shadow-lg shadow-sky-500/25 transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] hover:shadow-xl hover:shadow-sky-500/30 active:scale-[0.99] disabled:hover:scale-100 disabled:hover:shadow-lg"
                style={{ animation: 'fadeInUp 0.4s 0.35s both' }}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Searching…
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Search
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Result card - glassmorphism + smooth entry */}
        {result && (
          <div
            className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/30 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 shadow-xl shadow-sky-500/10 dark:shadow-sky-900/20 min-w-0 transition-shadow duration-500 hover:shadow-2xl hover:shadow-sky-500/15"
            style={{ backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', animation: 'fadeInUp 0.6s ease-out both' }}
          >
            <div className="absolute top-0 right-0 w-28 h-28 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-sky-400/10 to-teal-400/10 -translate-y-1/2 translate-x-1/2 pointer-events-none" style={{ animation: 'float 6s ease-in-out infinite' }} />
            <div className="relative min-w-0">
              <div className="p-3 sm:p-6">
                <div className="rounded-xl sm:rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 overflow-hidden min-w-0">
                  <div className="divide-y divide-slate-200 dark:divide-slate-600">
                    <div className="flex justify-between items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-300 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 min-w-0" style={{ animation: 'rowIn 0.35s 0.1s both' }}>
                      <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">Name</span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate text-right">{result.name}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-300 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 min-w-0" style={{ animation: 'rowIn 0.35s 0.15s both' }}>
                      <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">UserID</span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate text-right">{result.user_id}</span>
                    </div>
                    {result.type === 'customer' && (
                      <>
                        <div className="flex justify-between items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-300 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 min-w-0" style={{ animation: 'rowIn 0.35s 0.2s both' }}>
                          <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">Bill Amount</span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">{result.bill_amount} Tk</span>
                        </div>
                        <div className="flex justify-between items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-300 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 min-w-0" style={{ animation: 'rowIn 0.35s 0.25s both' }}>
                          <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">Package</span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate text-right">{result.package_name}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-300 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 min-w-0" style={{ animation: 'rowIn 0.35s 0.3s both' }}>
                          <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">Prev. Balance</span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">{result.previous_balance} Tk</span>
                        </div>
                        <div className="flex justify-between items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-300 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 min-w-0" style={{ animation: 'rowIn 0.35s 0.35s both' }}>
                          <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">Payable</span>
                          <span className="text-xs sm:text-sm font-bold text-sky-600 dark:text-sky-400">{result.payable_amount} Tk</span>
                        </div>
                        <div className="flex justify-between items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-300 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 min-w-0" style={{ animation: 'rowIn 0.35s 0.4s both' }}>
                          <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">Expires</span>
                          <span className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 text-right whitespace-nowrap">{formatDate(result.current_expire_date)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-300 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 min-w-0" style={{ animation: 'rowIn 0.35s 0.45s both' }}>
                          <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">New Expires</span>
                          <span className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 text-right whitespace-nowrap">{formatDate(result.new_expire_date)}</span>
                        </div>
                      </>
                    )}
                    {result.type === 'reseller' && (
                      <div className="flex justify-between items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-300 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 min-w-0" style={{ animation: 'rowIn 0.35s 0.2s both' }}>
                        <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">Prev. Balance</span>
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">{result.previous_balance} Tk</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment section */}
              <div className="p-3 sm:p-6 bg-slate-50/60 dark:bg-slate-900/40 border-t border-slate-200/80 dark:border-slate-600/80 min-w-0">
                <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 sm:mb-4" style={{ animation: 'fadeInUp 0.4s 0.2s both' }}>
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500 shrink-0" />
                  Choose payment option
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  {result.type === 'reseller' && (
                    <div style={{ animation: 'fadeInUp 0.4s 0.25s both' }}>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1.5 sm:mb-2">Amount (Tk)</label>
                      <input
                        type="number"
                        min="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full min-w-0 px-3 py-3 sm:px-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-base focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all duration-300 focus:shadow-md focus:shadow-sky-500/10"
                      />
                    </div>
                  )}
                {paymentMethods.length > 0 ? (
                  <div
                    className={
                      paymentMethods.length === 1
                        ? 'flex justify-center'
                        : paymentMethods.length === 2
                          ? 'w-full sm:w-[90%] max-w-md mx-auto grid grid-cols-2 gap-2 sm:gap-3'
                          : 'grid grid-cols-2 gap-2 sm:gap-3'
                    }
                  >
                    {paymentMethods.map((method, idx) => {
                      const gateway = method.gateway;
                      const isBkash = gateway === 'bkash';
                      const isSsl = gateway === 'ssl' || gateway === 'sslcommerz';
                      const isPaying = payLoading === gateway;
                      const borderHover = isBkash
                        ? 'hover:border-pink-400 dark:hover:border-pink-500 hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 dark:hover:from-pink-900/20 dark:hover:to-rose-900/20 hover:shadow-lg hover:shadow-pink-500/10'
                        : isSsl
                          ? 'hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 hover:shadow-lg hover:shadow-blue-500/10'
                          : 'hover:border-orange-400 dark:hover:border-orange-500 hover:bg-gradient-to-br hover:from-orange-50 hover:to-amber-50 dark:hover:from-orange-900/20 dark:hover:to-amber-900/20 hover:shadow-lg hover:shadow-orange-500/10';
                      const accentBg = isBkash ? 'bg-pink-400/10' : isSsl ? 'bg-blue-400/10' : 'bg-orange-400/10';
                      const iconGradient = isBkash ? 'from-pink-500 to-rose-600' : isSsl ? 'from-blue-500 to-indigo-600' : 'from-orange-500 to-amber-600';
                      const accentColor = isBkash ? 'text-pink-600 dark:text-pink-400' : isSsl ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400';
                      return (
                        <button
                          key={method.gateway}
                          type="button"
                          onClick={() => handlePay(gateway)}
                          disabled={payLoading !== null}
                          className={`relative p-3 sm:p-5 rounded-xl sm:rounded-2xl border-2 border-slate-200 dark:border-slate-600 transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden hover:scale-[1.02] active:scale-[0.98] min-h-[44px] sm:min-h-0 ${borderHover} ${paymentMethods.length === 1 ? 'max-w-sm w-full' : ''}`}
                          style={{ animation: `fadeInUp 0.4s ${0.3 + idx * 0.08}s both` }}
                        >
                          <div className={`absolute top-0 right-0 w-14 h-14 sm:w-20 sm:h-20 rounded-full ${accentBg} -translate-y-1/2 translate-x-1/2`} />
                          <div className="relative flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br ${iconGradient} flex items-center justify-center text-white shadow-lg shrink-0`}>
                              {isSsl ? <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" /> : <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">{method.label}</div>
                              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                {isPaying ? (
                                  <span className={`inline-flex items-center gap-1.5 ${accentColor}`}>
                                    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Redirecting…
                                  </span>
                                ) : (
                                  <span className="line-clamp-2">{method.description}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePay('ssl')}
                    disabled={payLoading !== null}
                    className="relative w-full min-h-[44px] py-4 sm:py-5 rounded-xl sm:rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:border-blue-400 dark:hover:border-blue-500 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 hover:scale-[1.01] hover:shadow-lg hover:shadow-blue-500/10 active:scale-[0.99] disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3 overflow-hidden"
                    style={{ animation: 'fadeInUp 0.4s 0.3s both' }}
                  >
                    <div className="absolute top-0 right-0 w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-blue-400/10 -translate-y-1/2 translate-x-1/2" />
                    <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                      <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                      {payLoading ? (
                        <span className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400">
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Redirecting…
                        </span>
                      ) : (
                        'Pay with SSLCommerz'
                      )}
                    </span>
                  </button>
                )}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
