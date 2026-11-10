import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Search, 
  Server, 
  UserCheck, 
  UserX, 
  AlertCircle, 
  Copy, 
  Check, 
  ExternalLink,
  Filter,
  Terminal,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Database,
  Zap,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/common';
import { Link } from 'react-router-dom';

interface RouterOption {
  network_device_id: string;
  device_name: string;
  management_ip: string;
  syslog_token?: string;
  status?: string;
}

interface LogCustomer {
  customer_id: string;
  customer_code: string;
  full_name: string;
  phone?: string;
  owner_id?: string;
  owner_name?: string;
  owner_role?: string;
}

interface PppoeLogItem {
  id: string;
  time: string;
  logged_at?: string;
  topics?: string;
  event_type: 'connected' | 'disconnected' | 'auth_failed' | 'info';
  action?: 'login' | 'logout' | 'failed' | 'connected' | 'authenticated' | 'info';
  username: string | null;
  customer: LogCustomer | null;
  assigned_ip?: string | null;
  ip: string | null;
  caller_mac?: string | null;
  mac: string | null;
  interface_name?: string | null;
  session_time_seconds?: number | null;
  bytes_uploaded?: number | null;
  bytes_downloaded?: number | null;
  disconnect_reason?: string | null;
  message: string;
  raw_message?: string;
  router_id?: string;
  router_name?: string;
}

interface PppoeLogsResponse {
  success: boolean;
  data?: PppoeLogItem[];
  logs?: PppoeLogItem[];
  total: number;
  pagination?: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
  routers: RouterOption[];
  current_router?: {
    network_device_id: string;
    device_name: string;
    management_ip: string;
    management_port: number;
  } | null;
  metrics?: {
    connected?: number;
    disconnected?: number;
    auth_failed?: number;
  };
  is_online?: boolean;
  user_role?: string;
  is_admin?: boolean;
  status_message?: string;
}

interface SyslogSetupScriptResponse {
  success: boolean;
  router: {
    id: string;
    name: string;
    ip: string;
    syslog_token: string;
  };
  server_host: string;
  server_port: number;
  prefix: string;
  script: string;
  message?: string;
}

