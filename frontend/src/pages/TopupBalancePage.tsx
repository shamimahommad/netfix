import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CreditCard, Wallet, Loader2, ArrowRight } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { PageHeader, MetricCard } from '@/components/common';

type PaymentMethodItem = {
  gateway: string;
  label: string;
  description: string;
};

function formatAmount(n: number): string {
  return Number(n).toLocaleString();
}

export default function TopupBalancePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resultParam = searchParams.get('result');
  const statusParam = searchParams.get('status');
  const paymentID = searchParams.get('paymentID') || searchParams.get('payment_id') || '';
  const { user, balance, refreshMe } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const hasShownResultToast = useRef(false);
  const hasAttemptedConfirm = useRef(false);
  const retryCountRef = useRef(0);

  const isSuccess = resultParam === 'success' || statusParam === 'success';

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  useEffect(() => {
    const tenantId = user?.tenant_id ?? null;
    if (!tenantId) {
      setPaymentMethods([]);
      return;
    }
    api
      .get<PaymentMethodItem[]>('/public/topup/payment-methods', { params: { tenant_id: tenantId } })
      .then(({ data }) => setPaymentMethods(Array.isArray(data) ? data : []))
      .catch(() => setPaymentMethods([]));
  }, [user?.tenant_id]);

  const confirmBalanceTopup = useCallback(async () => {
    if (!paymentID) return;
    setConfirming(true);
    setError(null);
    try {
      await api.post('/payments/confirm-balance-topup', { paymentID });
      setConfirmDone(true);
      await refreshMe();
      if (!hasShownResultToast.current) {
        hasShownResultToast.current = true;
        Swal.fire({
          icon: 'success',
          title: 'Payment Successful',
          text: 'Your balance has been updated.',
          confirmButtonColor: '#2563eb',
          timer: 1500,
          timerProgressBar: true,
          showConfirmButton: false,
        });
      }
    } catch (err: any) {
      const data = err?.response?.data ?? err;
      const msg = typeof data?.message === 'string' ? data.message : Array.isArray(data?.message) ? data.message[0] : data?.message;
      const displayMsg = msg || data?.error || 'Could not confirm payment. Please contact support.';
      const isSigV4 = /Credential|Signature|SignedHeaders|X-Amz-Date/i.test(displayMsg || '');
      if (isSigV4 && retryCountRef.current < 3) {
        retryCountRef.current += 1;
        setError('Payment is being verified. Please wait…');
        setTimeout(() => confirmBalanceTopup(), 4000);
      } else {
        setError(displayMsg || 'Payment confirmation failed');
      }
    } finally {
      setConfirming(false);
    }
  }, [paymentID, refreshMe]);

  useEffect(() => {
    if (!isSuccess || !paymentID || confirmDone || hasAttemptedConfirm.current) return;
    hasAttemptedConfirm.current = true;
    confirmBalanceTopup();
  }, [isSuccess, paymentID, confirmDone, confirmBalanceTopup]);

  const totalAmount = (() => {
    const n = parseFloat(String(amount).replace(/,/g, ''));
    return isNaN(n) || n < 1 ? 0 : Math.round(n);
  })();

  const handlePay = async (gateway: string) => {
    if (totalAmount < 1) {
      setError('Enter a valid amount (min ৳1)');
      return;
    }
    setError(null);
    setPaying(gateway);
    try {
      const gw = gateway === 'sslcommerz' ? 'ssl' : gateway;
      const { data } = await api.post<{ payment_url: string }>('/payments/initiate-balance-topup', {
        amount: totalAmount,
        gateway: gw,
      });
      if (data?.payment_url) {
        window.location.href = data.payment_url;
        return;
      }
      setError('Could not start payment. Try again.');
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.message || 'Payment initiation failed';
      setError(typeof msg === 'string' ? msg : 'Try again.');
    } finally {
      setPaying(null);
    }
  };

  const currentBalance = balance ?? 0;

  return (
    <div className="w-full min-w-0 max-w-4xl space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Topup Balance"
        subtitle="Add funds to your account balance. Your balance updates automatically upon checkout."
        badge={`৳${formatAmount(currentBalance)}`}
        onBack={() => navigate('/dashboard')}
      />

      {confirming && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
          <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Confirming payment… Please wait while we update your account balance.
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          title="Current Balance"
          value={`৳${formatAmount(currentBalance)}`}
          subtext="Available credit"
          variant="emerald"
        />
        <MetricCard
          title="Account Identity"
          value={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'Tenant Admin'}
          subtext={`Role: ${user?.role_code || 'isp_admin'}`}
          variant="blue"
        />
      </div>

      {/* Amount Input Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            1. Enter Recharge Amount
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Specify the amount in BDT you would like to top up into your balance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-full sm:w-72">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-lg">৳</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="e.g. 1000"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {[500, 1000, 2000, 5000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                +৳{preset}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Total payable:</span>
          <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">৳{formatAmount(totalAmount)}</span>
        </div>
      </div>

      {/* Payment Methods Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            2. Choose Payment Method
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select an online payment gateway to securely process your deposit.
          </p>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
            No payment gateways configured for this tenant account.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {paymentMethods.map((method) => {
              const gateway = method.gateway;
              const isBkash = gateway === 'bkash';
              const isNagad = gateway === 'nagad';
              const isPaying = paying === gateway;
              const payGateway = gateway === 'sslcommerz' ? 'ssl' : gateway;

              return (
                <button
                  key={method.gateway}
                  type="button"
                  onClick={() => handlePay(payGateway)}
                  disabled={totalAmount < 1 || paying !== null}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-xs ${
                          isBkash
                            ? 'bg-pink-600'
                            : isNagad
                              ? 'bg-amber-600'
                              : 'bg-blue-600'
                        }`}
                      >
                        {isBkash ? 'bK' : isNagad ? 'Ng' : <Wallet className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {method.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {isPaying ? (
                            <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Connecting to gateway...
                            </span>
                          ) : (
                            method.description || 'Instant automated verification'
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
