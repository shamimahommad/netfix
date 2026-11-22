import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  customerLogsService,
  CustomerLogTabType,
  CustomerLogHeader,
  MacLogsData,
  SmsLogsData,
  CallLogsData,
  TaskLogsData,
  SessionLogsData,
  RechargeLogsData,
  SmsLogRow,
  CallLogRow,
  TaskLogRow,
} from '@/services/customer-logs.service';
import { useToastContext } from '@/contexts/ToastContext';
import {
  ArrowLeft,
  RefreshCw,
  Copy,
  FileSpreadsheet,
  Printer,
  Search,
  Server,
  MessageSquare,
  PhoneCall,
  ClipboardList,
  Activity,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Laptop,
  Check,
  Eye,
  X,
  Radio,
  Wifi,
  Send,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Globe,
  Download,
  Filter,
} from 'lucide-react';

export default function CustomerLogsPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToastContext();

  const tabParam = (searchParams.get('tab') || 'mac').toLowerCase() as CustomerLogTabType;
  const activeTab: CustomerLogTabType = ['mac', 'sms', 'calls', 'tasks', 'sessions', 'recharge'].includes(tabParam)
    ? tabParam
    : 'mac';

  const [customer, setCustomer] = useState<CustomerLogHeader | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Detail Modals
  const [selectedSms, setSelectedSms] = useState<SmsLogRow | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLogRow | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskLogRow | null>(null);

  // Session Date Filtering
  const [sessionDatePreset, setSessionDatePreset] = useState<string>('all');
  const [sessionDateFrom, setSessionDateFrom] = useState<string>('');
  const [sessionDateTo, setSessionDateTo] = useState<string>('');
  const [showDailyBreakdown, setShowDailyBreakdown] = useState<boolean>(false);

  const fetchLogs = useCallback(
    async (
      tab: CustomerLogTabType,
      filters?: { preset?: string; date_from?: string; date_to?: string }
    ) => {
      if (!customerId) return;
      setLoading(true);
      try {
        const res = await customerLogsService.getLogs(customerId, tab, filters);
        if (res.success) {
          setCustomer(res.customer);
          setData(res.data);
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || err.message || 'Failed to load customer logs');
      } finally {
        setLoading(false);
      }
    },
    [customerId, toast]
  );

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchLogs('sessions', {
        preset: sessionDatePreset,
        date_from: sessionDateFrom,
        date_to: sessionDateTo,
      });
    } else {
      fetchLogs(activeTab);
    }
    setSearchQuery('');
    setPage(1);
  }, [activeTab, fetchLogs]);

  const handleTabChange = (newTab: CustomerLogTabType) => {
    setSearchParams({ tab: newTab });
  };

  const handleBack = () => {
    if (customerId) {
      navigate(`/dashboard/customers/view/${customerId}`);
    } else {
      navigate('/dashboard/customers');
    }
  };

  const copyToClipboard = (text: string, label = 'Copied') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success(`${label} to clipboard`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Filtered rows for active tab
  const filteredRows = useMemo(() => {
    if (!data || !data.rows) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data.rows;

    return data.rows.filter((r: any) => {
      return Object.values(r).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [data, searchQuery]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  // Export functions
  const exportCsv = () => {
    if (!filteredRows.length) {
      toast.error('No data available to export');
      return;
    }
    const headers = Object.keys(filteredRows[0]);
    const csvContent = [
      headers.join(','),
      ...filteredRows.map((r: any) =>
        headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${customer?.customerCode || 'customer'}_${activeTab}_logs.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV exported successfully');
  };

  const printTable = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all shadow-sm group"
            title="Back to Customer Profile"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Customer Activity &amp; Logs
              {customer?.isOnline && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Complete audit history, MAC tracking, messaging, usage sessions &amp; financial logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs(activeTab)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Customer Quick Header Card */}
      {customer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
            {/* Customer Info */}
            <div className="col-span-2 sm:col-span-1 pr-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Client</span>
              <div className="text-base font-bold text-slate-900 dark:text-white truncate">
                {customer.fullName || '—'}
              </div>
              <div className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-medium">
                #{customer.customerCode || customer.customerId}
              </div>
            </div>

            {/* PPPoE Username */}
            <div className="sm:pl-4 pt-2 sm:pt-0">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Account / User</span>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono truncate">
                {customer.pppoeUsername || '—'}
              </div>
              <div className="text-xs text-slate-500 truncate">{customer.phone || 'No Phone'}</div>
            </div>

            {/* Current IP & MAC */}
            <div className="sm:pl-4 pt-2 sm:pt-0">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Device</span>
              <div className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                {customer.currentMac || 'No MAC'}
                {customer.currentMac && (
                  <button
                    onClick={() => copyToClipboard(customer.currentMac!, 'MAC')}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                    title="Copy MAC"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate">
                {customer.deviceVendor || 'Vendor Unresolved'}
              </div>
            </div>

            {/* Package */}
            <div className="sm:pl-4 pt-2 sm:pt-0">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Package / Plan</span>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                {customer.packageName || 'None'}
              </div>
              <div className="text-xs text-slate-500 font-medium">৳{customer.packagePrice}/mo</div>
            </div>

            {/* Current Balance */}
            <div className="sm:pl-4 pt-2 sm:pt-0">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Account Balance</span>
              <div
                className={`text-base font-bold ${
                  customer.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                ৳{Math.abs(customer.balance).toFixed(2)}
              </div>
              <div className="text-xs text-slate-400">
                {customer.balance > 0 ? 'Outstanding Due' : 'Balance Clear'}
              </div>
            </div>

            {/* Status */}
            <div className="sm:pl-4 pt-2 sm:pt-0 flex flex-col justify-center">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</span>
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 mt-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    customer.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : customer.status === 'suspended'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {customer.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Tabs Navigation Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => handleTabChange('mac')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'mac'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>MAC Logs</span>
          {data && activeTab === 'mac' && (
            <span className="px-1.5 py-0.5 rounded-md text-xs bg-white/20 text-white font-semibold">
              {(data as MacLogsData).total ?? 0}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('sms')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'sms'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>SMS Logs</span>
          {data && activeTab === 'sms' && (
            <span className="px-1.5 py-0.5 rounded-md text-xs bg-white/20 text-white font-semibold">
              {(data as SmsLogsData).totals?.total ?? 0}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('calls')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'calls'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>Call Logs</span>
          {data && activeTab === 'calls' && (
            <span className="px-1.5 py-0.5 rounded-md text-xs bg-white/20 text-white font-semibold">
              {(data as CallLogsData).totals?.total ?? 0}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'tasks'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Task Logs</span>
          {data && activeTab === 'tasks' && (
            <span className="px-1.5 py-0.5 rounded-md text-xs bg-white/20 text-white font-semibold">
              {(data as TaskLogsData).total ?? 0}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('sessions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'sessions'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Sessions / Usages</span>
          {data && activeTab === 'sessions' && (
            <span className="px-1.5 py-0.5 rounded-md text-xs bg-white/20 text-white font-semibold">
              {(data as SessionLogsData).rows?.length ?? 0}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('recharge')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'recharge'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Recharge History</span>
          {data && activeTab === 'recharge' && (
            <span className="px-1.5 py-0.5 rounded-md text-xs bg-white/20 text-white font-semibold">
              {(data as RechargeLogsData).stats?.totalTransactions ?? 0}
            </span>
          )}
        </button>
      </div>

      {/* Tab Header Stats Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {activeTab === 'mac' && (
            <>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Total MAC Records</div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {(data as MacLogsData).total ?? 0}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Unique Hardware</div>
                <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  {(data as MacLogsData).unique ?? 0}
                </div>
              </div>
              <div className="col-span-2 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500 font-medium">Active Locked MAC</div>
                  <div className="text-base sm:text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {(data as MacLogsData).currentMac || 'None Assigned'}
                  </div>
                </div>
                {(data as MacLogsData).currentMac && (
                  <button
                    onClick={() => copyToClipboard((data as MacLogsData).currentMac!, 'Active MAC')}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    title="Copy MAC"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}

          {activeTab === 'sms' && (
            <>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Total Messages</div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {(data as SmsLogsData).totals?.total ?? 0}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Delivered / Sent</div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {(data as SmsLogsData).totals?.delivered ?? 0}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Pending Queue</div>
                <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {(data as SmsLogsData).totals?.pending ?? 0}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Failed</div>
                <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {(data as SmsLogsData).totals?.failed ?? 0}
                </div>
              </div>
            </>
          )}

          {activeTab === 'calls' && (
            <>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Total Voice Calls</div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {(data as CallLogsData).totals?.total ?? 0}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Delivered / Answered</div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {(data as CallLogsData).totals?.delivered ?? 0}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Pending</div>
                <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {(data as CallLogsData).totals?.pending ?? 0}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Failed</div>
                <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {(data as CallLogsData).totals?.failed ?? 0}
                </div>
              </div>
            </>
          )}

          {activeTab === 'tasks' && (
            <>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Total Tasks Executed</div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {(data as TaskLogsData).total ?? 0}
                </div>
              </div>
              <div className="col-span-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Audit Note</div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">
                  Tracks all automated background tasks, MAC binding/unbinding events, package renewals, and staff actions.
                </div>
              </div>
            </>
          )}

          {activeTab === 'sessions' && (
            <>
              {/* Date Range Dropdown Bar */}
              <div className="col-span-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Filter by Date:
                    </span>
                    <div className="relative">
                      <select
                        value={sessionDatePreset}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSessionDatePreset(val);
                          if (val !== 'custom') {
                            fetchLogs('sessions', { preset: val, date_from: '', date_to: '' });
                          }
                        }}
                        className="px-3.5 py-1.5 pr-8 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer appearance-none"
                      >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="this_week">This Week</option>
                        <option value="last_week">Last Week</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="custom">Custom Date Range</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Custom Date Pickers */}
                  {sessionDatePreset === 'custom' && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-500 text-[11px] font-medium">From:</span>
                      <input
                        type="date"
                        value={sessionDateFrom}
                        onChange={(e) => setSessionDateFrom(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                      />
                      <span className="text-slate-500 text-[11px] font-medium">To:</span>
                      <input
                        type="date"
                        value={sessionDateTo}
                        onChange={(e) => setSessionDateTo(e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          fetchLogs('sessions', {
                            preset: 'custom',
                            date_from: sessionDateFrom,
                            date_to: sessionDateTo,
                          })
                        }
                        className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Range Stats Cards */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Data Used in Range</div>
                <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  {(data as SessionLogsData).stats?.rangeTotal || (data as SessionLogsData).stats?.today || '0 B'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  ↓ {(data as SessionLogsData).stats?.rangeDownload || '0 B'} · ↑ {(data as SessionLogsData).stats?.rangeUpload || '0 B'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Time Online in Range</div>
                <div className="text-xl sm:text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">
                  {(data as SessionLogsData).stats?.rangeUptime || '0m'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  Active connection uptime
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                  <span>Assigned IPs</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    {(data as SessionLogsData).stats?.assignedIps?.length ?? 0}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5 min-h-[28px]">
                  {((data as SessionLogsData).stats?.assignedIps && (data as SessionLogsData).stats.assignedIps!.length > 0) ? (
                    (data as SessionLogsData).stats.assignedIps!.slice(0, 2).map((ip) => (
                      <span
                        key={ip}
                        className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                      >
                        {ip}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 font-mono">—</span>
                  )}
                  {((data as SessionLogsData).stats?.assignedIps?.length || 0) > 2 && (
                    <span className="text-[10px] text-slate-400 font-mono self-center">
                      +{(data as SessionLogsData).stats.assignedIps!.length - 2} more
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Historical Month Totals</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                  This Month: <span className="text-sky-600 dark:text-sky-400">{(data as SessionLogsData).stats?.month ?? '0 B'}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  Last Month: {(data as SessionLogsData).stats?.lastMonth ?? '0 B'}
                </div>
              </div>

              {/* Collapsible Daily Breakdown Table */}
              {((data as SessionLogsData).stats?.dailyBreakdown && (data as SessionLogsData).stats.dailyBreakdown!.length > 0) && (
                <div className="col-span-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                  <button
                    type="button"
                    onClick={() => setShowDailyBreakdown((prev) => !prev)}
                    className="w-full px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 flex items-center justify-between transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Daily Usage Breakdown
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono font-semibold">
                        {(data as SessionLogsData).stats.dailyBreakdown!.length} days
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{showDailyBreakdown ? 'Hide details' : 'View day-by-day table'}</span>
                      {showDailyBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {showDailyBreakdown && (
                    <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Total Data</th>
                            <th className="py-2.5 px-3">Time Online</th>
                            <th className="py-2.5 px-3">Assigned IP(s)</th>
                            <th className="py-2.5 px-3 text-right">Disconnects</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {(data as SessionLogsData).stats.dailyBreakdown!.map((d) => (
                            <tr key={d.date} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100 font-sans">
                                {d.date}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                                {d.totalGb} GB
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-teal-600 dark:text-teal-400">
                                {d.uptimeFormatted || '0m'}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {d.assignedIps && d.assignedIps.length > 0 ? (
                                    d.assignedIps.map((ip) => (
                                      <span
                                        key={ip}
                                        className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                      >
                                        {ip}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                    d.disconnectCount > 0
                                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  }`}
                                >
                                  {d.disconnectCount}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'recharge' && (
            <>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Total Renewals (Debit)</div>
                <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  ৳{(data as RechargeLogsData).stats?.totalRecharged ?? '0.00'}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Payments Collected (Credit)</div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  ৳{(data as RechargeLogsData).stats?.totalPaid ?? '0.00'}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Current Balance</div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  ৳{(data as RechargeLogsData).stats?.currentBalance ?? '0.00'}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">Total Ledger Entries</div>
                <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  {(data as RechargeLogsData).stats?.totalTransactions ?? 0}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Table Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={`Search in ${activeTab.toUpperCase()} logs...`}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Tools: Copy, CSV, Print */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm transition-colors"
              title="Download CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              CSV
            </button>
            <button
              onClick={printTable}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm transition-colors"
              title="Print Table"
            >
              <Printer className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Print
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium">Fetching {activeTab.toUpperCase()} records...</p>
          </div>
        )}

        {/* Tab Data Table */}
        {!loading && (
          <div className="overflow-x-auto">
            {filteredRows.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <HelpCircle className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-base font-semibold text-slate-600 dark:text-slate-300">
                  No {activeTab.toUpperCase()} logs found
                </p>
                <p className="text-xs text-slate-400">
                  {searchQuery ? 'Try adjusting your search criteria.' : 'No activity logged yet for this section.'}
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">#</th>

                    {/* TAB SPECIFIC HEADERS */}
                    {activeTab === 'mac' && (
                      <>
                        <th className="py-3 px-4">MAC Address</th>
                        <th className="py-3 px-4">Device / Hardware Vendor</th>
                        <th className="py-3 px-4">Assigned IP</th>
                        <th className="py-3 px-4">First Seen</th>
                        <th className="py-3 px-4">Last Seen</th>
                        <th className="py-3 px-4 text-center">Hits</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </>
                    )}

                    {activeTab === 'sms' && (
                      <>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Recipient</th>
                        <th className="py-3 px-4">Message Content</th>
                        <th className="py-3 px-4">Gateway</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Parts</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </>
                    )}

                    {activeTab === 'calls' && (
                      <>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Voice ID</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Gateway</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">Response</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </>
                    )}

                    {activeTab === 'tasks' && (
                      <>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Policy / Event</th>
                        <th className="py-3 px-4">IP Address</th>
                        <th className="py-3 px-4">Operator / Name</th>
                        <th className="py-3 px-4">Action Details</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </>
                    )}

                    {activeTab === 'sessions' && (
                      <>
                        <th className="py-3 px-4">Start Time</th>
                        <th className="py-3 px-4">End Time</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4">Upload</th>
                        <th className="py-3 px-4">Download</th>
                        <th className="py-3 px-4 font-bold">Total Traffic</th>
                        <th className="py-3 px-4">IP Address</th>
                        <th className="py-3 px-4">MAC Address</th>
                      </>
                    )}

                    {activeTab === 'recharge' && (
                      <>
                        <th className="py-3 px-4">Ref / Invoice #</th>
                        <th className="py-3 px-4 text-rose-600 dark:text-rose-400">Debit</th>
                        <th className="py-3 px-4 text-emerald-600 dark:text-emerald-400">Credit</th>
                        <th className="py-3 px-4">Balance</th>
                        <th className="py-3 px-4">Date / Time</th>
                        <th className="py-3 px-4">Processed By</th>
                        <th className="py-3 px-4">Description</th>
                      </>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {paginatedRows.map((r: any, idx: number) => {
                    const rowNum = (page - 1) * pageSize + idx + 1;

                    return (
                      <tr
                        key={r.id || idx}
                        className={`hover:bg-indigo-50/30 dark:hover:bg-slate-800/40 transition-colors ${
                          r.isCurrent || r.isOngoing ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center font-mono text-xs text-slate-400">{rowNum}</td>

                        {/* TAB 1: MAC LOGS */}
                        {activeTab === 'mac' && (
                          <>
                            <td className="py-3 px-4 font-mono font-semibold">
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                {r.mac}
                                <button
                                  onClick={() => copyToClipboard(r.mac, 'MAC')}
                                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                  title="Copy MAC"
                                >
                                  {copiedText === r.mac ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1.5 font-medium">
                                <Laptop className="w-4 h-4 text-slate-400" />
                                {r.device}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">{r.ip}</td>
                            <td className="py-3 px-4 text-xs text-slate-500">{r.firstSeen}</td>
                            <td className="py-3 px-4 text-xs text-slate-500">{r.lastSeen}</td>
                            <td className="py-3 px-4 text-center font-medium">{r.hits}</td>
                            <td className="py-3 px-4 text-right">
                              {r.isCurrent ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Active / Current
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Previous
                                </span>
                              )}
                            </td>
                          </>
                        )}

                        {/* TAB 2: SMS LOGS */}
                        {activeTab === 'sms' && (
                          <>
                            <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">{r.created_at}</td>
                            <td className="py-3 px-4 font-mono text-xs">{r.to}</td>
                            <td className="py-3 px-4 max-w-xs">
                              <div
                                onClick={() => setSelectedSms(r)}
                                className="truncate cursor-pointer text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                title="Click to view full message"
                              >
                                {r.message}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs font-medium">{r.gateway}</td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  r.status === 1
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                    : r.status === 3
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                                }`}
                              >
                                {r.statusLabel || (r.status === 1 ? 'Delivered' : r.status === 3 ? 'Pending' : 'Failed')}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-xs">{r.count}</td>
                            <td className="py-3 px-4 text-xs text-slate-500">{r.generatedBy}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setSelectedSms(r)}
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </>
                        )}

                        {/* TAB 3: CALL LOGS */}
                        {activeTab === 'calls' && (
                          <>
                            <td className="py-3 px-4 text-xs text-slate-500">{r.created_at}</td>
                            <td className="py-3 px-4 font-mono text-xs">{r.voiceId || '—'}</td>
                            <td className="py-3 px-4 text-xs font-medium">{r.type || 'IVR'}</td>
                            <td className="py-3 px-4 text-xs">{r.gateway || 'Default'}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {r.statusLabel || 'Logged'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs truncate max-w-xs">{r.response || '—'}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setSelectedCall(r)}
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </>
                        )}

                        {/* TAB 4: TASK LOGS */}
                        {activeTab === 'tasks' && (
                          <>
                            <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">{r.created_at}</td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                {r.policy}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">{r.ip}</td>
                            <td className="py-3 px-4 font-medium text-xs text-slate-900 dark:text-white">{r.name}</td>
                            <td className="py-3 px-4 text-xs font-medium">{r.action}</td>
                            <td className="py-3 px-4 text-right">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {r.status}
                              </span>
                            </td>
                          </>
                        )}

                        {/* TAB 5: SESSIONS */}
                        {activeTab === 'sessions' && (
                          <>
                            <td className="py-3 px-4 text-xs font-mono">{r.start}</td>
                            <td className="py-3 px-4 text-xs font-mono">
                              {r.isOngoing ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Ongoing
                                </span>
                              ) : (
                                r.end
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs font-medium">{r.duration}</td>
                            <td className="py-3 px-4 font-mono text-xs text-sky-600 dark:text-sky-400">{r.upload}</td>
                            <td className="py-3 px-4 font-mono text-xs text-emerald-600 dark:text-emerald-400">{r.download}</td>
                            <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900 dark:text-white">{r.total}</td>
                            <td className="py-3 px-4 font-mono text-xs">{r.ip}</td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-500">{r.mac}</td>
                          </>
                        )}

                        {/* TAB 6: RECHARGE */}
                        {activeTab === 'recharge' && (
                          <>
                            <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-white">{r.ref}</td>
                            <td className="py-3 px-4 font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                              {r.debit !== '-' ? `৳${r.debit}` : '—'}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {r.credit !== '-' ? `৳${r.credit}` : '—'}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900 dark:text-white">
                              ৳{r.balance}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">{r.time}</td>
                            <td className="py-3 px-4 text-xs font-medium">{r.by}</td>
                            <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 truncate max-w-xs">{r.description}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && filteredRows.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {Math.min(page * pageSize, filteredRows.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredRows.length}</span> records
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-2">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-1 px-2 focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 font-medium">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SMS Detail Modal */}
      {selectedSms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                SMS Log Details
              </h3>
              <button
                onClick={() => setSelectedSms(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <span className="text-xs text-slate-400 font-medium">Recipient</span>
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedSms.to}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Sent At</span>
                  <div className="text-xs text-slate-700 dark:text-slate-300">{selectedSms.created_at}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Gateway</span>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{selectedSms.gateway}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Status</span>
                  <div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        selectedSms.status === 1
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : selectedSms.status === 3
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                      }`}
                    >
                      {selectedSms.statusLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500">Message Content</span>
                <div className="p-3.5 mt-1 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-slate-800 dark:text-slate-200 font-sans text-sm whitespace-pre-wrap leading-relaxed">
                  {selectedSms.message}
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500">Gateway Response / TrxID</span>
                <div className="p-2.5 mt-1 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 break-all">
                  {selectedSms.response}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedSms(null)}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Detail Modal */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-teal-600" />
                Call Record Details
              </h3>
              <button
                onClick={() => setSelectedCall(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <span className="text-xs text-slate-400 font-medium">Voice ID</span>
                  <div className="font-mono font-semibold">{selectedCall.voiceId || '—'}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Type</span>
                  <div className="font-medium">{selectedCall.type || 'IVR Alert'}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Timestamp</span>
                  <div className="text-xs">{selectedCall.created_at}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">Gateway</span>
                  <div className="text-xs">{selectedCall.gateway || 'Default'}</div>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500">API Response</span>
                <div className="p-3 mt-1 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-xs break-all">
                  {selectedCall.response || 'No raw response received'}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedCall(null)}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
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
