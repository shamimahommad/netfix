import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  User,
  ArrowUpDown,
  X,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import {
  paymentsService,
  type OnlineTransactionItem,
  type OnlineTransactionsSummary,
  type GatewaySummaryItem,
  type PopInChargeItem
} from '@/services/payments.service';
import { formatInvoiceIdDisplay } from '@/lib/formatInvoiceId';
import PageHeader from '@/components/common/PageHeader';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' }
] as const;

const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'customer', label: 'Customer' },
  { value: 'reseller', label: 'Reseller' },
  { value: 'topup', label: 'Topup / Wallet' }
] as const;

const GATEWAY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'bkash', label: 'bKash' },
  { value: 'surjopay', label: 'shurjopay' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'ssl', label: 'SSLCommerz' }
] as const;

const ROWS_OPTIONS = [10, 25, 50, 100] as const;

function formatCompactDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '—';
  }
}

/**
 * Gateway Brand Icon Badges (bKash pink bird, SurjoPay green emblem, Nagad orange, SSL blue)
 */
function GatewayIcon({ gateway, className = "w-6 h-6" }: { gateway: string; className?: string }) {
  const gw = gateway.toLowerCase();

  if (gw === 'bkash') {
    return (
      <div className="w-10 h-10 rounded-lg bg-[#E2136E] flex items-center justify-center flex-shrink-0 shadow-xs">
        <svg viewBox="0 0 100 100" className={className} fill="white">
          <path d="M12 44 L42 12 L56 36 L40 50 Z M44 48 L68 18 L90 18 L62 54 Z M42 54 L72 58 L96 44 L60 72 Z M38 54 L56 74 L36 92 L30 66 Z M34 50 L8 56 L24 68 Z" />
        </svg>
      </div>
    );
  }

  if (gw === 'surjopay' || gw === 'shurjopay') {
    return (
      <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-400 shadow-xs">
        <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 10a2 2 0 012-2h20a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V10z" />
          <circle cx="16" cy="16" r="4" strokeWidth="2" />
          <path d="M8 12h.01M24 20h.01" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (gw === 'nagad') {
    return (
      <div className="w-10 h-10 rounded-lg bg-[#F7941D] flex items-center justify-center flex-shrink-0 text-white font-black text-sm shadow-xs">
        Ng
      </div>
    );
  }

  if (gw === 'ssl' || gw === 'sslcommerz') {
    return (
      <div className="w-10 h-10 rounded-lg bg-[#1E40AF] flex items-center justify-center flex-shrink-0 text-white font-black text-xs shadow-xs">
        SSL
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase shadow-xs">
      {gw.slice(0, 3)}
    </div>
  );
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

  // Filters State
  const [popInCharge, setPopInCharge] = useState('');
  const [status, setStatus] = useState('success');
  const [type, setType] = useState('all');
  const [gateway, setGateway] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Table Controls State
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [tableSearch, setTableSearch] = useState('');

  // Selected item for Details Modal
  const [selectedTxn, setSelectedTxn] = useState<OnlineTransactionItem | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<keyof OnlineTransactionItem>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Server Data
  const [data, setData] = useState<{
    items: OnlineTransactionItem[];
    total: number;
    summary: OnlineTransactionsSummary;
    gatewaySummaries: GatewaySummaryItem[];
    popList: PopInChargeItem[];
  }>({
    items: [],
    total: 0,
    summary: defaultSummary,
    gatewaySummaries: [],
    popList: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentsService.getOnlineTransactions({
        status: status === 'all' ? undefined : status,
        gateway: gateway === 'all' ? undefined : gateway,
        type: type === 'all' ? undefined : type,
        popInCharge: popInCharge || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: tableSearch.trim() || undefined,
        page,
        limit: rowsPerPage,
      });

      const items = (res as any)?.items || (res as any)?.data || [];
      const total = (res as any)?.total ?? (res as any)?.meta?.total ?? items.length;
      const summary = res?.summary || defaultSummary;
      const gatewaySummaries = (res as any)?.gatewaySummaries || [];
      const popList = (res as any)?.popList || [];

      setData({
        items,
        total,
        summary,
        gatewaySummaries,
        popList,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to load online transactions';
      setError(msg);
      setData({ items: [], total: 0, summary: defaultSummary, gatewaySummaries: [], popList: [] });
    } finally {
      setLoading(false);
    }
  }, [status, gateway, type, popInCharge, dateFrom, dateTo, tableSearch, page, rowsPerPage]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleApplyFilter = () => {
    setPage(1);
    fetchTransactions();
  };

  const handleSort = (field: keyof OnlineTransactionItem) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filtered & sorted display items
  const sortedItems = useMemo(() => {
    const list = [...data.items];
    list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
    return list;
  }, [data.items, sortField, sortOrder]);

  const handleExport = () => {
    if (!sortedItems || sortedItems.length === 0) {
      window.alert('No records available to export.');
      return;
    }
    const headers = [
      'Invoice ID',
      'Txn ID',
      'Payee Name',
      'Payee Mobile',
      'Pay Type',
      'Req. Time',
      'Pay Time',
      'Status',
      'Processed',
      'Total',
      'Retry',
      'Bank Txn',
      'Gateway'
    ];
    const rows = sortedItems.map((r) => [
      `"${(r.invoiceNumber || r.merchantInvoiceNumber || '').replace(/"/g, '""')}"`,
      `"${(r.gatewayPaymentId || '').replace(/"/g, '""')}"`,
      `"${(r.payeeName || '').replace(/"/g, '""')}"`,
      `"${(r.payeeMobile || '').replace(/"/g, '""')}"`,
      `"${(r.payType || r.gateway || '').replace(/"/g, '""')}"`,
      `"${formatCompactDate(r.createdAt)}"`,
      `"${formatCompactDate(r.paidAt || r.payTime)}"`,
      `"${r.status === 'PAID' ? 'Paid' : r.status}"`,
      `"${r.processed || (r.status === 'PAID' ? 'Done' : 'Pending')}"`,
      r.amount,
      r.retry ?? 0,
      `"${(r.bankTxn || '').replace(/"/g, '""')}"`,
      `"${(r.gateway || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `online_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.max(1, Math.ceil(data.total / rowsPerPage));

  // Gateways to show in top cards: whichever gateways are added/configured for the tenant
  const displayGatewaySummaries = useMemo(() => {
    if (data.gatewaySummaries && data.gatewaySummaries.length > 0) {
      return data.gatewaySummaries;
    }
    // Fallback default bKash row if none returned
    return [
      {
        gateway: 'bkash',
        label: 'bKash',
        today: data.summary.today,
        yesterday: data.summary.yesterday,
        thisMonth: data.summary.thisMonth,
        lastMonth: data.summary.lastMonth,
        filteredTotal: data.summary.filteredTotal,
      }
    ];
  }, [data.gatewaySummaries, data.summary]);

  return (
    <div className="w-full min-w-0 space-y-5 text-slate-800 dark:text-slate-100">
      {/* Header */}
      <PageHeader
        title="Online Transactions"
        subtitle="Gateway transaction reconciliation, verification logs, and automated invoices"
        badge={`${data.total} Records`}
        actions={
          <button
            type="button"
            onClick={() => fetchTransactions()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
          {error}
        </div>
      )}

      {/* =========================================================================
          GATEWAY-WISE SUMMARY CARDS (EXACT MATCH OF USER SCREENSHOT)
          Shows 1 row of 5 cards per added gateway (e.g. Row 1: bKash, Row 2: shurjopay)
          If only bKash is added, only bKash shows.
      ========================================================================= */}
      <div className="space-y-3">
        {displayGatewaySummaries.map((gwSummary) => (
          <div
            key={gwSummary.gateway}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
          >
            {/* 1. Today */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-xs">
              <GatewayIcon gateway={gwSummary.gateway} />
              <div className="text-right">
                <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  {Math.round(gwSummary.today).toLocaleString()}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  Today
                </div>
              </div>
            </div>

            {/* 2. Yesterday */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-xs">
              <GatewayIcon gateway={gwSummary.gateway} />
              <div className="text-right">
                <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  {Math.round(gwSummary.yesterday).toLocaleString()}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  Yesterday
                </div>
              </div>
            </div>

            {/* 3. This Month */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-xs">
              <GatewayIcon gateway={gwSummary.gateway} />
              <div className="text-right">
                <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  {Math.round(gwSummary.thisMonth).toLocaleString()}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  This Month
                </div>
              </div>
            </div>

            {/* 4. Last Month */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-xs">
              <GatewayIcon gateway={gwSummary.gateway} />
              <div className="text-right">
                <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  {Math.round(gwSummary.lastMonth).toLocaleString()}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  Last Month
                </div>
              </div>
            </div>

            {/* 5. Filtered Total */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-between shadow-xs col-span-2 sm:col-span-1">
              <GatewayIcon gateway={gwSummary.gateway} />
              <div className="text-right">
                <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                  {Math.round(gwSummary.filteredTotal).toLocaleString()}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  Filtered Total
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* =========================================================================
          FILTERS SECTION (EXACT MATCH OF USER SCREENSHOT)
      ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 items-end">
          {/* 1. POP In Charge */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              POP In Charge
            </label>
            <select
              value={popInCharge}
              onChange={(e) => setPopInCharge(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">Choose Pop In-Charge</option>
              {data.popList.map((pop) => (
                <option key={pop.user_id} value={pop.user_id}>
                  {pop.first_name ? `${pop.first_name} ${pop.last_name || ''} (${pop.username})` : pop.username}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Gateway */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Gateway
            </label>
            <select
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {GATEWAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Date From */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          {/* 6. Date To */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Action Button: Search */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleApplyFilter}
            className="inline-flex items-center gap-1.5 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TABLE CONTROLS TOOLBAR & TABLE CARD
      ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        {/* Table Controls (Show rows, Export on left; Search on right) */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-3 py-1.5 text-xs font-medium focus:outline-none"
            >
              {ROWS_OPTIONS.map((n) => (
                <option key={n} value={n}>Show {n} rows</option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-purple-200 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs font-medium transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Search:</span>
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => {
                setTableSearch(e.target.value);
                setPage(1);
              }}
              placeholder=""
              className="px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36 sm:w-48 font-medium"
            />
          </div>
        </div>

        {/* Main Table: Exact 14 columns matching the user's screenshot */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 font-semibold select-none">
                <th
                  onClick={() => handleSort('invoiceNumber')}
                  className="px-3.5 py-3 text-left cursor-pointer hover:text-blue-600"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Invoice ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('gatewayPaymentId')}
                  className="px-3 py-3 text-left cursor-pointer hover:text-blue-600"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Txn ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('payeeName')}
                  className="px-3 py-3 text-left cursor-pointer hover:text-blue-600"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Payee Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('payeeMobile')}
                  className="px-3 py-3 text-left cursor-pointer hover:text-blue-600"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Payee Mobile</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('payType')}
                  className="px-3 py-3 text-left cursor-pointer hover:text-blue-600"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Pay Type</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('createdAt')}
                  className="px-3 py-3 text-left cursor-pointer hover:text-blue-600"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Req. Time</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('paidAt')}
                  className="px-3 py-3 text-left cursor-pointer hover:text-blue-600"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Pay Time</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="px-3 py-3 text-left cursor-pointer hover:text-blue-600"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('processed')}
                  className="px-3 py-3 text-left cursor-pointer hover:text-blue-600"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Processed</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('amount')}
                  className="px-3 py-3 text-right cursor-pointer hover:text-blue-600"
                >
                  <div className="inline-flex items-center justify-end gap-1 w-full">
                    <span>Total</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="px-3 py-3 text-center">
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>Retry</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('bankTxn')}
                  className="px-3 py-3 text-left cursor-pointer hover:text-blue-600"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Bank Txn</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('gateway')}
                  className="px-3 py-3 text-left cursor-pointer hover:text-blue-600"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Gateway</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="px-3 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Loading transactions…
                    </div>
                  </td>
                </tr>
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-12 text-center text-slate-500 dark:text-slate-400">
                    No online gateway transactions match the filters.
                  </td>
                </tr>
              ) : (
                sortedItems.map((r) => {
                  const isPaid = r.status === 'PAID';
                  const isFailed = r.status === 'FAILED' || r.status === 'EXPIRED';

                  return (
                    <tr
                      key={r.paymentIntentId}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* 1. Invoice ID */}
                      <td className="px-3.5 py-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {formatInvoiceIdDisplay(r.invoiceNumber || r.merchantInvoiceNumber)}
                      </td>

                      {/* 2. Txn ID */}
                      <td className="px-3 py-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {r.gatewayPaymentId || '—'}
                      </td>

                      {/* 3. Payee Name */}
                      <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {r.payeeName}
                      </td>

                      {/* 4. Payee Mobile */}
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">
                        {r.payeeMobile}
                      </td>

                      {/* 5. Pay Type */}
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        {r.payType || (r.gateway?.toLowerCase() === 'bkash' ? 'bKash' : 'Nagad')}
                      </td>

                      {/* 6. Req. Time */}
                      <td className="px-3 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatCompactDate(r.createdAt || r.reqTime)}
                      </td>

                      {/* 7. Pay Time */}
                      <td className="px-3 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatCompactDate(r.paidAt || r.payTime)}
                      </td>

                      {/* 8. Status */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            ✔ Paid
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* 9. Processed */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                            Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            {r.processed || 'Pending'}
                          </span>
                        )}
                      </td>

                      {/* 10. Total */}
                      <td className="px-3 py-3 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {Math.round(r.amount).toLocaleString()}
                      </td>

                      {/* 11. Retry */}
                      <td className="px-3 py-3 text-center text-slate-500 dark:text-slate-400">
                        {r.retry ?? 0}
                      </td>

                      {/* 12. Bank Txn */}
                      <td className="px-3 py-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {r.bankTxn || '—'}
                      </td>

                      {/* 13. Gateway */}
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium">
                        {r.gateway}
                      </td>

                      {/* 14. Actions */}
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <div className="inline-flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedTxn(r)}
                            title="View Transaction Details"
                            className="p-1 text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {r.customerId ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/customers/${r.customerId}`)}
                              title="Customer Profile"
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            >
                              <User className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="w-3.5 h-3.5 inline-block opacity-0" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            Showing {data.total === 0 ? 0 : (page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, data.total)} of {data.total} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="px-2 font-medium text-slate-700 dark:text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TRANSACTION DETAILS MODAL DIALOG
      ========================================================================= */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <GatewayIcon gateway={selectedTxn.gateway} className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Online Transaction Details
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {selectedTxn.paymentIntentId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Invoice ID</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {selectedTxn.invoiceNumber || selectedTxn.merchantInvoiceNumber}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Txn ID / Payment ID</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {selectedTxn.gatewayPaymentId || '—'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Payee Name</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedTxn.payeeName}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Payee Mobile</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {selectedTxn.payeeMobile}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Gateway & Channel</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedTxn.gateway} ({selectedTxn.payType || 'Direct'})
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Amount</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  ৳{Math.round(selectedTxn.amount).toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Status</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedTxn.status} ({selectedTxn.processed || 'Pending'})
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Bank Reference</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {selectedTxn.bankTxn || '—'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Request Time</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatCompactDate(selectedTxn.createdAt)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 block mb-0.5">Paid Time</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatCompactDate(selectedTxn.paidAt || selectedTxn.payTime)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
