import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Search, Download, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { paymentsService, type OnlineTransactionItem, type OnlineTransactionsSummary } from '@/services/payments.service';
import { formatInvoiceIdDisplay } from '@/lib/formatInvoiceId';
import { PageHeader, MetricCard, StatusBadge } from '@/components/common';

const STATUS_OPTIONS = ['All', 'Success', 'Failed', 'Pending', 'Expired'] as const;
const GATEWAY_OPTIONS = ['All', 'bkash', 'nagad', 'aamarpay', 'ssl', 'shurjopay'] as const;
const ROWS_OPTIONS = [10, 25, 50, 100] as const;

function formatCurrency(n: number) {
  return `৳${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
  } catch {
    return '—';
  }
}

function statusLabel(s: string): 'Paid' | 'Failed' | 'Pending' {
  if (s === 'PAID') return 'Paid';
  if (s === 'FAILED' || s === 'EXPIRED') return 'Failed';
  return 'Pending';
}

const defaultSummary: OnlineTransactionsSummary = {
  today: 0,
  yesterday: 0,
  thisMonth: 0,
  lastMonth: 0,
  filteredTotal: 0,
};

export default function OnlineTransactionsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('Success');
  const [gateway, setGateway] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [data, setData] = useState<{ items: OnlineTransactionItem[]; total: number; summary: OnlineTransactionsSummary }>({
    items: [],
    total: 0,
    summary: defaultSummary,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentsService.getOnlineTransactions({
        status: status === 'All' ? undefined : status,
        gateway: gateway === 'All' ? undefined : gateway,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search.trim() || undefined,
        page,
        limit: rowsPerPage,
      });
      setData({
        items: res.data || [],
        total: res.meta?.total ?? 0,
        summary: res.summary || defaultSummary,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to load online transactions';
      setError(msg);
      setData({ items: [], total: 0, summary: defaultSummary });
    } finally {
      setLoading(false);
    }
  }, [status, gateway, dateFrom, dateTo, search, page, rowsPerPage]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSearch = () => setSearch(searchInput.trim());
  const handleExport = () => {
    window.alert('Export will download current filtered results as CSV.');
  };
  const summary = data.summary;

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Online Transactions"
        subtitle="Live payment gateway activity, payment intents, and transaction verifications"
        badge={`${data.total} Records`}
        actions={
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-sm font-medium shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Today"
          value={formatCurrency(summary.today)}
          subtext="Processed today"
          variant="emerald"
        />
        <MetricCard
          title="Yesterday"
          value={formatCurrency(summary.yesterday)}
          subtext="Previous day"
          variant="slate"
        />
        <MetricCard
          title="This Month"
          value={formatCurrency(summary.thisMonth)}
          subtext="Current calendar month"
          variant="blue"
        />
        <MetricCard
          title="Last Month"
          value={formatCurrency(summary.lastMonth)}
          subtext="Prior calendar month"
          variant="indigo"
        />
        <MetricCard
          title="Filtered Total"
          value={formatCurrency(summary.filteredTotal)}
          subtext="Matching current filter"
          variant="cyan"
        />
      </div>

      {/* Filters card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Gateway</label>
            <select
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {GATEWAY_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Search</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Invoice, Txn ID, name, mobile..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleSearch}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Show</span>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {ROWS_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} rows</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Invoice ID</th>
                <th className="px-4 py-3 text-left">Txn ID</th>
                <th className="px-4 py-3 text-left">Payee Name</th>
                <th className="px-4 py-3 text-left">Payee Mobile</th>
                <th className="px-4 py-3 text-left">Gateway</th>
                <th className="px-4 py-3 text-left">Request Time</th>
                <th className="px-4 py-3 text-left">Paid Time</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Loading transactions…
                    </div>
                  </td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                    No online gateway transactions match the filters.
                  </td>
                </tr>
              ) : (
                data.items.map((r) => {
                  const statusDisplay = statusLabel(r.status);
                  return (
                    <tr
                      key={r.paymentIntentId}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                        {formatInvoiceIdDisplay(r.invoiceNumber || r.merchantInvoiceNumber)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {r.gatewayPaymentId || '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{r.payeeName}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{r.payeeMobile}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {r.gateway}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDateTime(r.paidAt)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={statusDisplay} />
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(r.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
