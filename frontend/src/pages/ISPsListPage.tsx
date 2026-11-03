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
} from 'lucide-react';
import { tenantsService } from '@/services/tenants.service';
import { Tenant, TenantStatus, CreateTenantPayload, UpdateTenantPayload } from '@/types/tenant.types';
import { useTenantStore } from '@/stores/tenantStore';
import { useToastContext } from '@/contexts/ToastContext';
import { showDeleteConfirm, showError, showSuccess } from '@/lib/swal';

const stagger = { animate: { transition: { staggerChildren: 0.04 } } };
const itemUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };
const CARD_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

const getStatusBadgeClass = (status: TenantStatus): string => {
  const classes: Record<TenantStatus, string> = {
    active: 'bg-gradient-to-r from-emerald-400 to-green-500 text-white border-emerald-300 dark:from-emerald-500 dark:to-green-600 dark:border-emerald-400 shadow-sm',
    suspended: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-amber-300 dark:from-amber-500 dark:to-yellow-600 dark:border-amber-400 shadow-sm',
    trial: 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white border-blue-300 dark:from-blue-500 dark:to-indigo-600 dark:border-blue-400 shadow-sm',
    expired: 'bg-gradient-to-r from-gray-400 to-slate-500 text-white border-gray-300 dark:from-gray-500 dark:to-slate-600 dark:border-gray-400 shadow-sm',
    terminated: 'bg-gradient-to-r from-red-400 to-rose-500 text-white border-red-300 dark:from-red-500 dark:to-rose-600 dark:border-red-400 shadow-sm',
  };
  return classes[status] || classes.trial;
};

