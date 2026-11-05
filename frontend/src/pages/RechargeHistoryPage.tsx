import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, ArrowDown, ArrowUp, Search, Download } from 'lucide-react';
import { resellerService, PopOption } from '@/services/reseller.service';
import { paymentsService } from '@/services/payments.service';
import { usersService } from '@/services/users.service';
import { useToastContext } from '@/contexts/ToastContext';
import { formatInvoiceIdDisplay } from '@/lib/formatInvoiceId';
import { PageHeader, MetricCard } from '@/components/common';

export interface LedgerRow {
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

function formatMoney(n: number) {
  return `৳${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function RechargeHistoryPage() {
  const navigate = useNavigate();
  const toast = useToastContext();

  const [userId, setUserId] = useState<string>('');
  const [createdBy, setCreatedBy] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [method, setMethod] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [popOptions, setPopOptions] = useState<PopOption[]>([]);
  const [initiatorOptions, setInitiatorOptions] = useState<PopOption[]>([]);
  const [data, setData] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPops = useCallback(async () => {
    try {
      const pops = await resellerService.getPops();
      setPopOptions(Array.isArray(pops) ? pops : []);
    } catch {
      setPopOptions([]);
    }
  }, []);

  const loadInitiators = useCallback(async () => {
    try {
      const list = await usersService.getReceivedByOptions();
      const formatted = (list ?? []).map((u: any) => ({
        userId: String(u.userId || u.user_id),
        name: u.fullName || u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        username: u.username || '',
      }));
      setInitiatorOptions(formatted);
    } catch {
      setInitiatorOptions([]);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await paymentsService.getRechargeHistory({
        userId: userId || undefined,
        createdBy: createdBy || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
        method: method || undefined,
        page,
        limit,
      });
      setData(Array.isArray(res.data) ? res.data : []);
      setTotal(res.total ?? 0);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to load recharge history';
      setError(msg);
      toast.error(msg);
      setData([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [userId, createdBy, dateFrom, dateTo, search, method, page, limit, toast]);

  useEffect(() => {
    loadPops();
    loadInitiators();
  }, [loadPops, loadInitiators]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

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
    a.download = `recharge-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} rows`);
  };

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
        icon={<Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Recharge History"
        subtitle="Complete ledger of reseller debits, credits, renewals, topups, and cash entries"
        badge={`${total} Transactions`}
        actions={
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-sm font-medium shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Debit (Page)"
          value={formatMoney(totalDebit)}
          subtext="Amount debited from accounts"
          variant="amber"
          icon={<ArrowDown className="w-5 h-5" />}
        />
        <MetricCard
          title="Total Credit (Page)"
          value={formatMoney(totalCredit)}
          subtext="Amount credited to accounts"
          variant="emerald"
          icon={<ArrowUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Net Cashflow (Page)"
          value={formatMoney(net)}
          subtext="Credit minus debit balance"
          variant="blue"
          icon={<Wallet className="w-5 h-5" />}
        />
      </div>

      {/* Filters card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Initiator</label>
            <select
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">All Initiators</option>
              {initiatorOptions.map((p) => (
                <option key={p.userId} value={p.userId}>{p.name || p.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">POP In-Charge</label>
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
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Method</label>
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
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Search</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                placeholder="Description..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
              <button
                type="button"
                onClick={handleApplyFilters}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading recharge history…</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">SL</th>
                  <th className="px-4 py-3 text-left">REF</th>
                  <th className="px-4 py-3 text-left">Initiator</th>
                  <th className="px-4 py-3 text-left">POP In-Charge</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                      No recharge records found.
                    </td>
                  </tr>
                ) : (
                  data.map((row) => (
                    <tr
                      key={`${row.sl}-${row.ref}-${row.created_at}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{row.sl}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {formatInvoiceIdDisplay(row.ref) || row.ref}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{row.initiator_name || '–'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.pop_in_charge_name || '–'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                        {row.debit > 0 ? formatMoney(row.debit) : '–'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {row.credit != null && row.credit > 0 ? formatMoney(row.credit) : '–'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                        {formatMoney(row.balance_after)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{row.created_at}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">{row.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && total > 0 && (
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{(currentPage - 1) * limit + 1}</span>
              {' – '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(currentPage * limit, total)}</span>
              {' of '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{total.toLocaleString()}</span>
              {' entries'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span className="sr-only">Previous</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="min-w-[90px] text-center text-xs font-medium text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span className="sr-only">Next</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
