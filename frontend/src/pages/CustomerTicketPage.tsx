import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquare,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { customerPortalService } from '@/services/customer-portal.service';

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

function statusBadge(status: string) {
  const s = (status || '').toLowerCase();
  const classes =
    s === 'resolved' || s === 'closed'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80'
      : s === 'in_progress'
        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80'
        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold uppercase ${classes}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          s === 'resolved' || s === 'closed'
            ? 'bg-emerald-500'
            : s === 'in_progress'
              ? 'bg-blue-500'
              : 'bg-amber-500'
        }`}
      />
      {status.replace('_', ' ')}
    </span>
  );
}

export default function CustomerTicketPage() {
  const [tickets, setTickets] = useState<
    Array<{
      ticket_id: string;
      ticket_number: string;
      title: string;
      description: string | null;
      status: string;
      assigned_to: string | null;
      created_at: string;
    }>
  >([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadTickets = () => {
    setLoading(true);
    customerPortalService
      .getTickets(page, 10)
      .then((res) => {
        setTickets(res.data || []);
        setTotalPages(res.meta?.totalPages ?? 1);
      })
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTickets();
  }, [page]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = createTitle.trim();
    if (title.length < 3) {
      setCreateError('Subject / Title must be at least 3 characters.');
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      await customerPortalService.createTicket(title, createDesc.trim() || undefined);
      setShowCreate(false);
      setCreateTitle('');
      setCreateDesc('');
      loadTickets();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || err?.message || 'Failed to create support ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="max-w-4xl mx-auto space-y-4 sm:space-y-6"
    >
      {/* ────────────────── HEADER ────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Technical Helpdesk
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              NOC Escalations
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            Support Tickets & Inquiries
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Submit issues directly to your ISP technical support team
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setCreateError(null);
            setCreateTitle('');
            setCreateDesc('');
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Open New Ticket</span>
        </button>
      </div>

      {/* ────────────────── TICKET LIST SECTION ────────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Active & Resolved Tickets
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            Page {page} of {totalPages}
          </span>
        </div>

        {loading ? (
          <div className="p-4 sm:p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 font-mono">
            No support tickets logged. Fiber link is performing normally.
          </div>
        ) : (
          <>
            {/* MOBILE VIEW (< sm): Clean ticket cards (zero horizontal scroll needed!) */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {tickets.map((t) => (
                <div key={t.ticket_id} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {t.ticket_number}
                    </span>
                    {statusBadge(t.status)}
                  </div>

                  <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {t.title}
                  </h3>

                  {t.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {t.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-50 dark:border-slate-800/60 font-mono">
                    <span className="flex items-center gap-1 font-sans">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatDate(t.created_at)}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 font-medium font-sans">
                      NOC: {t.assigned_to || 'Assigned'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP VIEW (>= sm): Structured table */}
            <div className="hidden sm:block overflow-x-auto customer-portal-scrollbar">
              <table className="w-full text-left text-xs font-mono min-w-[540px] whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Ticket #</th>
                    <th className="px-4 py-3">Subject / Issue</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Desk</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tickets.map((t) => (
                    <tr
                      key={t.ticket_id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">
                        {t.ticket_number}
                      </td>
                      <td className="px-4 py-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                        <div className="truncate max-w-[280px]" title={t.title}>
                          {t.title}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-sans">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-sans">
                        {t.assigned_to || 'NOC Team'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {statusBadge(t.status)}
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

      {/* ────────────────── CREATE TICKET MODAL ────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            />

            {/* Modal Box (Solid, Opaque) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
            >
              {/* Header */}
              <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
                    <Ticket className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-lg font-bold tracking-tight">
                      Open Support Ticket
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                      Submit a technical or billing inquiry to the NOC team
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleCreate} className="flex-1 overflow-y-auto customer-portal-scrollbar p-4 sm:p-6 space-y-4">
                {createError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Problem Type (সমস্যার ধরন নির্বাচন করুন)
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) setCreateTitle(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all mb-3"
                  >
                    <option value="">-- Choose issue preset --</option>
                    <option value="🔴 Optical Red LOS Light / Fiber Cut (লাল বাতি জ্বলছে / তার কাটা)">🔴 Optical Red LOS Light / Fiber Cut (লাল বাতি জ্বলছে / তার কাটা)</option>
                    <option value="🟡 Slow Speed & High Latency (ইন্টারনেট স্লো / বাফারিং)">🟡 Slow Speed & High Latency (ইন্টারনেট স্লো / বাফারিং)</option>
                    <option value="🔵 Router WiFi & Configuration (ওয়াইফাই পাসওয়ার্ড / রাউটার সমস্যা)">🔵 Router WiFi & Configuration (ওয়াইফাই পাসওয়ার্ড / রাউটার সমস্যা)</option>
                    <option value="🟢 Billing & Payment Verification (বিল বা পেমেন্ট যাচাই)">🟢 Billing & Payment Verification (বিল বা পেমেন্ট যাচাই)</option>
                    <option value="⚪ Frequent Connection Drops (সংযোগ বারবার ডিসকানেক্ট হচ্ছে)">⚪ Frequent Connection Drops (সংযোগ বারবার ডিসকানেক্ট হচ্ছে)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Subject / Issue Title (সমস্যার শিরোনাম) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="e.g. Fiber link red LED / High ping latency"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Detailed Description (বিস্তারিত বিবরণ)
                  </label>
                  <textarea
                    rows={4}
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    placeholder="Describe the issue, ONU light status, or any billing questions..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    disabled={submitting}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors disabled:opacity-50 text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-60 active:scale-95 text-center"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Submit Ticket (জমা দিন)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
