import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Minus, Plus, Wallet, Calendar, Package, Receipt, CheckCircle2, Loader2 } from 'lucide-react';
import { customerPortalService, CustomerDashboardData, CustomerInvoiceItem, PaymentMethodItem } from '@/services/customer-portal.service';
import { formatInvoiceIdDisplay } from '@/lib/formatInvoiceId';
import { PortalSkeleton } from '@/components/customer-portal';

function formatDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function formatAmount(n: number): string {
  return Number(n).toLocaleString();
}

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const itemUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

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

  const handlePay = async (invoiceId?: string, gateway: 'bkash' | 'ssl' = 'bkash', payingKey?: string) => {
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
      setError('Could not start payment. Try again.');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Payment initiation failed.');
    } finally {
      setPaying(null);
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 lg:p-6 max-w-4xl mx-auto"
      >
        <PortalSkeleton className="h-8 w-40 mb-6 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <PortalSkeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <PortalSkeleton className="h-80 rounded-2xl" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6"
    >
      <div>
        <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          Pay Bill
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
          Pay outstanding invoices or renew your package
        </p>
      </div>

      {/* Summary cards */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <motion.section
          variants={itemUp}
          whileHover={{ y: -2 }}
          className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 p-5 transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {balanceDue < 0 ? 'Balance Due' : 'Balance (Credit)'}
              </p>
              <p className={`text-lg font-bold ${balanceDue < 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                ৳{formatAmount(balanceDue < 0 ? Math.abs(balanceDue) : balanceDue)}
                {balanceDue < 0 ? ' (due)' : ' (credit)'}
              </p>
            </div>
          </div>
        </motion.section>
        <motion.section
          variants={itemUp}
          whileHover={{ y: -2 }}
          className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 p-5 transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Package
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                {currentPackage}
              </p>
            </div>
          </div>
        </motion.section>
        <motion.section
          variants={itemUp}
          whileHover={{ y: -2 }}
          className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 p-5 transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Expires
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {formatDate(expiryDate)}
              </p>
            </div>
          </div>
        </motion.section>
      </motion.div>

      {/* Amount selection */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        whileHover={{ y: -2 }}
        className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 p-6 transition-all duration-300"
      >
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Choose what to pay
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <button
            type="button"
            onClick={() => { setMode('renew'); setSelectedInvoice(null); setCustomAmount(''); }}
            className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
              mode === 'renew'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
            }`}
          >
            <div className="font-semibold text-slate-900 dark:text-slate-100">Renew</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Extend by months
            </p>
          </button>
          {outstandingInvoices.length > 0 && (
            <button
              type="button"
              onClick={() => { setMode('invoice'); setCustomAmount(''); }}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                mode === 'invoice'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">Outstanding</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {outstandingInvoices.length} invoice{outstandingInvoices.length !== 1 ? 's' : ''}
              </p>
            </button>
          )}
          <button
            type="button"
            onClick={() => { setMode('custom'); setSelectedInvoice(null); }}
            className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
              mode === 'custom'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
            }`}
          >
            <div className="font-semibold text-slate-900 dark:text-slate-100">Custom</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enter amount
            </p>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'renew' && (
            <motion.div
              key="renew"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-wrap items-center gap-4"
            >
              <span className="text-slate-600 dark:text-slate-400 text-sm">Bill for:</span>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => setMonths((m) => Math.max(1, m - 1))}
                  className="w-11 h-11 rounded-xl border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                >
                  <Minus className="w-5 h-5" />
                </motion.button>
                <span className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 min-w-[2rem] text-center">
                  {months}
                </span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => setMonths((m) => m + 1)}
                  className="w-11 h-11 rounded-xl border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                >
                  <Plus className="w-5 h-5" />
                </motion.button>
              </div>
              <span className="text-slate-500 dark:text-slate-400 text-sm">
                Month{months !== 1 ? 's' : ''} × ৳{formatAmount(planPrice)} = ৳{formatAmount(Math.round(planPrice * months))}
                {dueBalanceAmount > 0 && (
                  <> + Due ৳{formatAmount(dueBalanceAmount)} = ৳{formatAmount(Math.round(planPrice * months) + dueBalanceAmount)}</>
                )}
              </span>
            </motion.div>
          )}

          {mode === 'invoice' && outstandingInvoices.length > 0 && (
            <motion.div
              key="invoice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <p className="text-sm text-slate-600 dark:text-slate-400">Select an invoice to pay:</p>
              <div className="flex flex-wrap gap-2">
                {outstandingInvoices.map((inv) => (
                  <button
                    key={inv.invoiceId}
                    type="button"
                    onClick={() => setSelectedInvoice(selectedInvoice?.invoiceId === inv.invoiceId ? null : inv)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-left transition-all ${
                      selectedInvoice?.invoiceId === inv.invoiceId
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {selectedInvoice?.invoiceId === inv.invoiceId && (
                      <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    )}
                    <span className="font-medium text-slate-900 dark:text-slate-100">{formatInvoiceIdDisplay(inv.invoiceNumber)}</span>
                    <span className="text-sm text-amber-600 dark:text-amber-400">৳{formatAmount(inv.balanceDue ?? 0)}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {mode === 'custom' && (
            <motion.div
              key="custom"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Enter amount (BDT)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="e.g. 500"
                className="w-full max-w-xs px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1">
          {mode === 'renew' && dueBalanceAmount > 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Package: ৳{formatAmount(Math.round(planPrice * months))} + Due Balance: ৳{formatAmount(dueBalanceAmount)}
            </p>
          )}
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Total:{' '}
            <span className="text-blue-600 dark:text-blue-400">৳{formatAmount(totalAmount)}</span>
          </p>
        </div>
      </motion.section>

      {/* Payment method */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        whileHover={{ y: -2 }}
        className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 p-6 transition-all duration-300"
      >
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4">
          Payment method
        </h2>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm border border-red-200/50 dark:border-red-800/50"
          >
            {error}
          </motion.p>
        )}

        <div
          className={
            paymentMethods.length === 1
              ? 'flex justify-center'
              : paymentMethods.length === 2
                ? 'w-[90%] max-w-md mx-auto grid grid-cols-2 gap-4'
                : 'grid grid-cols-2 gap-4'
          }
        >
          {paymentMethods.map((method) => {
            const gateway = method.gateway as 'bkash' | 'ssl' | 'surjopay';
            const isBkash = gateway === 'bkash';
            const isSsl = gateway === 'ssl';
            const isPaying = paying === gateway;
            const borderHover = isBkash
              ? 'hover:border-pink-400 dark:hover:border-pink-500 hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-50 dark:hover:from-pink-900/20 dark:hover:to-rose-900/20'
              : isSsl
                ? 'hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20'
                : 'hover:border-orange-400 dark:hover:border-orange-500 hover:bg-gradient-to-br hover:from-orange-50 hover:to-amber-50 dark:hover:from-orange-900/20 dark:hover:to-amber-900/20';
            const accentBg = isBkash ? 'bg-pink-400/10' : isSsl ? 'bg-blue-400/10' : 'bg-orange-400/10';
            const iconGradient = isBkash ? 'from-pink-500 to-rose-600' : isSsl ? 'from-blue-500 to-indigo-600' : 'from-orange-500 to-amber-600';
            const accentColor = isBkash ? 'text-pink-600 dark:text-pink-400' : isSsl ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400';
            const payGateway = gateway === 'surjopay' ? 'ssl' : gateway;
            return (
              <motion.button
                key={method.gateway}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => handlePay(selectedInvoice?.invoiceId, payGateway, gateway)}
                disabled={totalAmount < 1 || paying !== null}
                className={`relative p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-600 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${borderHover} ${paymentMethods.length === 1 ? 'max-w-sm w-full' : ''}`}
              >
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full ${accentBg} -translate-y-1/2 translate-x-1/2`} />
                <div className="relative flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconGradient} flex items-center justify-center text-white shadow-lg`}>
                    {isSsl || gateway === 'surjopay' ? <CreditCard className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">{method.label}</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isPaying ? (
                        <span className={`inline-flex items-center gap-1.5 ${accentColor}`}>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Redirecting…
                        </span>
                      ) : (
                        method.description
                      )}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.section>
    </motion.div>
  );
}