export default function PppoeLogsPage() {
  const [logs, setLogs] = useState<PppoeLogItem[]>([]);
  const [routers, setRouters] = useState<RouterOption[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState<string>('all');
  const [currentRouter, setCurrentRouter] = useState<PppoeLogsResponse['current_router']>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'connected' | 'disconnected' | 'auth_failed'>('all');
  const [dateRangePreset, setDateRangePreset] = useState<'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom'>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(25);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Stats
  const [metrics, setMetrics] = useState<{ connected: number; disconnected: number; auth_failed: number }>({
    connected: 0,
    disconnected: 0,
    auth_failed: 0,
  });

  // UI state
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [setupModalRouterId, setSetupModalRouterId] = useState<string>('');
  const [setupScriptData, setSetupScriptData] = useState<SyslogSetupScriptResponse | null>(null);
  const [isLoadingScript, setIsLoadingScript] = useState<boolean>(false);

  // Fetch Logs from High-Throughput Engine
  const fetchLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const params: Record<string, any> = {
        page,
        per_page: perPage,
      };

      if (selectedRouterId && selectedRouterId !== 'all') {
        params.router_id = selectedRouterId;
      }

      if (eventTypeFilter && eventTypeFilter !== 'all') {
        params.event_type = eventTypeFilter;
      }

      if (userFilter) {
        params.username = userFilter;
      } else if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      // Date Range Calculation
      const today = new Date();
      const formatDate = (d: Date) => d.toISOString().split('T')[0];

      if (dateRangePreset === 'today') {
        params.date_from = formatDate(today);
        params.date_to = formatDate(today);
      } else if (dateRangePreset === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        params.date_from = formatDate(yesterday);
        params.date_to = formatDate(yesterday);
      } else if (dateRangePreset === '7d') {
        const d7 = new Date(today);
        d7.setDate(d7.getDate() - 7);
        params.date_from = formatDate(d7);
        params.date_to = formatDate(today);
      } else if (dateRangePreset === '30d') {
        const d30 = new Date(today);
        d30.setDate(d30.getDate() - 30);
        params.date_from = formatDate(d30);
        params.date_to = formatDate(today);
      } else if (dateRangePreset === 'custom') {
        if (customDateFrom) params.date_from = customDateFrom;
        if (customDateTo) params.date_to = customDateTo;
      }

      // Query high-throughput PPPoE syslog logs endpoint
      const response = await api.get<PppoeLogsResponse>('/logs/pppoe', { params });

      if (response.data.success) {
        const rawLogs = response.data.data || response.data.logs || [];
        setLogs(rawLogs);
        setRouters(response.data.routers || []);
        if (response.data.current_router) {
          setCurrentRouter(response.data.current_router);
        }

        const pagination = response.data.pagination;
        if (pagination) {
          setTotalRecords(pagination.total);
          setTotalPages(pagination.total_pages || Math.ceil(pagination.total / perPage) || 1);
        } else {
          setTotalRecords(response.data.total || rawLogs.length);
          setTotalPages(Math.ceil((response.data.total || rawLogs.length) / perPage) || 1);
        }

        if (response.data.metrics) {
          setMetrics({
            connected: response.data.metrics.connected || 0,
            disconnected: response.data.metrics.disconnected || 0,
            auth_failed: response.data.metrics.auth_failed || 0,
          });
        }
      } else {
        setError(response.data.status_message || 'Failed to fetch PPPoE connection logs');
      }
    } catch (err: any) {
      console.error('Error fetching PPPoE logs:', err);
      // Fallback to /network/pppoe-logs if needed
      try {
        const fallbackRes = await api.get<PppoeLogsResponse>('/network/pppoe-logs', { 
          params: { router_id: selectedRouterId } 
        });
        if (fallbackRes.data.success) {
          setLogs(fallbackRes.data.logs || []);
          setRouters(fallbackRes.data.routers || []);
          setTotalRecords(fallbackRes.data.total || (fallbackRes.data.logs || []).length);
          return;
        }
      } catch {}
      setError(err?.response?.data?.message || err?.message || 'Error communicating with logging service');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, perPage, selectedRouterId, eventTypeFilter, userFilter, searchQuery, dateRangePreset, customDateFrom, customDateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh interval (every 6 seconds if enabled)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  // Fetch Syslog Setup Script when modal opens
  const fetchSetupScript = useCallback(async (rId: string) => {
    if (!rId) return;
    setIsLoadingScript(true);
    try {
      const res = await api.get<SyslogSetupScriptResponse>('/routers/syslog-script', {
        params: { router_id: rId }
      });
      if (res.data.success) {
        setSetupScriptData(res.data);
      }
    } catch (err) {
      console.error('Failed to load setup script:', err);
    } finally {
      setIsLoadingScript(false);
    }
  }, []);

  useEffect(() => {
    if (showSetupModal && setupModalRouterId) {
      fetchSetupScript(setupModalRouterId);
    }
  }, [showSetupModal, setupModalRouterId, fetchSetupScript]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  const handleOpenSetupGuide = () => {
    const targetId = (selectedRouterId && selectedRouterId !== 'all') 
      ? selectedRouterId 
      : (routers[0]?.network_device_id || '');
    setSetupModalRouterId(targetId);
    setShowSetupModal(true);
  };

  const handleFilterByUser = (username: string) => {
    setUserFilter(username);
    setPage(1);
  };

  const clearUserFilter = () => {
    setUserFilter(null);
    setPage(1);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          icon={<Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />}
          title="PPPoE Connection Logs"
          subtitle="Real-time multi-tenant MikroTik router authentication, live logins, and session disconnection events"
        />

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Syslog Setup Guide Button */}
          <button
            onClick={handleOpenSetupGuide}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 shadow-xs transition-all active:scale-95"
            title="View MikroTik remote syslog configuration commands"
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Setup Syslog Stream</span>
          </button>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer select-none bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
            />
            <span>Auto Refresh (6s)</span>
          </label>

          <button
            onClick={() => fetchLogs(false)}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Router Selector & Connection Status Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Storage Target</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                CENTRALIZED SYSLOG ENGINE
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">Port 514 UDP</span>
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {selectedRouterId === 'all' 
                ? `All Configured Routers (${routers.length} Active)` 
                : (routers.find(r => r.network_device_id === selectedRouterId)?.device_name || 'Selected Router')}
            </p>
          </div>
        </div>

        {routers.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Filter Router:</span>
            <select
              value={selectedRouterId}
              onChange={(e) => {
                setSelectedRouterId(e.target.value);
                setPage(1);
              }}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">🌐 All Routers Combined ({routers.length})</option>
              {routers.map((r) => (
                <option key={r.network_device_id} value={r.network_device_id}>
                  {r.device_name} ({r.management_ip})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Matching Logs</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {totalRecords.toLocaleString()}
          </p>
          <span className="text-[11px] text-slate-400">Indexed Database Rows</span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Connected</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {(metrics.connected || 0).toLocaleString()}
          </p>
          <span className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">Past 24 Hours</span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Disconnected</span>
            <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              <UserX className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
            {(metrics.disconnected || 0).toLocaleString()}
          </p>
          <span className="text-[11px] text-slate-400">Past 24 Hours</span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Auth Failures</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {(metrics.auth_failed || 0).toLocaleString()}
          </p>
          <span className="text-[11px] text-amber-600/70 dark:text-amber-400/70">Bad Credentials / Timeout</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs space-y-3">
        {/* Active Customer Filter Pill */}
        {userFilter && (
          <div className="flex items-center gap-2 p-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs">
            <span className="text-indigo-700 dark:text-indigo-300 font-semibold">
              Viewing connection history for PPPoE user: <strong>{userFilter}</strong>
            </span>
            <button
              onClick={clearUserFilter}
              className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              <X className="w-3 h-3" />
              <span>Clear Filter</span>
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Event Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => { setEventTypeFilter('all'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                eventTypeFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => { setEventTypeFilter('connected'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                eventTypeFilter === 'connected'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              Connected
            </button>
            <button
              onClick={() => { setEventTypeFilter('disconnected'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                eventTypeFilter === 'disconnected'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              Disconnected
            </button>
            <button
              onClick={() => { setEventTypeFilter('auth_failed'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                eventTypeFilter === 'auth_failed'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              Auth Failed
            </button>
          </div>

          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Time:</span>
            </span>
            {(['all', 'today', 'yesterday', '7d', '30d'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setDateRangePreset(preset);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  dateRangePreset === preset
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {preset === 'all' && 'All Time'}
                {preset === 'today' && 'Today'}
                {preset === 'yesterday' && 'Yesterday'}
                {preset === '7d' && '7 Days'}
                {preset === '30d' && '30 Days'}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search User, IP, MAC..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Main Logs DataTable */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
            <p className="text-sm font-medium">Querying time-series PPPoE connection logs...</p>
          </div>
        ) : error && logs.length === 0 ? (
          <div className="p-12 text-center text-rose-500 space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-rose-500" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={() => fetchLogs(false)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs"
            >
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Filter className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No PPPoE connection logs recorded yet</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Configure your MikroTik router to forward PPPoE events to NetFix UDP Syslog on port 514 using the Setup Guide.
            </p>
            <button
              onClick={handleOpenSetupGuide}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-xs"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Open MikroTik Setup Guide</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/75 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-700 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Router</th>
                  <th className="py-3 px-4">Event Status</th>
                  <th className="py-3 px-4">PPPoE User & Customer</th>
                  <th className="py-3 px-4">Assigned IP</th>
                  <th className="py-3 px-4">Caller MAC</th>
                  <th className="py-3 px-4">Interface</th>
                  <th className="py-3 px-4">Details / Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {logs.map((item) => {
                  const ev = item.event_type || item.action || 'info';

                  let badge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {ev.toUpperCase()}
                    </span>
                  );

                  if (ev === 'connected' || ev === 'login' || ev === 'authenticated') {
                    badge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        CONNECTED
                      </span>
                    );
                  } else if (ev === 'disconnected' || ev === 'logout') {
                    badge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        DISCONNECTED
                      </span>
                    );
                  } else if (ev === 'auth_failed' || ev === 'failed') {
                    badge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        AUTH FAILED
                      </span>
                    );
                  }

                  const ipAddr = item.assigned_ip || item.ip;
                  const macAddr = item.caller_mac || item.mac;
                  const timeVal = item.logged_at || item.time;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                        {timeVal}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <Server className="w-3 h-3 text-slate-400" />
                          <span>{item.router_name || 'Router'}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {badge}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.username ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleFilterByUser(item.username!)}
                                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline font-mono text-left cursor-pointer"
                                title="Click to filter connection history for this user"
                              >
                                {item.username}
                              </button>
                              {item.customer && (
                                <Link
                                  to={`/dashboard/customers/view/${item.customer.customer_id}`}
                                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold"
                                  title={`View customer ${item.customer.full_name} (${item.customer.customer_code})`}
                                >
                                  <span>{item.customer.customer_code}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                            {item.customer && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{item.customer.full_name}</span>
                                {item.customer.owner_name && (
                                  <>
                                    <span>•</span>
                                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-semibold">
                                      {item.customer.owner_role === 'agent' ? 'Agent: ' : (item.customer.owner_role === 'reseller' ? 'Reseller: ' : 'Owner: ')}
                                      <strong>{item.customer.owner_name}</strong>
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {ipAddr ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300 font-semibold">
                              {ipAddr}
                            </span>
                            <button
                              onClick={() => copyToClipboard(ipAddr)}
                              title="Copy IP"
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              {copiedText === ipAddr ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {macAddr ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md font-semibold border border-indigo-200 dark:border-indigo-800">
                              {macAddr}
                            </span>
                            <button
                              onClick={() => copyToClipboard(macAddr)}
                              title="Copy MAC"
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              {copiedText === macAddr ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                        {item.interface_name || `pppoe-${item.username || 'user'}`}
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-md truncate font-mono" title={item.raw_message || item.message}>
                        {item.disconnect_reason ? (
                          <span className="font-semibold text-rose-600 dark:text-rose-400 mr-1.5">
                            [{item.disconnect_reason}]
                          </span>
                        ) : null}
                        {item.message || item.raw_message}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalRecords > 0 && (
          <div className="p-4 border-t border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500">
              Showing <strong>{((page - 1) * perPage) + 1}</strong> to <strong>{Math.min(page * perPage, totalRecords)}</strong> of <strong>{totalRecords.toLocaleString()}</strong> logs
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Rows:</span>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MikroTik Syslog Setup Guide Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    MikroTik PPPoE Syslog Setup Guide
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Stream connection & auth events directly to NetFix High-Throughput Engine
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSetupModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {/* Router Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Target MikroTik Router:
                </label>
                <select
                  value={setupModalRouterId}
                  onChange={(e) => setSetupModalRouterId(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {routers.map((r) => (
                    <option key={r.network_device_id} value={r.network_device_id}>
                      {r.device_name} ({r.management_ip})
                    </option>
                  ))}
                </select>
              </div>

              {isLoadingScript ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                  <p className="text-xs">Generating router setup script...</p>
                </div>
              ) : setupScriptData ? (
                <div className="space-y-4">
                  {/* Info Pill */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Syslog Host</span>
                      <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{setupScriptData.server_host}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Port</span>
                      <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{setupScriptData.server_port} (UDP)</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Router Token</span>
                      <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{setupScriptData.prefix}</p>
                    </div>
                  </div>

                  {/* CLI Code Block */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Copy & Paste into MikroTik Terminal:
                      </span>
                      <button
                        onClick={() => copyToClipboard(setupScriptData.script)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95"
                      >
                        {copiedText === setupScriptData.script ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Commands</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="p-3.5 bg-slate-950 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 select-all">
                      {setupScriptData.script}
                    </pre>
                  </div>

                  {/* 3 Step Instruction */}
                  <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-bold text-indigo-700 dark:text-indigo-300">How to activate:</p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                      <li>Open Winbox or SSH into your MikroTik router.</li>
                      <li>Click <strong>New Terminal</strong>.</li>
                      <li>Paste the commands above and hit Enter.</li>
                      <li>PPPoE connection and auth events will immediately stream into NetFix in real time!</li>
                    </ol>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex justify-end">
              <button
                onClick={() => setShowSetupModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
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
