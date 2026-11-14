import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Wallet,
  CreditCard,
  Coins,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  Lock,
  ArrowRight,
  Copy,
  Check,
  History,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Zap,
  HelpCircle,
  Building2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useToastContext } from '@/contexts/ToastContext';
import api from '@/lib/api';
import PageHeader from '@/components/common/PageHeader';
import MetricCard from '@/components/common/MetricCard';

type PaymentMethodItem = {
  gateway: string;
  label: string;
  description: string;
};

type LedgerItem = {
  ledger_id: number;
  tenant_id: number;
  user_id: number;
  debit: number | string;
  credit: number | string;
  reference_type: string;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: number;
};

const PRESET_AMOUNTS = [500, 1000, 2000, 3000, 5000, 10000, 20000, 50000];

function formatAmount(n: number | string): string {
  const num = typeof n === 'number' ? n : parseFloat(String(n).replace(/,/g, ''));
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

export default function TopupBalancePage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const resultParam = searchParams.get('result');
  const statusParam = searchParams.get('status');
  const paymentID = searchParams.get('paymentID') || searchParams.get('payment_id') || searchParams.get('order_id') || '';

  const { user, balance, refreshMe } = useAuthStore();

  const [amount, setAmount] = useState<string>('1000');
  const [selectedGateway, setSelectedGateway] = useState<string>('bkash');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Payment Confirmation State
  const [confirming, setConfirming] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState<string | null>(null);
  const hasAttemptedConfirm = useRef(false);
  const retryCountRef = useRef(0);

  // Ledger / Transaction History State
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const isSuccessCallback = resultParam === 'success' || statusParam === 'success';

  // Load User & Balance
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshMe();
      toast.success('Wallet balance updated');
    } catch {
      toast.error('Failed to sync wallet balance');
    } finally {
      setRefreshing(false);
    }
  }, [refreshMe, toast]);

  // Load Payment Methods for Tenant
  useEffect(() => {
    const tenantId = user?.tenant_id ?? 2;
    setLoadingMethods(true);
    api
      .get<PaymentMethodItem[]>('/public/topup/payment-methods', { params: { tenant_id: tenantId } })
      .then(({ data }) => {
        const methods = Array.isArray(data) && data.length > 0 ? data : [
          { gateway: 'bkash', label: 'bKash Direct', description: 'Instant recharge via bKash mobile wallet or QR code' },
          { gateway: 'nagad', label: 'Nagad Gateway', description: 'Fast automated checkout with Nagad personal/merchant' },
          { gateway: 'sslcommerz', label: 'Cards & NetBanking', description: 'Visa, MasterCard, Amex, Rocket & Internet Banking' },
        ];
        setPaymentMethods(methods);
        if (methods.length > 0) {
          setSelectedGateway(methods[0].gateway);
        }
      })
      .catch(() => {
        // Fallback default gateways
        const fallback: PaymentMethodItem[] = [
          { gateway: 'bkash', label: 'bKash Direct', description: 'Instant recharge via bKash mobile wallet or QR code' },
          { gateway: 'nagad', label: 'Nagad Gateway', description: 'Fast automated checkout with Nagad personal/merchant' },
          { gateway: 'sslcommerz', label: 'Cards & NetBanking', description: 'Visa, MasterCard, Amex, Rocket & Internet Banking' },
        ];
        setPaymentMethods(fallback);
        setSelectedGateway('bkash');
      })
      .finally(() => setLoadingMethods(false));
  }, [user?.tenant_id]);

  // Load User's Recent Ledger / Topup History
  const fetchLedgerHistory = useCallback(async () => {
    if (!user?.user_id) return;
    setLoadingLedger(true);
    try {
      const { data } = await api.get<{ items: LedgerItem[] }>(`/resellers/${user.user_id}/ledger`);
      setLedgerItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      // Fail silently for ledger
      setLedgerItems([]);
    } finally {
      setLoadingLedger(false);
    }
  }, [user?.user_id]);

  useEffect(() => {
    fetchLedgerHistory();
  }, [fetchLedgerHistory]);

  // Confirm Online Topup Callback
  const confirmBalanceTopup = useCallback(async () => {
    if (!paymentID) return;
    setConfirming(true);
    setError(null);
    try {
      const { data } = await api.post<{ success: boolean; message: string; trxID?: string; balance?: number }>(
        '/payments/confirm-balance-topup',
        { paymentID }
      );
      setConfirmedSuccess(data?.trxID || paymentID);
      await refreshMe();
      fetchLedgerHistory();
      toast.success(data?.message || 'Payment confirmed and balance updated successfully!');
      // Clean query params from URL without reload
      setSearchParams({}, { replace: true });
    } catch (err: any) {
      const data = err?.response?.data ?? err;
      const msg = typeof data?.message === 'string' ? data.message : Array.isArray(data?.message) ? data.message[0] : data?.message;
      const displayMsg = msg || data?.error || 'Could not confirm payment. Please contact support.';
      const isSigV4 = /Credential|Signature|SignedHeaders|X-Amz-Date/i.test(displayMsg || '');
      if (isSigV4 && retryCountRef.current < 3) {
        retryCountRef.current += 1;
        setError('Payment verification is in progress. Please wait…');
        setTimeout(() => confirmBalanceTopup(), 4000);
      } else {
        setError(displayMsg || 'Payment confirmation failed');
        toast.error(displayMsg || 'Payment confirmation failed');
      }
    } finally {
      setConfirming(false);
    }
  }, [paymentID, refreshMe, fetchLedgerHistory, toast, setSearchParams]);

  useEffect(() => {
    if (!isSuccessCallback || !paymentID || hasAttemptedConfirm.current) return;
    hasAttemptedConfirm.current = true;
    confirmBalanceTopup();
  }, [isSuccessCallback, paymentID, confirmBalanceTopup]);

  // Handle Cancellation or Gateway Decline Callbacks
  const isCancel =
    statusParam === 'cancel' ||
    statusParam === 'cancelled' ||
    statusParam === 'canceled' ||
    resultParam === 'cancel' ||
    resultParam === 'cancelled';

  const isFailed =
    statusParam === 'failure' ||
    statusParam === 'failed' ||
    resultParam === 'failure' ||
    resultParam === 'failed';

  useEffect(() => {
    if (isCancel) {
      toast.warning('Payment was cancelled. Your account balance was not charged.');
      setSearchParams({}, { replace: true });
    } else if (isFailed) {
      setError('Payment was declined or failed at gateway. Please try again or choose another payment method.');
      toast.error('Payment failed or was declined by gateway.');
      setSearchParams({}, { replace: true });
    }
  }, [isCancel, isFailed, setSearchParams, toast]);

  // Calculate Numeric Values
  const totalAmount = useMemo(() => {
    const cleanStr = String(amount).replace(/[^0-9.]/g, '');
    const n = parseFloat(cleanStr);
    return isNaN(n) || n < 1 ? 0 : Math.round(n);
  }, [amount]);

  const currentBalance = balance ?? 0;
  const projectedBalance = currentBalance + totalAmount;

  // Handle Amount Input & Quick Modifiers
  const handleAmountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    setAmount(cleaned);
  };

  const handlePresetClick = (presetVal: number) => {
    setAmount(String(presetVal));
  };

  const handleAddAmount = (addVal: number) => {
    const current = totalAmount;
    setAmount(String(current + addVal));
  };

  // Initiate Payment Gateway
  const handlePay = async (gatewayToUse: string) => {
    if (totalAmount < 10) {
      setError('Minimum recharge amount is ৳10');
      toast.error('Minimum recharge amount is ৳10');
      return;
    }
    if (totalAmount > 100000) {
      setError('Maximum recharge amount per transaction is ৳100,000');
      toast.error('Maximum recharge amount per transaction is ৳100,000');
      return;
    }

    setError(null);
    setPaying(gatewayToUse);

    try {
      const gw = gatewayToUse === 'sslcommerz' ? 'ssl' : gatewayToUse;
      const callbackUrl = `${window.location.origin}/dashboard/topup-balance`;
      const { data } = await api.post<{ payment_url?: string; redirectURL?: string }>('/payments/initiate-balance-topup', {
        amount: totalAmount,
        gateway: gw,
        callbackURL: callbackUrl,
      });

      const redirectTarget = data?.payment_url || data?.redirectURL;
      if (redirectTarget) {
        window.location.href = redirectTarget;
        return;
      }
      setError('Unable to initialize payment gateway URL. Please try again.');
      toast.error('Unable to initialize payment gateway URL.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Payment initiation failed. Please try again.';
      setError(typeof msg === 'string' ? msg : 'Payment initiation failed');
      toast.error(typeof msg === 'string' ? msg : 'Payment initiation failed');
    } finally {
      setPaying(null);
    }
  };

  // Filter Ledger Items
  const filteredLedger = useMemo(() => {
    if (!ledgerSearch.trim()) return ledgerItems;
    const q = ledgerSearch.toLowerCase();
    return ledgerItems.filter((item) => {
      const ref = (item.reference_id || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();
      const type = (item.reference_type || '').toLowerCase();
      return ref.includes(q) || notes.includes(q) || type.includes(q);
    });
  }, [ledgerItems, ledgerSearch]);

  const copyRefToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRef(text);
    toast.success('Transaction reference copied to clipboard');
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const selectedGatewayItem = paymentMethods.find((m) => m.gateway === selectedGateway) || paymentMethods[0];

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Topup Balance"
        subtitle="Deposit funds securely to your account balance using instant automated payment gateways"
        badge={`Available: ৳${formatAmount(currentBalance)}`}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
              <span>Refresh Balance</span>
            </button>
          </div>
        }
      />

      {/* Confirmation In-Progress Alert */}
      {confirming && (
        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 shadow-sm animate-pulse">
          <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100">
              Verifying Payment with Gateway...
            </h4>
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mt-0.5">
              Please wait while your payment verification and wallet crediting completes automatically.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Success Alert */}
      {confirmedSuccess && (
        <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
              Topup Successful!
            </h4>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mt-0.5">
              Your wallet has been credited successfully. Reference: <span className="font-mono font-bold">{confirmedSuccess}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmedSuccess(null)}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-medium shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <MetricCard
          title="Current Balance"
          value={`৳${formatAmount(currentBalance)}`}
          subtext="Available for subscriptions & billing"
          variant="emerald"
          icon={<Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
        />
        <MetricCard
          title="Topup Amount"
          value={totalAmount > 0 ? `৳${formatAmount(totalAmount)}` : '৳0.00'}
          subtext={totalAmount > 0 ? 'Ready for gateway checkout' : 'Select or specify amount'}
          variant="blue"
          icon={<Coins className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        />
        <MetricCard
          title="Estimated Balance"
          value={`৳${formatAmount(projectedBalance)}`}
          subtext={totalAmount > 0 ? `+৳${formatAmount(totalAmount)} after confirmation` : 'Awaiting recharge amount'}
          variant={totalAmount > 0 ? 'indigo' : 'slate'}
          icon={<TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
        />
        <MetricCard
          title="Account Identity"
          value={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'Tenant Admin'}
          subtext={`Role: ${user?.role_code || user?.role || 'Admin'} • ID: #${user?.user_id ?? ''}`}
          variant="amber"
          icon={<ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
        />
      </div>

      {/* 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Steps (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Step 1: Specify Recharge Amount */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                1. Specify Recharge Amount
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Choose a predefined quick amount or enter any custom topup value in BDT
              </p>
            </div>

            {/* Quick Presets Grid */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5">
                Quick Preset Amounts
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PRESET_AMOUNTS.map((preset) => {
                  const isSelected = totalAmount === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetClick(preset)}
                      className={`relative px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all text-center ${
                        isSelected
                          ? 'border-blue-600 dark:border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>৳{preset.toLocaleString()}</span>
                      {(preset === 1000 || preset === 2000) && (
                        <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-blue-600 text-white tracking-wide uppercase">
                          Popular
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Amount Input Field */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Custom Amount (BDT)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 dark:text-slate-400 font-bold text-xl">
                  ৳
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-24 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xl font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                />
                {totalAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount('')}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Quick Increments */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Add more:</span>
                {[500, 1000, 5000].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => handleAddAmount(inc)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors shadow-xs"
                  >
                    +৳{inc}
                  </button>
                ))}
              </div>

              {/* Helper note */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                <span>Minimum recharge: ৳10</span>
                <span>Maximum limit: ৳100,000</span>
              </div>
            </div>
          </div>

          {/* Step 2: Choose Payment Gateway */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                2. Choose Payment Method
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select an automated payment gateway to securely process your balance recharge
              </p>
            </div>

            {loadingMethods ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium">Loading payment gateways...</span>
              </div>
            ) : paymentMethods.length === 0 ? (
              <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                No active payment gateways configured for this account. Please contact support.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {paymentMethods.map((method) => {
                  const gw = method.gateway.toLowerCase();
                  const isBkash = gw === 'bkash';
                  const isNagad = gw === 'nagad';
                  const isRocket = gw === 'rocket';
                  const isUpay = gw === 'upay';
                  const isSSL = gw === 'sslcommerz' || gw === 'ssl';
                  const isSurjo = gw === 'surjopay' || gw === 'shurjopay';
                  const isSelected = selectedGateway === method.gateway;
                  const isPayingThis = paying === method.gateway || (method.gateway === 'sslcommerz' && paying === 'ssl');

                  // Gateway styling configs
                  let badgeBg = 'bg-blue-600';
                  let badgeText = 'GW';
                  if (isBkash) {
                    badgeBg = 'bg-[#E2136E]';
                    badgeText = 'bK';
                  } else if (isNagad) {
                    badgeBg = 'bg-[#F7941D]';
                    badgeText = 'Ng';
                  } else if (isRocket) {
                    badgeBg = 'bg-[#8C3494]';
                    badgeText = 'Rk';
                  } else if (isUpay) {
                    badgeBg = 'bg-[#002D62]';
                    badgeText = 'Up';
                  } else if (isSSL) {
                    badgeBg = 'bg-[#1E40AF]';
                    badgeText = 'SSL';
                  } else if (isSurjo) {
                    badgeBg = 'bg-[#0D9488]';
                    badgeText = 'SJ';
                  }

                  return (
                    <div
                      key={method.gateway}
                      onClick={() => setSelectedGateway(method.gateway)}
                      className={`relative p-4 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-white shadow-xs ${badgeBg}`}
                          >
                            <span className="text-sm tracking-tight">{badgeText}</span>
                          </div>
                          <div>
                            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              <span>{method.label}</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                Instant
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {method.description || 'Instant automated balance verification'}
                            </p>
                          </div>
                        </div>

                        {/* Selected Radio Indicator */}
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>

                      {/* Footer Info on Card */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-medium">
                          <Zap className="w-3 h-3 text-amber-500" /> Auto Verification
                        </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">0% Gateway Fee</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 3: Payment Summary & Checkout Action */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                3. Payment Summary & Confirmation
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review your topup order details before proceeding to the secure gateway
              </p>
            </div>

            <div className="space-y-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Topup Deposit Amount:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  ৳{formatAmount(totalAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Gateway Processing Fee:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  ৳0.00 (Free)
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Selected Gateway:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedGatewayItem?.label || 'Online Payment Gateway'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Total Payable
                  </span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Credit to balance: ৳{formatAmount(totalAmount)}
                  </span>
                </div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                  ৳{formatAmount(totalAmount)}
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            <div>
              <button
                type="button"
                onClick={() => handlePay(selectedGateway)}
                disabled={totalAmount < 1 || paying !== null || !selectedGateway}
                className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Connecting to {selectedGatewayItem?.label || 'Gateway'}...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>
                      Pay ৳{formatAmount(totalAmount)} via {selectedGatewayItem?.label || 'Gateway'}
                    </span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
              <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-2.5 flex items-center justify-center gap-1.5 font-medium">
                <Lock className="w-3.5 h-3.5" /> 256-bit SSL encrypted & automated instant verification
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Wallet Summary & Guidelines (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Wallet Card with Modern Gradient */}
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 text-white rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-200" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
                  Account Wallet
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-xs">
                Active
              </span>
            </div>

            <div>
              <div className="text-xs text-blue-100 font-medium">Available Balance</div>
              <div className="text-3xl font-black tracking-tight mt-1 font-mono">
                ৳{formatAmount(currentBalance)}
              </div>
            </div>

            <div className="pt-3 border-t border-white/15 space-y-2 text-xs">
              <div className="flex items-center justify-between text-blue-100">
                <span>Account Holder:</span>
                <span className="font-semibold text-white">
                  {user?.username || 'user'}
                </span>
              </div>
              <div className="flex items-center justify-between text-blue-100">
                <span>Account Role:</span>
                <span className="font-semibold text-white capitalize">
                  {user?.role_code || user?.role || 'Admin'}
                </span>
              </div>
              <div className="flex items-center justify-between text-blue-100">
                <span>After This Topup:</span>
                <span className="font-bold text-emerald-300 font-mono">
                  ৳{formatAmount(projectedBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* How It Works Guide */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                How It Works
              </h3>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold flex-shrink-0 text-xs">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">Enter Amount</h4>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Select a preset or enter the amount you wish to deposit.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold flex-shrink-0 text-xs">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">Pick Gateway</h4>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Select bKash, Nagad, Card, or Internet Banking.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold flex-shrink-0 text-xs">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">Complete Authorization</h4>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Authorize via OTP/PIN on the official secure portal.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 text-xs">
                  4
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">Instant Balance Update</h4>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Your balance is updated automatically without manual intervention.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Security & Protection Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Security & Compliance
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Transactions are encrypted with high-grade TLS/SSL protocols. NetFix SaaS never stores your PIN or sensitive credentials. All payments are verified via direct webhook callbacks.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Area: Recent Topup & Wallet Ledger History */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Recent Wallet Ledger & Topup History
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Audit log of your balance deposits, commissions, and transaction references
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative w-full sm:w-60">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search references..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              />
            </div>
            <button
              type="button"
              onClick={fetchLedgerHistory}
              disabled={loadingLedger}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shadow-xs"
              title="Refresh History"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLedger ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          {loadingLedger ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium">Loading ledger transactions...</span>
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <History className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No recent transactions found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your completed balance topups and ledger movements will appear here automatically.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Reference / Trx ID</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3 text-right">Credit (+)</th>
                  <th className="py-3 px-3 text-right">Debit (-)</th>
                  <th className="py-3 px-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                {filteredLedger.slice(0, 15).map((row) => {
                  const credit = parseFloat(String(row.credit || 0));
                  const debit = parseFloat(String(row.debit || 0));
                  const refId = row.reference_id || `TX-${row.ledger_id}`;
                  const isCopied = copiedRef === refId;
                  const isTopup = row.reference_type === 'ONLINE_TOPUP';

                  return (
                    <tr
                      key={row.ledger_id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {refId}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyRefToClipboard(refId)}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            title="Copy Reference"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isTopup
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : credit > 0
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {row.reference_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right font-mono font-bold text-xs">
                        {credit > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +৳{formatAmount(credit)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right font-mono font-bold text-xs">
                        {debit > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            -৳{formatAmount(debit)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {row.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
