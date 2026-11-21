import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  History,
  ShieldCheck,
  Activity,
  LogIn,
  Users,
  Layers,
  Search,
  Filter,
  RotateCw,
  Download,
  Calendar,
  Eye,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  X,
  Laptop,
  Globe,
  Clock,
  User,
  ArrowUpRight,
  Printer,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import {
  activityLogsService,
  ActivityLogItem,
  ActivityLogStats,
  ActivityLogFilters,
} from '@/services/activityLogs.service';
import { useToastContext } from '@/contexts/ToastContext';

type TabType = 'all' | 'activity' | 'login' | 'client_task' | 'plan_update';

export default function ActivityLogsPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab
  const initialTab = (searchParams.get('tab') as TabType) || 'all';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Data States
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [stats, setStats] = useState<ActivityLogStats | null>(null);
  const [filterOptions, setFilterOptions] = useState<ActivityLogFilters | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters
  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(search);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [customerIdFilter, setCustomerIdFilter] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Modals & Popovers
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<ActivityLogItem | null>(null);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle outside click for export menu
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showExportMenu]);

  // Load KPI Stats
  const loadStats = async () => {
    setIsStatsLoading(true);
    try {
      const data = await activityLogsService.getStats();
      setStats(data);
    } catch (e: any) {
      console.error('Failed to load activity stats', e);
    } finally {
      setIsStatsLoading(false);
    }
  };

  // Load Filter Options
  const loadFilterOptions = async () => {
    try {
      const data = await activityLogsService.getFilters();
      setFilterOptions(data);
    } catch (e: any) {
      console.error('Failed to load filter options', e);
    }
  };

  // Load Logs
  const loadLogs = async () => {
    setIsLoading(true);
    try {
      let fFrom = dateFrom;
      let fTo = dateTo;

      if (datePreset === 'today') {
        const d = new Date().toISOString().split('T')[0];
        fFrom = d;
        fTo = d;
      } else if (datePreset === 'yesterday') {
        const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        fFrom = y;
        fTo = y;
      } else if (datePreset === '7days') {
        fFrom = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        fTo = new Date().toISOString().split('T')[0];
      } else if (datePreset === '30days') {
        fFrom = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        fTo = new Date().toISOString().split('T')[0];
      }

      const res = await activityLogsService.getLogs({
        type: activeTab,
        user_id: selectedUser || undefined,
        action: selectedAction || undefined,
        module: selectedModule || undefined,
        customer_id: customerIdFilter || undefined,
        date_from: fFrom || undefined,
        date_to: fTo || undefined,
        search: debouncedSearch || undefined,
        page,
        limit,
      });

      setLogs(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (e: any) {
      console.error('Failed to load logs', e);
      toast.error('Failed to load activity logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [
    activeTab,
    page,
    limit,
    debouncedSearch,
    selectedUser,
    selectedAction,
    selectedModule,
    customerIdFilter,
    datePreset,
    dateFrom,
    dateTo,
  ]);

  // Tab switch handler
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (tab === 'all') {
        p.delete('tab');
      } else {
        p.set('tab', tab);
      }
      return p;
    });
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedUser('');
    setSelectedAction('');
    setSelectedModule('');
    setCustomerIdFilter('');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  // Helper for badge color based on action
  const getActionBadge = (action: string) => {
    const act = (action || '').toLowerCase();
    if (act.includes('delete') || act.includes('suspend') || act.includes('cancel')) {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50';
    }
    if (act.includes('renew') || act.includes('recharge') || act.includes('create') || act.includes('onboard') || act.includes('active')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50';
    }
    if (act.includes('login') || act.includes('auth')) {
      return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900/50';
    }
    if (act.includes('export') || act.includes('transfer') || act.includes('wallet')) {
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/50';
    }
    if (act.includes('extend') || act.includes('warning') || act.includes('expire')) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50';
  };

  // Helper for Log Type pill
  const getLogTypeBadge = (logType: string) => {
    switch (logType) {
      case 'login':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300">Login</span>;
      case 'client_task':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">Client Task</span>;
      case 'plan_update':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300">Plan Update</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">Activity</span>;
    }
  };

  // Export handlers
  const handleExport = (format: 'csv' | 'excel' | 'print') => {
    setShowExportMenu(false);
    if (logs.length === 0) {
      toast.error('No logs available to export');
      return;
    }

    if (format === 'print') {
      const printWin = window.open('', '_blank');
      if (!printWin) return;
      const rowsHtml = logs.map((l, i) => `
        <tr>
          <td style="border:1px solid #ddd;padding:6px;font-size:11px;">${i + 1}</td>
          <td style="border:1px solid #ddd;padding:6px;font-size:11px;">${l.createdAt}</td>
          <td style="border:1px solid #ddd;padding:6px;font-size:11px;">${l.user.name} (${l.user.role})</td>
          <td style="border:1px solid #ddd;padding:6px;font-size:11px;">${l.logType}</td>
          <td style="border:1px solid #ddd;padding:6px;font-size:11px;">${l.action}</td>
          <td style="border:1px solid #ddd;padding:6px;font-size:11px;">${l.description}</td>
          <td style="border:1px solid #ddd;padding:6px;font-size:11px;">${l.ipAddress || '—'}</td>
        </tr>
      `).join('');

      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>NetFix Activity Logs Export</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { border: 1px solid #ddd; padding: 8px; font-size: 12px; background: #f4f6f8; text-align: left; }
            h2 { margin: 0; font-size: 18px; color: #1e293b; }
            p { margin: 4px 0 12px; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <h2>NetFix - Activity & Audit Logs Report</h2>
          <p>Export Date: ${new Date().toLocaleString()} | Total Records: ${logs.length}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Timestamp</th>
                <th>Performed By</th>
                <th>Type</th>
                <th>Action</th>
                <th>Description</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
        </html>
      `);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
        printWin.close();
      }, 300);
      return;
    }

    // CSV / Excel
    const headers = ['ID', 'Timestamp', 'User', 'Role', 'Log Type', 'Action', 'Module', 'Target ID', 'Description', 'IP Address', 'Browser', 'Platform'];
    const csvRows = [
      headers.join(','),
      ...logs.map((l) => [
        l.id,
        `"${l.createdAt}"`,
        `"${l.user.name || l.user.username}"`,
        `"${l.user.role}"`,
        `"${l.logType}"`,
        `"${l.action}"`,
        `"${l.module || ''}"`,
        `"${l.targetId || ''}"`,
        `"${(l.description || '').replace(/"/g, '""')}"`,
        `"${l.ipAddress || ''}"`,
        `"${l.browser || ''}"`,
        `"${l.platform || ''}"`,
      ].join(',')),
    ];

    const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `activity_logs_${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'csv' : 'csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${logs.length} activity records`);
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      {/* 1. Header Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-blue-500/5 dark:from-blue-500/20 dark:to-indigo-500/10 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Activity & Audit Logs
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  Live Audit Trail
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Comprehensive security stream tracking authentication, billing operations, subscriber lifecycle, and configuration events.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Refresh */}
            <button
              type="button"
              onClick={() => {
                loadStats();
                loadLogs();
                toast.success('Activity logs refreshed');
              }}
              disabled={isLoading}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh log entries"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Logs</span>
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => handleExport('excel')}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Export as Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Export as CSV</span>
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                  <button
                    type="button"
                    onClick={() => handleExport('print')}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Print Log View</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards (Clean NetFix Visual Hierarchy) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: System Activity */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              System Activity
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/40">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isStatsLoading ? '…' : stats?.actToday ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="inline-block px-1.5 py-0.2 rounded font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                {isStatsLoading ? '…' : stats?.actTotal ?? 0}
              </span>
              <span>total recorded</span>
            </p>
          </div>
        </div>

        {/* Card 2: User Logins */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              User Logins
            </span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-100 dark:border-teal-900/40">
              <LogIn className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isStatsLoading ? '…' : stats?.loginToday ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="inline-block px-1.5 py-0.2 rounded font-medium bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60">
                {isStatsLoading ? '…' : stats?.loginTotal ?? 0}
              </span>
              <span>sessions logged</span>
            </p>
          </div>
        </div>

        {/* Card 3: Client Tasks */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              Client Tasks
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/40">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isStatsLoading ? '…' : stats?.taskToday ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="inline-block px-1.5 py-0.2 rounded font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                {isStatsLoading ? '…' : stats?.taskTotal ?? 0}
              </span>
              <span>customer events</span>
            </p>
          </div>
        </div>

        {/* Card 4: Plan Updates */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              Plan Updates
            </span>
            <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-100 dark:border-violet-900/40">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isStatsLoading ? '…' : stats?.planToday ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="inline-block px-1.5 py-0.2 rounded font-medium bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60">
                {isStatsLoading ? '…' : stats?.planTotal ?? 0}
              </span>
              <span>profile adjustments</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. Tab Pills & Filter Hub */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Audit Trail', count: stats?.allTotal },
            { id: 'activity', label: 'System Activities', count: stats?.actTotal },
            { id: 'login', label: 'Login Sessions', count: stats?.loginTotal },
            { id: 'client_task', label: 'Client Operations', count: stats?.taskTotal },
            { id: 'plan_update', label: 'Plan Updates', count: stats?.planTotal },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id as TabType)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === tab.id
                      ? 'bg-blue-200/70 dark:bg-blue-800/60 text-blue-800 dark:text-blue-200'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          {/* Search Input */}
          <div className="sm:col-span-2 lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, description, user, IP..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* User Select */}
          <div className="sm:col-span-1 lg:col-span-2">
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="">All Users / Staff</option>
              {filterOptions?.users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Action Select */}
          <div className="sm:col-span-1 lg:col-span-2">
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all capitalize"
            >
              <option value="">All Actions</option>
              {filterOptions?.actions.map((act) => (
                <option key={act} value={act}>
                  {act.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Date Presets */}
          <div className="sm:col-span-1 lg:col-span-2">
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="all">Date: All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Rows Limit & Reset */}
          <div className="sm:col-span-1 lg:col-span-2 flex items-center gap-1.5">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              title="Rows per page"
            >
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>

            <button
              type="button"
              onClick={handleResetFilters}
              className="flex-1 py-2 px-2 text-center text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              title="Clear all filters"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Custom Date Pickers (if Custom Selected) */}
        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" /> Date Range:
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
        )}
      </div>

      {/* 4. Table Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Loading platform audit trail...
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <History className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">No activity log entries found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              There are no recorded logs matching your current filter criteria. Try adjusting your filters or search query.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 px-3.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3.5 w-12 text-center">#</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Timestamp</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Performed By</th>
                  {activeTab === 'all' && <th className="py-3 px-3.5 whitespace-nowrap">Log Type</th>}
                  <th className="py-3 px-3.5 whitespace-nowrap">Action / Event</th>
                  <th className="py-3 px-3.5 min-w-[220px]">Description & Details</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Origin (IP & Device)</th>
                  <th className="py-3 px-3.5 w-16 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {logs.map((log, index) => {
                  const rowNumber = (page - 1) * limit + index + 1;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLogForDetail(log)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      {/* Row # */}
                      <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                        {rowNumber}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {log.createdAt ? log.createdAt.split(' ')[0] : '—'}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                            {log.createdAt ? log.createdAt.split(' ')[1] : ''}
                          </span>
                        </div>
                      </td>

                      {/* Performed By */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[11px] shrink-0 uppercase">
                            {(log.user.name || log.user.username || 'S')[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[130px]">
                              {log.user.name || log.user.username}
                            </div>
                            <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                              {log.user.role || 'staff'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Log Type (on All tab) */}
                      {activeTab === 'all' && (
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {getLogTypeBadge(log.logType)}
                        </td>
                      )}

                      {/* Action */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${getActionBadge(
                            log.action
                          )} capitalize`}
                        >
                          {(log.action || 'action').replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Description & Target */}
                      <td className="py-3 px-3.5">
                        <div className="space-y-0.5">
                          <p className="text-slate-800 dark:text-slate-200 text-xs line-clamp-2 leading-relaxed">
                            {log.description}
                          </p>
                          {log.targetId && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                              <span>Ref:</span>
                              <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">
                                #{log.targetId}
                              </span>
                              {log.module && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                  {log.module}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Origin (IP & Browser) */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{log.ipAddress || '127.0.0.1'}</span>
                          </div>
                          {(log.browser || log.platform) && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                              <Laptop className="w-3 h-3 shrink-0" />
                              <span>
                                {log.browser || 'Browser'} • {log.platform || 'OS'}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action Detail Trigger */}
                      <td className="py-3 px-3.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogForDetail(log);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                          title="View Full Payload Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination Footer */}
        {total > 0 && (
          <div className="border-t border-slate-200/80 dark:border-slate-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/50 dark:bg-slate-850">
            <div className="text-slate-500 dark:text-slate-400">
              Showing{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {Math.min((page - 1) * limit + 1, total)}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {Math.min(page * limit, total)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{total}</span>{' '}
              entries
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>

              <span className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold border border-blue-200/60 dark:border-blue-800/60">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Inspect Payload Slide-over / Modal */}
      {selectedLogForDetail && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setSelectedLogForDetail(null)}
          />

          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/40">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Audit Log Inspection #{selectedLogForDetail.id}
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    Recorded at {selectedLogForDetail.createdAt}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Event Summary Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Action Event
                  </span>
                  <div className="mt-0.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${getActionBadge(
                        selectedLogForDetail.action
                      )}`}
                    >
                      {selectedLogForDetail.action}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Log Category
                  </span>
                  <div className="mt-0.5">{getLogTypeBadge(selectedLogForDetail.logType)}</div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Performed By
                  </span>
                  <div className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                    {selectedLogForDetail.user.name} ({selectedLogForDetail.user.role})
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Origin IP Address
                  </span>
                  <div className="mt-0.5 font-mono text-slate-900 dark:text-slate-100">
                    {selectedLogForDetail.ipAddress || '127.0.0.1'}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Event Statement
                </label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                  {selectedLogForDetail.description}
                </div>
              </div>

              {/* Target & Scope Details */}
              {(selectedLogForDetail.targetId || selectedLogForDetail.module) && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {selectedLogForDetail.targetId && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Target Reference</span>
                      <div className="font-mono text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                        #{selectedLogForDetail.targetId} ({selectedLogForDetail.targetType || 'target'})
                      </div>
                    </div>
                  )}
                  {selectedLogForDetail.module && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">System Module</span>
                      <div className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                        {selectedLogForDetail.module}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Device & Agent */}
              {(selectedLogForDetail.browser || selectedLogForDetail.platform || selectedLogForDetail.userAgent) && (
                <div>
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Client Environment
                  </span>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-1 text-xs">
                    <p className="text-slate-700 dark:text-slate-300 font-medium">
                      Browser: <span className="font-bold">{selectedLogForDetail.browser || 'Unknown'}</span> | OS:{' '}
                      <span className="font-bold">{selectedLogForDetail.platform || 'Unknown'}</span>
                    </p>
                    {selectedLogForDetail.userAgent && (
                      <p className="font-mono text-[10px] text-slate-400 break-all">
                        {selectedLogForDetail.userAgent}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata / Full JSON Payload */}
              {selectedLogForDetail.metadata && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Structured Metadata Payload
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          JSON.stringify(selectedLogForDetail.metadata, null, 2)
                        );
                        toast.success('JSON copied to clipboard');
                      }}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Copy JSON
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                    {JSON.stringify(selectedLogForDetail.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-850">
              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
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
