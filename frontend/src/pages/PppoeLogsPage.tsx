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
  X,
  Database,
  Globe,
  Clock,
  Layers,
  Download,
  CheckCircle2,
  Zap,
  Settings2,
  Radio,
  CheckCheck
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, MetricCard, ModernCheckbox } from '@/components/common';
import { Link } from 'react-router-dom';
import { useToastContext } from '@/contexts/ToastContext';

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
  host_source?: string;
  prefix: string;
  script: string;
  message?: string;
}

function formatLogTimestamp(ts: string | undefined): { date: string; time: string } {
  if (!ts) return { date: '—', time: '—' };
  try {
    const cleanTs = ts.includes(' ') && !ts.includes('T') ? ts.replace(' ', 'T') : ts;
    const d = new Date(cleanTs);
    if (isNaN(d.getTime())) {
      return { date: ts, time: '' };
    }
    const day = d.getDate();
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    const yr = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return {
      date: `${day} ${mon} ${yr}`,
      time: `${h}:${m}:${s}`,
    };
  } catch {
    return { date: ts, time: '' };
  }
}

export default function PppoeLogsPage() {
  const toast = useToastContext();
  const [logs, setLogs] = useState<PppoeLogItem[]>([]);
  const [routers, setRouters] = useState<RouterOption[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState<string>('all');
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

  // Selection state (ModernCheckbox)
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

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

  // Setup Modal State & 1-Click Trigger
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [setupModalRouterId, setSetupModalRouterId] = useState<string>('');
  const [setupScriptData, setSetupScriptData] = useState<SyslogSetupScriptResponse | null>(null);
  const [isLoadingScript, setIsLoadingScript] = useState<boolean>(false);
  const [customServerHost, setCustomServerHost] = useState<string>('');
  const [isConfiguringRouter, setIsConfiguringRouter] = useState<boolean>(false);
  const [autoSetupSuccess, setAutoSetupSuccess] = useState<string | null>(null);
  const [autoSetupError, setAutoSetupError] = useState<string | null>(null);

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

      const response = await api.get<PppoeLogsResponse>('/logs/pppoe', { params });

      if (response.data.success) {
        const rawLogs = response.data.data || response.data.logs || [];
        setLogs(rawLogs);
        setRouters(response.data.routers || []);

        const pagination = response.data.pagination;
        if (pagination) {
          setTotalRecords(pagination.total);
          setTotalPages(pagination.total_pages || Math.ceil(pagination.total / perPage) || 1);
        } else {
          const tot = response.data.total || rawLogs.length;
          setTotalRecords(tot);
          setTotalPages(Math.ceil(tot / perPage) || 1);
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
      // Fallback
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
      const msg = err?.response?.data?.message || err?.message || 'Error communicating with logging service';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, perPage, selectedRouterId, eventTypeFilter, userFilter, searchQuery, dateRangePreset, customDateFrom, customDateTo, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Clear selections when page or filters change
  useEffect(() => {
    setSelectedLogIds(new Set());
  }, [page, perPage, selectedRouterId, eventTypeFilter, userFilter, searchQuery]);

  // Auto-refresh interval (every 6 seconds if enabled)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  // Fetch Syslog Setup Script with Auto-Detected IP & Token
  const fetchSetupScript = useCallback(async (rId: string, overrideHost?: string) => {
    if (!rId) return;
    setIsLoadingScript(true);
    setAutoSetupSuccess(null);
    setAutoSetupError(null);
    try {
      const params: Record<string, any> = { router_id: rId };
      if (overrideHost) params.server_host = overrideHost;
      const res = await api.get<SyslogSetupScriptResponse>('/routers/syslog-script', { params });
      if (res.data.success) {
        setSetupScriptData(res.data);
        if (!overrideHost) {
          setCustomServerHost(res.data.server_host);
        }
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

  const copyToClipboard = (text: string, label = 'Copied to clipboard') => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success(label);
    setTimeout(() => setCopiedText(null), 1500);
  };

  const handleOpenSetupGuide = () => {
    const targetId = (selectedRouterId && selectedRouterId !== 'all') 
      ? selectedRouterId 
      : (routers[0]?.network_device_id || '');
    setSetupModalRouterId(targetId);
    setAutoSetupSuccess(null);
    setAutoSetupError(null);
    setShowSetupModal(true);
  };

  // 1-Click Automatic Router Configuration
  const handle1ClickAutoSetup = async () => {
    if (!setupModalRouterId) return;
    setIsConfiguringRouter(true);
    setAutoSetupSuccess(null);
    setAutoSetupError(null);

    try {
      const payload = {
        router_id: setupModalRouterId,
        server_host: customServerHost || setupScriptData?.server_host,
        server_port: setupScriptData?.server_port || 514,
      };
      const res = await api.post<{ success: boolean; message: string; script?: string }>('/routers/syslog-auto-setup', payload);
      if (res.data.success) {
        setAutoSetupSuccess(res.data.message || 'Syslog server successfully configured in router!');
        toast.success('MikroTik Router configured automatically!');
        fetchLogs(true);
      } else {
        setAutoSetupError(res.data.message || 'Failed to auto-configure router');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Could not connect to router API. Please check router reachability.';
      setAutoSetupError(msg);
      toast.error('Router auto-configuration failed');
    } finally {
      setIsConfiguringRouter(false);
    }
  };

  const handleFilterByUser = (username: string) => {
    setUserFilter(username);
    setPage(1);
  };

  const clearUserFilter = () => {
    setUserFilter(null);
    setPage(1);
  };

  // Modern Checkbox Selection Handlers
  const isAllSelected = useMemo(() => {
    if (logs.length === 0) return false;
    return logs.every((l) => selectedLogIds.has(l.id));
  }, [logs, selectedLogIds]);

  const isIndeterminate = useMemo(() => {
    if (logs.length === 0) return false;
    const someSelected = logs.some((l) => selectedLogIds.has(l.id));
    return someSelected && !isAllSelected;
  }, [logs, selectedLogIds, isAllSelected]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const next = new Set(selectedLogIds);
      logs.forEach((l) => next.add(l.id));
      setSelectedLogIds(next);
    } else {
      const next = new Set(selectedLogIds);
      logs.forEach((l) => next.delete(l.id));
      setSelectedLogIds(next);
    }
  };

  const handleSelectLog = (id: string) => {
    const next = new Set(selectedLogIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedLogIds(next);
  };

  // Bulk Actions
  const selectedLogs = useMemo(() => {
    return logs.filter((l) => selectedLogIds.has(l.id));
  }, [logs, selectedLogIds]);

  const handleCopySelectedIps = () => {
    const ips = Array.from(new Set(selectedLogs.map((l) => l.assigned_ip || l.ip).filter(Boolean)));
    if (ips.length === 0) {
      toast.warning('No IP addresses found in selected items');
      return;
    }
    copyToClipboard(ips.join('\n'), `Copied ${ips.length} IP address(es)`);
  };

  const handleCopySelectedMacs = () => {
    const macs = Array.from(new Set(selectedLogs.map((l) => l.caller_mac || l.mac).filter(Boolean)));
    if (macs.length === 0) {
      toast.warning('No MAC addresses found in selected items');
      return;
    }
    copyToClipboard(macs.join('\n'), `Copied ${macs.length} MAC address(es)`);
  };

  const handleCopySelectedUsers = () => {
    const users = Array.from(new Set(selectedLogs.map((l) => l.username).filter(Boolean)));
    if (users.length === 0) {
      toast.warning('No usernames found in selected items');
      return;
    }
    copyToClipboard(users.join(', '), `Copied ${users.length} username(s)`);
  };

  const handleExportSelectedCSV = () => {
    if (selectedLogs.length === 0) return;
    const headers = [
      'Timestamp',
      'Router',
      'Event',
      'Username',
      'Customer Code',
      'Customer Name',
      'IP Address',
      'MAC Address',
      'Interface',
      'Disconnect Reason',
      'Message'
    ];
    const rows = selectedLogs.map((l) => [
      `"${l.logged_at || l.time || ''}"`,
      `"${l.router_name || ''}"`,
      `"${l.event_type || l.action || ''}"`,
      `"${l.username || ''}"`,
      `"${l.customer?.customer_code || ''}"`,
      `"${(l.customer?.full_name || '').replace(/"/g, '""')}"`,
      `"${l.assigned_ip || l.ip || ''}"`,
      `"${l.caller_mac || l.mac || ''}"`,
      `"${l.interface_name || ''}"`,
      `"${l.disconnect_reason || ''}"`,
      `"${(l.message || l.raw_message || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pppoe_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${selectedLogs.length} logs to CSV`);
  };

  // Pagination page items generator (matches BillingPage / CustomersPage)
  const getPaginationItems = (current: number, total: number): (number | string)[] => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  };

  const startEntryDisplay = totalRecords === 0 ? 0 : (page - 1) * perPage + 1;
  const endEntryDisplay = Math.min(page * perPage, totalRecords);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="PPPoE Connection Logs"
        subtitle="Real-time multi-tenant MikroTik router authentication, live logins, and session disconnection events"
        badge={`${totalRecords.toLocaleString()} Events`}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Setup Syslog Button */}
            <button
              type="button"
              onClick={handleOpenSetupGuide}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 shadow-xs transition-all active:scale-95"
              title="View MikroTik remote syslog configuration commands and 1-click auto setup"
            >
              <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Setup Syslog Stream</span>
            </button>

            {/* Modern Checkbox Auto Refresh Toggle */}
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
              <ModernCheckbox
                checked={autoRefresh}
                onChange={(checked) => setAutoRefresh(checked)}
                size="sm"
                ariaLabel="Toggle auto-refresh"
              />
              <span className="flex items-center gap-1.5">
                <span>Auto Refresh (6s)</span>
                {autoRefresh && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
              </span>
            </label>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchLogs(false)}
              disabled={isLoading || isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs active:scale-95 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Matching Logs"
          value={totalRecords.toLocaleString()}
          subtext="Indexed database events"
          variant="blue"
          icon={<Database className="w-5 h-5" />}
        />
        <MetricCard
          title="Connected"
          value={(metrics.connected || 0).toLocaleString()}
          subtext="Past 24 hours active sessions"
          variant="emerald"
          icon={<UserCheck className="w-5 h-5" />}
        />
        <MetricCard
          title="Disconnected"
          value={(metrics.disconnected || 0).toLocaleString()}
          subtext="Past 24 hours closed sessions"
          variant="slate"
          icon={<UserX className="w-5 h-5" />}
        />
        <MetricCard
          title="Auth Failures"
          value={(metrics.auth_failed || 0).toLocaleString()}
          subtext="Bad credentials / timed out"
          variant="amber"
          icon={<AlertCircle className="w-5 h-5" />}
        />
      </div>

      {/* Router Selector & Connection Status Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Storage Target</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                CENTRALIZED SYSLOG ENGINE
              </span>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">Port 514 UDP</span>
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {selectedRouterId === 'all' 
                ? `All Configured Routers (${routers.length} Active)` 
                : (routers.find((r) => r.network_device_id === selectedRouterId)?.device_name || 'Selected Router')}
            </p>
          </div>
        </div>

        {routers.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 uppercase tracking-wider">Router:</span>
            <select
              value={selectedRouterId}
              onChange={(e) => {
                setSelectedRouterId(e.target.value);
                setPage(1);
              }}
              className="text-xs font-medium px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
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

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Active Customer Filter Pill */}
        {userFilter && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs">
            <span className="text-blue-700 dark:text-blue-300 font-semibold">
              Viewing connection history for PPPoE user: <strong className="font-mono">{userFilter}</strong>
            </span>
            <button
              onClick={clearUserFilter}
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-xs"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filter</span>
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          {/* Event Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => { setEventTypeFilter('all'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                eventTypeFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => { setEventTypeFilter('connected'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                eventTypeFilter === 'connected'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
              }`}
            >
              Connected
            </button>
            <button
              onClick={() => { setEventTypeFilter('disconnected'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                eventTypeFilter === 'disconnected'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
              }`}
            >
              Disconnected
            </button>
            <button
              onClick={() => { setEventTypeFilter('auth_failed'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                eventTypeFilter === 'auth_failed'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
              }`}
            >
              Auth Failed
            </button>
          </div>

          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Time:</span>
            </span>
            {(['all', 'today', 'yesterday', '7d', '30d', 'custom'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setDateRangePreset(preset);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  dateRangePreset === preset
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
                }`}
              >
                {preset === 'all' && 'All Time'}
                {preset === 'today' && 'Today'}
                {preset === 'yesterday' && 'Yesterday'}
                {preset === '7d' && '7 Days'}
                {preset === '30d' && '30 Days'}
                {preset === 'custom' && 'Custom'}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search User, IP, MAC, Message..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Pickers when 'custom' is active */}
        {dateRangePreset === 'custom' && (
          <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">From:</label>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => {
                  setCustomDateFrom(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">To:</label>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => {
                  setCustomDateTo(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        )}
      </div>

      {/* Floating Modern Checkbox Bulk Action Bar */}
      {selectedLogIds.size > 0 && (
        <div className="bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-xl p-3 sm:p-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {selectedLogIds.size}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-100">
              Log entries selected on this page
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopySelectedIps}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs active:scale-95 transition-all"
            >
              <Copy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Copy IPs</span>
            </button>

            <button
              type="button"
              onClick={handleCopySelectedMacs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs active:scale-95 transition-all"
            >
              <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Copy MACs</span>
            </button>

            <button
              type="button"
              onClick={handleCopySelectedUsers}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs active:scale-95 transition-all"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Copy Users</span>
            </button>

            <button
              type="button"
              onClick={handleExportSelectedCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedLogIds(new Set())}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
              <span>Deselect</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Logs DataTable */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="text-sm font-medium">Querying time-series PPPoE connection logs...</p>
          </div>
        ) : error && logs.length === 0 ? (
          <div className="p-12 text-center text-rose-500 space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-rose-500" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={() => fetchLogs(false)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-xs transition-colors shadow-sm"
            >
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Filter className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-slate-700 dark:text-slate-200">No PPPoE connection logs found</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Configure your MikroTik router to forward PPPoE events to NetFix UDP Syslog on port 514 using 1-Click Auto Setup or the Setup Guide.
            </p>
            <button
              onClick={handleOpenSetupGuide}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-xs shadow-sm transition-all active:scale-95"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Open Setup & 1-Click Auto Config</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px] sticky top-0 z-10 select-none">
                <tr>
                  <th className="py-3 px-4" style={{ width: '48px' }}>
                    <ModernCheckbox
                      checked={isAllSelected}
                      indeterminate={isIndeterminate}
                      onChange={handleSelectAll}
                      title="Select all logs on this page"
                    />
                  </th>
                  <th className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      TIMESTAMP
                    </span>
                  </th>
                  <th className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-purple-500" />
                      ROUTER
                    </span>
                  </th>
                  <th className="py-3 px-4">EVENT STATUS</th>
                  <th className="py-3 px-4">PPPOE USER & CUSTOMER</th>
                  <th className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-500" />
                      ASSIGNED IP
                    </span>
                  </th>
                  <th className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      CALLER MAC
                    </span>
                  </th>
                  <th className="py-3 px-4">INTERFACE</th>
                  <th className="py-3 px-4">DETAILS / MESSAGE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium bg-white dark:bg-slate-900">
                {logs.map((item) => {
                  const ev = item.event_type || item.action || 'info';
                  const isSelected = selectedLogIds.has(item.id);

                  let badge = (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {ev.toUpperCase()}
                    </span>
                  );

                  if (ev === 'connected' || ev === 'login' || ev === 'authenticated') {
                    badge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        CONNECTED
                      </span>
                    );
                  } else if (ev === 'disconnected' || ev === 'logout') {
                    badge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        DISCONNECTED
                      </span>
                    );
                  } else if (ev === 'auth_failed' || ev === 'failed') {
                    badge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        AUTH FAILED
                      </span>
                    );
                  }

                  const ipAddr = item.assigned_ip || item.ip;
                  const macAddr = item.caller_mac || item.mac;
                  const timeFormatted = formatLogTimestamp(item.logged_at || item.time);

                  return (
                    <tr 
                      key={item.id} 
                      className={`transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-50/60 dark:bg-blue-900/15' 
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                      }`}
                      onClick={() => handleSelectLog(item.id)}
                    >
                      {/* Checkbox Cell */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <ModernCheckbox
                          checked={isSelected}
                          onChange={() => handleSelectLog(item.id)}
                          title="Select this log"
                        />
                      </td>

                      {/* Timestamp Cell */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs">
                        <div className="flex flex-col">
                          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {timeFormatted.time}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {timeFormatted.date}
                          </span>
                        </div>
                      </td>

                      {/* Router Cell */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <Server className="w-3 h-3 text-slate-400" />
                          <span>{item.router_name || 'Router'}</span>
                        </span>
                      </td>

                      {/* Event Status Cell */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {badge}
                      </td>

                      {/* PPPoE User & Customer Cell */}
                      <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {item.username ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleFilterByUser(item.username!)}
                                className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-mono text-left cursor-pointer"
                                title="Click to filter connection history for this user"
                              >
                                {item.username}
                              </button>
                              {item.customer && (
                                <Link
                                  to={`/dashboard/customers/view/${item.customer.customer_id}`}
                                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-semibold"
                                  title={`View customer ${item.customer.full_name} (${item.customer.customer_code})`}
                                >
                                  <span>{item.customer.customer_code}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                            {item.customer && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                                  {item.customer.full_name}
                                </span>
                                {item.customer.owner_name && (
                                  <>
                                    <span>•</span>
                                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-semibold">
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

                      {/* IP Address Cell */}
                      <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {ipAddr ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-slate-800 dark:text-slate-200 font-semibold">
                              {ipAddr}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(ipAddr, `Copied IP: ${ipAddr}`)}
                              title="Copy IP"
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                            >
                              {copiedText === ipAddr ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* MAC Address Cell */}
                      <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {macAddr ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md font-semibold border border-indigo-200 dark:border-indigo-800">
                              {macAddr}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(macAddr, `Copied MAC: ${macAddr}`)}
                              title="Copy MAC"
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                            >
                              {copiedText === macAddr ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Interface Cell */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                          {item.interface_name || `pppoe-${item.username || 'user'}`}
                        </span>
                      </td>

                      {/* Message Cell */}
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-md truncate font-mono" title={item.raw_message || item.message}>
                        {item.disconnect_reason ? (
                          <span className="font-semibold text-rose-600 dark:text-rose-400 mr-1.5 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                            {item.disconnect_reason}
                          </span>
                        ) : null}
                        <span>{item.message || item.raw_message}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Unified Pagination Bar matching NetFix standards */}
        {totalRecords > 0 && (
          <div className="bg-white dark:bg-slate-900 px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{startEntryDisplay}</span> to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{endEntryDisplay}</span> of{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{totalRecords.toLocaleString()}</span> entries
            </div>

            <div className="flex items-center gap-3">
              {/* Rows Per Page selector */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span>Rows:</span>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1 select-none">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm transition-colors disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Previous page"
                >
                  ‹
                </button>

                {getPaginationItems(page, totalPages).map((item, idx) => {
                  if (item === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="w-6 text-center text-slate-400 dark:text-slate-500 text-xs sm:text-sm">
                        …
                      </span>
                    );
                  }
                  const pageNum = Number(item);
                  const isActive = pageNum === page;
                  return (
                    <button
                      key={`page-${pageNum}`}
                      type="button"
                      onClick={() => setPage(pageNum)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs cursor-default'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm transition-colors disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Next page"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MikroTik Syslog Setup & 1-Click Auto Configuration Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    MikroTik PPPoE Syslog Setup & Auto Config
                  </h3>
                  <p className="text-xs text-slate-500">
                    Auto-detect server IP, 1-Click trigger router setup, or copy pre-filled CLI script
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Target Router Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Select Target MikroTik Router:
                </label>
                <select
                  value={setupModalRouterId}
                  onChange={(e) => {
                    setSetupModalRouterId(e.target.value);
                    setAutoSetupSuccess(null);
                    setAutoSetupError(null);
                  }}
                  className="w-full text-xs sm:text-sm font-medium px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {routers.map((r) => (
                    <option key={r.network_device_id} value={r.network_device_id}>
                      {r.device_name} ({r.management_ip})
                    </option>
                  ))}
                </select>
              </div>

              {isLoadingScript ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                  <p className="text-xs font-medium">Auto-detecting Server IP & generating script...</p>
                </div>
              ) : setupScriptData ? (
                <div className="space-y-4">
                  {/* Server Host Resolution Info Box */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                        Syslog Destination Server
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCheck className="w-3 h-3" />
                        Auto-Detected ({setupScriptData.host_source || 'WAN IP'})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                          Server Public IP / Domain Host:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={customServerHost}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomServerHost(val);
                              fetchSetupScript(setupModalRouterId, val);
                            }}
                            placeholder="e.g. 103.x.x.x or syslog.domain.com"
                            className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                          Port (UDP):
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`${setupScriptData.server_port} UDP`}
                          className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-blue-600 dark:text-blue-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 1-CLICK AUTOMATIC SETUP BUTTON & BANNER */}
                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-800/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 fill-blue-600/20" />
                          <span>1-Click Auto Configuration</span>
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          NetFix will connect directly via RouterOS API to configure Syslog action & PPPoE rules automatically.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handle1ClickAutoSetup}
                        disabled={isConfiguringRouter}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                      >
                        {isConfiguringRouter ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Configuring Router...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>Trigger 1-Click Setup</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Auto Setup Success Notification */}
                    {autoSetupSuccess && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-2.5 animate-in fade-in duration-150">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-emerald-800 dark:text-emerald-300">
                          <p className="font-bold">Setup Completed Successfully!</p>
                          <p className="text-[11px] mt-0.5">{autoSetupSuccess}</p>
                        </div>
                      </div>
                    )}

                    {/* Auto Setup Error Notification */}
                    {autoSetupError && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg flex items-start gap-2.5 animate-in fade-in duration-150">
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-rose-800 dark:text-rose-300">
                          <p className="font-bold">Automatic Configuration Failed</p>
                          <p className="text-[11px] mt-0.5">{autoSetupError}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Don't worry! You can copy the ready-to-use script below and paste it directly into MikroTik Winbox Terminal.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CLI Code Block (Ready to Use) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-slate-500" />
                        Ready-to-Use Terminal Script (Copy & Paste):
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(setupScriptData.script, 'Copied script to clipboard')}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all active:scale-95"
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
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-bold text-slate-800 dark:text-slate-200">How it works:</p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                      <li><strong>1-Click Setup:</strong> Click "Trigger 1-Click Setup" above. NetFix connects to the router API and applies all rules automatically.</li>
                      <li><strong>Manual Terminal:</strong> Or copy the commands above, open Winbox ➜ <strong>New Terminal</strong>, and hit Enter.</li>
                      <li>PPPoE connection and auth logs will immediately stream into your NetFix dashboard in real time!</li>
                    </ol>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
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
