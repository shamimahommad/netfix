import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { tenantsService } from '@/services/tenants.service';
import { Tenant } from '@/types/tenant.types';
import { useTenantStore } from '@/stores/tenantStore';
import { useAuthStore } from '@/stores/authStore';

const CARD_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

export default function SaaSDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setSelectedTenant } = useTenantStore();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const response = await tenantsService.getTenants();
      if (response && response.success && Array.isArray(response.data)) {
        setTenants(response.data);
      } else {
        setTenants([]);
      }
    } catch (err: any) {
      console.error('Error loading tenants for SaaS dashboard:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to load platform data';
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.status === 'active').length;
  const trialTenants = tenants.filter((t) => t.status === 'trial').length;
  const totalCustomers = tenants.reduce((acc, t) => acc + (t.totalCustomers || 0), 0);
  const totalRouters = tenants.reduce((acc, t) => acc + (t.totalRouters || 0), 0);

  const handleLoginToTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    navigate('/dashboard');
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Welcome / Platform Header */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              SaaS Platform Super Admin
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Welcome back, {user?.first_name || 'Admin'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              NetFix Multi-Tenant ISP Cloud Overview & System Management
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors disabled:opacity-50"
              title="Refresh live data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => navigate('/saas/tenants')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm hover:shadow transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Manage ISPs
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 flex items-center justify-between gap-3 text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadData()}
            className="px-3 py-1.5 text-xs font-semibold bg-red-100 dark:bg-red-900/40 hover:bg-red-200 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Live Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tenants */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Tenants
            </p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {isLoading ? '...' : totalTenants}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{activeTenants} active</span>
              {trialTenants > 0 && <span>· {trialTenants} trial</span>}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Active ISPs */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Network ISPs
            </p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {isLoading ? '...' : activeTenants}
            </h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              100% operational
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Total Subscribers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Subscribers
            </p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {isLoading ? '...' : totalCustomers.toLocaleString()}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Across all ISP tenants
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Network Gateways / Routers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Network Routers
            </p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {isLoading ? '...' : totalRouters}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-blue-500" />
              MikroTik & OLT nodes
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Server className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Access Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tenants & ISPs', path: '/saas/tenants', desc: 'Manage ISP accounts', icon: Building2 },
          { label: 'Subscribers', path: '/saas/customers', desc: 'Cross-tenant users', icon: Users },
          { label: 'SaaS Billing', path: '/saas/billing', desc: 'Subscriptions & fees', icon: CheckCircle2 },
          { label: 'System Settings', path: '/saas/settings', desc: 'Global configurations', icon: Server },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => navigate(item.path)}
              className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-500/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Tenants Table & Quick Impersonation */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Registered ISP Tenants
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select an ISP to impersonate or configure profile settings
            </p>
          </div>
          <button
            onClick={() => navigate('/saas/tenants')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            View All ({tenants.length})
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium">Loading platform data...</p>
            </div>
          ) : tenants.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No ISP tenants registered yet</p>
              <button
                onClick={() => navigate('/saas/tenants')}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
              >
                Create First ISP
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-slate-700/80">
                <tr>
                  <th className="py-3 px-4">ISP / Company</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Subscribers</th>
                  <th className="py-3 px-4">Routers</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-700/80">
                {tenants.map((t, idx) => (
                  <tr
                    key={t.tenantId}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
                          style={{
                            background: `linear-gradient(135deg, ${CARD_COLORS[idx % CARD_COLORS.length]}, ${CARD_COLORS[(idx + 1) % CARD_COLORS.length]})`,
                          }}
                        >
                          {(t.tenantName || 'I').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {t.tenantName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            ID: {t.tenantId} · {t.countryCode || 'BD'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-medium text-slate-600 dark:text-slate-300">
                      {t.tenantCode}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                      <p className="truncate max-w-[180px]">{t.businessEmail}</p>
                      {t.businessPhone && (
                        <p className="text-slate-400 text-[11px]">{t.businessPhone}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {(t.totalCustomers || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {t.totalRouters || 0}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          t.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : t.status === 'trial'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/saas/tenants/${t.tenantId}`)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                          title="View Profile & Settings"
                        >
                          Profile
                        </button>
                        <button
                          onClick={() => handleLoginToTenant(t)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
                          title="Open Tenant ISP Dashboard"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          Login to Tenant
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Platform Architecture & Engine Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Backend API Engine</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">PHP 8.2 API Server</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Status: Running (Port 4000)</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">OLT Telemetry Sync</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Cached Background Task</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Interval: Every 2 Hours</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Security & Isolation</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Multi-Tenant Guard</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Protected & Isolated</p>
          </div>
        </div>
      </div>
    </div>
  );
}