const getStatusLabel = (status: TenantStatus): string => {
  const labels: Record<TenantStatus, string> = {
    active: 'Active',
    suspended: 'Suspended',
    trial: 'Trial',
    expired: 'Expired',
    terminated: 'Terminated',
  };
  return labels[status] || status;
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

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
    countryCode: 'US',
    status: 'trial' as TenantStatus,
    adminPassword: '',
    limits: {
      maxRouters: 5,
      maxOlts: 2,
      maxUsers: 10,
      maxCustomers: 500,
      mapEnabled: true,
      monitoringEnabled: true,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Show confirmation modal instead of submitting directly
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

      // Add optional fields only if they have values
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
      toast.success('ISP created successfully!');
      onSuccess();
      onClose();
      setFormData({
        tenantName: '',
        tenantSlug: '',
        businessEmail: '',
        businessPhone: '',
        businessAddress: '',
        countryCode: 'US',
        status: 'trial',
        adminPassword: '',
        limits: {
          maxRouters: 5,
          maxOlts: 2,
          maxUsers: 10,
          maxCustomers: 500,
          mapEnabled: true,
          monitoringEnabled: true,
        },
      });
    } catch (err: any) {
      console.error('Error creating ISP:', err);
      let errorMessage = 'Failed to create ISP. Please try again.';
      
      if (err.response) {
        const response = err.response;
        const data = response.data;
        
        // Handle validation errors (array format)
        if (Array.isArray(data.message)) {
          errorMessage = data.message.join(', ');
        }
        // Handle single message
        else if (data.message) {
          errorMessage = data.message;
        }
        // Handle error field
        else if (data.error) {
          if (Array.isArray(data.error)) {
            errorMessage = data.error.join(', ');
          } else if (typeof data.error === 'string') {
            errorMessage = data.error;
          }
        }
        // Handle string response
        else if (typeof data === 'string') {
          errorMessage = data;
        }
        // Handle status text
        else if (response.statusText) {
          errorMessage = `${response.status} ${response.statusText}`;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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

  if (!isOpen) return null;

  return (
    <>
      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Confirm ISP Creation</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Please review the details before creating</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">ISP Name:</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 text-right">{formData.tenantName}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Slug:</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 text-right">{formData.tenantSlug}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Email:</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 text-right">{formData.businessEmail}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Status:</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 text-right capitalize">{formData.status}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Max Customers:</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 text-right">{formData.limits.maxCustomers}</span>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  <strong>Note:</strong> An admin user will be created with the provided password. Make sure to save the credentials securely.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                disabled={isLoading}
                className="px-6 py-3 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isLoading}
                className="px-6 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm hover:shadow active:scale-95"
              >
                {isLoading ? 'Creating...' : 'Confirm & Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form Modal */}
      <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            Add New ISP
          </h2>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="status" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              id="status"
              required
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as TenantStatus }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 transition-all"
            >
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Tenant code will be auto-generated (e.g., ISP000001)</p>
          </div>

          <div>
            <label htmlFor="tenantName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              ISP Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="tenantName"
              required
              value={formData.tenantName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
              placeholder="ABC Internet Services"
            />
          </div>

          <div>
            <label htmlFor="tenantSlug" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Slug <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="tenantSlug"
              required
              value={formData.tenantSlug}
              onChange={(e) => setFormData((prev) => ({ ...prev, tenantSlug: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
              placeholder="abc-internet"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="businessEmail" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Business Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="businessEmail"
                required
                value={formData.businessEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, businessEmail: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                placeholder="contact@example.com"
              />
            </div>

            <div>
              <label htmlFor="businessPhone" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Business Phone
              </label>
              <input
                type="tel"
                id="businessPhone"
                value={formData.businessPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, businessPhone: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                placeholder="+1234567890"
              />
            </div>
          </div>

          <div>
            <label htmlFor="businessAddress" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Business Address
            </label>
            <textarea
              id="businessAddress"
              rows={2}
              value={formData.businessAddress}
              onChange={(e) => setFormData((prev) => ({ ...prev, businessAddress: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all resize-none"
              placeholder="123 Main St, City, State, ZIP"
            />
          </div>

          <div>
            <label htmlFor="countryCode" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Country Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="countryCode"
              required
              maxLength={2}
              value={formData.countryCode}
              onChange={(e) => setFormData((prev) => ({ ...prev, countryCode: e.target.value.toUpperCase() }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all uppercase"
              placeholder="US"
            />
          </div>

          <div>
            <label htmlFor="adminPassword" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Admin Password
            </label>
            <input
              type="password"
              id="adminPassword"
              value={formData.adminPassword}
              onChange={(e) => setFormData((prev) => ({ ...prev, adminPassword: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
              placeholder="Password for admin user (optional)"
            />
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              If provided, an admin user will be created with this password. Login email will be the business email.
            </p>
          </div>

          {/* Limits Section */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent mb-6">
              Resource Limits
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                <label htmlFor="maxRouters" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Max Routers <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="maxRouters"
                  required
                  min="0"
                  value={formData.limits.maxRouters}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      limits: { ...prev.limits, maxRouters: parseInt(e.target.value) || 0 },
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 transition-all font-semibold"
                />
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                <label htmlFor="maxOlts" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Max OLTs <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="maxOlts"
                  required
                  min="0"
                  value={formData.limits.maxOlts}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      limits: { ...prev.limits, maxOlts: parseInt(e.target.value) || 0 },
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 transition-all font-semibold"
                />
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
                <label htmlFor="maxUsers" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Max Users <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="maxUsers"
                  required
                  min="0"
                  value={formData.limits.maxUsers}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      limits: { ...prev.limits, maxUsers: parseInt(e.target.value) || 0 },
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 transition-all font-semibold"
                />
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800">
                <label htmlFor="maxCustomers" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Max Customers <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="maxCustomers"
                  required
                  min="0"
                  value={formData.limits.maxCustomers}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      limits: { ...prev.limits, maxCustomers: parseInt(e.target.value) || 0 },
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 transition-all font-semibold"
                />
              </div>

              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-800">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.limits.mapEnabled}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        limits: { ...prev.limits, mapEnabled: e.target.checked },
                      }))
                    }
                    className="w-5 h-5 text-blue-600 dark:text-blue-400 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Map/GIS Feature Enabled</span>
                </label>
              </div>

              <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 p-4 rounded-xl border border-violet-100 dark:border-violet-800">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.limits.monitoringEnabled}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        limits: { ...prev.limits, monitoringEnabled: e.target.checked },
                      }))
                    }
                    className="w-5 h-5 text-blue-600 dark:text-blue-400 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Monitoring Feature Enabled</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all font-medium shadow-sm hover:shadow-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm hover:shadow active:scale-95"
            >
              {isLoading ? 'Creating...' : 'Create ISP'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </>
  );
}

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
    countryCode: 'US',
    status: 'trial' as TenantStatus,
    adminPassword: '',
    limits: {
      maxRouters: 5,
      maxOlts: 2,
      maxUsers: 10,
      maxCustomers: 500,
      mapEnabled: true,
      monitoringEnabled: true,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTenant, setIsLoadingTenant] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant && isOpen) {
      setIsLoadingTenant(true);
      // Fetch full tenant data with limits
      tenantsService
        .getTenant(tenant.tenantId)
        .then((response) => {
          const fullTenant = response.data;
          setFormData({
            tenantName: fullTenant.tenantName,
            businessEmail: fullTenant.businessEmail,
            businessPhone: fullTenant.businessPhone || '',
            businessAddress: fullTenant.businessAddress || '',
            countryCode: fullTenant.countryCode,
            status: fullTenant.status,
            adminPassword: '',
            limits: fullTenant.limits || {
              maxRouters: 5,
              maxOlts: 2,
              maxUsers: 10,
              maxCustomers: 500,
              mapEnabled: true,
              monitoringEnabled: true,
            },
          });
        })
        .catch((err) => {
          console.error('Error loading tenant details:', err);
          // Fallback to basic tenant data
          setFormData({
            tenantName: tenant.tenantName,
            businessEmail: tenant.businessEmail,
            businessPhone: tenant.businessPhone || '',
            businessAddress: tenant.businessAddress || '',
            countryCode: tenant.countryCode,
            status: tenant.status,
            adminPassword: '',
            limits: {
              maxRouters: 5,
              maxOlts: 2,
              maxUsers: 10,
              maxCustomers: 500,
              mapEnabled: true,
              monitoringEnabled: true,
            },
          });
        })
        .finally(() => {
          setIsLoadingTenant(false);
        });
    }
  }, [tenant, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Update tenant basic info
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
      if (formData.adminPassword?.trim()) {
        payload.adminPassword = formData.adminPassword;
      }

      await tenantsService.updateTenant(tenant.tenantId, payload);

      // Update tenant limits
      const limitsPayload = {
        maxRouters: formData.limits.maxRouters,
        maxOlts: formData.limits.maxOlts,
        maxUsers: formData.limits.maxUsers,
        maxCustomers: formData.limits.maxCustomers,
        mapEnabled: formData.limits.mapEnabled,
        monitoringEnabled: formData.limits.monitoringEnabled,
      };

      try {
        await tenantsService.updateTenantLimits(tenant.tenantId, limitsPayload);
      } catch (limitsErr: any) {
        console.error('Error updating tenant limits:', limitsErr);
        // If limits update fails, still show success for tenant update but warn about limits
        const limitsErrorMsg = limitsErr.response?.data?.message || limitsErr.message || 'Failed to update limits';
        toast.error(`ISP updated but limits update failed: ${limitsErrorMsg}`);
        onSuccess();
        onClose();
        return;
      }

      toast.success('ISP updated successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating ISP:', err);
      let errorMessage = 'Failed to update ISP. Please try again.';
      
      if (err.response?.data?.message) {
        errorMessage = Array.isArray(err.response.data.message) 
          ? err.response.data.message.join(', ') 
          : err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !tenant) return null;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            Edit ISP
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {isLoadingTenant && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Loading tenant details...</p>
            </div>
          )}

          <div>
            <label htmlFor="edit-tenantName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              ISP Name
            </label>
            <input
              type="text"
              id="edit-tenantName"
              required
              value={formData.tenantName}
              onChange={(e) => setFormData((prev) => ({ ...prev, tenantName: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-businessEmail" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Business Email
              </label>
              <input
                type="email"
                id="edit-businessEmail"
                required
                value={formData.businessEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, businessEmail: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
              />
            </div>

            <div>
              <label htmlFor="edit-businessPhone" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Business Phone
              </label>
              <input
                type="tel"
                id="edit-businessPhone"
                value={formData.businessPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, businessPhone: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-businessAddress" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Business Address
            </label>
            <textarea
              id="edit-businessAddress"
              rows={2}
              value={formData.businessAddress}
              onChange={(e) => setFormData((prev) => ({ ...prev, businessAddress: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-countryCode" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Country Code
              </label>
              <input
                type="text"
                id="edit-countryCode"
                required
                maxLength={2}
                value={formData.countryCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, countryCode: e.target.value.toUpperCase() }))}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all uppercase"
              />
            </div>

            <div>
              <label htmlFor="edit-status" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Status
              </label>
              <select
                id="edit-status"
                required
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as TenantStatus }))}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 transition-all"
              >
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="expired">Expired</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>

          {/* Device Limits Section */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Device & Resource Limits</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                <label htmlFor="edit-maxRouters" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Max Routers
                </label>
                <input
                  type="number"
                  id="edit-maxRouters"
                  required
                  min="0"
                  value={formData.limits.maxRouters}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      limits: { ...prev.limits, maxRouters: parseInt(e.target.value) || 0 },
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 transition-all font-semibold"
                />
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                <label htmlFor="edit-maxOlts" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Max OLTs
                </label>
                <input
                  type="number"
                  id="edit-maxOlts"
                  required
                  min="0"
                  value={formData.limits.maxOlts}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      limits: { ...prev.limits, maxOlts: parseInt(e.target.value) || 0 },
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 transition-all font-semibold"
                />
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
                <label htmlFor="edit-maxUsers" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Max Users
                </label>
                <input
                  type="number"
                  id="edit-maxUsers"
                  required
                  min="0"
                  value={formData.limits.maxUsers}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      limits: { ...prev.limits, maxUsers: parseInt(e.target.value) || 0 },
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 transition-all font-semibold"
                />
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800">
                <label htmlFor="edit-maxCustomers" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Max Customers
                </label>
                <input
                  type="number"
                  id="edit-maxCustomers"
                  required
                  min="0"
                  value={formData.limits.maxCustomers}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      limits: { ...prev.limits, maxCustomers: parseInt(e.target.value) || 0 },
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 transition-all font-semibold"
                />
              </div>

              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-800">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.limits.mapEnabled}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        limits: { ...prev.limits, mapEnabled: e.target.checked },
                      }))
                    }
                    className="w-5 h-5 text-blue-600 dark:text-blue-400 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Map/GIS Feature Enabled</span>
                </label>
              </div>

              <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 p-4 rounded-xl border border-violet-100 dark:border-violet-800">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.limits.monitoringEnabled}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        limits: { ...prev.limits, monitoringEnabled: e.target.checked },
                      }))
                    }
                    className="w-5 h-5 text-blue-600 dark:text-blue-400 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Monitoring Feature Enabled</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="edit-adminPassword" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Update Admin Password
            </label>
            <input
              type="password"
              id="edit-adminPassword"
              value={formData.adminPassword}
              onChange={(e) => setFormData((prev) => ({ ...prev, adminPassword: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
              placeholder="Leave empty to keep current password"
            />
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              Only fill this field if you want to update the admin user password.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all font-medium shadow-sm hover:shadow-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm hover:shadow active:scale-95"
            >
              {isLoading ? 'Updating...' : 'Update ISP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ISPsListPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTenants = useMemo(() => {
    if (!searchQuery.trim()) return tenants;
    const q = searchQuery.trim().toLowerCase();
    return tenants.filter(
      (t) =>
        t.tenantName.toLowerCase().includes(q) ||
        t.tenantCode.toLowerCase().includes(q) ||
        t.businessEmail.toLowerCase().includes(q) ||
        (t.businessPhone && t.businessPhone.toLowerCase().includes(q)),
    );
  }, [tenants, searchQuery]);

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
      let errorMessage = 'Failed to load ISPs. Please try again.';
      
      // The API interceptor may return error.response.data directly
      // So err might be the data object itself, or it might have response property
      const errorData = err.response?.data || err;
      
      if (errorData?.message) {
        errorMessage = Array.isArray(errorData.message) 
          ? errorData.message.join(', ') 
          : errorData.message;
      } else if (errorData?.error) {
        errorMessage = Array.isArray(errorData.error) 
          ? errorData.error.join(', ') 
          : errorData.error;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (err.response?.status === 401) {
        errorMessage = 'Authentication required. Please login again.';
      } else if (err.response?.status === 403) {
        errorMessage = 'You do not have permission to access this resource. Only SaaS administrators can view tenants.';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const { setSelectedTenant } = useTenantStore();

  const handleEdit = (tenant: Tenant) => {
    setEditTenant(tenant);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (tenant: Tenant) => {
    const result = await showDeleteConfirm(
      tenant.tenantName,
      'This action cannot be undone. All associated data will be permanently deleted.'
    );

    if (!result.isConfirmed) {
      return;
    }

    try {
      await tenantsService.deleteTenant(tenant.tenantId);
      await showSuccess('Deleted!', `ISP "${tenant.tenantName}" has been deleted successfully.`);
      loadTenants();
    } catch (err: any) {
      console.error('Error deleting tenant:', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to delete ISP. Please try again.';
      await showError('Delete Failed', errorMessage);
    }
  };

  const handleLogin = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    navigate('/dashboard');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
              <Building2 className="w-8 h-8" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 dark:from-slate-100 dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
                Tenants
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" />
                {isLoading ? 'Loading...' : `${tenants.length} ISP${tenants.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm hover:shadow transition-all active:scale-95"
            type="button"
            aria-label="Add new ISP"
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} />
            Add ISP
          </motion.button>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50"
            >
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
                <p className="text-xs mt-1 text-red-600 dark:text-red-400">
                  {error.includes('Authentication') || error.includes('permission')
                    ? 'Log in as a SaaS administrator.'
                    : 'Check your connection and try again.'}
                </p>
              </div>
              <button
                onClick={loadTenants}
                className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
              >
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tenants list */}
        <motion.section
          variants={stagger}
          initial="initial"
          animate="animate"
          className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl overflow-hidden"
        >
          <div className="p-5 border-b border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2 shrink-0">
              <Building2 className="w-4 h-4" />
              All Tenants
            </h2>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, code, email or phone..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            {isLoading ? (
              <div className="p-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium">Loading tenants...</p>
              </div>
            ) : filteredTenants.length === 0 ? (
              <motion.div
                variants={itemUp}
                className="p-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400"
              >
                <Building2 className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-sm font-medium">
                  {tenants.length === 0 ? 'No tenants yet' : 'No matching tenants'}
                </p>
                <p className="text-xs mt-1">
                  {tenants.length === 0 ? 'Add your first ISP' : 'Try a different search'}
                </p>
                {tenants.length === 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-4 px-5 py-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium text-sm"
                  >
                    Add ISP
                  </motion.button>
                )}
              </motion.div>
            ) : (
              <motion.ul
                variants={stagger}
                initial="initial"
                animate="animate"
                className="divide-y divide-slate-200/80 dark:divide-slate-700/80"
              >
                <AnimatePresence>
                  {filteredTenants.map((tenant, index) => (
                    <motion.li
                      key={tenant.tenantId}
                      variants={itemUp}
                      initial="initial"
                      animate="animate"
                      exit={{ opacity: 0, x: -20 }}
                      onClick={() => navigate(`/saas/tenants/${tenant.tenantId}`)}
                      className="group flex items-center gap-4 p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
                        style={{
                          background: `linear-gradient(135deg, ${CARD_COLORS[index % CARD_COLORS.length]}, ${CARD_COLORS[(index + 1) % CARD_COLORS.length]})`,
                        }}
                      >
                        {tenant.tenantName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {tenant.tenantName}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            {tenant.tenantCode}
                          </span>
                          <span className="flex items-center gap-1 truncate max-w-[180px]">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            {tenant.businessEmail}
                          </span>
                          {tenant.businessPhone && (
                            <span className="flex items-center gap-1 shrink-0">
                              <Phone className="w-3.5 h-3.5" />
                              {tenant.businessPhone}
                            </span>
                          )}
                          <span className="flex items-center gap-1 shrink-0">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(tenant.createdAt)}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                          tenant.status,
                        )}`}
                      >
                        {getStatusLabel(tenant.status)}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <motion.button
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(tenant);
                          }}
                          className="p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLogin(tenant);
                          }}
                          className="p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-green-100 dark:hover:bg-green-900/40 hover:text-green-600 dark:hover:text-green-400"
                          title="Login as this ISP"
                        >
                          <LogIn className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tenant);
                          }}
                          className="p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            )}
          </div>
        </motion.section>
      </div>

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
    </motion.div>
  );
}
