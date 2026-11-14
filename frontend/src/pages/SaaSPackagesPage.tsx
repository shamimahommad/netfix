import { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Building2,
  Users,
  Server,
  Radio,
  Sliders,
  Sparkles,
  MapPin,
  Activity,
  MessageSquare,
  Globe,
  Share2,
  Edit2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Check,
  Layers,
} from 'lucide-react';
import {
  saasBillingService,
  SaaSPackage,
  SaaSTenantSummary,
  SaaSPackageLimits,
  SaaSPackagePermissions,
} from '@/services/saas-billing.service';
import { useToastContext } from '@/contexts/ToastContext';
import PageHeader from '@/components/common/PageHeader';

export default function SaaSPackagesPage() {
  const toast = useToastContext();

  const [packages, setPackages] = useState<SaaSPackage[]>([]);
  const [unassignedTenants, setUnassignedTenants] = useState<SaaSTenantSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Assign Package Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedPackageId, setSelectedPackageId] = useState<number>(0);
  const [isAssigning, setIsAssigning] = useState(false);

  // Create / Edit Package Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<number | null>(null);
  const [packageFormData, setPackageFormData] = useState<{
    name: string;
    code: string;
    tagline: string;
    price: number;
    billingCycle: 'monthly' | 'yearly';
    limits: SaaSPackageLimits;
    permissions: SaaSPackagePermissions;
    isPopular: boolean;
  }>({
    name: '',
    code: '',
    tagline: '',
    price: 3500,
    billingCycle: 'monthly',
    limits: {
      maxCustomers: 2500,
      maxRouters: 5,
      maxOlts: 3,
      maxUsers: 15,
    },
    permissions: {
      mapEnabled: true,
      monitoringEnabled: true,
      smsEnabled: true,
      customerPortalEnabled: true,
      resellerEnabled: true,
    },
    isPopular: false,
  });
  const [isSavingPackage, setIsSavingPackage] = useState(false);

  const loadPackages = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await saasBillingService.getPackages();
      if (res && res.success) {
        setPackages(res.data || []);
        setUnassignedTenants(res.unassignedTenants || []);
      }
    } catch (err: any) {
      console.error('Failed to load SaaS packages:', err);
      const msg = err.response?.data?.message || 'Service temporarily unavailable. Please try again later.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingPackageId(null);
    setPackageFormData({
      name: '',
      code: '',
      tagline: '',
      price: 3500,
      billingCycle: 'monthly',
      limits: {
        maxCustomers: 2500,
        maxRouters: 5,
        maxOlts: 3,
        maxUsers: 15,
      },
      permissions: {
        mapEnabled: true,
        monitoringEnabled: true,
        smsEnabled: true,
        customerPortalEnabled: true,
        resellerEnabled: true,
      },
      isPopular: false,
    });
    setIsEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (pkg: SaaSPackage) => {
    setEditingPackageId(pkg.id);
    setPackageFormData({
      name: pkg.name,
      code: pkg.code,
      tagline: pkg.tagline || '',
      price: pkg.price,
      billingCycle: pkg.billingCycle,
      limits: { ...pkg.limits },
      permissions: { ...pkg.permissions },
      isPopular: pkg.isPopular,
    });
    setIsEditModalOpen(true);
  };

  // Save (Create or Update) Package
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageFormData.name.trim()) {
      toast.error('Package name is required');
      return;
    }

    setIsSavingPackage(true);
    try {
      if (editingPackageId) {
        await saasBillingService.updatePackage(editingPackageId, packageFormData);
        toast.success('Package updated successfully');
      } else {
        await saasBillingService.createPackage(packageFormData);
        toast.success('New SaaS Package created successfully');
      }
      setIsEditModalOpen(false);
      loadPackages();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setIsSavingPackage(false);
    }
  };

  // Open Assign Modal
  const handleOpenAssignModal = (defaultPkgId?: number, defaultTenantId?: string) => {
    setSelectedPackageId(defaultPkgId || (packages[0]?.id ?? 0));
    setSelectedTenantId(defaultTenantId || '');
    setIsAssignModalOpen(true);
  };

  // Submit Assign Package
  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId || !selectedPackageId) {
      toast.error('Please select both an ISP tenant and a target package');
      return;
    }

    setIsAssigning(true);
    try {
      const res = await saasBillingService.assignTenantPackage(selectedTenantId, selectedPackageId);
      toast.success(res.message || 'Package successfully assigned to tenant');
      setIsAssignModalOpen(false);
      loadPackages();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to assign package');
    } finally {
      setIsAssigning(false);
    }
  };

  // Flattened all assigned tenants across packages for the mapping matrix
  const allAssignedTenants = packages.flatMap((pkg) =>
    pkg.assignedTenants.map((t) => ({
      ...t,
      currentPackage: pkg,
    }))
  );

  return (
    <div className="w-full min-w-0 space-y-6 pb-12">
      {/* Page Header conforming to NetFix GEMINI.md design standards */}
      <PageHeader
        icon={<Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="SaaS Subscription Packages & ISP Plan Matrix"
        subtitle="Configure tier pricing, resource quotas, feature permissions, and tenant plan allocations"
        badge="SaaS Super Admin"
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => loadPackages(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold transition-all shadow-2xs active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => handleOpenAssignModal()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-semibold transition-all shadow-2xs active:scale-95"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Assign Plan to ISP</span>
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Create New Package</span>
            </button>
          </div>
        }
      />

      {/* Error alert banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between text-rose-700 dark:text-rose-300 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadPackages()}
            className="px-3 py-1 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded-lg text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Summary Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Configured Packages</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{packages.length} Plans</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Assigned ISP Networks</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{allAssignedTenants.length} Tenants</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Quota Allocated</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">
              {packages.reduce((acc, p) => acc + p.limits.maxCustomers * p.assignedTenantsCount, 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Subscription MRR Potential</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">
              ৳{packages.reduce((acc, p) => acc + p.price * p.assignedTenantsCount, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Grid of SaaS Package Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              SaaS Subscription Plans & Quota Tiers
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Defines customer caps, core router nodes, OLT integration, and system feature permissions
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-3" />
            <p className="text-xs font-semibold text-slate-500">Loading package catalog...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {packages.map((pkg) => {
              const isPopular = pkg.isPopular;

              return (
                <div
                  key={pkg.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm flex flex-col justify-between relative transition-all ${
                    isPopular
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs">
                      Popular Tier
                    </span>
                  )}

                  <div>
                    {/* Header */}
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                        <span>{pkg.name}</span>
                        <button
                          onClick={() => handleOpenEditModal(pkg)}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Package"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 min-h-[32px] line-clamp-2">
                        {pkg.tagline || 'Standard ISP subscription package'}
                      </p>

                      {/* Price */}
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                          ৳{pkg.price.toLocaleString()}
                        </span>
                        <span className="text-xs font-medium text-slate-400">/{pkg.billingCycle}</span>
                      </div>
                    </div>

                    {/* Limits Section */}
                    <div className="space-y-2 mb-4">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Resource Quotas</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-medium">Subscribers</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {pkg.limits.maxCustomers.toLocaleString()} Max
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-medium">Routers</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{pkg.limits.maxRouters} BRAS</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-medium">OLT Nodes</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{pkg.limits.maxOlts} OLTs</span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-medium">Staff Users</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{pkg.limits.maxUsers} Users</span>
                        </div>
                      </div>
                    </div>

                    {/* Feature Permissions Checklist */}
                    <div className="space-y-2 mb-4">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Included Permissions</p>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center gap-2">
                          {pkg.permissions.mapEnabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                          <span className={pkg.permissions.mapEnabled ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 line-through'}>
                            GIS Fiber Network Map
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {pkg.permissions.monitoringEnabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                          <span className={pkg.permissions.monitoringEnabled ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 line-through'}>
                            Live Bandwidth & Device Monitoring
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {pkg.permissions.smsEnabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                          <span className={pkg.permissions.smsEnabled ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 line-through'}>
                            Automated SMS Gateway Alerts
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {pkg.permissions.customerPortalEnabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                          <span className={pkg.permissions.customerPortalEnabled ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 line-through'}>
                            Self-Care Customer Portal
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {pkg.permissions.resellerEnabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                          <span className={pkg.permissions.resellerEnabled ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 line-through'}>
                            Multi-Tier Reseller System
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Tenants count & Action */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="text-slate-500 font-medium">Assigned ISPs:</span>
                      <span className="font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                        {pkg.assignedTenantsCount} Active
                      </span>
                    </div>

                    {pkg.assignedTenants.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {pkg.assignedTenants.map((t) => (
                          <span
                            key={t.tenantId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900 text-[10px] font-bold"
                          >
                            <Building2 className="w-2.5 h-2.5" />
                            {t.tenantName}
                          </span>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => handleOpenAssignModal(pkg.id)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <span>Assign to ISP</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comprehensive Mapping Table: "Which ISP has Which Package" */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Tenant Plan Allocation Matrix
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live breakdown of which ISP is assigned to which package, quota limits, and pricing
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Total {allAssignedTenants.length + unassignedTenants.length} ISP Networks
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">ISP Tenant</th>
                <th className="px-4 py-3">Assigned Package</th>
                <th className="px-4 py-3">Monthly Price</th>
                <th className="px-4 py-3">Subscriber Quota</th>
                <th className="px-4 py-3 text-center">Routers</th>
                <th className="px-4 py-3 text-center">OLTs</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 bg-white dark:bg-slate-900">
              {allAssignedTenants.map((t) => (
                <tr key={t.tenantId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{t.tenantName}</div>
                    <div className="font-mono text-[10px] text-slate-400">
                      {t.tenantCode} · {t.businessEmail}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800 text-[11px]">
                      <Package className="w-3 h-3 text-blue-600" />
                      {t.currentPackage.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                    ৳{t.currentPackage.price.toLocaleString()}/mo
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {t.totalCustomers.toLocaleString()}
                    </span>
                    <span className="text-slate-400 ml-1">/ {t.currentPackage.limits.maxCustomers.toLocaleString()} max</span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-slate-100">
                    {t.totalRouters} / {t.currentPackage.limits.maxRouters}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-slate-100">
                    {t.totalOlts} / {t.currentPackage.limits.maxOlts}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : t.status === 'trial'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                      }`}
                    >
                      {t.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleOpenAssignModal(t.currentPackage.id, t.tenantId)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] transition-colors"
                    >
                      Change Plan
                    </button>
                  </td>
                </tr>
              ))}

              {/* Unassigned Tenants if any */}
              {unassignedTenants.map((t) => (
                <tr key={t.tenantId} className="bg-amber-50/30 dark:bg-amber-950/10">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{t.tenantName}</div>
                    <div className="font-mono text-[10px] text-slate-400">{t.tenantCode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                      No Package Assigned
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">—</td>
                  <td className="px-4 py-3 text-slate-400">{t.totalCustomers}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{t.totalRouters}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{t.totalOlts}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleOpenAssignModal(packages[0]?.id, t.tenantId)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] transition-colors"
                    >
                      Assign Plan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Assign Package to Tenant */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                Assign Subscription Plan to ISP
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Updates subscriber quotas, MikroTik router caps, and feature permissions automatically
              </p>
            </div>

            <form onSubmit={handleConfirmAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select ISP Tenant
                </label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                >
                  <option value="">— Select an ISP —</option>
                  {[...allAssignedTenants, ...unassignedTenants].map((t) => (
                    <option key={t.tenantId} value={t.tenantId}>
                      {t.tenantName} ({t.tenantCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select SaaS Package
                </label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(Number(e.target.value))}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — ৳{pkg.price.toLocaleString()}/mo ({pkg.limits.maxCustomers} subs, {pkg.limits.maxRouters} routers)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isAssigning ? 'Applying...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create / Edit Package */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                {editingPackageId ? 'Edit SaaS Package' : 'Create New SaaS Package'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure quotas, monthly fee, and feature flags
              </p>
            </div>

            <form onSubmit={handleSavePackage} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Package Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={packageFormData.name}
                    onChange={(e) => setPackageFormData({ ...packageFormData, name: e.target.value })}
                    placeholder="e.g. Standard Growth Plan"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Price (BDT) *
                  </label>
                  <input
                    type="number"
                    required
                    value={packageFormData.price}
                    onChange={(e) => setPackageFormData({ ...packageFormData, price: Number(e.target.value) || 0 })}
                    placeholder="e.g. 3500"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tagline / Description
                </label>
                <input
                  type="text"
                  value={packageFormData.tagline}
                  onChange={(e) => setPackageFormData({ ...packageFormData, tagline: e.target.value })}
                  placeholder="e.g. Best for growing ISPs with multiple POPs"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium"
                />
              </div>

              {/* Quotas */}
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Resource Limits & Quotas
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Max Customers</label>
                    <input
                      type="number"
                      value={packageFormData.limits.maxCustomers}
                      onChange={(e) =>
                        setPackageFormData({
                          ...packageFormData,
                          limits: { ...packageFormData.limits, maxCustomers: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Max Routers</label>
                    <input
                      type="number"
                      value={packageFormData.limits.maxRouters}
                      onChange={(e) =>
                        setPackageFormData({
                          ...packageFormData,
                          limits: { ...packageFormData.limits, maxRouters: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Max OLT Nodes</label>
                    <input
                      type="number"
                      value={packageFormData.limits.maxOlts}
                      onChange={(e) =>
                        setPackageFormData({
                          ...packageFormData,
                          limits: { ...packageFormData.limits, maxOlts: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Max Staff Users</label>
                    <input
                      type="number"
                      value={packageFormData.limits.maxUsers}
                      onChange={(e) =>
                        setPackageFormData({
                          ...packageFormData,
                          limits: { ...packageFormData.limits, maxUsers: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Feature Permissions
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'mapEnabled', label: 'GIS Network Map', icon: MapPin },
                    { key: 'monitoringEnabled', label: 'Live Bandwidth & Telemetry Monitoring', icon: Activity },
                    { key: 'smsEnabled', label: 'Automated SMS Billing Alerts', icon: MessageSquare },
                    { key: 'customerPortalEnabled', label: 'Self-Care Subscriber Portal', icon: Globe },
                    { key: 'resellerEnabled', label: 'Multi-Tier Reseller System', icon: Share2 },
                  ].map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(packageFormData.permissions as any)[perm.key]}
                        onChange={(e) =>
                          setPackageFormData({
                            ...packageFormData,
                            permissions: {
                              ...packageFormData.permissions,
                              [perm.key]: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPackage}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSavingPackage ? 'Saving...' : editingPackageId ? 'Update Package' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

