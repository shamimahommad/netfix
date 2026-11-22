import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Receipt,
  Calendar,
  CreditCard,
  ArrowUpRight,
} from 'lucide-react';
import {
  customerPortalService,
  CustomerPaymentHistoryItem,
} from '@/services/customer-portal.service';

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
  if (s === 'paid' || s === 'completed') {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80';
  }
  if (s === 'failed' || s === 'overdue' || s === 'expired') {
    return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
  }
  if (s === 'pending' || s === 'partial') {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
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
        setPayments(res.data || []);
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
              Financial Statements
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Receipt Ledger
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            Payment History & Receipts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified subscriber transactions, invoice receipts & recharge records
          </p>
        </div>

        {meta && (
          <div className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Total Records: <strong className="text-slate-900 dark:text-slate-100">{meta.total}</strong>
          </div>
        )}
      </div>

      {/* ────────────────── TOP STATS (2 Compact Side-by-Side Cards) ────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        {/* Total Paid */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold truncate">
              Total Settled
            </p>
            <p className="text-base sm:text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate">
              ৳{formatAmount(totalPaid)}
            </p>
          </div>
        </div>

        {/* Transactions Count */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/60 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold truncate">
              Transactions
            </p>
            <p className="text-base sm:text-xl font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
              {meta?.total ?? payments.length}{' '}
              <span className="text-[11px] font-sans font-normal text-slate-400">
                ({paidCount} paid)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ────────────────── PAYMENT STATEMENTS LIST ────────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <CreditCard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Verified Billing Ledger
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            Page {page} of {totalPages}
          </span>
        </div>

        {loading ? (
          <div className="p-4 sm:p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 font-mono">
            No previous payment statements found.
          </div>
        ) : (
          <>
            {/* MOBILE VIEW (< sm): Clean native transaction cards */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {payments.map((p) => (
                <div key={p.paymentId} className="p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {p.tranId}
                    </span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${getStatusStyle(
                        p.status
                      )}`}
                    >
                      {p.status || 'Paid'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {formatDate(p.paidAt)}
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      ৳{formatAmount(p.amount ?? 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                    <span className="font-mono uppercase font-semibold text-slate-700 dark:text-slate-300">
                      Gateway: {p.gateway || 'CASH'}
                    </span>
                    {(p.remarks || p.doneBy) && (
                      <span className="truncate max-w-[170px] text-slate-400">
                        {p.remarks || `By ${p.doneBy}`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP VIEW (>= sm): Structured ledger rows */}
            <div className="hidden sm:block overflow-x-auto customer-portal-scrollbar">
              <table className="w-full text-left text-xs font-mono min-w-[500px] whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Transaction #</th>
                    <th className="px-4 py-3">Gateway</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.map((p) => (
                    <tr
                      key={p.paymentId}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-sans">
                        {formatDate(p.paidAt)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {p.tranId}
                      </td>
                      <td className="px-4 py-3 uppercase font-medium text-slate-600 dark:text-slate-300">
                        {p.gateway || 'CASH'}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ৳{formatAmount(p.amount ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${getStatusStyle(
                            p.status
                          )}`}
                        >
                          {p.status || 'Paid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800 transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <span className="text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800 transition-all"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </motion.div>
  );
}
