import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  History,
  RefreshCw,
  Search,
  Filter,
  Copy,
  Check,
  Monitor,
  Smartphone,
  Globe,
  User,
  Users,
  Calendar,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Layers,
  Laptop,
} from 'lucide-react';
import { PageHeader } from '@/components/common';
import { resellerService, Reseller } from '@/services/reseller.service';
import { useToastContext } from '@/contexts/ToastContext';

const POLL_INTERVAL_MS = 15_000;

export interface LoginLogEntry {
  sl: number;
  id?: string | number;
  logTime: string;
  ip: string;
  browser: string;
  os: string;
  method: string;
  userId?: string;
  userName?: string;
  username?: string;
  role?: string;
}

function formatLogTime(iso: string): string {
  try {
    if (!iso) return '—';
    const d = new Date(iso.replace(' ', 'T'));
    if (isNaN(d.getTime())) return iso;
    const day = d.getDate();
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    const year = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${day} ${mon} ${year}, ${h}:${m}:${s}`;
  } catch {
    return iso;
  }
}

function getBrowserBadgeColor(browser: string): string {
  const b = (browser || '').toLowerCase();
  if (b.includes('chrome')) return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60';
  if (b.includes('firefox')) return 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/60';
  if (b.includes('edge')) return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60';
  if (b.includes('safari')) return 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800/60';
  return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
}

function getOsBadgeColor(os: string): string {
  const o = (os || '').toLowerCase();
  if (o.includes('windows')) return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60';
  if (o.includes('mac') || o.includes('ios')) return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700';
  if (o.includes('android')) return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60';
  if (o.includes('linux')) return 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/60';
  return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
}

export default function LoginLogPage() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();

  const [resellersList, setResellersList] = useState<Reseller[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(userId || 'all');
  const [user, setUser] = useState<Reseller | null>(null);
  const [log, setLog] = useState<LoginLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [osFilter, setOsFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(15);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  // 1. Load available resellers list for dropdown
  useEffect(() => {
    resellerService
      .list({ limit: 200 })
      .then((res) => {
        if (res.data) {
          setResellersList(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // Sync selectedUserId when URL param changes
  useEffect(() => {
    if (userId) {
      setSelectedUserId(userId);
    }
  }, [userId]);

  // 2. Fetch logs for selected reseller (or all)
  const fetchLogs = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setIsRefreshing(true);
      try {
        const targetId = selectedUserId && selectedUserId !== 'all' ? selectedUserId : undefined;

        // Fetch user profile if single user selected
        if (targetId) {
          resellerService
            .getOne(targetId)
            .then((u) => setUser(u))
            .catch(() => setUser(null));
        } else {
          setUser(null);
        }

        const res = await resellerService.getLoginLog(targetId);
        const items = (res.items ?? []).map((r, i) => ({
          sl: i + 1,
          id: r.id,
          logTime: r.logTime ? formatLogTime(r.logTime) : '—',
          ip: r.ip || '—',
          browser: r.browser || 'Unknown',
          os: r.os || 'Unknown',
          method: r.method || 'web',
          userId: r.user_id ? String(r.user_id) : targetId,
          userName: r.userName || user?.name,
          username: r.username || user?.username,
          role: r.role || user?.role || 'reseller',
        }));
        setLog(items);
        if (isManualRefresh) {
          toast.success('Login logs refreshed');
        }
      } catch (err: any) {
        if (isManualRefresh) {
          toast.error(err?.message || 'Failed to refresh login logs');
        }
      } finally {
        setLoading(false);
        if (isManualRefresh) setIsRefreshing(false);
      }
    },
    [selectedUserId, user?.name, user?.username, user?.role, toast],
  );

  useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [selectedUserId, fetchLogs]);

  // Polling loop
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchLogs(false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchLogs]);

  // Handle changing reseller from selector
  const handleResellerChange = (newId: string) => {
    setSelectedUserId(newId);
    setCurrentPage(1);
    if (newId && newId !== 'all') {
      navigate(`/dashboard/reseller/login-log/${newId}`);
    } else {
      navigate('/dashboard/reseller/login-log');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIp(text);
    setTimeout(() => setCopiedIp(null), 1500);
  };

  // Filtered logs
  const filteredLog = useMemo(() => {
    return log.filter((r) => {
      if (osFilter !== 'all' && !r.os.toLowerCase().includes(osFilter.toLowerCase())) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesIp = r.ip.toLowerCase().includes(q);
        const matchesBrowser = r.browser.toLowerCase().includes(q);
        const matchesOs = r.os.toLowerCase().includes(q);
        const matchesMethod = r.method.toLowerCase().includes(q);
        const matchesTime = r.logTime.toLowerCase().includes(q);
        const matchesUser = (r.userName || '').toLowerCase().includes(q);
        const matchesUsername = (r.username || '').toLowerCase().includes(q);
        return matchesIp || matchesBrowser || matchesOs || matchesMethod || matchesTime || matchesUser || matchesUsername;
      }
      return true;
    });
  }, [log, osFilter, search]);

  // Pagination
  const totalPages = Math.ceil(filteredLog.length / entriesPerPage) || 1;
  const paginatedLog = useMemo(() => {
    const start = (currentPage - 1) * entriesPerPage;
    return filteredLog.slice(start, start + entriesPerPage);
  }, [filteredLog, currentPage, entriesPerPage]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalSessions = log.length;
    const uniqueIps = new Set(log.map((l) => l.ip).filter((ip) => ip && ip !== '—')).size;
    const uniqueUsers = new Set(log.map((l) => l.userId || l.username).filter(Boolean)).size;

    // Determine top browser
    const browserCounts: Record<string, number> = {};
    log.forEach((l) => {
      const b = l.browser || 'Unknown';
      browserCounts[b] = (browserCounts[b] || 0) + 1;
    });
    let topBrowser = 'Chrome';
    let maxB = 0;
    Object.entries(browserCounts).forEach(([b, count]) => {
      if (count > maxB) {
        maxB = count;
        topBrowser = b;
      }
    });

    return { totalSessions, uniqueIps, uniqueUsers, topBrowser };
  }, [log]);

  // Export to CSV
  const exportCsv = () => {
    if (log.length === 0) {
      toast.error('No login records to export');
      return;
    }
    const headers = ['SL', 'Reseller Name', 'Username', 'Role', 'Log Time', 'IP Address', 'Browser', 'OS', 'Method'];
    const rows = log.map((l, i) => [
      i + 1,
      `"${l.userName || '—'}"`,
      `"${l.username || '—'}"`,
      `"${l.role || 'reseller'}"`,
      `"${l.logTime}"`,
      `"${l.ip}"`,
      `"${l.browser}"`,
      `"${l.os}"`,
      `"${l.method}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reseller_login_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV exported successfully');
  };

  return (
    <div className="w-full min-w-0 space-y-6 pb-20 relative">
      
      {/* Standard NetFix PageHeader */}
      <PageHeader
        backTo="/dashboard/reseller"
        icon={<History className="w-5 h-5 text-indigo-500" />}
        title="Reseller Login Logs"
        subtitle="Monitor authentication history, login timestamps, active IP addresses, and device environments"
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            {filteredLog.length} Sessions Logged
          </span>
        }
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Auto refresh toggle */}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer select-none bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                Auto-Refresh (15s)
              </span>
            </label>

            {/* Manual Refresh */}
            <button
              type="button"
              onClick={() => fetchLogs(true)}
              disabled={loading || isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs active:scale-95 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || loading ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={exportCsv}
              disabled={log.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      {/* Reseller Filter & Selector Banner */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Dropdown Selector */}
          <div className="flex-1 max-w-md space-y-1">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Filter by Reseller / User
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Users className="w-4 h-4" />
              </span>
              <select
                value={selectedUserId}
                onChange={(e) => handleResellerChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
              >
                <option value="all">👥 All Resellers & Agents ({resellersList.length})</option>
                {resellersList.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.name || r.username} ({r.username}) — {r.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* User profile overview when single user selected */}
          {user && (
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-xs">
                {user.name.split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'RS'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{user.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    {user.role}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {user.username} {user.phone ? `• ${user.phone}` : ''}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 4 Metric Overview Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>Total Logins</span>
            <History className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {stats.totalSessions}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Authentication events</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>Active Resellers</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
            {stats.uniqueUsers}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Distinct user accounts</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>Distinct IPs</span>
            <Globe className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {stats.uniqueIps}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Unique network addresses</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>Primary Browser</span>
            <Monitor className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
            {stats.topBrowser}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Most common client</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-xs overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by IP, username, browser, or OS..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* OS Filter & Entries Dropdown */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
              {['all', 'windows', 'mac', 'android', 'linux'].map((os) => (
                <button
                  key={os}
                  type="button"
                  onClick={() => {
                    setOsFilter(os);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-colors ${
                    osFilter === os
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {os === 'all' ? 'All OS' : os}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Show:</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold outline-none"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Reseller / User</th>
                <th className="py-3 px-4">Login Timestamp</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Browser</th>
                <th className="py-3 px-4">Platform (OS)</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {paginatedLog.map((row, idx) => {
                const globalIndex = (currentPage - 1) * entriesPerPage + idx + 1;
                const isCopied = copiedIp === row.ip;

                return (
                  <tr
                    key={`${row.logTime}-${row.ip}-${idx}`}
                    className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/30"
                  >
                    {/* Index */}
                    <td className="py-3 px-4 text-center text-slate-400 font-mono text-xs">
                      {globalIndex}
                    </td>

                    {/* Reseller Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {(row.userName || row.username || 'R')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {row.userName || user?.name || row.username || 'Reseller'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {row.username || user?.username || '—'}
                          </div>
                        </div>
                        {row.role && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {row.role}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Log Time */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{row.logTime}</span>
                      </div>
                    </td>

                    {/* IP Address */}
                    <td className="py-3 px-4">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {row.ip}
                        </span>
                        {row.ip && row.ip !== '—' && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(row.ip)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            title="Copy IP"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Browser */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBrowserBadgeColor(row.browser)}`}>
                        <Monitor className="w-3 h-3" />
                        {row.browser}
                      </span>
                    </td>

                    {/* Operating System */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getOsBadgeColor(row.os)}`}>
                        <Laptop className="w-3 h-3" />
                        {row.os}
                      </span>
                    </td>

                    {/* Method */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                        <Globe className="w-3 h-3 text-slate-400" />
                        {row.method}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                        <CheckCircle2 className="w-3 h-3" />
                        Success
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {paginatedLog.length === 0 && !loading && (
          <div className="py-14 px-4 text-center text-slate-500 dark:text-slate-400">
            <History className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No login records found</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {search ? 'Try clearing your search filters.' : 'Reseller authentication history will appear here once users log in.'}
            </p>
          </div>
        )}

        {/* Pagination & Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <strong>{filteredLog.length > 0 ? (currentPage - 1) * entriesPerPage + 1 : 0}</strong> to{' '}
            <strong>{Math.min(currentPage * entriesPerPage, filteredLog.length)}</strong> of{' '}
            <strong>{filteredLog.length}</strong> login events
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold disabled:opacity-40 transition-colors shadow-2xs"
              >
                Previous
              </button>
              
              <div className="px-2 font-mono font-semibold text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold disabled:opacity-40 transition-colors shadow-2xs"
              >
                Next
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
