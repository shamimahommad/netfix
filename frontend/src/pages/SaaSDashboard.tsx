import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  Server,
  ShieldCheck,
  Activity,
  ArrowRight,
  LogIn,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Radio,
  Search,
  ExternalLink,
  Cpu,
  Clock,
  Wallet,
  Globe,
  Sliders,
  Sparkles,
  Package,
  Receipt,
} from 'lucide-react';
import { dashboardService, SaaSDashboardResponse, SaaSTenantItem } from '@/services/dashboard.service';
import { useTenantStore } from '@/stores/tenantStore';
import { useAuthStore } from '@/stores/authStore';
import { useToastContext } from '@/contexts/ToastContext';
import PageHeader from '@/components/common/PageHeader';
import AddISPModal from '@/components/AddISPModal';
import { TenantStatus } from '@/types/tenant.types';

const CARD_COLORS = [
  'from-blue-600 to-indigo-600',
  'from-purple-600 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
];

export default function SaaSDashboard() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const { user } = useAuthStore();
  const { setSelectedTenant } = useTenantStore();

  const [data, setData] = useState<SaaSDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters for tenant preview table
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TenantStatus>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const response = await dashboardService.getSaaSStats();
      if (response && response.success) {
        setData(response);
      } else {
        setError('Unable to load SaaS platform telemetry');
      }
    } catch (err: any) {
      console.error('Error loading SaaS dashboard:', err);
      const msg = err.response?.data?.message || err.message || 'Service temporarily unavailable. Please try again later.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const overview = data?.overview;
  const tenants = data?.tenants || [];
  const recentLogs = data?.recentLogs || [];
  const health = data?.health;

  // Filtered tenants for preview table
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = t.tenantName?.toLowerCase().includes(q);
      const codeMatch = t.tenantCode?.toLowerCase().includes(q);
      const emailMatch = t.businessEmail?.toLowerCase().includes(q);
      const phoneMatch = t.businessPhone?.toLowerCase().includes(q);
      return nameMatch || codeMatch || emailMatch || phoneMatch;
    });
  }, [tenants, statusFilter, searchQuery]);

  const handleLoginToTenant = (tenant: SaaSTenantItem) => {
    setSelectedTenant({
      tenantId: tenant.tenantId,
      tenantCode: tenant.tenantCode,
      tenantName: tenant.tenantName,
      tenantSlug: tenant.tenantCode.toLowerCase(),
      businessEmail: tenant.businessEmail,
      businessPhone: tenant.businessPhone || undefined,
      countryCode: tenant.countryCode,
      status: tenant.status,
      createdAt: tenant.createdAt,
      totalCustomers: tenant.totalCustomers,
      totalRouters: tenant.totalRouters,
      totalOlts: tenant.totalOlts,
    });
    toast.success(`Switched context to ${tenant.tenantName}`);
    navigate('/dashboard');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return {
          badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
          dot: 'bg-emerald-500',
          label: 'Active',
        };
      case 'trial':
        return {
          badge: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
          dot: 'bg-blue-500',
          label: 'Trial',
        };
      case 'suspended':
        return {
          badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
          dot: 'bg-amber-500',
          label: 'Suspended',
        };
      case 'expired':
        return {
          badge: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
          dot: 'bg-rose-500',
          label: 'Expired',
        };
      default:
        return {
          badge: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          dot: 'bg-slate-400',
          label: status,
        };
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6 pb-12">
      {/* Unified Page Header conforming to NetFix design guidelines */}
      <PageHeader
        icon={<ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="SaaS Platform Command Center"
        subtitle="Unified multi-tenant orchestration, live subscriber quotas, and global infrastructure telemetry"
        badge="SaaS Super Admin"
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold transition-all shadow-2xs active:scale-95 disabled:opacity-50"
              title="Refresh live telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => navigate('/saas/tenants')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold transition-all shadow-2xs"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Tenants</span>
            </button>
            <button
              onClick={() => navigate('/saas/packages')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold transition-all shadow-2xs"
            >
              <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Packages</span>
            </button>
            <button
              onClick={() => navigate('/saas/billing')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-semibold transition-all shadow-2xs"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Billing</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Add New ISP</span>
            </button>
          </div>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between gap-3 text-rose-700 dark:text-rose-300 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadData()}
            className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded-xl hover:bg-rose-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top 5 Critical Platform KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Tenants */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  <Building2 className="w-3.5 h-3.5" />
                </span>
                ISP Tenants
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                {overview?.activeTenants ?? 0} Active
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {isLoading ? '...' : overview?.totalTenants ?? 0}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            {overview?.trialTenants ?? 0} Trial · {overview?.suspendedTenants ?? 0} Suspended
          </p>
        </div>

        {/* Global Subscribers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  <Users className="w-3.5 h-3.5" />
                </span>
                Total Subscribers
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
                Network Wide
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {isLoading ? '...' : (overview?.totalSubscribers ?? 0).toLocaleString()}
            </div>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {overview?.activeSubscribers ?? 0} active connections
          </p>
        </div>

        {/* MikroTik Core Routers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                  <Server className="w-3.5 h-3.5" />
                </span>
                MikroTik Routers
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400">
                BRAS Nodes
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {isLoading ? '...' : overview?.totalRouters ?? 0}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            Core & Edge API Gateways
          </p>
        </div>

        {/* OLT Nodes */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                  <Radio className="w-3.5 h-3.5" />
                </span>
                OLT Devices
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400">
                GPON / EPON
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {isLoading ? '...' : overview?.totalOlts ?? 0}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            Optical Line Terminals Synced
          </p>
        </div>

        {/* Platform Volume */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                  <Wallet className="w-3.5 h-3.5" />
                </span>
                Monthly Volume
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
                MTD
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              ৳{isLoading ? '...' : (overview?.revenueThisMonth ?? 0).toLocaleString()}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            {overview?.totalTransactions ?? 0} processed collections
          </p>
        </div>
      </div>

      {/* Platform Quick Operations Hub */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tenants Directory', path: '/saas/tenants', desc: 'Registered ISP networks & quotas', icon: Building2 },
          { label: 'SaaS Packages & Plans', path: '/saas/packages', desc: 'Tier pricing, caps & permissions', icon: Package },
          { label: 'Platform Subscriptions & Billing', path: '/saas/billing', desc: 'Paid ISPs, due balances & trials', icon: Wallet },
          { label: 'Core Network Hardware', path: '/mikrotik', desc: 'MikroTik BRAS & OLT nodes', icon: Server },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => navigate(item.path)}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/60 transition-all text-left group shadow-2xs cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon className="w-4 h-4" />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.label}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Live System Health & Infrastructure Telemetry Row */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Platform Infrastructure Health
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live runtime telemetry, database state, and server resources
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            System Healthy
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">REST API Engine</p>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">PHP {health?.phpVersion || '8.2'}</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Port {health?.apiPort || 4000} Online</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Storage Core</p>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Database Engine</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Operational (Port 3306)</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Memory Allocation</p>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{health?.memoryUsage || '4.0 MB'}</p>
              <p className="text-[10px] text-slate-500 font-medium">High Efficiency</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Server Synchronized</p>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Asia/Dhaka (GMT+6)</p>
              <p className="text-[10px] text-slate-500 font-medium">{health?.serverTime?.split(' ')[1] || 'Realtime'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tenants Table & Quick Impersonation (Follows pure table list standard) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Header & Filter Controls */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Registered ISP Tenant Networks
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live quotas, subscribers, routers, and one-click workspace impersonation
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tenant..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-all font-medium"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => navigate('/saas/tenants')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
            >
              <span>Manage All ({tenants.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Loading tenant networks...</p>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Building2 className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No tenants matched your query</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-bold" style={{ width: '25%' }}>ISP / Tenant Name</th>
                  <th className="px-4 py-3 font-bold" style={{ width: '12%' }}>Status</th>
                  <th className="px-4 py-3 font-bold" style={{ width: '22%' }}>Subscribers & Quota</th>
                  <th className="px-4 py-3 font-bold text-center" style={{ width: '10%' }}>Routers</th>
                  <th className="px-4 py-3 font-bold text-center" style={{ width: '8%' }}>OLTs</th>
                  <th className="px-4 py-3 font-bold" style={{ width: '11%' }}>Created</th>
                  <th className="px-4 py-3 font-bold text-right" style={{ width: '12%' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 bg-white dark:bg-slate-900">
                {filteredTenants.map((t, idx) => {
                  const st = getStatusBadge(t.status);
                  const maxSubs = t.maxCustomers || 5000;
                  const currentSubs = t.totalCustomers || 0;
                  const pct = Math.min(100, Math.round((currentSubs / maxSubs) * 100));
                  const gradient = CARD_COLORS[idx % CARD_COLORS.length];

                  return (
                    <tr
                      key={t.tenantId}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => navigate(`/saas/tenants/${t.tenantId}`)}
                    >
                      {/* Name & Contact */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${gradient} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                          >
                            {(t.tenantName || 'I').charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate hover:text-blue-600 transition-colors">
                                {t.tenantName}
                              </span>
                              <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800 shrink-0">
                                #{t.tenantCode}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                              {t.businessEmail}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </td>

                      {/* Subscriber Quota Bar */}
                      <td className="px-4 py-3 font-mono">
                        <div className="flex items-center justify-between text-[11px] mb-1 font-semibold text-slate-700 dark:text-slate-300">
                          <span>{currentSubs.toLocaleString()}</span>
                          <span className="text-slate-400 text-[10px]">Max: {maxSubs.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 90 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>

                      {/* Routers */}
                      <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-slate-100">
                        {t.totalRouters}
                      </td>

                      {/* OLTs */}
                      <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-slate-100">
                        {t.totalOlts}
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {t.createdAt?.split(' ')[0] || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleLoginToTenant(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-[11px] font-bold transition-all active:scale-95 shadow-2xs"
                            title="Login directly into this tenant ISP workspace"
                          >
                            <LogIn className="w-3 h-3" />
                            <span>Login</span>
                          </button>
                          <button
                            onClick={() => navigate(`/saas/tenants/${t.tenantId}`)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="View Full Profile"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-5 py-3 bg-slate-50/80 dark:bg-slate-950/40 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Displaying <strong>{filteredTenants.length}</strong> of <strong>{tenants.length}</strong> total ISP tenants
          </span>
          <span className="font-mono text-[11px]">NetFix Multi-Tenant Core v1.0</span>
        </div>
      </div>

      {/* Recent Platform Security & Login Audit Log */}
      {recentLogs.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden space-y-0">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Recent Platform Authentication Audit
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time security telemetry of administrative session initiations
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Latest 8 events</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/60 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">User Identity</th>
                  <th className="px-4 py-2.5">IP Address</th>
                  <th className="px-4 py-2.5">Client Environment</th>
                  <th className="px-4 py-2.5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                {recentLogs.map((log) => (
                  <tr key={log.logId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{log.username || 'Administrator'}</span>
                      <span className="text-slate-400 ml-1.5 font-mono text-[10px]">({log.email || '—'})</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-400">{log.ip || '127.0.0.1'}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                      {log.browser || 'Browser'} on {log.os || 'Windows'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-400 text-[11px]">
                      {log.createdAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add ISP Modal */}
      <AddISPModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          loadData();
          setIsAddModalOpen(false);
        }}
      />
    </div>
  );
}
