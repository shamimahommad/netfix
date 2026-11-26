import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Minus,
  Plus,
  Wallet,
  Calendar,
  Package,
  Receipt,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  customerPortalService,
  CustomerDashboardData,
  CustomerInvoiceItem,
  PaymentMethodItem,
} from '@/services/customer-portal.service';
import { formatInvoiceIdDisplay } from '@/lib/formatInvoiceId';
import { PortalSkeleton } from '@/components/customer-portal';

function formatDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatAmount(n: number): string {
  return Number(n).toLocaleString();
}

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const itemUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

export default function CustomerPayBillPage() {
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [invoices, setInvoices] = useState<CustomerInvoiceItem[]>([]);
  const [months, setMonths] = useState(1);
  const [mode, setMode] = useState<'renew' | 'custom' | 'invoice'>('renew');
  const [customAmount, setCustomAmount] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<CustomerInvoiceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      customerPortalService.getDashboard(),
      customerPortalService.getInvoices(1, 50),
      customerPortalService.getPaymentMethods(),
    ])
      .then(([dashRes, invRes, methods]) => {
        setData(dashRes.data);
        setInvoices(invRes.data || []);
        setPaymentMethods(Array.isArray(methods) ? methods : []);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const planPrice = data?.planPrice ?? 0;
  const balanceDue = data?.balance ?? 0;
  const dueBalanceAmount = balanceDue < 0 ? Math.abs(balanceDue) : 0;
  const currentPackage = data?.packageName || '—';
  const expiryDate = data?.expiryDate ?? null;

  const outstandingInvoices = invoices.filter((inv) => (inv.balanceDue ?? 0) > 0);

  const getAmountForPayment = (): number => {
    if (mode === 'invoice' && selectedInvoice && (selectedInvoice.balanceDue ?? 0) > 0) {
      return selectedInvoice.balanceDue ?? 0;
    }
    if (mode === 'custom' && customAmount) {
      const n = parseFloat(customAmount.replace(/,/g, ''));
      return isNaN(n) || n < 1 ? 0 : Math.round(n);
    }
    const packageTotal = Math.round(planPrice * months);
    return packageTotal + dueBalanceAmount;
  };

  const totalAmount = getAmountForPayment();

  const handlePay = async (invoiceId?: string, gateway: string = 'bkash', payingKey?: string) => {
    if (totalAmount < 1) return;
    if (mode === 'renew' && months < 1) return;
    setPaying(payingKey ?? gateway);
    setError(null);
    try {
      const res =
        mode === 'renew'
          ? await customerPortalService.initiateRenewPayment(months, gateway)
          : await customerPortalService.initiatePayment(totalAmount, invoiceId, gateway);
      if (res?.payment_url) {
        window.location.href = res.payment_url;
        return;
      }
      setError('Could not initiate online payment gateway. Please try again.');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Payment initiation failed.');
    } finally {
      setPaying(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <PortalSkeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <PortalSkeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <PortalSkeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="max-w-4xl mx-auto space-y-4 sm:space-y-6"
    >
      {/* ────────────────── HEADER ────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Billing Center
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Instant Online Recharge
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            Pay Bill & Renew Plan
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pay outstanding invoices or recharge subscription via mobile banking & cards
          </p>
        </div>

        <div className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            256-Bit Secure Gateway
          </span>
        </div>
      </div>

      {/* ────────────────── 1. ACCOUNT SUMMARY INSTRUMENTS ────────────────── */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
      >
        {/* Instrument 1: Balance / Due */}
        <motion.div
          variants={itemUp}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-800/60 shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              {balanceDue < 0 ? 'Balance Due' : 'Account Balance'}
            </p>
            <p className={`text-lg sm:text-xl font-mono font-bold tabular-nums truncate ${balanceDue < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              ৳{formatAmount(balanceDue < 0 ? Math.abs(balanceDue) : balanceDue)}
              <span className="text-xs font-normal text-slate-400 ml-1">
                {balanceDue < 0 ? '(due)' : '(current)'}
              </span>
            </p>
          </div>
        </motion.div>

        {/* Instrument 2: Active Plan */}
        <motion.div
          variants={itemUp}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/60 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Current Plan
            </p>
            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {currentPackage}
            </p>
            <p className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
              {planPrice > 0 ? `৳${formatAmount(planPrice)} / mo` : '—'}
            </p>
          </div>
        </motion.div>

        {/* Instrument 3: Validity Date */}
        <motion.div
          variants={itemUp}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center gap-3.5"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Expiry Date
            </p>
            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
              {formatDate(expiryDate)}
            </p>
            <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
              Auto-renews on recharge
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* ────────────────── 2. PAYMENT MODE & AMOUNT ────────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-3 sm:mb-4 flex items-center gap-2">
          <Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Select Recharge Option
        </h2>

        {/* Mode Selector (Thumb-friendly 3 tabs) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('renew');
              setSelectedInvoice(null);
              setCustomAmount('');
            }}
            className={`p-2.5 sm:p-4 rounded-xl border-2 text-center sm:text-left transition-all duration-150 ${
              mode === 'renew'
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="font-semibold text-xs sm:text-sm">Renew Plan</div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              By months
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('invoice');
              setCustomAmount('');
            }}
            className={`p-2.5 sm:p-4 rounded-xl border-2 text-center sm:text-left transition-all duration-150 ${
              mode === 'invoice'
                ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="font-semibold text-xs sm:text-sm">Invoices</div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {outstandingInvoices.length} due
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('custom');
              setSelectedInvoice(null);
            }}
            className={`p-2.5 sm:p-4 rounded-xl border-2 text-center sm:text-left transition-all duration-150 ${
              mode === 'custom'
                ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="font-semibold text-xs sm:text-sm">Custom</div>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Any amount
            </p>
          </button>
        </div>

        {/* Dynamic Mode Forms */}
        <AnimatePresence mode="wait">
          {mode === 'renew' && (
            <motion.div
              key="renew"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Months to Extend:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMonths((m) => Math.max(1, m - 1))}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors active:scale-95"
                    title="Decrease month"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-base sm:text-lg font-mono font-bold text-slate-900 dark:text-slate-100 min-w-[2rem] text-center">
                    {months}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMonths((m) => m + 1)}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors active:scale-95"
                    title="Increase month"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {months} month{months > 1 ? 's' : ''} × ৳{formatAmount(planPrice)}
                {dueBalanceAmount > 0 && (
                  <span className="text-rose-600 dark:text-rose-400"> + Due ৳{formatAmount(dueBalanceAmount)}</span>
                )}
              </div>
            </motion.div>
          )}

          {mode === 'invoice' && (
            <motion.div
              key="invoice"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-2.5"
            >
              {outstandingInvoices.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-500">
                  No unpaid invoices found. All statements are settled.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {outstandingInvoices.map((inv) => (
                    <button
                      key={inv.invoiceId}
                      type="button"
                      onClick={() => setSelectedInvoice(selectedInvoice?.invoiceId === inv.invoiceId ? null : inv)}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all ${
                        selectedInvoice?.invoiceId === inv.invoiceId
                          ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/40'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {selectedInvoice?.invoiceId === inv.invoiceId && (
                          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                          {formatInvoiceIdDisplay(inv.invoiceNumber)}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                        ৳{formatAmount(inv.balanceDue ?? 0)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {mode === 'custom' && (
            <motion.div
              key="custom"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-2"
            >
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Enter Amount to Recharge (BDT ৳)
              </label>
              <div className="relative max-w-sm">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">
                  ৳
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="e.g. 500"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Calculated Total Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Total Amount to Pay</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-slate-900 dark:text-slate-100">
              ৳{formatAmount(totalAmount)}
            </span>
          </div>

          <span className="text-xs font-mono text-slate-400">
            {totalAmount > 0 ? 'Ready for gateway' : 'Select amount'}
          </span>
        </div>
      </section>

      {/* ────────────────── 3. SELECT PAYMENT GATEWAY ────────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-3 sm:mb-4">
          Select Payment Gateway
        </h2>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-800">
            {error}
          </div>
        )}

        {/* GATEWAY BUTTONS: 1 Column on Mobile, 2 Columns on Tablet/Desktop (NEVER cramped grid-cols-2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {paymentMethods.length === 0 ? (
            <div className="col-span-full p-6 text-center text-xs text-slate-400 font-mono bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              No online payment gateways configured. Please contact support.
            </div>
          ) : (
            paymentMethods.map((method) => {
              const gateway = method.gateway as 'bkash' | 'ssl' | 'surjopay';
              const isBkash = gateway === 'bkash';
              const isPaying = paying === gateway;

              return (
                <button
                  key={method.gateway}
                  type="button"
                  onClick={() => handlePay(selectedInvoice?.invoiceId, method.gateway, method.gateway)}
                  disabled={totalAmount < 1 || paying !== null}
                  className={`relative p-3.5 sm:p-4 rounded-xl border-2 transition-all duration-150 text-left flex items-center justify-between gap-3 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isBkash
                      ? 'border-pink-200 dark:border-pink-900/60 hover:border-pink-500 bg-pink-50/30 dark:bg-pink-950/20'
                      : 'border-blue-200 dark:border-blue-900/60 hover:border-blue-500 bg-blue-50/30 dark:bg-blue-950/20'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 font-bold ${
                        isBkash
                          ? 'bg-gradient-to-br from-pink-500 to-rose-600'
                          : 'bg-gradient-to-br from-blue-600 to-indigo-700'
                      }`}
                    >
                      {isBkash ? <Wallet className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {method.label}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {method.description || 'Fast & secure checkout'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm">
                    {isPaying ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    ) : (
                      <>
                        <span>Pay ৳{formatAmount(totalAmount)}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>
    </motion.div>
  );
}
