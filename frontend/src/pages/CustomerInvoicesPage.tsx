import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { billingService, InvoiceDto } from '@/services/billing.service';
import { formatInvoiceIdDisplay } from '@/lib/formatInvoiceId';

function DocumentTextIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function PrinterIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2h-2m-4-1v8m0 0l-4-4m4 4l4-4" />
    </svg>
  );
}

function CurrencyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function formatDateTime(s: string) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).replace(/\//g, '-');
  } catch {
    return s;
  }
}

function formatDateOnly(s: string) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).replace(/\//g, '-');
  } catch {
    return s;
  }
}

function getDescription(inv: InvoiceDto) {
  if (inv.notes?.trim()) return inv.notes.trim();
  if (inv.renewMode) return inv.renewMode === 'RESELLER' ? 'Renew Bill (Reseller)' : inv.renewMode;
  return 'Renew Bill';
}

export default function CustomerInvoicesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInvoices = () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    billingService
      .getCustomerInvoices(id, statusFilter || undefined)
      .then((res) => {
        if (res.success && res.data) setInvoices(res.data);
        else setInvoices([]);
      })
      .catch((err) => {
        setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load invoices.');
        setInvoices([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Customer ID is missing.');
      return;
    }
    fetchInvoices();
  }, [id, statusFilter]);

  const filteredInvoices = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.trim().toLowerCase();
    return invoices.filter(
      (inv) =>
        String(inv.invoiceId).toLowerCase().includes(q) ||
        String(inv.invoiceNumber).toLowerCase().includes(q) ||
        String(inv.doneBy ?? '').toLowerCase().includes(q) ||
        getDescription(inv).toLowerCase().includes(q) ||
        String(inv.notes ?? '').toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const paginatedInvoices = useMemo(() => {
    return filteredInvoices.slice(0, entriesPerPage);
  }, [filteredInvoices, entriesPerPage]);

  const isPaid = (inv: InvoiceDto) => (inv.status || '').toLowerCase() === 'paid';
  const canCancelOrReturn = (inv: InvoiceDto) => isPaid(inv) && inv.isLastPaidInvoice === true;
  /** Invoice expire date (dueDate) past hole Cancel+Return button hide */
  const isInvoiceExpired = (inv: InvoiceDto) => {
    if (!inv.dueDate) return false;
    const due = new Date(inv.dueDate);
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
  };
  const showCancelReturnButtons = (inv: InvoiceDto) => canCancelOrReturn(inv) && !isInvoiceExpired(inv);

  const handleCancel = async (inv: InvoiceDto) => {
    if (!canCancelOrReturn(inv)) return;
    const result = await Swal.fire({
      title: 'Cancel invoice?',
      text: `Invoice #${formatInvoiceIdDisplay(inv.invoiceNumber || inv.invoiceId)} will be fully refunded.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, cancel',
    });
    if (!result.isConfirmed) return;
    setActionLoading(inv.invoiceId);
    try {
      await billingService.cancelInvoice(inv.invoiceId);
      await Swal.fire({ title: 'Cancelled', text: 'Invoice has been cancelled.', icon: 'success' });
      fetchInvoices();
    } catch (err: any) {
      Swal.fire({
        title: 'Error',
        text: err?.response?.data?.message ?? err?.message ?? 'Failed to cancel invoice.',
        icon: 'error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReturn = async (inv: InvoiceDto) => {
    if (!canCancelOrReturn(inv)) return;
    const result = await Swal.fire({
      title: 'Return invoice?',
      text: `Process return for invoice #${formatInvoiceIdDisplay(inv.invoiceNumber || inv.invoiceId)}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0ea5e9',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, return',
    });
    if (!result.isConfirmed) return;
    setActionLoading(inv.invoiceId);
    try {
      const res = await billingService.returnInvoice(inv.invoiceId);
      await Swal.fire({
        title: 'Return processed',
        text: res?.message ?? `Return amount: ${res?.returnAmount ?? 0}`,
        icon: 'success',
      });
      fetchInvoices();
    } catch (err: any) {
      Swal.fire({
        title: 'Error',
        text: err?.response?.data?.message ?? err?.message ?? 'Failed to process return.',
        icon: 'error',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePrint = (inv: InvoiceDto) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Invoice ${formatInvoiceIdDisplay(inv.invoiceNumber || inv.invoiceId)}</title>
      <style>body{font-family:sans-serif;padding:24px;max-width:600px;margin:0 auto;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background:#f5f5f5;}</style>
      </head><body>
<h1>Invoice ${formatInvoiceIdDisplay(inv.invoiceNumber || inv.invoiceId)}</h1>
              <p><strong>Inv ID:</strong> ${formatInvoiceIdDisplay(inv.invoiceId)}</p>
      <p><strong>Inv Time:</strong> ${formatDateTime(inv.createdAt)}</p>
      <p><strong>Expire Time:</strong> ${formatDateOnly(inv.dueDate)}</p>
      <p><strong>Bill:</strong> ${formatInvoiceIdDisplay(inv.invoiceNumber)}</p>
      <p><strong>Done By:</strong> ${inv.doneBy ?? '—'}</p>
      <p><strong>Description:</strong> ${getDescription(inv)}</p>
      <p><strong>Remarks:</strong> ${inv.notes ?? '—'}</p>
      <p><strong>Total:</strong> ৳${Number(inv.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      <p><strong>Status:</strong> ${inv.status}</p>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <button
            type="button"
            onClick={() => navigate(`/dashboard/customers/view/${id}`)}
            className="self-start px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            ← Back to customer
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="status-filter" className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Status:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partially_paid">Partially paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/60 dark:border-slate-600/80 shadow-xl p-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/40">
              <DocumentTextIcon className="w-5 h-5 text-sky-600 dark:text-teal-400" />
            </span>
            Client Invoices: {id ?? '—'}
          </h1>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-sky-500 border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="entries" className="text-sm text-slate-600 dark:text-slate-400">
                    Show
                  </label>
                  <select
                    id="entries"
                    value={entriesPerPage}
                    onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                    className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-slate-600 dark:text-slate-400">entries</span>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="search" className="text-sm text-slate-600 dark:text-slate-400">
                    Search:
                  </label>
                  <input
                    id="search"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter invoices..."
                    className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1.5 text-sm min-w-[180px]"
                  />
                </div>
              </div>

              {filteredInvoices.length === 0 ? (
                <p className="text-slate-600 dark:text-slate-400 py-8 text-center">No invoices found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-600">
                        <th className="pb-2 pr-2 font-semibold text-slate-700 dark:text-slate-300">Inv ID</th>
                        <th className="pb-2 pr-2 font-semibold text-slate-700 dark:text-slate-300">Inv Time</th>
                        <th className="pb-2 pr-2 font-semibold text-slate-700 dark:text-slate-300">Expire Time</th>
                        <th className="pb-2 pr-2 font-semibold text-slate-700 dark:text-slate-300">Method</th>
                        <th className="pb-2 pr-2 font-semibold text-slate-700 dark:text-slate-300">Bill</th>
                        <th className="pb-2 pr-2 font-semibold text-slate-700 dark:text-slate-300">Done By</th>
                        <th className="pb-2 pr-2 font-semibold text-slate-700 dark:text-slate-300">Description</th>
                        <th className="pb-2 pr-2 font-semibold text-slate-700 dark:text-slate-300">Remarks</th>
                        <th className="pb-2 pl-2 font-semibold text-slate-700 dark:text-slate-300 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedInvoices.map((inv) => (
                        <tr
                          key={inv.invoiceId}
                          className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30"
                        >
                          <td className="py-2 pr-2 text-slate-800 dark:text-slate-200">{formatInvoiceIdDisplay(inv.invoiceId)}</td>
                          <td className="py-2 pr-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formatDateTime(inv.createdAt)}
                          </td>
                          <td className="py-2 pr-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formatDateOnly(inv.dueDate)}
                          </td>
                          <td className="py-2 pr-2 text-slate-600 dark:text-slate-400">—</td>
                          <td className="py-2 pr-2 text-slate-800 dark:text-slate-200">{formatInvoiceIdDisplay(inv.invoiceNumber) || '—'}</td>
                          <td className="py-2 pr-2 text-slate-600 dark:text-slate-400">{inv.doneBy ?? '—'}</td>
                          <td className="py-2 pr-2 text-slate-600 dark:text-slate-400">{getDescription(inv)}</td>
                          <td className="py-2 pr-2 text-slate-600 dark:text-slate-400">{inv.notes ?? '—'}</td>
                          <td className="py-2 pl-2 text-right">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              {showCancelReturnButtons(inv) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleCancel(inv)}
                                    disabled={actionLoading === inv.invoiceId}
                                    title="Cancel invoice"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-red-500 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {actionLoading === inv.invoiceId ? (
                                      <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                                    ) : (
                                      <XCircleIcon className="w-3.5 h-3.5" />
                                    )}
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReturn(inv)}
                                    disabled={actionLoading === inv.invoiceId}
                                    title="Return"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-sky-400 hover:bg-sky-500 text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {actionLoading === inv.invoiceId ? (
                                      <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                                    ) : (
                                      <CurrencyIcon className="w-3.5 h-3.5" />
                                    )}
                                    Return
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handlePrint(inv)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium"
                              >
                                <PrinterIcon className="w-3.5 h-3.5" />
                                Print
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
