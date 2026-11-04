import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  CreditCard,
  Wallet,
  Search,
  User,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Calendar,
  Wifi,
  Building2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Phone,
  HelpCircle,
  ChevronDown
} from 'lucide-react';
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
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function PublicTopupPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resultParam = searchParams.get('result');
  const txnIdParam = searchParams.get('txn_id') || searchParams.get('transaction_ref') || '';
  const amountParam = searchParams.get('amount') || '';
  const gatewayParam = searchParams.get('gateway') || '';

  // Tenants list
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  // Tenant ID from URL (?tenant_id= or ?isp=) or fallback
  const tenantIdFromUrl = useMemo(() => {
    return (searchParams.get('tenant_id') || searchParams.get('isp') || '').trim();
  }, [searchParams]);

  const activeTenantId = selectedTenantId || tenantIdFromUrl || DEFAULT_TENANT_ID;

  // Search input & state
  const qFromUrl = searchParams.get('q') || '';
  const [query, setQuery] = useState(qFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [amount, setAmount] = useState('');
  const [payLoading, setPayLoading] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const lastAutoSearchKey = useRef<string>('');

  // Fetch tenants on mount
  useEffect(() => {
    api
      .get<TenantOption[]>('/public/topup/tenants')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setTenants(list);
        if (!selectedTenantId) {
          if (tenantIdFromUrl && list.some((t) => t.tenant_id === tenantIdFromUrl)) {
            setSelectedTenantId(tenantIdFromUrl);
          } else if (list.length > 0) {
            setSelectedTenantId(list[0].tenant_id);
          }
        }
      })
      .catch(() => {
        // Fallback default list
        setTenants([
          { tenant_id: '1', tenant_code: 'ISP001', tenant_name: 'NetFix Cloud Network' },
          { tenant_id: '2', tenant_code: 'ISP002', tenant_name: 'SpeedNet Fiber Broadband' },
        ]);
        if (!selectedTenantId) {
          setSelectedTenantId('2');
        }
      });
  }, [tenantIdFromUrl]);

  const currentTenant = useMemo(() => {
    return tenants.find((t) => t.tenant_id === activeTenantId) || null;
  }, [tenants, activeTenantId]);

  const runLookup = async (q: string, targetTenantId?: string) => {
    const tid = targetTenantId || activeTenantId;
    if (!q.trim()) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const { data } = await api.get<LookupResult>('/public/topup/lookup', {
        params: { q: q.trim(), tenant_id: tid || undefined },
      });
      setResult(data);
      if (data.type === 'customer') {
        setAmount(String(data.payable_amount || ''));
      } else {
        setAmount('');
      }
      if (data.tenant_id && data.tenant_id !== activeTenantId) {
        setSelectedTenantId(data.tenant_id);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Subscriber account not found';
      setError(typeof msg === 'string' ? msg : 'Account not found. Please verify the ID or phone number.');
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill search when query param changes
  useEffect(() => {
    const q = (qFromUrl || '').trim();
    if (!q) return;
    const key = `${activeTenantId}:${q}`;
    if (lastAutoSearchKey.current === key) return;
    lastAutoSearchKey.current = key;
    setQuery(q);
    runLookup(q, activeTenantId);
  }, [activeTenantId, qFromUrl]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setError('Please enter your Customer ID, Mobile Number, or Username');
      return;
    }

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('q', q);
      if (activeTenantId) next.set('isp', activeTenantId);
      return next;
    });

    lastAutoSearchKey.current = `${activeTenantId}:${q}`;
    await runLookup(q, activeTenantId);
  };

  // Load payment methods when result changes
  useEffect(() => {
    if (!result?.tenant_id) {
      setPaymentMethods([]);
      return;
    }
    api
      .get<PaymentMethodItem[]>('/public/topup/payment-methods', {
        params: { tenant_id: result.tenant_id },
      })
      .then(({ data }) => setPaymentMethods(Array.isArray(data) ? data : []))
      .catch(() => {
        setPaymentMethods([
          { gateway: 'bkash', label: 'bKash Direct', description: 'Instant recharge via bKash mobile wallet' },
          { gateway: 'nagad', label: 'Nagad Pay', description: 'Fast payment via Nagad checkout' },
          { gateway: 'sslcommerz', label: 'Cards & NetBanking', description: 'Visa, MasterCard, Amex, Internet Banking' },
        ]);
      });
  }, [result?.tenant_id]);

  const getPayAmount = (): number => {
    if (!result) return 0;
    if (result.type === 'customer') {
      return Math.round(Number(result.payable_amount ?? result.bill_amount ?? 0));
    }
    return Math.round(Number(amount));
  };

  const handlePay = async (gateway: string) => {
    if (!result) return;
    const amt = getPayAmount();
    if (amt < 1) {
      setError(result.type === 'reseller' ? 'Please enter a valid top-up amount (min 10 Tk)' : 'Invalid package amount');
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
      setError('Could not generate secure payment link. Please retry.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Payment initiation failed';
      setError(typeof msg === 'string' ? msg : 'Unable to proceed to payment gateway. Try again later.');
    } finally {
      setPayLoading(null);
    }
  };

  const fillDemoCustomer = () => {
    setQuery('100001');
    setError(null);
    runLookup('100001', activeTenantId);
  };

  // =========================================================================
  // VIEW: PAYMENT RESULT (Success / Failure Return)
  // =========================================================================
  if (resultParam) {
    const isSuccess = resultParam === 'success';

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
        {/* Cyberpunk Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0d_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0d_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Ambient Glowing Blobs */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[35rem] h-[35rem] bg-gradient-to-tr from-cyan-600/15 via-emerald-600/15 to-transparent rounded-full blur-[120px] pointer-events-none" />

        {/* Top Navbar */}
        <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-4 sm:px-8 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-[1.5px] shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Wifi className="h-5 w-5 text-cyan-400" />
                </div>
              </div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                NetFix<span className="text-cyan-400">.</span>
              </span>
            </Link>

            <Link
              to="/topup"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 px-3.5 py-1.5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Recharge Portal
            </Link>
          </div>
        </header>

        {/* Main Card */}
        <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 shadow-2xl p-6 sm:p-10 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

            {isSuccess ? (
              <>
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-xl shadow-emerald-500/30 animate-in zoom-in-75 duration-300">
                  <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Payment Confirmed
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Recharge Successful!</h1>
                <p className="text-sm text-slate-400 mb-6">
                  Your broadband account has been refreshed and renewed immediately.
                </p>

                {/* Details Breakdown */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5 mb-8 text-left space-y-3 text-sm">
                  {txnIdParam && (
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                      <span className="text-slate-400 text-xs">Transaction ID</span>
                      <span className="font-mono text-xs font-semibold text-cyan-400 truncate max-w-[200px]">
                        {txnIdParam}
                      </span>
                    </div>
                  )}

                  {amountParam && (
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                      <span className="text-slate-400 text-xs">Amount Paid</span>
                      <span className="font-bold text-white text-base">{amountParam} BDT</span>
                    </div>
                  )}

                  {gatewayParam && (
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                      <span className="text-slate-400 text-xs">Method</span>
                      <span className="font-semibold text-emerald-400 uppercase text-xs">{gatewayParam}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs">Service Status</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Active / Renewed
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link
                    to="/customer/login"
                    className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all"
                  >
                    Customer Portal
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    to="/topup"
                    className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-white font-semibold text-sm border border-slate-700/80 transition-colors"
                  >
                    Recharge Another
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center text-white shadow-xl shadow-rose-500/30">
                  <XCircle className="w-10 h-10 stroke-[2.5]" />
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider mb-3">
                  Payment Incomplete
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Recharge Failed or Cancelled</h1>
                <p className="text-sm text-slate-400 mb-8">
                  No payment was deducted from your account. You can verify your balance and retry anytime.
                </p>

                <div className="space-y-3">
                  <Link
                    to="/topup"
                    className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Try Again
                  </Link>

                  <Link
                    to="/customer/login"
                    className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Login to Customer Care
                  </Link>
                </div>
              </>
            )}
          </div>
        </main>

        {/* Minimal Footer */}
        <footer className="relative z-10 py-5 text-center text-xs text-slate-600 border-t border-slate-900">
          <p>© {new Date().getFullYear()} NetFix Technologies. 256-Bit SSL Encrypted Instant Payment Gateway.</p>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW: MAIN SEARCH & TOPUP PORTAL
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Cyberpunk Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0d_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0d_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Ambient Glowing Blobs */}
      <div className="absolute -top-32 left-1/4 w-[32rem] h-[32rem] bg-gradient-to-tr from-cyan-600/15 via-blue-600/10 to-transparent rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-[28rem] h-[28rem] bg-gradient-to-br from-emerald-600/15 via-teal-600/10 to-transparent rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-4 sm:px-8 py-3.5 sm:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-[1.5px] shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Wifi className="h-5 w-5 text-cyan-400" />
                </div>
              </div>
              <div>
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  NetFix<span className="text-cyan-400">.</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold tracking-wider uppercase text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                  Instant Pay
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/customer/login"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 px-3 sm:px-4 py-2 rounded-xl transition-all"
            >
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>Customer Portal</span>
            </Link>
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-400 hover:text-slate-200 px-3 py-2 transition-colors"
            >
              ISP Staff
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-8 my-auto">
        <div className="w-full max-w-xl mx-auto">
          {/* Hero Title */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium mb-3 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Self-Service Instant Recharge</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
              Pay Broadband Bill
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              Recharge your internet connection instantly via bKash, Nagad, or Bank Cards. No login required.
            </p>
          </div>

          {/* ================================================================= */}
          {/* STEP 1: SEARCH & IDENTIFIER FORM */}
          {/* ================================================================= */}
          {!result && (
            <div className="rounded-3xl bg-slate-900/85 backdrop-blur-xl border border-slate-800/80 shadow-2xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

              <form onSubmit={handleSearch} className="space-y-5">
                {/* ISP Network Selection */}
                {tenants.length > 1 && (
                  <div>
                    <label className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                        Select Internet Provider (ISP)
                      </span>
                      {currentTenant && (
                        <span className="text-[11px] text-cyan-400 font-mono">
                          ID: {currentTenant.tenant_code}
                        </span>
                      )}
                    </label>

                    <div className="relative">
                      <select
                        value={activeTenantId}
                        onChange={(e) => {
                          setSelectedTenantId(e.target.value);
                          setError(null);
                        }}
                        className="w-full appearance-none bg-slate-950/80 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-sm text-white font-medium transition-colors cursor-pointer pr-10"
                      >
                        {tenants.map((t) => (
                          <option key={t.tenant_id} value={t.tenant_id} className="bg-slate-900 text-white">
                            {t.tenant_name} ({t.tenant_code})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Identifier Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                      <Search className="w-3.5 h-3.5 text-cyan-400" />
                      Customer ID / Mobile / Username
                    </label>
                    <button
                      type="button"
                      onClick={fillDemoCustomer}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1 transition-colors hover:underline"
                    >
                      <Sparkles className="w-3 h-3" />
                      ⚡ Fill Demo: 100001
                    </button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setError(null);
                      }}
                      placeholder="e.g. 100001 or 01774581701"
                      className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-xl pl-10 pr-4 py-3.5 text-sm sm:text-base text-white placeholder-slate-500 transition-all font-medium"
                      autoFocus
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Enter the Customer Code or Phone Number given when receiving your internet connection.
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs sm:text-sm font-medium flex items-start gap-2 animate-in fade-in duration-200">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 active:scale-[0.99] text-slate-950 font-bold text-sm sm:text-base shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Searching account...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Find Account & Pay</span>
                    </>
                  )}
                </button>
              </form>

              {/* Trust Indicators */}
              <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400">
                <div className="flex flex-col items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Bank Grade Security</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Instant Line Renewal</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Wallet className="w-4 h-4 text-purple-400" />
                  <span>Zero Processing Fee</span>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 2: ACCOUNT FOUND & PAYMENT METHOD SELECTION */}
          {/* ================================================================= */}
          {result && (
            <div className="space-y-4">
              {/* Reset Search Button */}
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Search a different account</span>
              </button>

              <div className="rounded-3xl bg-slate-900/85 backdrop-blur-xl border border-slate-800/80 shadow-2xl p-5 sm:p-7 relative overflow-hidden">
                {/* Customer Info Card Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg shrink-0">
                      {result.name ? result.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-base sm:text-lg text-white truncate">{result.name}</h2>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Verified
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Customer ID: <span className="text-slate-200">{result.user_id}</span>
                        {result.type === 'customer' && result.username && result.username !== result.user_id && (
                          <span className="ml-2 text-slate-500">({result.username})</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Service Details Grid */}
                {result.type === 'customer' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Internet Plan</span>
                      <span className="font-bold text-sm text-white truncate block">{result.package_name}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Monthly Bill</span>
                      <span className="font-bold text-sm text-cyan-400">{result.bill_amount} BDT</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block mb-0.5">Current Expiry</span>
                      <span className="font-semibold text-xs text-rose-400 block truncate">
                        {formatDate(result.current_expire_date)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                      <span className="text-[10px] text-emerald-400 block mb-0.5">Extended Expiry</span>
                      <span className="font-semibold text-xs text-emerald-300 block truncate">
                        {formatDate(result.new_expire_date)}
                      </span>
                    </div>
                  </div>
                )}

                {result.type === 'reseller' && (
                  <div className="my-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Current Balance:</span>
                      <span className="font-bold text-white">{result.previous_balance} BDT</span>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Top-up Amount (BDT)</label>
                      <input
                        type="number"
                        min="10"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount to recharge"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-white font-bold"
                      />
                    </div>
                  </div>
                )}

                {/* Highlight Payable Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-900/60 to-emerald-950/60 border border-cyan-500/30 flex items-center justify-between mb-6">
                  <div>
                    <span className="text-xs text-slate-400 block">Total Payable Now</span>
                    <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                      {getPayAmount()} <span className="text-sm font-normal text-slate-300">BDT</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold block">
                      30 Days Renewal
                    </span>
                    <span className="text-[11px] text-slate-400">Auto-activated on payment</span>
                  </div>
                </div>

                {/* Gateways Section */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                    Select Instant Payment Gateway
                  </h3>

                  {paymentMethods.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {paymentMethods.map((method) => {
                        const gw = method.gateway;
                        const isBkash = gw === 'bkash';
                        const isNagad = gw === 'nagad';
                        const isSsl = gw === 'ssl' || gw === 'sslcommerz';
                        const isPaying = payLoading === gw;

                        // Gateway branding gradients & borders
                        let bgStyle = 'bg-slate-950 hover:bg-slate-900 border-slate-800 hover:border-slate-700';
                        let accentText = 'text-white';
                        let buttonBadge = 'Pay with Card';

                        if (isBkash) {
                          bgStyle =
                            'bg-gradient-to-b from-pink-950/40 to-slate-950 border-pink-900/40 hover:border-pink-500/70 hover:shadow-lg hover:shadow-pink-500/10';
                          accentText = 'text-pink-400';
                          buttonBadge = 'bKash Direct';
                        } else if (isNagad) {
                          bgStyle =
                            'bg-gradient-to-b from-orange-950/40 to-slate-950 border-orange-900/40 hover:border-orange-500/70 hover:shadow-lg hover:shadow-orange-500/10';
                          accentText = 'text-orange-400';
                          buttonBadge = 'Nagad Pay';
                        } else if (isSsl) {
                          bgStyle =
                            'bg-gradient-to-b from-blue-950/40 to-slate-950 border-blue-900/40 hover:border-blue-500/70 hover:shadow-lg hover:shadow-blue-500/10';
                          accentText = 'text-blue-400';
                          buttonBadge = 'Debit / Credit Card';
                        }

                        return (
                          <button
                            key={gw}
                            type="button"
                            onClick={() => handlePay(gw)}
                            disabled={payLoading !== null}
                            className={`p-4 rounded-2xl border text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[110px] ${bgStyle}`}
                          >
                            <div className="flex items-center justify-between w-full mb-2">
                              <span className={`font-extrabold text-base ${accentText}`}>{buttonBadge}</span>
                              <div className="w-8 h-8 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-center">
                                {isSsl ? (
                                  <CreditCard className="w-4 h-4 text-blue-400" />
                                ) : (
                                  <Wallet className={`w-4 h-4 ${accentText}`} />
                                )}
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                              {isPaying ? (
                                <span className="inline-flex items-center gap-1.5 text-cyan-400 font-semibold">
                                  <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                  Redirecting...
                                </span>
                              ) : (
                                method.description
                              )}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePay('ssl')}
                      disabled={payLoading !== null}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                    >
                      <CreditCard className="w-5 h-5" />
                      <span>Proceed to Payment Gateway</span>
                    </button>
                  )}
                </div>

                {error && (
                  <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center gap-2">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/80 backdrop-blur-sm py-4 px-4 sm:px-8 text-center">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} NetFix Broadband & Billing SaaS. All rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <Link to="/customer/login" className="hover:text-slate-300 transition-colors">
              Self-Care Portal
            </Link>
            <span className="text-slate-700">•</span>
            <span className="text-emerald-500/90 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 256-Bit SSL Protected
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
