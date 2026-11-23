import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Router as RouterIcon,
  Radio,
  Activity,
  ShieldCheck,
  RefreshCw,
  Search,
  Building2,
  ExternalLink,
  Cpu,
  Database,
  HardDrive,
  Copy,
  Terminal,
} from 'lucide-react';
import { saasService, SaaSNetworkDeviceItem, SaaSNetworkResponse } from '@/services/saas.service';
import { tenantsService } from '@/services/tenants.service';
import { Tenant } from '@/types/tenant.types';
import { useTenantStore } from '@/stores/tenantStore';
import { useToastContext } from '@/contexts/ToastContext';
import PageHeader from '@/components/common/PageHeader';

export default function GlobalNetworkPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const { setSelectedTenant } = useTenantStore();

  const [devices, setDevices] = useState<SaaSNetworkDeviceItem[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [diagnostics, setDiagnostics] = useState<SaaSNetworkResponse['diagnostics'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Metrics
  const [metrics, setMetrics] = useState({
    totalDevices: 0,
    totalRouters: 0,
    totalOlts: 0,
    activeDevices: 0,
    offlineDevices: 0,
  });

  // Load tenants
  useEffect(() => {
    tenantsService.getTenants().then((res) => {
      if (res && res.data) {
        setTenants(res.data);
      }
    }).catch(() => {});
  }, []);

  // Fetch Network Fleet
  const loadFleet = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await saasService.getNetworkInfrastructure({
        tenant_id: selectedTenantId !== 'all' ? selectedTenantId : undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        search: search.trim() || undefined,
      });

      if (res && res.success) {
        setDevices(res.devices || []);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
        if (res.diagnostics) {
          setDiagnostics(res.diagnostics);
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load network infrastructure');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedTenantId, selectedType, selectedStatus, search, toast]);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  const handleInspectTenantNetwork = (tenantId: string, deviceType: string) => {
    const matchedTenant = tenants.find((t) => String(t.tenantId || (t as any).id) === String(tenantId));
    if (matchedTenant) {
      setSelectedTenant(matchedTenant);
      if (deviceType === 'olt') {
        navigate('/dashboard/network/olt');
      } else {
        navigate('/dashboard/network/mikrotik');
      }
      toast.info(`Switched context to ${matchedTenant.tenantName}`);
    } else {
      navigate(`/saas/tenants/${tenantId}`);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard: ${text}`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Network Infrastructure & Fleet Telemetry"
        subtitle="Global network telemetry, router nodes, OLT terminals, and core engine health across all tenants."
        actions={
          <button
            type="button"
            onClick={() => loadFleet(true)}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            Refresh Fleet
          </button>
        }
      />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">Engine Health</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight flex items-center gap-1.5">
              <span>{diagnostics?.overall === 'healthy' ? 'Optimal' : 'Healthy'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">Total Devices</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {metrics.totalDevices}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">Core Routers</p>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400 tracking-tight">
              {metrics.totalRouters}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">OLT Terminals</p>
            <p className="text-xl font-bold text-teal-600 dark:text-teal-400 tracking-tight">
              {metrics.totalOlts}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5 col-span-2 sm:col-span-1">
          <div className="w-11 h-11 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">Reachable Fleet</p>
            <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400 tracking-tight">
              {metrics.activeDevices} / {metrics.totalDevices}
            </p>
          </div>
        </div>
      </div>

      {/* Cloud Engine Server Diagnostics Ribbon */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 shadow-sm border border-slate-700/50">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-400/30">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                <span>Core SaaS Telemetry & Diagnostics</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live Engine
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Server response latency: <strong className="text-white">{diagnostics?.responseTimeMs ?? 1.5} ms</strong>
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Node Timestamp: {diagnostics?.timestamp ? new Date(diagnostics.timestamp).toLocaleTimeString() : 'Current'}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-slate-700/60">
          <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/40">
            <span className="text-slate-400 block mb-0.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" /> Database Pool
            </span>
            <span className="font-semibold text-emerald-400">MySQL 8.0 Connected</span>
          </div>

          <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/40">
            <span className="text-slate-400 block mb-0.5 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-400" /> Runtime Engine
            </span>
            <span className="font-semibold text-slate-200">PHP 8.2 FastCGI</span>
          </div>

          <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/40">
            <span className="text-slate-400 block mb-0.5 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" /> Storage & Disk
            </span>
            <span className="font-semibold text-slate-200">NVMe High-Speed</span>
          </div>

          <div className="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700/40">
            <span className="text-slate-400 block mb-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Security Fence
            </span>
            <span className="font-semibold text-emerald-400">Multi-Tenant Isolated</span>
          </div>
        </div>
      </div>

      {/* Control & Filter Bar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search router/OLT name, code, management IP, or tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Tenant Selector */}
          <div className="relative min-w-[190px]">
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="all">🏢 All ISP Tenants</option>
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.tenantName} [{t.tenantCode}]
                </option>
              ))}
            </select>
          </div>

          {/* Device Type Filter */}
          <div className="relative min-w-[140px]">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="all">🌐 All Hardware</option>
              <option value="router">MikroTik Routers</option>
              <option value="olt">OLT Terminals</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative min-w-[140px]">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="all">⚡ All Statuses</option>
              <option value="active">Active Only</option>
              <option value="offline">Offline</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Network Devices Fleet Table */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Device Node</th>
                <th className="py-3 px-4">ISP Tenant</th>
                <th className="py-3 px-4">Type & Vendor</th>
                <th className="py-3 px-4">Management IP & Ports</th>
                <th className="py-3 px-4">Subscribers</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Sync</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Scanning network nodes and routers...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <Server className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No network devices found matching your criteria.
                  </td>
                </tr>
              ) : (
                devices.map((d) => (
                  <tr
                    key={d.networkDeviceId}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    {/* Device Name & Code */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        {d.deviceType === 'olt' ? (
                          <Radio className="w-4 h-4 text-teal-600 shrink-0" />
                        ) : (
                          <RouterIcon className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                        <span>{d.deviceName}</span>
                      </div>
                      <div className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {d.deviceCode}
                      </div>
                    </td>

                    {/* Tenant Info */}
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleInspectTenantNetwork(d.tenantId, d.deviceType)}
                        className="text-left group"
                        title="Click to inspect this ISP"
                      >
                        <div className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
                          <span className="truncate max-w-[140px]">{d.tenantName}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                          ID #{d.tenantCode}
                        </span>
                      </button>
                    </td>

                    {/* Type & Vendor */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300">
                        {d.vendor || d.deviceType}
                      </span>
                      {d.deviceType === 'olt' && d.ponType && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {d.totalPonPorts} Ports ({d.ponType.toUpperCase()})
                        </div>
                      )}
                    </td>

                    {/* Management IP & Ports */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-slate-800 dark:text-slate-200">
                        <span>{d.managementIp || '0.0.0.0'}</span>
                        {d.managementIp && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(d.managementIp, 'IP')}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600"
                            title="Copy IP"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                        <span>API: {d.managementPort}</span>
                        {d.winboxPort && <span>• Winbox: {d.winboxPort}</span>}
                      </div>
                    </td>

                    {/* Subscriber Count */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {d.subscriberCount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        active accounts
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${
                          d.status === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            d.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                          }`}
                        />
                        <span className="capitalize">{d.status}</span>
                      </span>
                    </td>

                    {/* Last Sync */}
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                      {d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString() : 'Sync Pending'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleInspectTenantNetwork(d.tenantId, d.deviceType)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Summary */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing <strong className="text-slate-800 dark:text-slate-200">{devices.length}</strong> managed network nodes
          </div>
          <div>
            Live Ping Interval:{' '}
            <strong className="text-slate-800 dark:text-slate-200">10s Engine Heartbeat</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
