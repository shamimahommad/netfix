import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Search, Download, Plus, RefreshCw } from 'lucide-react';
import { paymentsService, type OnlineTransactionItem, type OnlineTransactionsSummary } from '@/services/payments.service';
import { formatInvoiceIdDisplay } from '@/lib/formatInvoiceId';
import { PageHeader, MetricCard, StatusBadge } from '@/components/common';

const METHOD_OPTIONS = ['All', 'bkash', 'nagad', 'aamarpay', 'ssl'] as const;
const TYPE_OPTIONS = ['All', 'Payment'] as const;
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

function statusLabel(s: string): string {
  if (s === 'PAID') return 'Success';
  if (s === 'FAILED' || s === 'EXPIRED') return 'Not Matched';
  return 'Pending';
}

const defaultSummary: OnlineTransactionsSummary = {
  today: 0,
  yesterday: 0,
  thisMonth: 0,
  lastMonth: 0,
  filteredTotal: 0,
};

export default function MerchantPaymentsPage() {
  const navigate = useNavigate();
  const [popInCharge, setPopInCharge] = useState('');
  const [type, setType] = useState<string>('All');
  const [method, setMethod] = useState<string>('All');
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await paymentsService.getOnlineTransactions({
        status: 'Success',
        gateway: method === 'All' ? undefined : method,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
        page,
        limit: rowsPerPage,
      });
      setData({ items: result.items || [], total: result.total || 0, summary: result.summary || defaultSummary });
    } catch (e: any) {
      setError(e?.message || 'Failed to load merchant payments');
      setData({ items: [], total: 0, summary: defaultSummary });
    } finally {
      setLoading(false);
    }
  }, [method, dateFrom, dateTo, search, page, rowsPerPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => setSearch(searchInput.trim());
  const handleExport = () => window.alert('Export will be available soon.');
  const handleAdd = () => window.alert('Add payment will be available when backend supports it.');

  const items = data.items;
  const totalCount = data.total;
  const successCount = data.total;
  const notMatchedCount = 0;
  const nagadCount = items.filter((i) => i.gateway?.toLowerCase() === 'nagad').length;
  const bkashCount = items.filter((i) => i.gateway?.toLowerCase() === 'bkash').length;

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Merchant Payments"
        subtitle="View merchant payment records and gateway reconciliation"
        badge={`${totalCount} Records`}
        onBack={() => navigate('/dashboard')}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-sm font-medium shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Payment
            </button>
          </div>
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
          title="Total"
          value={totalCount}
          subtext="All merchant entries"
          variant="blue"
        />
        <MetricCard
          title="Success"
          value={successCount}
          subtext="Settled successfully"
          variant="emerald"
        />
        <MetricCard
          title="Not Matched"
          value={notMatchedCount}
          subtext="Requires review"
          variant="rose"
        />
        <MetricCard
          title="Nagad"
          value={nagadCount}
          subtext="Transactions"
          variant="amber"
        />
        <MetricCard
          title="bKash"
          value={bkashCount}
          subtext="Transactions"
          variant="purple"
        />
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">POP In Charge</label>
            <select
              value={popInCharge}
              onChange={(e) => setPopInCharge(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">All POPs</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {METHOD_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSearch}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-sm"
            >
              <Search className="w-4 h-4" /> Filter
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Show:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              {ROWS_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} rows</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ref, sender, amount..."
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50">
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">ID</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Sender</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Ref.No</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Amount</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">TxNID</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Method</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Type</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Time</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="inline-flex items-center gap-2 text-sm">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      Loading merchant payments...
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                    No merchant payment records found matching criteria
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr
                    key={r.paymentIntentId}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatInvoiceIdDisplay(r.merchantInvoiceNumber || r.paymentIntentId)}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-800 dark:text-slate-200">{r.payeeName}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 font-mono text-xs">
                      {formatInvoiceIdDisplay(r.merchantInvoiceNumber)}
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(r.amount)}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 font-mono text-xs">
                      {r.gatewayPaymentId || '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300 font-medium">
                      {r.gateway}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">Payment</td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(r.paidAt || r.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        status={
                          r.status === 'PAID'
                            ? 'paid'
                            : r.status === 'FAILED' || r.status === 'EXPIRED'
                              ? 'failed'
                              : 'pending'
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>
            Showing {loading ? 0 : (page - 1) * rowsPerPage + 1} to {loading ? 0 : Math.min(page * rowsPerPage, data.total)} of {data.total} entries
          </span>
        </div>
      </div>
    </div>
  );
}
