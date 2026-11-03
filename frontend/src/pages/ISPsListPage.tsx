import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  LogIn,
  AlertCircle,
  Mail,
  Phone,
  Calendar,
  ChevronRight,
  Users,
  Router,
  Radio,
  Activity,
  ShieldCheck,
  RefreshCw,
  LayoutGrid,
  List,
  ExternalLink,
  CheckCircle2,
  Sliders,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';
import { tenantsService } from '@/services/tenants.service';
import { Tenant, TenantStatus, CreateTenantPayload, UpdateTenantPayload } from '@/types/tenant.types';
import { useTenantStore } from '@/stores/tenantStore';
import { useToastContext } from '@/contexts/ToastContext';
import { showDeleteConfirm, showError, showSuccess } from '@/lib/swal';

const CARD_COLORS = [
  'from-blue-600 to-indigo-600',
  'from-indigo-600 to-purple-600',
  'from-purple-600 to-pink-600',
  'from-teal-600 to-emerald-600',
  'from-sky-600 to-cyan-600',
  'from-amber-600 to-orange-600',
];

const getStatusBadge = (status: TenantStatus) => {
  switch (status) {
    case 'active':
      return {
        badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
        dot: 'bg-emerald-500 animate-pulse',
        label: 'Active',
      };
    case 'trial':
      return {
        badge: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60',
        dot: 'bg-blue-500',
        label: 'Trial',
      };
    case 'suspended':
      return {
        badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
        dot: 'bg-amber-500',
        label: 'Suspended',
      };
    case 'expired':
      return {
        badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-400',
        label: 'Expired',
      };
    case 'terminated':
      return {
        badge: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60',
        dot: 'bg-rose-500',
        label: 'Terminated',
      };
    default:
      return {
        badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-400',
        label: status,
      };
  }
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/* ========================================================================= */
/* ADD ISP MODAL                                                             */
/* ========================================================================= */
interface AddISPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function AddISPModal({ isOpen, onClose, onSuccess }: AddISPModalProps) {
  const toast = useToastContext();
  const [formData, setFormData] = useState({
    tenantName: '',
    tenantSlug: '',
    businessEmail: '',
    businessPhone: '',
    businessAddress: '',
    countryCode: 'BD',
    status: 'active' as TenantStatus,
    adminPassword: '',
    limits: {
      maxRouters: 10,
      maxOlts: 5,
      maxUsers: 25,
      maxCustomers: 2000,
      mapEnabled: true,
      monitoringEnabled: true,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      tenantName: name,
      tenantSlug: generateSlug(name),
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setShowConfirmation(false);

    try {
      const payload: CreateTenantPayload = {
        tenantName: formData.tenantName.trim(),
        tenantSlug: formData.tenantSlug.trim(),
        businessEmail: formData.businessEmail.trim().toLowerCase(),
        countryCode: formData.countryCode.trim().toUpperCase(),
        status: formData.status,
        limits: formData.limits,
      };

      if (formData.businessPhone?.trim()) {
        payload.businessPhone = formData.businessPhone.trim();
      }
      if (formData.businessAddress?.trim()) {
        payload.businessAddress = formData.businessAddress.trim();
      }
      if (formData.adminPassword?.trim()) {
        payload.adminPassword = formData.adminPassword;
      }

      await tenantsService.createTenant(payload);
      toast.success('ISP Tenant created successfully!');
      onSuccess();
      onClose();
      setFormData({
        tenantName: '',
        tenantSlug: '',
        businessEmail: '',
        businessPhone: '',
        businessAddress: '',
        countryCode: 'BD',
        status: 'active',
        adminPassword: '',
        limits: {
          maxRouters: 10,
          maxOlts: 5,
          maxUsers: 25,
          maxCustomers: 2000,
          mapEnabled: true,
          monitoringEnabled: true,
        },
      });
    } catch (err: any) {
      console.error('Error creating ISP:', err);
      let errorMessage = 'Failed to create ISP. Please try again.';
      const errorData = err.response?.data || err;
      if (errorData?.message) {
        errorMessage = Array.isArray(errorData.message) ? errorData.message.join(', ') : errorData.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Confirm ISP Creation</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Review parameters before provisioning</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">ISP Name:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{formData.tenantName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tenant Slug:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{formData.tenantSlug}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Login Email:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{formData.businessEmail}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Initial Status:</span>
                  <span className="font-semibold uppercase text-emerald-600">{formData.status}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Subscribers Quota:</span>
                  <span className="font-bold text-blue-600">{formData.limits.maxCustomers} Subscribers</span>
                </div>
              </div>

              {formData.adminPassword && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
                  An administrator account will be provisioned with the provided password.
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/30">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isLoading}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
              >
                {isLoading ? 'Creating ISP...' : 'Confirm & Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form Modal */}
      <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col overflow-hidden my-auto">
          <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add New ISP Tenant</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Provision a new isolated ISP workspace</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  ISP / Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.tenantName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                  placeholder="e.g. City Broadband Ltd"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tenant Slug / Subdomain <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.tenantSlug}
                  onChange={(e) => setFormData((p) => ({ ...p, tenantSlug: generateSlug(e.target.value) }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-slate-900 dark:text-slate-100"
                  placeholder="city-broadband"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Business / Login Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.businessEmail}
                  onChange={(e) => setFormData((p) => ({ ...p, businessEmail: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                  placeholder="admin@citybroadband.net"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Business Phone</label>
                <input
                  type="text"
                  value={formData.businessPhone}
                  onChange={(e) => setFormData((p) => ({ ...p, businessPhone: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                  placeholder="+8801700000000"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Country Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={2}
                  required
                  value={formData.countryCode}
                  onChange={(e) => setFormData((p) => ({ ...p, countryCode: e.target.value.toUpperCase() }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none uppercase font-mono text-slate-900 dark:text-slate-100"
                  placeholder="BD"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Account Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as TenantStatus }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                >
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Business Address</label>
              <textarea
                rows={2}
                value={formData.businessAddress}
                onChange={(e) => setFormData((p) => ({ ...p, businessAddress: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                placeholder="House 12, Road 4, Sector 7, Uttara, Dhaka"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Initial Admin Password</label>
              <input
                type="password"
                value={formData.adminPassword}
                onChange={(e) => setFormData((p) => ({ ...p, adminPassword: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                placeholder="Secure password for ISP administrator login"
              />
              <p className="mt-1 text-[11px] text-slate-400">If provided, an administrator account is generated immediately.</p>
            </div>

            {/* Quota Limits */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                Resource Limits & Feature Allocation
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Max Customers</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.limits.maxCustomers}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, limits: { ...p.limits, maxCustomers: parseInt(e.target.value) || 0 } }))
                    }
                    className="w-full p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Max Routers</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.limits.maxRouters}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, limits: { ...p.limits, maxRouters: parseInt(e.target.value) || 0 } }))
                    }
                    className="w-full p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Max OLTs</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.limits.maxOlts}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, limits: { ...p.limits, maxOlts: parseInt(e.target.value) || 0 } }))
                    }
                    className="w-full p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Max Staff Users</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.limits.maxUsers}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, limits: { ...p.limits, maxUsers: parseInt(e.target.value) || 0 } }))
                    }
                    className="w-full p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.limits.mapEnabled}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, limits: { ...p.limits, mapEnabled: e.target.checked } }))
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Map / GIS Coverage Active</span>
                </label>
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.limits.monitoringEnabled}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, limits: { ...p.limits, monitoringEnabled: e.target.checked } }))
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Device Ping & Telemetry Monitoring</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 font-semibold text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm active:scale-95 transition-all"
              >
                Continue to Review
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/* ========================================================================= */
/* EDIT ISP MODAL                                                            */
/* ========================================================================= */
interface EditISPModalProps {
  isOpen: boolean;
  tenant: Tenant | null;
  onClose: () => void;
  onSuccess: () => void;
}

function EditISPModal({ isOpen, tenant, onClose, onSuccess }: EditISPModalProps) {
  const toast = useToastContext();
  const [formData, setFormData] = useState({
    tenantName: '',
    businessEmail: '',
    businessPhone: '',
    businessAddress: '',
    countryCode: 'BD',
    status: 'active' as TenantStatus,
    adminPassword: '',
    limits: {
      maxRouters: 10,
      maxOlts: 5,
      maxUsers: 25,
      maxCustomers: 2000,
      mapEnabled: true,
      monitoringEnabled: true,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant && isOpen) {
      tenantsService
        .getTenant(tenant.tenantId)
        .then((response) => {
          if (response.success && response.data) {
            const t = response.data;
            setFormData({
              tenantName: t.tenantName || '',
              businessEmail: t.businessEmail || '',
              businessPhone: t.businessPhone || '',
              businessAddress: t.businessAddress || '',
              countryCode: t.countryCode || 'BD',
              status: t.status || 'active',
              adminPassword: '',
              limits: {
                maxRouters: t.limits?.maxRouters ?? 10,
                maxOlts: t.limits?.maxOlts ?? 5,
                maxUsers: t.limits?.maxUsers ?? 25,
                maxCustomers: t.limits?.maxCustomers ?? 2000,
                mapEnabled: t.limits?.mapEnabled ?? true,
                monitoringEnabled: t.limits?.monitoringEnabled ?? true,
              },
            });
          }
        })
        .catch(() => {
          setFormData((prev) => ({
            ...prev,
            tenantName: tenant.tenantName,
            businessEmail: tenant.businessEmail,
            businessPhone: tenant.businessPhone || '',
            businessAddress: tenant.businessAddress || '',
            countryCode: tenant.countryCode || 'BD',
            status: tenant.status,
          }));
        });
    }
  }, [tenant, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setIsLoading(true);
    setError(null);

    try {
      const payload: UpdateTenantPayload = {
        tenantName: formData.tenantName.trim(),
        businessEmail: formData.businessEmail.trim().toLowerCase(),
        countryCode: formData.countryCode.trim().toUpperCase(),
        status: formData.status,
      };

      if (formData.businessPhone?.trim()) {
        payload.businessPhone = formData.businessPhone.trim();
      }
      if (formData.businessAddress?.trim()) {
        payload.businessAddress = formData.businessAddress.trim();
      }

      await tenantsService.updateTenant(tenant.tenantId, payload);
      await tenantsService.updateTenantLimits(tenant.tenantId, formData.limits);

      toast.success('Tenant settings updated successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating tenant:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to update tenant';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !tenant) return null;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col overflow-hidden my-auto">
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit ISP Tenant</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Updating {tenant.tenantName} ({tenant.tenantCode})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                ISP / Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.tenantName}
                onChange={(e) => setFormData((p) => ({ ...p, tenantName: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Business Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.businessEmail}
                onChange={(e) => setFormData((p) => ({ ...p, businessEmail: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Business Phone</label>
              <input
                type="text"
                value={formData.businessPhone}
                onChange={(e) => setFormData((p) => ({ ...p, businessPhone: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Account Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as TenantStatus }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
              >
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
                <option value="expired">Expired</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Business Address</label>
            <textarea
              rows={2}
              value={formData.businessAddress}
              onChange={(e) => setFormData((p) => ({ ...p, businessAddress: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Quotas & Limits */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Resource Limits & Quotas
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Max Customers</label>
                <input
                  type="number"
                  min="1"
                  value={formData.limits.maxCustomers}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, limits: { ...p.limits, maxCustomers: parseInt(e.target.value) || 0 } }))
                  }
                  className="w-full p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Max Routers</label>
                <input
                  type="number"
                  min="1"
                  value={formData.limits.maxRouters}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, limits: { ...p.limits, maxRouters: parseInt(e.target.value) || 0 } }))
                  }
                  className="w-full p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Max OLTs</label>
                <input
                  type="number"
                  min="1"
                  value={formData.limits.maxOlts}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, limits: { ...p.limits, maxOlts: parseInt(e.target.value) || 0 } }))
                  }
                  className="w-full p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Max Staff Users</label>
                <input
                  type="number"
                  min="1"
                  value={formData.limits.maxUsers}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, limits: { ...p.limits, maxUsers: parseInt(e.target.value) || 0 } }))
                  }
                  className="w-full p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 font-semibold text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm active:scale-95 transition-all"
            >
              {isLoading ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* MAIN PAGE: ISPS LIST (TENANTS DIRECTORY)                                  */
/* ========================================================================= */
export default function ISPsListPage() {
  const navigate = useNavigate();
  const { setSelectedTenant } = useTenantStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TenantStatus>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tenantsService.getTenants();
      if (response.success && response.data) {
        setTenants(response.data);
      } else {
        setError('Invalid response format from server');
      }
    } catch (err: any) {
      console.error('Error loading tenants:', err);
      const errorData = err.response?.data || err;
      const msg = errorData?.message || err.message || 'Failed to load ISP tenants';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (tenant: Tenant) => {
    setEditTenant(tenant);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (tenant: Tenant) => {
    const result = await showDeleteConfirm(
      tenant.tenantName,
      `All associated subscriber accounts, MikroTik and OLT mappings for ${tenant.tenantName} will be affected.`
    );
    if (!result.isConfirmed) return;

    try {
      await tenantsService.deleteTenant(tenant.tenantId);
      await showSuccess('Deleted!', `ISP "${tenant.tenantName}" has been deleted.`);
      loadTenants();
    } catch (err: any) {
      console.error('Error deleting tenant:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete ISP';
      await showError('Delete Failed', msg);
    }
  };

  const handleLogin = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    navigate('/dashboard');
  };

  // Telemetry Aggregates
  const stats = useMemo(() => {
    const totalTenants = tenants.length;
    const activeTenants = tenants.filter((t) => t.status === 'active').length;
    const trialTenants = tenants.filter((t) => t.status === 'trial').length;
    const suspendedTenants = tenants.filter((t) => t.status === 'suspended').length;
    const expiredTenants = tenants.filter((t) => t.status === 'expired').length;

    let totalSubscribers = 0;
    let totalRouters = 0;
    let totalOlts = 0;

    for (const t of tenants) {
      totalSubscribers += t.totalCustomers || 0;
      totalRouters += t.totalRouters || 0;
      totalOlts += t.totalOlts || 0;
    }

    return {
      totalTenants,
      activeTenants,
      trialTenants,
      suspendedTenants,
      expiredTenants,
      totalSubscribers,
      totalRouters,
      totalOlts,
    };
  }, [tenants]);

  // Filtered List
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = t.tenantName?.toLowerCase().includes(q);
      const codeMatch = t.tenantCode?.toLowerCase().includes(q);
      const emailMatch = t.businessEmail?.toLowerCase().includes(q);
      const phoneMatch = t.businessPhone?.toLowerCase().includes(q);
      const slugMatch = t.tenantSlug?.toLowerCase().includes(q);
      return nameMatch || codeMatch || emailMatch || phoneMatch || slugMatch;
    });
  }, [tenants, statusFilter, searchQuery]);

  return (
    <div className="w-full min-w-0 space-y-6 pb-12">
      {/* Hero Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">ISP Tenant Networks</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                SaaS Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enterprise multi-tenant directory, subscriber quotas, and hardware allocations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadTenants}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/70 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all shadow-2xs active:scale-95 disabled:opacity-50"
            title="Refresh tenant directory"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add New ISP</span>
          </button>
        </div>
      </div>

      {/* Top 4 Telemetry Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tenants */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            <span className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                <Building2 className="w-4 h-4" />
              </span>
              Total ISP Tenants
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
              {stats.activeTenants} Active
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {stats.totalTenants}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {stats.trialTenants} Trial • {stats.suspendedTenants} Suspended
          </p>
        </div>

        {/* Managed Subscribers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            <span className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                <Users className="w-4 h-4" />
              </span>
              Total Subscribers
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
              Network Wide
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {stats.totalSubscribers.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Live registered end-user connections
          </p>
        </div>

        {/* MikroTik Routers */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            <span className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                <Router className="w-4 h-4" />
              </span>
              MikroTik Routers
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400">
              BRAS
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {stats.totalRouters}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Active Core & Edge Routers connected
          </p>
        </div>

        {/* OLT Devices */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            <span className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                <Radio className="w-4 h-4" />
              </span>
              OLT Nodes
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400">
              PON
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {stats.totalOlts}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Optical Line Terminals synchronized
          </p>
        </div>
      </div>

      {/* Control Bar: Status Filter & Search & View Toggle */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80'
              }`}
            >
              All Tenants ({tenants.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80'
              }`}
            >
              Active ({stats.activeTenants})
            </button>
            <button
              onClick={() => setStatusFilter('trial')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                statusFilter === 'trial'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80'
              }`}
            >
              Trial ({stats.trialTenants})
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                statusFilter === 'suspended'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80'
              }`}
            >
              Suspended ({stats.suspendedTenants})
            </button>
            <button
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                statusFilter === 'expired'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80'
              }`}
            >
              Expired ({stats.expiredTenants})
            </button>
          </div>

          {/* Search & View Toggle */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, code, email..."
                className="w-full pl-9 pr-7 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-all"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="Grid Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="Dense Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="p-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex flex-col items-center justify-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
          <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">Loading tenant networks...</p>
          <p className="text-xs text-slate-400 mt-1">Retrieving live subscriber and device telemetry</p>
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="p-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-center">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No tenants matched your criteria</h3>
          <p className="text-xs text-slate-400 mt-1">Try clearing your search query or status filter</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="mt-4 px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTenants.map((t, idx) => {
            const st = getStatusBadge(t.status);
            const maxSubs = t.limits?.maxCustomers || 5000;
            const currentSubs = t.totalCustomers || 0;
            const pct = Math.min(100, Math.round((currentSubs / maxSubs) * 100));
            const gradient = CARD_COLORS[idx % CARD_COLORS.length];

            return (
              <div
                key={t.tenantId}
                className="group rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:border-blue-500/50 transition-all flex flex-col justify-between overflow-hidden"
              >
                <div>
                  {/* Card Top */}
                  <div className="p-5 border-b border-slate-100 dark:border-slate-700/70">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${gradient} text-white font-black text-base flex items-center justify-center shrink-0 shadow-sm`}
                        >
                          {t.tenantName ? t.tenantName.charAt(0).toUpperCase() : 'T'}
                        </div>
                        <div className="min-w-0">
                          <button
                            onClick={() => navigate(`/saas/tenants/${t.tenantId}`)}
                            className="font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate block text-left transition-colors"
                            title={t.tenantName}
                          >
                            {t.tenantName}
                          </button>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400">
                              {t.tenantCode}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="text-[10px] uppercase font-semibold text-slate-400">
                              {t.countryCode || 'BD'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${st.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </div>

                    {/* Subscriber Quota Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Subscribers Quota</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {currentSubs.toLocaleString()} <span className="text-slate-400 font-normal">/ {maxSubs.toLocaleString()}</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct >= 90 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                        <span>{pct}% capacity utilized</span>
                        <span>{maxSubs - currentSubs} available</span>
                      </div>
                    </div>
                  </div>

                  {/* Hardware / Staff Telemetry Row */}
                  <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700/70 py-3 bg-slate-50/50 dark:bg-slate-900/30 text-center text-xs">
                    <div>
                      <div className="flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400 text-[11px]">
                        <Router className="w-3.5 h-3.5 text-blue-500" />
                        <span>Routers</span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {t.totalRouters || 0}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400 text-[11px]">
                        <Radio className="w-3.5 h-3.5 text-purple-500" />
                        <span>OLTs</span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {t.totalOlts || 0}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-slate-500 dark:text-slate-400 text-[11px]">
                        <Users className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Staff</span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {t.totalUsers || 1}
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="p-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{t.businessEmail}</span>
                    </div>
                    {t.businessPhone && (
                      <div className="flex items-center gap-2 truncate">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{t.businessPhone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 truncate text-[11px] text-slate-400">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>Onboarded: {formatDate(t.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-700/70 bg-white dark:bg-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleLogin(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all"
                    title="Login into this tenant workspace directly"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Login as ISP</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/saas/tenants/${t.tenantId}`)}
                      className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      title="View Full Profile & Hardware Devices"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(t)}
                      className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      title="Edit Tenant Settings"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
                      className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Delete Tenant"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DENSE TABLE VIEW */
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-slate-50/80 dark:bg-slate-900/70 border-b border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 font-bold" style={{ width: '22%' }}>ISP / Tenant Name</th>
                  <th className="px-4 py-3.5 font-bold" style={{ width: '11%' }}>Status</th>
                  <th className="px-4 py-3.5 font-bold" style={{ width: '18%' }}>Subscribers & Quota</th>
                  <th className="px-4 py-3.5 font-bold text-center" style={{ width: '9%' }}>Routers</th>
                  <th className="px-4 py-3.5 font-bold text-center" style={{ width: '8%' }}>OLTs</th>
                  <th className="px-4 py-3.5 font-bold text-center" style={{ width: '8%' }}>Staff</th>
                  <th className="px-4 py-3.5 font-bold" style={{ width: '12%' }}>Created</th>
                  <th className="px-4 py-3.5 font-bold text-right" style={{ width: '12%' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                {filteredTenants.map((t, idx) => {
                  const st = getStatusBadge(t.status);
                  const maxSubs = t.limits?.maxCustomers || 5000;
                  const currentSubs = t.totalCustomers || 0;
                  const pct = Math.min(100, Math.round((currentSubs / maxSubs) * 100));
                  const gradient = CARD_COLORS[idx % CARD_COLORS.length];

                  return (
                    <tr
                      key={t.tenantId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
                      onClick={() => navigate(`/saas/tenants/${t.tenantId}`)}
                    >
                      {/* Name & Code */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${gradient} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                          >
                            {t.tenantName ? t.tenantName.charAt(0).toUpperCase() : 'T'}
                          </div>
                          <div className="truncate min-w-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block truncate hover:text-blue-600">
                              {t.tenantName}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                              {t.tenantCode} • {t.businessEmail}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${st.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </td>

                      {/* Subscribers */}
                      <td className="px-4 py-3 font-mono">
                        <div className="flex items-center justify-between text-[11px] mb-1 font-semibold text-slate-700 dark:text-slate-300">
                          <span>{currentSubs.toLocaleString()}</span>
                          <span className="text-slate-400 text-[10px]">Max: {maxSubs.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
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
                        {t.totalRouters || 0}
                      </td>

                      {/* OLTs */}
                      <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-slate-100">
                        {t.totalOlts || 0}
                      </td>

                      {/* Staff */}
                      <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-slate-100">
                        {t.totalUsers || 1}
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {formatDate(t.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleLogin(t)}
                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                            title="Login as ISP"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => navigate(`/saas/tenants/${t.tenantId}`)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="View Profile"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEdit(t)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(t)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing <strong>{filteredTenants.length}</strong> of <strong>{tenants.length}</strong> total ISP tenants
            </span>
            <span className="font-mono">NetFix Multi-Tenant Core</span>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddISPModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={loadTenants} />
      <EditISPModal
        isOpen={isEditModalOpen}
        tenant={editTenant}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditTenant(null);
        }}
        onSuccess={() => {
          loadTenants();
          setIsEditModalOpen(false);
          setEditTenant(null);
        }}
      />
    </div>
  );
}
