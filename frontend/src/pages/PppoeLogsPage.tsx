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
  Filter
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/common';
import { Link } from 'react-router-dom';

interface RouterOption {
  network_device_id: string;
  device_name: string;
  management_ip: string;
  status?: string;
}

interface LogCustomer {
  customer_id: string;
  customer_code: string;
  full_name: string;
  phone?: string;
}

interface PppoeLogItem {
  id: string;
  time: string;
  topics: string;
  action: 'login' | 'logout' | 'failed' | 'connected' | 'authenticated' | 'info';
  username: string | null;
  customer: LogCustomer | null;
  ip: string | null;
  mac: string | null;
  message: string;
}

interface PppoeLogsResponse {
  success: boolean;
  is_online: boolean;
  current_router: {
    network_device_id: string;
    device_name: string;
    management_ip: string;
    management_port: number;
  } | null;
  routers: RouterOption[];
  total: number;
  logs: PppoeLogItem[];
  status_message?: string;
}

export default function PppoeLogsPage() {
  const [logs, setLogs] = useState<PppoeLogItem[]>([]);
  const [routers, setRouters] = useState<RouterOption[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState<string>('');
  const [currentRouter, setCurrentRouter] = useState<PppoeLogsResponse['current_router']>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<'all' | 'login' | 'logout' | 'failed'>('all');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  const fetchLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const params: Record<string, string> = {};
      if (selectedRouterId) {
        params.router_id = selectedRouterId;
      }
      const response = await api.get<PppoeLogsResponse>('/network/pppoe-logs', { params });
      if (response.data.success) {
        setLogs(response.data.logs || []);
        setRouters(response.data.routers || []);
        setCurrentRouter(response.data.current_router);
        setIsOnline(response.data.is_online);
        if (!selectedRouterId && response.data.current_router) {
          setSelectedRouterId(response.data.current_router.network_device_id);
        }
      } else {
        setError(response.data.status_message || 'Failed to fetch logs from MikroTik');
      }
    } catch (err: any) {
      console.error('Error fetching PPPoE logs:', err);
      setError(err?.response?.data?.message || err?.message || 'Error communicating with router API');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedRouterId]);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Action filter
      if (actionFilter === 'login' && log.action !== 'login' && log.action !== 'connected' && log.action !== 'authenticated') {
        return false;
      }
      if (actionFilter === 'logout' && log.action !== 'logout') {
        return false;
      }
      if (actionFilter === 'failed' && log.action !== 'failed') {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesUser = log.username?.toLowerCase().includes(q);
        const matchesMac = log.mac?.toLowerCase().includes(q);
        const matchesIp = log.ip?.toLowerCase().includes(q);
        const matchesMsg = log.message?.toLowerCase().includes(q);
        const matchesCustomer = log.customer?.full_name?.toLowerCase().includes(q) || log.customer?.customer_code?.toLowerCase().includes(q);
        if (!matchesUser && !matchesMac && !matchesIp && !matchesMsg && !matchesCustomer) {
          return false;
        }
      }

      return true;
    });
  }, [logs, actionFilter, searchQuery]);

  // Quick stats
  const stats = useMemo(() => {
    let logins = 0;
    let logouts = 0;
    let failed = 0;
    logs.forEach((l) => {
      if (l.action === 'login' || l.action === 'connected' || l.action === 'authenticated') logins++;
      else if (l.action === 'logout') logouts++;
      else if (l.action === 'failed') failed++;
    });
    return { total: logs.length, logins, logouts, failed };
  }, [logs]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          icon={<Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />}
          title="PPPoE Logs"
          subtitle="Real-time MikroTik router authentication, live logins, and session disconnection events"
        />

        <div className="flex items-center gap-2.5 shrink-0">
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

      {/* Router Selector & Connection Status */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Router</span>
              {isOnline ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  API ONLINE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  OFFLINE
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {currentRouter ? `${currentRouter.device_name} (${currentRouter.management_ip}:${currentRouter.management_port})` : 'No Router Selected'}
            </p>
          </div>
        </div>

        {routers.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Switch Router:</span>
            <select
              value={selectedRouterId}
              onChange={(e) => setSelectedRouterId(e.target.value)}
              className="text-xs font-semibold px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
            >
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
            <span className="text-xs font-semibold text-slate-500">Total Telemetry</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{stats.total}</p>
          <span className="text-[11px] text-slate-400">PPPoE & PPP Entries</span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Connections / Logins</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.logins}</p>
          <span className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">Successful Logins</span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Disconnections</span>
            <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              <UserX className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">{stats.logouts}</p>
          <span className="text-[11px] text-slate-400">Logged Out / Disconnected</span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Auth Failures</span>
            <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{stats.failed}</p>
          <span className="text-[11px] text-rose-600/70 dark:text-rose-400/70">Failed Password / Reject</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setActionFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              actionFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setActionFilter('login')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              actionFilter === 'login'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
          >
            Logins ({stats.logins})
          </button>
          <button
            onClick={() => setActionFilter('logout')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              actionFilter === 'logout'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
          >
            Disconnections ({stats.logouts})
          </button>
          <button
            onClick={() => setActionFilter('failed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              actionFilter === 'failed'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
          >
            Auth Failures ({stats.failed})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search User, IP, MAC..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
            <p className="text-sm font-medium">Connecting to MikroTik & fetching real-time logs...</p>
          </div>
        ) : error && logs.length === 0 ? (
          <div className="p-12 text-center text-rose-500 space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-rose-500" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={() => fetchLogs(false)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Filter className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No matching logs found</p>
            <p className="text-xs text-slate-400">Try adjusting your search query or action filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/75 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-700 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Status / Event</th>
                  <th className="py-3 px-4">PPPoE User</th>
                  <th className="py-3 px-4">Assigned IP</th>
                  <th className="py-3 px-4">Caller ID (MAC)</th>
                  <th className="py-3 px-4">Router Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {filteredLogs.map((item) => {
                  let badge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {item.action.toUpperCase()}
                    </span>
                  );

                  if (item.action === 'login' || item.action === 'connected' || item.action === 'authenticated') {
                    badge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        LOGGED IN
                      </span>
                    );
                  } else if (item.action === 'logout') {
                    badge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        LOGGED OUT
                      </span>
                    );
                  } else if (item.action === 'failed') {
                    badge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        AUTH FAILED
                      </span>
                    );
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                        {item.time}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {badge}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.username ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                              {item.username}
                            </span>
                            {item.customer && (
                              <Link
                                to={`/dashboard/customers/view/${item.customer.customer_id}`}
                                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                                title={`View ${item.customer.full_name} (${item.customer.customer_code})`}
                              >
                                <span>{item.customer.customer_code}</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.ip ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300 font-semibold">
                              {item.ip}
                            </span>
                            <button
                              onClick={() => copyToClipboard(item.ip!)}
                              title="Copy IP"
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              {copiedText === item.ip ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.mac ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md font-semibold border border-indigo-200 dark:border-indigo-800">
                              {item.mac}
                            </span>
                            <button
                              onClick={() => copyToClipboard(item.mac!)}
                              title="Copy MAC"
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              {copiedText === item.mac ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-md truncate font-mono" title={item.message}>
                        {item.message}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

