import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Search,
  RefreshCw,
  Printer,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  MapPin,
  Users,
  ShieldAlert,
  Wifi,
  WifiOff,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { customersService, ServerWiseReportRow } from '@/services/customers.service';
import { useToastContext } from '@/contexts/ToastContext';
import { useAuthStore } from '@/stores/authStore';
import { PageHeader, MetricCard } from '@/components/common';

type SortKey = 'serverName' | 'total' | 'active' | 'online' | 'offline' | 'expired';

export default function ServerWiseCustomersPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const { user } = useAuthStore();
  const role = (user?.role_code ?? '').toLowerCase();
  const isAllowed = user?.user_type === 'saas' || ['admin', 'manager', 'isp_admin', 'tenant_admin', 'saas_admin', 'super_admin'].includes(role);

  const [rows, setRows] = useState<ServerWiseReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [serverSearch, setServerSearch] = useState('');
  const [resellerSearch, setResellerSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortAsc, setSortAsc] = useState(false);

  // Expansion state for POP / Reseller breakdown per server (Default: ALL HIDDEN / COLLAPSED)
  const [expandedServerIds, setExpandedServerIds] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async (showToast = false) => {
    try {
      setError(null);
      const data = await customersService.getServerWiseReport();
      const safeData = Array.isArray(data) ? data : [];
      setRows(safeData);

      // Default: Keep all resellers collapsed/hidden
      // Only retain current expansion if user had already expanded something
      setExpandedServerIds((prev) => {
        const next: Record<string, boolean> = {};
        safeData.forEach((row, idx) => {
          const key = row.serverId != null ? String(row.serverId) : `row-${idx}`;
          if (prev[key]) {
            next[key] = true;
          }
        });
        return next;
      });

      if (showToast) {
        toast.success('Server report refreshed');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to load server wise customer report';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAllowed) {
      setIsLoading(false);
      return;
    }
    loadData(false);
  }, [isAllowed, loadData]);

  // Synchronize live MikroTik sessions + Reload
  const handleReloadAll = async () => {
    try {
      setIsSyncing(true);
      await customersService.syncOnlineSessions();
      toast.success('Live MikroTik sessions synchronized');
      await loadData(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Sync failed, refreshing cached report';
      toast.error(msg);
      await loadData(false);
    } finally {
      setIsSyncing(false);
    }
  };

  // Toggle single server expansion
  const toggleServerExpand = (key: string) => {
    setExpandedServerIds((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Toggle all servers
  const isAllExpanded = useMemo(() => {
    if (rows.length === 0) return false;
    return rows.every((r, idx) => {
      const key = r.serverId != null ? String(r.serverId) : `row-${idx}`;
      return !!expandedServerIds[key];
    });
  }, [rows, expandedServerIds]);

  const toggleAllExpand = () => {
    const nextState = !isAllExpanded;
    const updated: Record<string, boolean> = {};
    rows.forEach((r, idx) => {
      const key = r.serverId != null ? String(r.serverId) : `row-${idx}`;
      updated[key] = nextState;
    });
    setExpandedServerIds(updated);
  };

  // Filtered rows based on serverSearch & resellerSearch
  const filteredRows = useMemo(() => {
    const sTerm = serverSearch.trim().toLowerCase();
    const rTerm = resellerSearch.trim().toLowerCase();

    return rows.filter((r) => {
      const serverMatches = !sTerm ||
        r.serverName.toLowerCase().includes(sTerm) ||
        (r.serverIp && r.serverIp.toLowerCase().includes(sTerm));

      if (!serverMatches) return false;

      if (!rTerm) return true;

      // If resellerSearch is provided, check if any reseller matches
      const hasMatchingReseller = (r.resellers || []).some((res) =>
        res.resellerName.toLowerCase().includes(rTerm)
      );

      return hasMatchingReseller;
    });
  }, [rows, serverSearch, resellerSearch]);

  // If reseller search is active, auto-expand matching servers
  useEffect(() => {
    if (resellerSearch.trim()) {
      const autoExpanded: Record<string, boolean> = {};
      filteredRows.forEach((r, idx) => {
        const key = r.serverId != null ? String(r.serverId) : `row-${idx}`;
        autoExpanded[key] = true;
      });
      setExpandedServerIds((prev) => ({ ...prev, ...autoExpanded }));
    }
  }, [resellerSearch, filteredRows]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        const c = va.localeCompare(vb);
        return sortAsc ? c : -c;
      }
      const na = Number(va) || 0;
      const nb = Number(vb) || 0;
      return sortAsc ? na - nb : nb - na;
    });
  }, [filteredRows, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  // Grand Totals calculated from all loaded rows
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.total += Number(r.total) || 0;
        acc.active += Number(r.active) || 0;
        acc.online += Number(r.online) || 0;
        acc.offline += Number(r.offline) || 0;
        acc.expired += Number(r.expired) || 0;
        return acc;
      },
      { total: 0, active: 0, online: 0, offline: 0, expired: 0 }
    );
  }, [rows]);

  // Export to CSV
  const handleExportCsv = () => {
    if (rows.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Server ID', 'Server Name', 'Total', 'Active', 'Online', 'Offline', 'Expired', 'Reseller Name', 'Reseller Active', 'Reseller Online', 'Reseller Offline', 'Reseller Expired'];
    const csvRows: string[] = [headers.join(',')];

    rows.forEach((r) => {
      if (!r.resellers || r.resellers.length === 0) {
        csvRows.push([
          `"${r.serverId ?? 'unassigned'}"`,
          `"${r.serverName}"`,
          r.total,
          r.active,
          r.online ?? 0,
          r.offline ?? 0,
          r.expired,
          '""',
          0,
          0,
          0,
          0,
        ].join(','));
      } else {
        r.resellers.forEach((res, index) => {
          csvRows.push([
            index === 0 ? `"${r.serverId ?? 'unassigned'}"` : '""',
            index === 0 ? `"${r.serverName}"` : '""',
            index === 0 ? r.total : '',
            index === 0 ? r.active : '',
            index === 0 ? (r.online ?? 0) : '',
            index === 0 ? (r.offline ?? 0) : '',
            index === 0 ? r.expired : '',
            `"${res.resellerName}"`,
            res.active,
            res.online,
            res.offline,
            res.expired,
          ].join(','));
        });
      }
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `server_wise_customers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported report to CSV');
  };

  // Helper drilldown to customer list (properly handles unassigned / 0 / null servers)
  const getCustomerDrillUrl = (serverId: string | null, filterType?: 'active' | 'online' | 'offline' | 'expired') => {
    const params = new URLSearchParams();
    const effServerId = (serverId == null || serverId === '0' || String(serverId).toLowerCase() === 'unassigned') ? 'unassigned' : String(serverId);
    params.set('serverId', effServerId);
    if (filterType === 'active') params.set('status', 'active');
    else if (filterType === 'expired') params.set('billing_status', 'Expired');
    else if (filterType === 'online') params.set('type', 'online');
    else if (filterType === 'offline') params.set('type', 'offline');
    return `/dashboard/customers/all?${params.toString()}`;
  };

  const getResellerDrillUrl = (serverId: string | null, resellerId: string | number | null, filterType?: 'active' | 'online' | 'offline' | 'expired') => {
    const params = new URLSearchParams();
    const effServerId = (serverId == null || serverId === '0' || String(serverId).toLowerCase() === 'unassigned') ? 'unassigned' : String(serverId);
    params.set('serverId', effServerId);
    if (resellerId != null && resellerId !== '0') params.set('ownerId', String(resellerId));
    if (filterType === 'active') params.set('status', 'active');
    else if (filterType === 'expired') params.set('billing_status', 'Expired');
    else if (filterType === 'online') params.set('type', 'online');
    else if (filterType === 'offline') params.set('type', 'offline');
    return `/dashboard/customers/all?${params.toString()}`;
  };

  if (!isAllowed) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <PageHeader
          icon={<Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          title="Server Wise Online Client (v2)"
          subtitle="Customer distribution and live subscriber metrics per MikroTik router / NAS"
          onBack={() => navigate('/dashboard/report')}
        />
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Access Restricted</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm font-medium">
            Server Wise Customers report is only accessible by ISP Admin / Company Management. Resellers and downlines are strictly isolated from server/router-level aggregates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Server Wise Online Client (v2)"
        subtitle="Customer distribution and live subscriber metrics per MikroTik router / NAS"
        badge={`${rows.length} Server${rows.length === 1 ? '' : 's'}`}
        onBack={() => navigate('/dashboard/report')}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-all"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-all"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={handleReloadAll}
              disabled={isLoading || isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing || isLoading ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Reload All'}</span>
            </button>
          </div>
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <MetricCard
          title="Total Routers"
          value={rows.length}
          subtext="Configured Gateways"
          variant="purple"
          icon={<Server className="w-4 h-4 text-purple-600" />}
        />
        <MetricCard
          title="Total Clients"
          value={totals.total.toLocaleString()}
          subtext="Assigned Subscribers"
          variant="blue"
          icon={<Users className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Active Clients"
          value={totals.active.toLocaleString()}
          subtext="Valid Subscriptions"
          variant="emerald"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Live Online"
          value={totals.online.toLocaleString()}
          subtext="Active MikroTik Sessions"
          variant="cyan"
          icon={<Wifi className="w-4 h-4 text-cyan-600 animate-pulse" />}
        />
        <MetricCard
          title="Offline Clients"
          value={totals.offline.toLocaleString()}
          subtext="Active but Disconnected"
          variant="slate"
          icon={<WifiOff className="w-4 h-4 text-slate-500" />}
        />
        <MetricCard
          title="Expired Clients"
          value={totals.expired.toLocaleString()}
          subtext="Requires Renewal"
          variant="rose"
          icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
        />
      </div>

      {/* Main Card: Controls & Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden space-y-0">
        
        {/* Status / Loading Accent Indicator */}
        <div className="px-5 pt-4 pb-3 sm:px-6">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Activity className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
              <span>
                All {filteredRows.length} server{filteredRows.length === 1 ? '' : 's'} loaded.
              </span>
            </div>
            {rows.length > 0 && (
              <button
                type="button"
                onClick={toggleAllExpand}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
                <span>{isAllExpanded ? 'Collapse All POPs' : 'Expand All POPs'}</span>
              </button>
            )}
          </div>
          {/* Cyan Line Bar matching reference */}
          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-400 rounded-full transition-all duration-500 ${
                isLoading || isSyncing ? 'w-2/3 animate-pulse' : 'w-full'
              }`}
            />
          </div>
        </div>

        {/* Toolbar: Search Server, Search POP / Reseller, Actions */}
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Search Server */}
            <div className="relative w-full sm:w-56 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={serverSearch}
                onChange={(e) => setServerSearch(e.target.value)}
                placeholder="Search server..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium shadow-sm"
              />
            </div>

            {/* Search POP / Reseller */}
            <div className="relative w-full sm:w-56 md:w-64">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={resellerSearch}
                onChange={(e) => setResellerSearch(e.target.value)}
                placeholder="Search POP / reseller..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium shadow-sm"
              />
            </div>

            {(serverSearch || resellerSearch) && (
              <button
                type="button"
                onClick={() => {
                  setServerSearch('');
                  setResellerSearch('');
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReloadAll}
              disabled={isLoading || isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Reload All</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Standard Table with Direct Cells for Perfect Column Alignment */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left border-collapse table-auto">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 select-none">
                <th className="py-3.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider w-12 text-center">
                  #
                </th>
                <th
                  onClick={() => handleSort('serverName')}
                  className="py-3.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="inline-flex items-center gap-1.5">
                    <span>Server</span>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('total')}
                  className="py-3.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center w-28 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Total</span>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('active')}
                  className="py-3.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center w-28 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Active</span>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('online')}
                  className="py-3.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center w-28 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Online</span>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('offline')}
                  className="py-3.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center w-28 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Offline</span>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('expired')}
                  className="py-3.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center w-28 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Expired</span>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center w-32">
                  POP Wise
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                      Loading server customer report...
                    </div>
                  </td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
                    No router / server records matching criteria.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, idx) => {
                  const sKey = row.serverId != null ? String(row.serverId) : `row-${idx}`;
                  const isExpanded = !!expandedServerIds[sKey];
                  const resellers = row.resellers || [];
                  const rTerm = resellerSearch.trim().toLowerCase();
                  const matchingResellers = rTerm
                    ? resellers.filter((res) => res.resellerName.toLowerCase().includes(rTerm))
                    : resellers;

                  return (
                    <Fragment key={sKey}>
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        {/* 1. # */}
                        <td className="py-3.5 px-4 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 w-12">
                          {idx + 1}
                        </td>

                        {/* 2. Server (Only Server Name, No IP) */}
                        <td className="py-3.5 px-4 text-left">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                              <Server className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                              {row.serverName}
                            </span>
                          </div>
                        </td>

                        {/* 3. Total */}
                        <td className="py-3.5 px-4 text-center w-28">
                          {row.total > 0 ? (
                            <button
                              type="button"
                              onClick={() => navigate(getCustomerDrillUrl(row.serverId))}
                              className="font-bold text-blue-600 dark:text-blue-400 hover:underline hover:opacity-85 text-sm"
                              title="View customers on this router"
                            >
                              {row.total}
                            </button>
                          ) : (
                            <span className="font-bold text-slate-400 dark:text-slate-600 text-sm">0</span>
                          )}
                        </td>

                        {/* 4. Active */}
                        <td className="py-3.5 px-4 text-center w-28">
                          {row.active > 0 ? (
                            <button
                              type="button"
                              onClick={() => navigate(getCustomerDrillUrl(row.serverId, 'active'))}
                              className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline hover:opacity-85 text-sm"
                              title="View active customers"
                            >
                              {row.active}
                            </button>
                          ) : (
                            <span className="font-bold text-slate-400 dark:text-slate-600 text-sm">0</span>
                          )}
                        </td>

                        {/* 5. Online */}
                        <td className="py-3.5 px-4 text-center w-28">
                          {(row.online ?? 0) > 0 ? (
                            <button
                              type="button"
                              onClick={() => navigate(getCustomerDrillUrl(row.serverId, 'online'))}
                              className="font-bold text-cyan-600 dark:text-cyan-400 hover:underline hover:opacity-85 text-sm"
                              title="View live online subscribers"
                            >
                              {row.online}
                            </button>
                          ) : (
                            <span className="font-bold text-slate-400 dark:text-slate-600 text-sm">0</span>
                          )}
                        </td>

                        {/* 6. Offline */}
                        <td className="py-3.5 px-4 text-center w-28">
                          {(row.offline ?? 0) > 0 ? (
                            <button
                              type="button"
                              onClick={() => navigate(getCustomerDrillUrl(row.serverId, 'offline'))}
                              className="font-bold text-slate-700 dark:text-slate-300 hover:underline hover:opacity-85 text-sm"
                              title="View offline subscribers"
                            >
                              {row.offline}
                            </button>
                          ) : (
                            <span className="font-bold text-slate-400 dark:text-slate-600 text-sm">0</span>
                          )}
                        </td>

                        {/* 7. Expired */}
                        <td className="py-3.5 px-4 text-center w-28">
                          {row.expired > 0 ? (
                            <button
                              type="button"
                              onClick={() => navigate(getCustomerDrillUrl(row.serverId, 'expired'))}
                              className="font-bold text-rose-600 dark:text-rose-400 hover:underline hover:opacity-85 text-sm"
                              title="View expired subscribers"
                            >
                              {row.expired}
                            </button>
                          ) : (
                            <span className="font-bold text-slate-400 dark:text-slate-600 text-sm">0</span>
                          )}
                        </td>

                        {/* 8. POP Wise (Show / Hide Button) */}
                        <td className="py-3.5 px-4 text-center w-32">
                          {resellers.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleServerExpand(sKey)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-sm transition-all ${
                                isExpanded
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  <span>Hide</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  <span>Show</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Nested POP / Reseller Breakdown Sub-table Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800">
                          <td colSpan={8} className="py-3 px-4 sm:px-14">
                            <div className="w-full max-w-3xl mx-auto rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                                    <th className="py-2.5 px-4 text-left">Reseller / POP</th>
                                    <th className="py-2.5 px-4 text-center w-24">Active</th>
                                    <th className="py-2.5 px-4 text-center w-24">Online</th>
                                    <th className="py-2.5 px-4 text-center w-24">Offline</th>
                                    <th className="py-2.5 px-4 text-center w-24">Expired</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {matchingResellers.length === 0 ? (
                                    <tr>
                                      <td colSpan={5} className="py-6 text-center text-slate-500 dark:text-slate-400">
                                        No matching resellers under this router
                                      </td>
                                    </tr>
                                  ) : (
                                    matchingResellers.map((res) => (
                                      <tr
                                        key={res.resellerId != null ? String(res.resellerId) : res.resellerName}
                                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                                      >
                                        <td className="py-2.5 px-4">
                                          <div className="flex items-center gap-2">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                                              {res.resellerName}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                          {res.active > 0 ? (
                                            <button
                                              type="button"
                                              onClick={() => navigate(getResellerDrillUrl(row.serverId, res.resellerId, 'active'))}
                                              className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                            >
                                              {res.active}
                                            </button>
                                          ) : (
                                            <span className="font-medium text-slate-400">0</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                          {res.online > 0 ? (
                                            <button
                                              type="button"
                                              onClick={() => navigate(getResellerDrillUrl(row.serverId, res.resellerId, 'online'))}
                                              className="font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                                            >
                                              {res.online}
                                            </button>
                                          ) : (
                                            <span className="font-medium text-slate-400">0</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                          {res.offline > 0 ? (
                                            <button
                                              type="button"
                                              onClick={() => navigate(getResellerDrillUrl(row.serverId, res.resellerId, 'offline'))}
                                              className="font-bold text-slate-700 dark:text-slate-300 hover:underline"
                                            >
                                              {res.offline}
                                            </button>
                                          ) : (
                                            <span className="font-medium text-slate-400">0</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-4 text-center">
                                          {res.expired > 0 ? (
                                            <button
                                              type="button"
                                              onClick={() => navigate(getResellerDrillUrl(row.serverId, res.resellerId, 'expired'))}
                                              className="font-bold text-rose-600 dark:text-rose-400 hover:underline"
                                            >
                                              {res.expired}
                                            </button>
                                          ) : (
                                            <span className="font-medium text-slate-400">0</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>

            {/* Grand Total Footer Row with Perfect Column Alignment */}
            {!isLoading && sortedRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 font-bold text-sm">
                  <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-400 w-12" />
                  <td className="py-3.5 px-4 text-left uppercase tracking-wider text-xs font-bold text-slate-700 dark:text-slate-200">
                    Grand Total
                  </td>
                  <td className="py-3.5 px-4 text-center w-28 text-blue-600 dark:text-blue-400 font-extrabold text-sm">
                    {totals.total.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center w-28 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                    {totals.active.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center w-28 text-cyan-600 dark:text-cyan-400 font-extrabold text-sm">
                    {totals.online.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center w-28 text-slate-700 dark:text-slate-300 font-extrabold text-sm">
                    {totals.offline.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center w-28 text-rose-600 dark:text-rose-400 font-extrabold text-sm">
                    {totals.expired.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center w-32" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
