import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, ChevronLeft, ChevronRight, RefreshCw, ChevronDown } from 'lucide-react';
import { billingService, InvoiceDto } from '@/services/billing.service';
import { formatInvoiceIdDisplay } from '@/lib/formatInvoiceId';
import { resellerService, Reseller } from '@/services/reseller.service';
import { networkService } from '@/services/network.service';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader, MetricCard } from '@/components/common';

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
      hour12: false,
    }).replace(/\//g, '-');
  } catch {
    return s;
  }
}

function formatCurrency(amount: number) {
  return '৳' + new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

type SearchByOption = 'invoice_owner' | 'customer';

export default function InvoicesReportPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);

  // Filter state
  const [ownerId, setOwnerId] = useState<string>('');
  const [serverId, setServerId] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [subArea, setSubArea] = useState<string>('');
  const [protocol, setProtocol] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('');
  const [searchBy, setSearchBy] = useState<SearchByOption>('invoice_owner');
  const [searchText, setSearchText] = useState<string>('');
  const [searchDebounced, setSearchDebounced] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchText), 400);
    return () => clearTimeout(t);
  }, [searchText]);

  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [servers, setServers] = useState<{ id: string; name: string }[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  useEffect(() => {
    resellerService.list().then((r) => setResellers(r.data ?? [])).catch(() => setResellers([]));
    networkService.getDevicesDropdown('router').then((r) => setServers((r.data ?? []).filter((x) => x.type !== 'olt').map((x) => ({ id: x.id, name: x.name })))).catch(() => setServers([]));
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await billingService.listInvoices({
        page,
        limit,
        ownerId: ownerId || undefined,
        serverId: serverId || undefined,
        area: area || undefined,
        subArea: subArea || undefined,
        protocol: protocol || undefined,
        status: statusFilter || undefined,
        payMethod: payMethod || undefined,
        searchBy,
        search: searchDebounced || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setInvoices(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load invoices');
      setInvoices([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, limit, ownerId, serverId, area, subArea, protocol, statusFilter, payMethod, searchDebounced, dateFrom, dateTo]);

  const onFilterChange = () => setPage(1);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((i) => i.invoiceId)));
    }
  };

  const rowsToExport = invoices.filter((i) => selectedIds.size === 0 || selectedIds.has(i.invoiceId));

  function downloadCSV() {
    const headers = ['Inv ID', 'Inv Time', 'Exp.Date', 'C.Name', 'Username', 'Mobile No', 'Bill Amount', 'Balance', 'Done By'];
    const rows = rowsToExport.map((inv) => [
      inv.invoiceId,
      formatDateTime(inv.createdAt),
      formatDateOnly(inv.dueDate),
      inv.customerName ?? inv.customerId ?? '',
      inv.username ?? '',
      inv.mobile ?? '',
      inv.totalAmount ?? 0,
      inv.customerBalance ?? '',
      inv.doneBy ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadExcel() {
    const headers = ['Inv ID', 'Inv Time', 'Exp.Date', 'C.Name', 'Username', 'Mobile No', 'Bill Amount', 'Balance', 'Done By'];
    const rows = rowsToExport.map((inv) => [
      inv.invoiceId,
      formatDateTime(inv.createdAt),
      formatDateOnly(inv.dueDate),
      inv.customerName ?? inv.customerId ?? '',
      inv.username ?? '',
      inv.mobile ?? '',
      inv.totalAmount ?? 0,
      inv.customerBalance ?? '',
      inv.doneBy ?? '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `invoices-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function downloadPDF() {
    const doc = new jsPDF({ orientation: 'landscape' });
    const headers = [['Inv ID', 'Inv Time', 'Exp.Date', 'C.Name', 'Username', 'Mobile No', 'Bill Amount', 'Balance', 'Done By']];
    const rows = rowsToExport.map((inv) => [
      String(inv.invoiceId),
      formatDateTime(inv.createdAt),
      formatDateOnly(inv.dueDate),
      (inv.customerName ?? inv.customerId ?? '').slice(0, 20),
      (inv.username ?? '').slice(0, 15),
      (inv.mobile ?? '').slice(0, 15),
      String(inv.totalAmount ?? 0),
      inv.customerBalance != null ? String(inv.customerBalance) : '',
      (inv.doneBy ?? '').slice(0, 15),
    ]);
    autoTable(doc, { head: headers, body: rows, styles: { fontSize: 8 } });
    doc.save(`invoices-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const total = meta?.total ?? invoices.length;
  const totalPages = meta?.totalPages ?? Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  const totalPageBill = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Invoices Report"
        subtitle="Filter and generate reports for tenant invoices with instant export"
        badge={`${total} Invoices`}
        onBack={() => navigate('/dashboard/report')}
        actions={
          <div className="relative">
            <button
              type="button"
              onClick={() => setDownloadMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" /> Download Export
              <ChevronDown className="w-4 h-4 ml-0.5" />
            </button>
            {downloadMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" aria-hidden onClick={() => setDownloadMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-20 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-1 min-w-[150px] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { downloadCSV(); setDownloadMenuOpen(false); }}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => { downloadExcel(); setDownloadMenuOpen(false); }}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Export as Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => { downloadPDF(); setDownloadMenuOpen(false); }}
                    className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Export as PDF
                  </button>
                </div>
              </>
            )}
          </div>
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Total Invoices"
          value={total.toLocaleString()}
          subtext="Matching current filters"
          variant="blue"
        />
        <MetricCard
          title="Invoices On Page"
          value={invoices.length}
          subtext="Currently listed"
          variant="slate"
        />
        <MetricCard
          title="Page Bill Amount"
          value={formatCurrency(totalPageBill)}
          subtext="Sum for this view"
          variant="emerald"
        />
        <MetricCard
          title="Selected Invoices"
          value={selectedIds.size > 0 ? selectedIds.size : 'All Visible'}
          subtext={selectedIds.size > 0 ? 'Export selection' : 'Export will include all'}
          variant="purple"
        />
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Resellers</label>
            <select
              value={ownerId}
              onChange={(e) => { setOwnerId(e.target.value); onFilterChange(); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">All In-Charge</option>
              {resellers.map((r) => (
                <option key={r.userId} value={r.userId}>{r.name || r.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Server</label>
            <select
              value={serverId}
              onChange={(e) => { setServerId(e.target.value); onFilterChange(); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">All Servers</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Protocol</label>
            <select
              value={protocol}
              onChange={(e) => { setProtocol(e.target.value); onFilterChange(); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">All Protocols</option>
              <option value="pppoe">PPPoE</option>
              <option value="hotspot">Hotspot</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); onFilterChange(); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="paid">Paid (Success)</option>
              <option value="pending">Pending</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Search Target</label>
            <select
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value as SearchByOption)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="invoice_owner">Invoice Owner</option>
              <option value="customer">Customer</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); onFilterChange(); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); onFilterChange(); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Search Text</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); onFilterChange(); }}
              placeholder={searchBy === 'invoice_owner' ? 'Search by invoice / owner...' : 'Search by customer name/phone...'}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Show:</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none w-full"
            >
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800/90 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                <th className="py-3 px-4 w-12">
                  <input
                    type="checkbox"
                    checked={invoices.length > 0 && selectedIds.size === invoices.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Inv ID</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Inv Time</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Exp.Date</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Customer</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Username</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Mobile</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-right">Bill Amount</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-right">Balance</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Done By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="inline-flex items-center gap-2 text-sm">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      Loading invoices...
                    </div>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                    No invoices found matching criteria
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.invoiceId}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(inv.invoiceId)}
                        onChange={() => toggleSelect(inv.invoiceId)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 font-mono text-xs">
                      {formatInvoiceIdDisplay(inv.invoiceId)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs">
                      {formatDateTime(inv.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs">
                      {formatDateOnly(inv.dueDate)}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/customers/view/${inv.customerId}/invoices`)}
                        className="text-blue-600 dark:text-blue-400 font-medium hover:underline text-left transition-colors"
                      >
                        {inv.customerName ?? inv.customerId ?? '—'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">{inv.username || (inv as any).customerCode || '—'}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{inv.mobile || (inv as any).customerPhone || '—'}</td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100 text-right font-bold">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 text-right">
                      {inv.customerBalance != null ? formatCurrency(inv.customerBalance) : ((inv as any).balanceDue != null ? formatCurrency((inv as any).balanceDue) : '—')}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">{inv.doneBy || (inv as any).collectedByName || 'System'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && total > 0 && (
          <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-3">
            <p>
              Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{(currentPage - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(currentPage * limit, total)}</span> of{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{total.toLocaleString()}</span> invoices
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
