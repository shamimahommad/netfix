import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ChevronLeft, ChevronRight, Banknote, Receipt, Calendar } from 'lucide-react';
import { customerPortalService, CustomerPaymentHistoryItem } from '@/services/customer-portal.service';

function formatDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatAmount(n: number): string {
  return Number(n).toLocaleString();
}

function getStatusStyle(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'paid' || s === 'completed') return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  if (s === 'failed' || s === 'overdue' || s === 'expired') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  if (s === 'pending' || s === 'partial') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
  return 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400';
}

export default function CustomerPaymentHistoryPage() {
  const [payments, setPayments] = useState<CustomerPaymentHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [meta, setMeta] = useState<{ total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    customerPortalService
      .getPaymentHistory(page, 12)
      .then((res) => {
        setPayments(res.data);
        setTotalPages(res.meta?.totalPages ?? 1);
        setMeta(res.meta ?? null);
      })
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const paidCount = payments.filter((p) => (p.status || '').toLowerCase() === 'paid').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 lg:p-6 space-y-6"
    >
      <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        Payment History
      </h1>

      {!loading && payments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <motion.section
            whileHover={{ y: -2 }}
            className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 p-5 transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Paid</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatAmount(totalPaid)} ৳</p>
              </div>
            </div>
          </motion.section>
          <motion.section
            whileHover={{ y: -2 }}
            className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 p-5 transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Transactions</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {meta?.total ?? payments.length} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">(paid: {paidCount})</span>
                </p>
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}

      <motion.section
        whileHover={{ y: -2 }}
        className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 overflow-hidden transition-all duration-300"
      >
        <h2 className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-700/60 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Recent Payments
        </h2>

        {loading ? (
          <div className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 animate-pulse">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-1/4 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : payments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-16 text-center"
          >
            <div className="inline-flex p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 mb-4">
              <Receipt className="w-12 h-12 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">No payment history yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your invoices and payments will appear here</p>
          </motion.div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              <AnimatePresence mode="popLayout">
                {payments.map((p, i) => (
                  <motion.article
                    key={p.paymentId}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors duration-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-shrink-0 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                          <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{p.tranId}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(p.paidAt)}
                          </p>
                          {(p.remarks?.trim() || p.doneBy) && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate max-w-md">
                              {(p.remarks?.trim() || `Done by ${p.doneBy}`).trim()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                        <div className="text-right">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Gateway</p>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{String(p.gateway || '—').toUpperCase()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Amount</p>
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatAmount(p.amount ?? 0)} ৳</p>
                        </div>
                        <span
                          className={`inline-flex px-3 py-1 rounded-xl text-xs font-semibold ${getStatusStyle(p.status)}`}
                        >
                          {p.status || '—'}
                        </span>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-white dark:hover:bg-slate-800 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </motion.button>
                <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                  Page {page} of {totalPages}
                </span>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-white dark:hover:bg-slate-800 transition-all"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            )}
          </>
        )}
      </motion.section>
    </motion.div>
  );
}
