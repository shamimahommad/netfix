import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  Copy,
  Receipt,
  User,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import ledgerService, { LedgerEntry, LedgerStatementResponse } from '@/services/ledger.service';
import resellerService, { Reseller } from '@/services/reseller.service';
import { useToastContext } from '@/contexts/ToastContext';

export default function FinancialLedgerPage() {
  const toast = useToastContext();

  const [loading, setLoading] = useState<boolean>(true);
  const [statement, setStatement] = useState<LedgerStatementResponse | null>(null);
  const [downlines, setDownlines] = useState<Reseller[]>([]);

  // Filter States
  const [quickDate, setQuickDate] = useState<string>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [purposeFilter, setPurposeFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(50);

  // Quick date presets
  const applyQuickDate = (preset: string) => {
    setQuickDate(preset);
    const now = new Date();
    const formatYMD = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      const todayStr = formatYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this_week') {
      const monday = new Date(now);
      const day = monday.getDay();
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
      monday.setDate(diff);
      setStartDate(formatYMD(monday));
      setEndDate(formatYMD(now));
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
    setPage(1);
  };

  // Initial load
  useEffect(() => {
    applyQuickDate('this_month');
    // Load downlines for user dropdown
    resellerService.list().then((res) => {
      if (Array.isArray(res.data)) {
        setDownlines(res.data);
      }
    }).catch(() => {});
  }, []);

  // Fetch statement data
  const fetchStatement = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ledgerService.getLedgerStatement({
        user_id: selectedUserId ? Number(selectedUserId) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        purpose: purposeFilter !== 'all' ? purposeFilter : undefined,
        type: typeFilter !== 'all' ? (typeFilter as 'credit' | 'debit') : undefined,
        page,
        limit,
      });

      if (res.success) {
        setStatement(res);
      } else {
        toast.error(res.message || 'Failed to load ledger');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to fetch statement');
    } finally {
      setLoading(false);
    }
  }, [selectedUserId, startDate, endDate, purposeFilter, typeFilter, page, limit, toast]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  // Client-side search filtering on rows
  const filteredRows = useMemo(() => {
    if (!statement?.data) return [];
    if (!searchKeyword.trim()) return statement.data;
    const q = searchKeyword.toLowerCase();
    return statement.data.filter((r) =>
      r.txn_group_id.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.invoice_number && r.invoice_number.toLowerCase().includes(q)) ||
      (r.customer_username && r.customer_username.toLowerCase().includes(q)) ||
      (r.customer_full_name && r.customer_full_name.toLowerCase().includes(q))
    );
  }, [statement?.data, searchKeyword]);

  // Export CSV
  const handleExportCSV = () => {
    if (!statement?.data || statement.data.length === 0) {
      toast.info('No ledger records to export');
      return;
    }

    const headers = [
      'Txn ID',
      'Txn Group ID',
      'Date & Time',
      'Type',
      'Amount (BDT)',
      'Opening Balance',
      'Closing Balance',
      'Purpose',
      'Customer',
      'Invoice No',
      'Description',
    ];

    const rows = statement.data.map((r) => [
      r.id,
      r.txn_group_id,
      r.created_at,
      r.type.toUpperCase(),
      r.amount,
      r.opening_balance,
      r.closing_balance,
      r.purpose,
      r.customer_username || r.customer_full_name || 'N/A',
      r.invoice_number || 'N/A',
      `"${(r.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_ledger_${startDate || 'all'}_${endDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ledger exported to CSV successfully');
  };

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${text}`);
  };

  const formatBDT = (amt: number | string) => {
    const num = Number(amt) || 0;
    return `৳${num.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Financial Statement & Double-Entry Ledger
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Immutable Audit Trail
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time transaction settlements, retail bill splits, upstream pass-through margins, and running balance
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStatement}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Reload data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-medium rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-medium rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Credits (Earning / Margin) */}
        <div className="relative overflow-hidden bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> Total Credit / Margin Earning
            </span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {formatBDT(statement?.summary.total_credit || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <span>Customer payments + upstream cascading commissions</span>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: Total Debits (Deductions / Recharges) */}
        <div className="relative overflow-hidden bg-slate-900/80 border border-rose-500/20 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-rose-400" /> Total Debit / Recharges
            </span>
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {formatBDT(statement?.summary.total_debit || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              <span>Subscriber recharges and wallet balance transfers</span>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 3: Current SaaS Wallet Balance */}
        <div className="relative overflow-hidden bg-slate-900/80 border border-blue-500/20 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-blue-400" /> Current Wallet Balance
            </span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {statement?.wallet.status || 'Active'}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {formatBDT(statement?.wallet.balance || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span className="text-emerald-400 font-medium">Net Margin: {formatBDT(statement?.summary.net_profit || 0)}</span>
              <span>•</span>
              <span>Account: {statement?.user.username || 'Self'}</span>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            {['today', 'this_week', 'this_month', 'all'].map((preset) => (
              <button
                key={preset}
                onClick={() => applyQuickDate(preset)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                  quickDate === preset
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {preset.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Txn ID, customer, invoice..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Secondary Filter Line */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-2 border-t border-slate-800/60 text-xs">
          {/* Start Date */}
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setQuickDate('custom');
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setQuickDate('custom');
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Downline Beneficiary User Selector */}
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">Account / Downline</label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">My Own Wallet (Self)</option>
              {downlines.map((dl) => (
                <option key={dl.userId} value={dl.userId}>
                  {dl.username} ({dl.role})
                </option>
              ))}
            </select>
          </div>

          {/* Purpose Filter */}
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">Purpose</label>
            <select
              value={purposeFilter}
              onChange={(e) => {
                setPurposeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Purposes</option>
              <option value="commission_margin">Commission Margin (Profit)</option>
              <option value="customer_payment">Customer Bill Payment</option>
              <option value="wallet_recharge">Wallet Top-up</option>
              <option value="package_deduction">Package Recharge Debit</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">Credit / Debit</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Movements</option>
              <option value="credit">Credit Only (+)</option>
              <option value="debit">Debit Only (-)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit-grade DataTable */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Txn Group ID</th>
                <th className="py-3 px-4">Description / Customer</th>
                <th className="py-3 px-4">Purpose</th>
                <th className="py-3 px-4 text-center">Type</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    <span>Loading double-entry ledger statement...</span>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-medium text-slate-300">No ledger transactions found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      No records match the selected date bounds or filter criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row: LedgerEntry) => {
                  const isCredit = row.type === 'credit';
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300">
                        {row.created_at}
                      </td>

                      {/* Txn Group ID */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-blue-300 border border-slate-700">
                            {row.txn_group_id}
                          </span>
                          <button
                            onClick={() => copyToClipboard(row.txn_group_id)}
                            className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-700/50"
                            title="Copy Txn Group ID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Description / Customer / Invoice */}
                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-medium text-slate-100 truncate">
                          {row.description || 'System balance entry'}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          {row.customer_username && (
                            <span className="flex items-center gap-1 text-blue-400">
                              <User className="w-3 h-3" /> {row.customer_username}
                            </span>
                          )}
                          {row.invoice_number && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Receipt className="w-3 h-3" /> Inv #{row.invoice_number}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Purpose Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            row.purpose === 'commission_margin'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                              : row.purpose === 'customer_payment'
                              ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                              : row.purpose === 'wallet_recharge'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                          }`}
                        >
                          {row.purpose === 'commission_margin'
                            ? 'Profit Margin'
                            : row.purpose === 'customer_payment'
                            ? 'Customer Bill'
                            : row.purpose === 'wallet_recharge'
                            ? 'Top-up'
                            : 'Package Debit'}
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isCredit
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isCredit ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3" /> Credit
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3" /> Debit
                            </>
                          )}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-bold">
                        <span className={isCredit ? 'text-emerald-400' : 'text-rose-400'}>
                          {isCredit ? '+' : '-'}{formatBDT(row.amount)}
                        </span>
                      </td>

                      {/* Running Balance */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-semibold text-slate-100">
                        {formatBDT(row.closing_balance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {statement?.pagination && statement.pagination.total_pages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing page {statement.pagination.page} of {statement.pagination.total_pages} ({statement.pagination.total_records} total movements)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-200 font-mono">
                {page}
              </span>
              <button
                disabled={page >= statement.pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40"
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
