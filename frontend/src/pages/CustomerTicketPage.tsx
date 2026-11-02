import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { customerPortalService } from '@/services/customer-portal.service';
import { TableRowSkeleton } from '@/components/customer-portal';

function formatDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString();
  } catch {
    return '—';
  }
}

function statusBadge(status: string) {
  const s = (status || '').toLowerCase();
  const classes =
    s === 'resolved' || s === 'closed'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      : s === 'in_progress'
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-xl text-xs font-medium ${classes}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function CustomerTicketPage() {
  const [tickets, setTickets] = useState<Array<{
    ticket_id: string;
    ticket_number: string;
    title: string;
    description: string | null;
    status: string;
    assigned_to: string | null;
    created_at: string;
  }>>([]);
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
      setCreateError('Title must be at least 3 characters');
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
      setCreateError(err?.response?.data?.message || err?.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 lg:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Ticket className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          Ticket
        </h1>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => {
            setShowCreate(true);
            setCreateError(null);
            setCreateTitle('');
            setCreateDesc('');
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-2xl shadow-lg shadow-blue-500/25 transition-all duration-200"
        >
          <Plus className="w-5 h-5" />
          Create a New Ticket
        </motion.button>
      </div>

      <motion.section
        whileHover={{ y: -1 }}
        className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 overflow-hidden transition-all duration-300"
      >
        <h2 className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-700/60 font-semibold text-slate-900 dark:text-slate-100">
          Ticket History
        </h2>
        {loading ? (
          <div className="p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 text-left text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Ticket ID</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRowSkeleton key={i} cols={6} />
                ))}
              </tbody>
            </table>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No tickets yet. Create a ticket to get support.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 text-left text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 font-semibold">Ticket ID</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t, i) => (
                    <motion.tr
                      key={t.ticket_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors duration-200"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{t.ticket_number}</td>
                      <td className="px-4 py-3">{statusBadge(t.status)}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.title}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                        {t.description || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(t.created_at)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{t.assigned_to || '—'}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          </>
        )}
      </motion.section>

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreate(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100">Create a New Ticket</h3>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {createError && (
                <p className="mb-3 p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  {createError}
                </p>
              )}
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                  <input
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Brief subject"
                    required
                    minLength={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                  <textarea
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
                    rows={3}
                    placeholder="Details (optional)"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={submitting || createTitle.trim().length < 3}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-2xl shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all"
                  >
                    {submitting ? 'Creating…' : 'Create'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
