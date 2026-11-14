import { useState, useEffect } from 'react';
import { Building2, CheckCircle2, AlertCircle, Sliders, Hash } from 'lucide-react';
import { tenantsService } from '@/services/tenants.service';
import { CreateTenantPayload, TenantStatus } from '@/types/tenant.types';
import { useToastContext } from '@/contexts/ToastContext';

export interface AddISPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddISPModal({ isOpen, onClose, onSuccess }: AddISPModalProps) {
  const toast = useToastContext();
  const [formData, setFormData] = useState({
    tenantCode: '',
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

  // Auto-fetch guaranteed next unique ISP ID number
  useEffect(() => {
    if (isOpen) {
      tenantsService.getNextTenantCode().then((res) => {
        if (res && res.nextCode) {
          setFormData((p) => ({
            ...p,
            tenantCode: p.tenantCode || res.nextCode,
          }));
        }
      }).catch(() => {
        // Fallback default
        setFormData((p) => ({
          ...p,
          tenantCode: p.tenantCode || String(Math.floor(1000 + Math.random() * 9000)),
        }));
      });
    }
  }, [isOpen]);

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
        tenantCode: formData.tenantCode.trim().replace(/\D/g, ''),
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
        payload.adminPassword = formData.adminPassword.trim();
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
                  <span className="text-slate-500">Unique ISP ID:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                    {formData.tenantCode}
                  </span>
                </div>
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
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Unique ISP ID Number</span>
                    <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                    Auto-generated & Unique
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={formData.tenantCode}
                  onChange={(e) => setFormData((p) => ({ ...p, tenantCode: e.target.value.replace(/\D/g, '') }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-sm text-blue-600 dark:text-blue-400 tracking-wider"
                  placeholder="e.g. 1004"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Permanent unique ISP identifier used for instant search, API queries, and Payment Webhook routing
                </p>
              </div>

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

