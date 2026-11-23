import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Search,
  RefreshCw,
  Building2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { saasService, SaaSCustomerItem } from '@/services/saas.service';
import { tenantsService } from '@/services/tenants.service';
import { Tenant } from '@/types/tenant.types';
import { useTenantStore } from '@/stores/tenantStore';
import { useToastContext } from '@/contexts/ToastContext';
import PageHeader from '@/components/common/PageHeader';

export default function GlobalCustomersPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const { setSelectedTenant } = useTenantStore();

  const [customers, setCustomers] = useState<SaaSCustomerItem[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Metrics
  const [metrics, setMetrics] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    suspendedCustomers: 0,
    expiredCustomers: 0,
    newThisMonth: 0,
  });

  // Load tenants for dropdown
  useEffect(() => {
    tenantsService.getTenants().then((res) => {
      if (res && res.data) {
        setTenants(res.data);
      }
    }).catch(() => {});
  }, []);

  // Fetch customers
  const loadCustomers = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await saasService.getGlobalCustomers({
        page,
        limit,
        search: search.trim() || undefined,
        tenant_id: selectedTenantId !== 'all' ? selectedTenantId : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
      });

      if (res && res.success) {
        setCustomers(res.customers || []);
        setTotal(res.total || 0);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load global customers');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, limit, search, selectedTenantId, selectedStatus, toast]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleInspectTenant = (tenantId: string) => {
    const matchedTenant = tenants.find((t) => String(t.tenantId || (t as any).id) === String(tenantId));
    if (matchedTenant) {
      setSelectedTenant(matchedTenant);
      navigate('/dashboard/customers/all');
      toast.info(`Switched context to ${matchedTenant.tenantName}`);
    } else {
      navigate(`/saas/tenants/${tenantId}`);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Global Customers Directory"
        subtitle="Unified subscriber registry across all onboarded ISP tenants and networks."
        actions={
          <button
            type="button"
            onClick={() => loadCustomers(true)}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">Total Platform</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {metrics.totalCustomers.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">Active Users</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {metrics.activeCustomers.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">Suspended</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
              {metrics.suspendedCustomers.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">Expired / Left</p>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
              {metrics.expiredCustomers.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5 col-span-2 sm:col-span-1">
          <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">New This Month</p>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400 tracking-tight">
              +{metrics.newThisMonth.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search code, name, phone, IP, or PPPoE username..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Tenant Selector */}
          <div className="relative min-w-[190px]">
            <select
              value={selectedTenantId}
              onChange={(e) => {
                setSelectedTenantId(e.target.value);
                setPage(1);
              }}
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

          {/* Status Filter */}
          <div className="relative min-w-[140px]">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="all">⚡ All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {/* Limit Selector */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Show:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="px-2 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Customer Registry Table */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">ISP Tenant</th>
                <th className="py-3 px-4">Network & IP</th>
                <th className="py-3 px-4">Plan / Package</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Billing</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading subscriber records...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No customers found matching your filters.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.customerId}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    {/* Customer Code & Name */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{c.fullName || 'Unnamed'}</span>
                        {c.isOnline ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Online Session" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" title="Offline" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-mono bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                          {c.customerCode}
                        </span>
                        <span>•</span>
                        <span>{c.phone}</span>
                      </div>
                    </td>

                    {/* Tenant Info */}
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleInspectTenant(c.tenantId)}
                        className="text-left group"
                        title="Click to inspect this ISP"
                      >
                        <div className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
                          <span className="truncate max-w-[140px]">{c.tenantName}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                          ID #{c.tenantCode}
                        </span>
                      </button>
                    </td>

                    {/* Network & IP */}
                    <td className="py-3 px-4">
                      {c.username ? (
                        <div className="font-mono text-xs text-slate-800 dark:text-slate-200">
                          {c.username}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                        {c.ipAddress || 'Dynamic IP'}
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {c.packageName || 'Standard Plan'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        ৳{c.packagePrice ? c.packagePrice.toLocaleString() : '0'}/mo
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${
                          c.status === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                            : c.status === 'suspended'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.status === 'active' ? 'bg-emerald-500' : c.status === 'suspended' ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                        />
                        <span className="capitalize">{c.status}</span>
                      </span>
                    </td>

                    {/* Billing Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md ${
                          c.billingStatus === 'Paid'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : c.billingStatus === 'Due'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {c.billingStatus || 'Paid'}
                      </span>
                    </td>

                    {/* Expiry Date */}
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                      {c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : 'Lifetime'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleInspectTenant(c.tenantId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        <span>Manage ISP</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing <strong className="text-slate-800 dark:text-slate-200">{customers.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{total}</strong> total subscribers
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <span className="px-2">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 disabled:opacity-40 transition-all"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
