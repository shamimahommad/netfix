import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  TrendingUp,
  Users,
  Package,
  Calendar,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  DollarSign,
  ArrowDownLeft,
  CheckCircle2,
} from 'lucide-react';
import ledgerService, { ReconciliationResponse } from '@/services/ledger.service';
import resellerService, { Reseller } from '@/services/reseller.service';
import { useToastContext } from '@/contexts/ToastContext';

export default function ReconciliationReportPage() {
  const toast = useToastContext();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ReconciliationResponse | null>(null);
  const [downlines, setDownlines] = useState<Reseller[]>([]);

  // Filter state
  const [period, setPeriod] = useState<string>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [downlineUserId, setDownlineUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'downlines' | 'packages' | 'timeline'>('downlines');

  useEffect(() => {
    resellerService.list().then((res) => {
      if (Array.isArray(res.data)) {
        setDownlines(res.data);
      }
    }).catch(() => {});
  }, []);

  const fetchReconciliation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ledgerService.getReconciliation({
        period,
        start_date: period === 'custom' ? startDate : undefined,
        end_date: period === 'custom' ? endDate : undefined,
        downline_user_id: downlineUserId ? Number(downlineUserId) : undefined,
      });

      if (res.success) {
        setData(res);
      } else {
        toast.error(res.message || 'Failed to load reconciliation');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to fetch reconciliation report');
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate, downlineUserId, toast]);

  useEffect(() => {
    fetchReconciliation();
  }, [fetchReconciliation]);

  const formatBDT = (amt: number | string) => {
    const num = Number(amt) || 0;
    return `৳${num.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleExportCSV = () => {
    if (!data) return;
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = `reconciliation_${period}.csv`;

    if (activeTab === 'downlines') {
      headers = ['User ID', 'Username', 'Full Name', 'Role', 'Txn Count', 'Commission Earned', 'Direct Payment Received', 'Total Credited', 'Current Balance'];
      rows = data.downline_reconciliation.map((d) => [
        d.user_id,
        d.username,
        d.full_name || 'N/A',
        d.role,
        d.txn_count,
        d.commission_earned,
        d.direct_payment_received,
        d.total_credited,
        d.current_wallet_balance,
      ]);
    } else if (activeTab === 'packages') {
      headers = ['Package ID', 'Package Name', 'Retail Price', 'Invoices Paid', 'Total Retail Volume', 'Active Subscribers'];
      rows = data.package_reconciliation.map((p) => [
        p.access_profile_id,
        p.package_name,
        p.retail_price,
        p.total_invoices_paid,
        p.total_retail_volume,
        p.active_subscribers,
      ]);
    } else {
      headers = ['Date', 'Settlements Count', 'Daily Commissions', 'Daily ISP Revenue', 'Daily Disbursed'];
      rows = data.daily_timeline.map((t) => [
        t.txn_date,
        t.settlements_count,
        t.daily_commissions,
        t.daily_isp_revenue,
        t.daily_total_disbursed,
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Reconciliation table exported');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600/10 text-purple-400 border border-purple-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Financial Reconciliation & Audit Matrix
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-tier commission distribution, retail package volume, and downline performance audit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchReconciliation}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-medium rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Tab CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-medium rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-md">
          <span className="text-xs text-slate-400 font-medium">Total Settled Txns</span>
          <div className="text-2xl font-black text-white mt-1">
            {data?.overall.total_settled_txns || 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {data?.overall.total_settled_invoices || 0} customer invoices
          </span>
        </div>

        <div className="bg-slate-900/80 border border-blue-500/20 rounded-2xl p-4 shadow-md">
          <span className="text-xs text-blue-400 font-medium">Total Disbursed Funds</span>
          <div className="text-2xl font-black text-white mt-1">
            {formatBDT(data?.overall.total_disbursed_funds || 0)}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Across all hierarchy beneficiaries
          </span>
        </div>

        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-2xl p-4 shadow-md">
          <span className="text-xs text-emerald-400 font-medium">Commissions Distributed</span>
          <div className="text-2xl font-black text-white mt-1">
            {formatBDT(data?.overall.total_commissions_distributed || 0)}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Downline partner profit margins
          </span>
        </div>

        <div className="bg-slate-900/80 border border-purple-500/20 rounded-2xl p-4 shadow-md">
          <span className="text-xs text-purple-400 font-medium">ISP Base Net Revenue</span>
          <div className="text-2xl font-black text-white mt-1">
            {formatBDT(data?.overall.total_isp_collected || 0)}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Retained core company revenue
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {[
            { key: 'today', label: 'Today' },
            { key: 'this_week', label: 'This Week' },
            { key: 'this_month', label: 'This Month' },
            { key: 'this_year', label: 'This Year' },
            { key: 'custom', label: 'Custom' },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 font-medium rounded-lg transition-colors ${
                period === p.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-slate-400 font-medium">Downline Scope:</label>
          <select
            value={downlineUserId}
            onChange={(e) => setDownlineUserId(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
          >
            <option value="">All Descendants & Self</option>
            {downlines.map((dl) => (
              <option key={dl.userId} value={dl.userId}>
                {dl.username} ({dl.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('downlines')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'downlines'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" /> By Downlines & Agents ({data?.downline_reconciliation.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'packages'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" /> By Retail Packages ({data?.package_reconciliation.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'timeline'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" /> Daily Trend Timeline ({data?.daily_timeline.length || 0})
        </button>
      </div>

      {/* Tab 1: Downline Performance */}
      {activeTab === 'downlines' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role Tier</th>
                  <th className="py-3 px-4 text-center">Settled Txns</th>
                  <th className="py-3 px-4 text-right">Commissions Earned</th>
                  <th className="py-3 px-4 text-right">Direct Bill Collected</th>
                  <th className="py-3 px-4 text-right">Total Disbursed</th>
                  <th className="py-3 px-4 text-right">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">Loading downline audit...</td>
                  </tr>
                ) : data?.downline_reconciliation.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">No downline activity in this period.</td>
                  </tr>
                ) : (
                  data?.downline_reconciliation.map((dl) => (
                    <tr key={dl.user_id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-medium text-white">
                        {dl.username}
                        {dl.full_name && <span className="text-slate-400 text-[11px] block">{dl.full_name}</span>}
                      </td>
                      <td className="py-3 px-4 uppercase text-[11px] font-semibold text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {dl.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">{dl.txn_count}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatBDT(dl.commission_earned)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-blue-400">
                        {formatBDT(dl.direct_payment_received)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {formatBDT(dl.total_credited)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-200">
                        {formatBDT(dl.current_wallet_balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Package Breakdown */}
      {activeTab === 'packages' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Package Name</th>
                  <th className="py-3 px-4 text-right">Retail Price</th>
                  <th className="py-3 px-4 text-center">Invoices Paid</th>
                  <th className="py-3 px-4 text-right">Gross Retail Volume</th>
                  <th className="py-3 px-4 text-center">Active Subscribers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">Loading package audit...</td>
                  </tr>
                ) : data?.package_reconciliation.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">No package invoices found in this period.</td>
                  </tr>
                ) : (
                  data?.package_reconciliation.map((pkg) => (
                    <tr key={pkg.access_profile_id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-white">{pkg.package_name}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatBDT(pkg.retail_price)}</td>
                      <td className="py-3 px-4 text-center font-mono">{pkg.total_invoices_paid}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatBDT(pkg.total_retail_volume)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">{pkg.active_subscribers}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Settlements</th>
                  <th className="py-3 px-4 text-right">Daily Commissions</th>
                  <th className="py-3 px-4 text-right">Daily ISP Revenue</th>
                  <th className="py-3 px-4 text-right">Daily Total Disbursed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">Loading timeline audit...</td>
                  </tr>
                ) : data?.daily_timeline.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">No settlements found in this period.</td>
                  </tr>
                ) : (
                  data?.daily_timeline.map((tl) => (
                    <tr key={tl.txn_date} className="hover:bg-slate-800/40 font-mono">
                      <td className="py-3 px-4 font-medium text-slate-300">{tl.txn_date}</td>
                      <td className="py-3 px-4 text-center">{tl.settlements_count}</td>
                      <td className="py-3 px-4 text-right text-emerald-400">{formatBDT(tl.daily_commissions)}</td>
                      <td className="py-3 px-4 text-right text-purple-400">{formatBDT(tl.daily_isp_revenue)}</td>
                      <td className="py-3 px-4 text-right font-bold text-white">{formatBDT(tl.daily_total_disbursed)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
