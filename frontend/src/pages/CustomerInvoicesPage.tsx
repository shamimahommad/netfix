import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { 
  FileText, 
  ArrowLeft, 
  Printer, 
  RotateCcw, 
  XCircle, 
  Search, 
  CreditCard, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  User, 
  Receipt,
  Download
} from 'lucide-react';
import { billingService, InvoiceDto } from '@/services/billing.service';
import { formatInvoiceIdDisplay } from '@/lib/formatInvoiceId';

function formatDateTime(s?: string) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return s;
  }
}

function formatDateOnly(s?: string) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return s;
  }
}

function getDescription(inv: InvoiceDto) {
  if (inv.notes?.trim()) return inv.notes.trim();
  if (inv.renewMode) return inv.renewMode === 'RESELLER' ? 'Renew (Reseller)' : `Renew (${inv.renewMode})`;
  if ((inv as any).packageName) return `Package: ${(inv as any).packageName}`;
  return 'Monthly Subscription';
}

export default function CustomerInvoicesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [customerInfo, setCustomerInfo] = useState<{
    customer_id?: string;
    customer_code?: string;
    full_name?: string;
    phone?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [entriesPerPage, setEntriesPerPage] = useState(15);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInvoices = () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    billingService
      .getCustomerInvoices(id, statusFilter || undefined)
      .then((res: any) => {
        if (res.success && res.data) {
          setInvoices(res.data);
          if (res.customer) {
            setCustomerInfo(res.customer);
          } else if (res.data[0]) {
            setCustomerInfo({
              customer_id: res.data[0].customerId || id,
              customer_code: res.data[0].customerCode || res.data[0].customerId || id,
              full_name: res.data[0].customerName || 'Customer',
              phone: (res.data[0] as any).customerPhone || '',
            });
          }
        } else {
          setInvoices([]);
        }
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
        String(inv.invoiceId || '').toLowerCase().includes(q) ||
        String(inv.invoiceNumber || '').toLowerCase().includes(q) ||
        String(inv.doneBy ?? '').toLowerCase().includes(q) ||
        getDescription(inv).toLowerCase().includes(q) ||
        String(inv.notes ?? '').toLowerCase().includes(q) ||
        String(inv.paymentMethod ?? (inv as any).payment_method ?? '').toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const paginatedInvoices = useMemo(() => {
    return filteredInvoices.slice(0, entriesPerPage);
  }, [filteredInvoices, entriesPerPage]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalCount = invoices.length;
    let totalBilled = 0;
    let totalPaid = 0;
    let totalDue = 0;

    invoices.forEach((inv) => {
      const amount = Number(inv.totalAmount || (inv as any).total_amount || 0);
      const paid = Number(inv.paidAmount || (inv as any).paid_amount || 0);
      const due = Number(inv.balanceDue || (inv as any).balance_due || 0);
      totalBilled += amount;
      totalPaid += paid;
      totalDue += due;
    });

    return { totalCount, totalBilled, totalPaid, totalDue };
  }, [invoices]);

  const isPaid = (inv: InvoiceDto) => (inv.status || '').toLowerCase() === 'paid';
  const canCancelOrReturn = (inv: InvoiceDto) => isPaid(inv) && inv.isLastPaidInvoice === true;

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
      title: 'Cancel Invoice?',
      text: `Invoice #${formatInvoiceIdDisplay(inv.invoiceNumber || inv.invoiceId)} will be marked as cancelled.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, cancel it',
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
      title: 'Process Return?',
      text: `Process refund/return for invoice #${formatInvoiceIdDisplay(inv.invoiceNumber || inv.invoiceId)}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0ea5e9',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, process return',
    });
    if (!result.isConfirmed) return;
    setActionLoading(inv.invoiceId);
    try {
      const res = await billingService.returnInvoice(inv.invoiceId);
      await Swal.fire({
        title: 'Return Processed',
        text: res?.message ?? `Return amount: ৳${res?.returnAmount ?? 0}`,
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
    const invNum = formatInvoiceIdDisplay(inv.invoiceNumber || inv.invoiceId);
    const total = Number(inv.totalAmount || (inv as any).total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const paid = Number(inv.paidAmount || (inv as any).paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const due = Number(inv.balanceDue || (inv as any).balance_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const clientName = customerInfo?.full_name || inv.customerName || (inv as any).customer_name || 'Valued Customer';
    const clientCode = customerInfo?.customer_code || inv.customerCode || (inv as any).customer_code || id;
    const clientPhone = customerInfo?.phone || (inv as any).customerPhone || '—';
    const method = inv.paymentMethod || (inv as any).payment_method || 'Cash';
    const date = formatDateTime(inv.createdAt || inv.invoiceDate);
    const expire = formatDateOnly(inv.dueDate);

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Invoice #${invNum} - NetFix</title>
        <style>
          * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          body { background: #fff; color: #1e293b; padding: 40px; margin: 0 auto; max-width: 720px; font-size: 13px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 25px; }
          .brand { font-size: 24px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px; }
          .badge { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; }
          .badge-paid { background: #dcfce7; color: #15803d; }
          .badge-due { background: #fef3c7; color: #b45309; }
          .badge-overdue { background: #fee2e2; color: #b91c1c; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
          .box h4 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
          .box p { margin: 3px 0; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th { background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: #475569; }
          td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; font-size: 13px; }
          .totals { margin-left: auto; width: 280px; }
          .totals-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
          .totals-row.grand { font-size: 16px; font-weight: 800; border-top: 2px solid #0284c7; border-bottom: none; padding-top: 10px; color: #0284c7; }
          .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
          @media print { body { padding: 15px; } button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">NetFix ISP Billing</div>
            <div style="color: #64748b; font-size: 12px; margin-top: 4px;">High-Speed Fiber Broadband</div>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; font-size: 18px; color: #0f172a;">INVOICE #${invNum}</h2>
            <div style="margin-top: 6px;">
              <span class="badge ${inv.status === 'paid' ? 'badge-paid' : (inv.status === 'overdue' ? 'badge-overdue' : 'badge-due')}">
                ${(inv.status || 'PAID').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <h4>Bill To Customer</h4>
            <p><strong>${clientName}</strong></p>
            <p>ID / User: <code>${clientCode}</code></p>
            <p>Phone: ${clientPhone}</p>
          </div>
          <div class="box">
            <h4>Invoice Summary</h4>
            <p><strong>Invoice Date:</strong> ${date}</p>
            <p><strong>Due / Expire:</strong> ${expire}</p>
            <p><strong>Payment Method:</strong> ${method}</p>
            <p><strong>Collector / Done By:</strong> ${inv.doneBy || 'Admin'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Period / Notes</th>
              <th style="text-align: right;">Amount (BDT)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${getDescription(inv)}</strong>
                <div style="font-size: 11px; color: #64748b;">Broadband Internet Access & Port Subscription</div>
              </td>
              <td>${inv.notes || 'Monthly Plan Renewal'}</td>
              <td style="text-align: right; font-weight: 600;">৳${total}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>৳${total}</span>
          </div>
          <div class="totals-row">
            <span>Paid Amount:</span>
            <span style="color: #15803d; font-weight: 600;">৳${paid}</span>
          </div>
          <div class="totals-row">
            <span>Balance Due:</span>
            <span style="color: #b91c1c; font-weight: 600;">৳${due}</span>
          </div>
          <div class="totals-row grand">
            <span>Total Payable:</span>
            <span>৳${total}</span>
          </div>
        </div>

        <div class="footer">
          This is a computer-generated invoice from NetFix ISP Network Automation Platform. No signature is required.
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 400);
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" /> Paid
        </span>
      );
    }
    if (s === 'pending' || s === 'partially_paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3" /> {s === 'partially_paid' ? 'Partial' : 'Pending'}
        </span>
      );
    }
    if (s === 'overdue') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <AlertCircle className="w-3 h-3" /> Overdue
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
        {status || 'Unknown'}
      </span>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/dashboard/customers/view/${id}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold shadow-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Customer
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-sky-500" />
              Customer Invoices
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Billing statement and history for <strong className="text-slate-800 dark:text-slate-200">{customerInfo?.full_name || 'Customer #' + id}</strong> (ID: {customerInfo?.customer_code || id})
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Status:</span>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quick KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Total Invoices
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            {stats.totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Records on ledger</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Total Billed
          </div>
          <div className="text-xl sm:text-2xl font-bold text-sky-600 dark:text-sky-400">
            ৳{stats.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Gross bill generated</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Total Paid
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ৳{stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Collected payments</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Balance Due
          </div>
          <div className={`text-xl sm:text-2xl font-bold ${stats.totalDue > 0 ? 'text-amber-500' : 'text-slate-900 dark:text-slate-100'}`}>
            ৳{stats.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Outstanding balance</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(Number(e.target.value))}
              className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">entries</span>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by ID, description, method..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 transition-all"
            />
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Loading customer invoices...</p>
          </div>
        )}

        {/* Error Alert */}
        {error && !loading && (
          <div className="p-6">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <>
            {filteredInvoices.length === 0 ? (
              <div className="py-16 text-center">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No invoices found</p>
                <p className="text-xs text-slate-400 mt-1">
                  {search ? 'No invoices match your search filters.' : 'This customer does not have any generated invoices yet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 uppercase font-semibold tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Inv #</th>
                      <th className="py-3 px-3">Date & Time</th>
                      <th className="py-3 px-3">Expire Time</th>
                      <th className="py-3 px-3">Description</th>
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3 text-right">Amount</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3">Collected By</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {paginatedInvoices.map((inv) => {
                      const invId = inv.invoiceId || (inv as any).invoice_id;
                      const invNum = formatInvoiceIdDisplay(inv.invoiceNumber || (inv as any).invoice_number || invId);
                      const amount = Number(inv.totalAmount || (inv as any).total_amount || 0);
                      const method = inv.paymentMethod || (inv as any).payment_method || 'Cash';
                      const isLoadingAction = actionLoading === invId;

                      return (
                        <tr
                          key={invId}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              #{invNum}
                            </span>
                            <div className="text-[10px] text-slate-400">ID: {invId}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formatDateTime(inv.createdAt || inv.invoiceDate)}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formatDateOnly(inv.dueDate)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-800 dark:text-slate-200 max-w-[200px] truncate">
                              {getDescription(inv)}
                            </div>
                            {inv.notes && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                {inv.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                              <CreditCard className="w-3 h-3 text-slate-400" />
                              {method}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              ৳{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {getStatusBadge(inv.status)}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                            {inv.doneBy || '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {showCancelReturnButtons(inv) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleCancel(inv)}
                                    disabled={isLoadingAction}
                                    title="Cancel invoice"
                                    className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReturn(inv)}
                                    disabled={isLoadingAction}
                                    title="Process return"
                                    className="p-1.5 rounded-lg border border-sky-200 dark:border-sky-900 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors disabled:opacity-50"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handlePrint(inv)}
                                title="Print / Download Invoice"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs shadow-sm transition-all"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
