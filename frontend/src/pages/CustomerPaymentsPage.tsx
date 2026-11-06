import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Search, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { resellerService, PopOption } from '@/services/reseller.service';
import { paymentsService } from '@/services/payments.service';
import { useToastContext } from '@/contexts/ToastContext';
import { formatInvoiceIdDisplay } from '@/lib/formatInvoiceId';
import { PageHeader, MetricCard } from '@/components/common';

export interface CustomerPaymentRow {
  sl: number;
  ref: string;
  initiator_name: string;
  pop_in_charge_name: string;
  debit: number;
  credit: number | null;
  balance_after: number;
  created_at: string;
  description: string;
}

const PAGE_SIZES = [10, 25, 50] as const;

function formatMoney(n: number | null): string {
  if (n == null) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CustomerPaymentsPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [data, setData] = useState<CustomerPaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popOptions, setPopOptions] = useState<PopOption[]>([]);
  const [initiatorOptions, setInitiatorOptions] = useState<PopOption[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [userId, setUserId] = useState<string>('');
  const [createdBy, setCreatedBy] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [method, setMethod] = useState<string>('');

  const loadPops = useCallback(async () => {
    try {
      const list = await resellerService.listPops();
      setPopOptions(Array.isArray(list) ? list : []);
    } catch {
      setPopOptions([]);
    }
  }, []);

  const loadInitiators = useCallback(async () => {
    try {
      const res = await resellerService.list();
      const items = Array.isArray(res.data) ? res.data : [];
      setInitiatorOptions(
        items.map((u) => ({
          userId: u.id,
          username: u.username,
          name: u.full_name || u.name,
        }))
      );
    } catch {
      setInitiatorOptions([]);
    }
  }, []);

  useEffect(() => {
    loadPops();
    loadInitiators();
  }, [loadPops, loadInitiators]);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await paymentsService.getCustomerPayments({
        page,
        limit,
        userId: userId || undefined,
        createdBy: createdBy || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search.trim() || undefined,
        method: method || undefined,
      });

      const list = res.data || [];
      const rows: CustomerPaymentRow[] = list.map((item: any, idx: number) => ({
        sl: (page - 1) * limit + idx + 1,
        ref: item.ref_no || item.reference || String(item.id || ''),
        initiator_name: item.initiator_name || item.user_name || item.customer_name || '—',
        pop_in_charge_name: item.pop_name || item.collector_name || '—',
        debit: Number(item.debit || 0),
        credit: item.credit != null ? Number(item.credit) : null,
        balance_after: Number(item.balance || item.balance_after || 0),
        created_at: item.created_at || '—',
        description: item.description || item.note || '—',
      }));

      setData(rows);
      setTotal(res.meta?.total ?? res.total ?? rows.length);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load customer payments';
      setError(msg);
      toast.error(msg);
      setData([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, userId, createdBy, dateFrom, dateTo, search, method, toast]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleApplyFilters = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleExport = () => {
    const headers = ['SL', 'REF', 'Initiator', 'Pop In Charge', 'Debit', 'Credit', 'Balance', 'Time', 'Description'];
    const rows = data.map((r) => [
      r.sl,
      r.ref,
      r.initiator_name,
      r.pop_in_charge_name,
      r.debit > 0 ? formatMoney(r.debit) : '',
      r.credit != null && r.credit > 0 ? formatMoney(r.credit) : '',
      formatMoney(r.balance_after),
      r.created_at,
      r.description,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);

  const { totalDebit, totalCredit, net } = useMemo(() => {
    let d = 0;
    let c = 0;
    for (const row of data) {
      d += row.debit ?? 0;
      c += row.credit ?? 0;
    }
    return {
      totalDebit: d,
      totalCredit: c,
      net: c - d,
    };
  }, [data]);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Customer Payments"
        subtitle="Customer recharge, renew, topup, and manual cash transaction log"
        badge={`${total} Entries`}
        onBack={() => navigate('/dashboard/report')}
        actions={
          <button
            type="button"
            onClick={handleExport}
            disabled={data.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
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
          title="Total Debit"
          value={`৳${formatMoney(totalDebit)}`}
          subtext="On this page"
          variant="rose"
        />
        <MetricCard
          title="Total Credit"
          value={`৳${formatMoney(totalCredit)}`}
          subtext="On this page"
          variant="emerald"
        />
        <MetricCard
          title="Net Cashflow"
          value={`৳${formatMoney(net)}`}
          subtext="Credit minus debit"
          variant={net >= 0 ? 'blue' : 'amber'}
        />
        <MetricCard
          title="Total Records"
          value={total}
          subtext="Matching criteria"
          variant="slate"
        />
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Initiator</label>
            <select
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">All Users</option>
              {initiatorOptions.map((p) => (
                <option key={p.userId} value={p.userId}>{p.name || p.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">POP In-Charge</label>
            <select
              value={createdBy}
              onChange={(e) => { setCreatedBy(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">All POPs</option>
              {popOptions.map((p) => (
                <option key={p.userId} value={p.userId}>{p.name || p.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Method</label>
            <select
              value={method}
              onChange={(e) => { setMethod(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">All Methods</option>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
              <option value="cash">Cash</option>
              <option value="system">System</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyFilters}
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
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n} rows</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              placeholder="Search description, reference..."
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50">
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">SL</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Ref</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Initiator</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">POP In Charge</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Debit</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Credit</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Balance</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Time</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="inline-flex items-center gap-2 text-sm">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      Loading customer payments...
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                    No customer payments found.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={`${row.ref}-${row.sl}`}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">{row.sl}</td>
                    <td className="py-3 px-4 text-sm font-mono text-xs text-slate-600 dark:text-slate-400">
                      {formatInvoiceIdDisplay(row.ref)}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-900 dark:text-slate-100">{row.initiator_name}</td>
                    <td className="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">{row.pop_in_charge_name}</td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-rose-600 dark:text-rose-400">
                      {row.debit > 0 ? `৳${formatMoney(row.debit)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {row.credit != null && row.credit > 0 ? `৳${formatMoney(row.credit)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-bold text-slate-900 dark:text-slate-100">
                      ৳{formatMoney(row.balance_after)}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs">{row.created_at}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate" title={row.description}>
                      {row.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && total > 0 && (
          <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-3">
            <p>
              Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{(currentPage - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(currentPage * limit, total)}</span> of{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{total.toLocaleString()}</span> entries
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
