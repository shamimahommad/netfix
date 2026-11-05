import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customersService } from '@/services/customers.service';
import { CustomerDetailResponse } from '@/types/customer.types';
import { serviceAreaService } from '@/services/service-area.service';
import { ServiceArea } from '@/types/service-area.types';
import { networkPackagesService } from '@/services/network-packages.service';
import { NetworkPackage } from '@/types/network.types';
import { useToastContext } from '@/contexts/ToastContext';

// Icons
function ArrowLeftIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function UserIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function PhoneIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function EnvelopeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IdentificationIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
    </svg>
  );
}

function MapPinIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ServerIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

function WifiIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  );
}

function CreditCardIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function XMarkIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function EyeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeSlashIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

type TabKey = 'identity' | 'network' | 'billing' | 'location';

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();

  const [customerData, setCustomerData] = useState<CustomerDetailResponse['data'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('identity');

  // Related options
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [packages, setPackages] = useState<NetworkPackage[]>([]);
  const [isAddAreaModalOpen, setIsAddAreaModalOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Identity & Contact
    fullName: '',
    phone: '',
    alternatePhone: '',
    email: '',
    nationalId: '',
    dob: '',
    installationAddress: '',
    billingAddress: '',
    internalNotes: '',

    // Location
    district: '',
    thana: '',
    area: '',
    subArea: '',
    postalCode: '',

    // Network & MikroTik
    protocol: 'pppoe',
    username: '',
    password: '',
    routerName: '',
    ipAddress: '',
    macAddress: '',
    deviceVendor: '',

    // Billing & Package
    planId: '',
    packageName: '',
    planPrice: 0,
    billingCycle: 'monthly',
    billingStatus: 'Paid',
    status: 'active',
    connectionDate: '',
  });

  useEffect(() => {
    if (id) {
      loadCustomerDetail();
      loadAreas();
      loadPackages();
    }
  }, [id]);

  const loadAreas = async () => {
    try {
      const response = await serviceAreaService.listAreas();
      setAreas(response.data || []);
    } catch (err) {
      console.error('Failed to load areas:', err);
    }
  };

  const loadPackages = async () => {
    try {
      const res = await networkPackagesService.list({ limit: 100 });
      setPackages(res.data || []);
    } catch (err) {
      console.error('Failed to load packages:', err);
    }
  };

  const loadCustomerDetail = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await customersService.getCustomerDetail(id);
      const data = response.data;
      setCustomerData(data);

      const cust = data.customer;
      const net = data.network;
      const srv = data.service;
      const bil = data.billing;

      setFormData({
        fullName: cust.fullName || '',
        phone: cust.phone || cust.mobileNumber || '',
        alternatePhone: cust.alternatePhone || '',
        email: cust.email || '',
        nationalId: cust.nationalId || '',
        dob: cust.dob ? cust.dob.split('T')[0] : '',
        installationAddress: cust.installationAddress || '',
        billingAddress: cust.billingAddress || cust.installationAddress || '',
        internalNotes: cust.internalNotes || '',

        district: cust.district || '',
        thana: cust.thana || '',
        area: cust.area || '',
        subArea: cust.subArea || '',
        postalCode: cust.postalCode || '',

        protocol: net.protocolType || 'pppoe',
        username: net.username || '',
        password: net.password || '',
        routerName: net.serverName || 'Core Router',
        ipAddress: net.ipAddress || '',
        macAddress: net.macAddress || net.activeMacAddress || '',
        deviceVendor: net.deviceVendor || '',

        planId: '',
        packageName: srv.packageName || '',
        planPrice: bil.planPrice || srv.price || 0,
        billingCycle: srv.billingCycle || 'monthly',
        billingStatus: bil.billingStatus || cust.billingStatus || 'Paid',
        status: cust.status || 'active',
        connectionDate: cust.connectionDate ? cust.connectionDate.split('T')[0] : '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load customer details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddArea = async () => {
    if (!newAreaName.trim()) return;
    setIsCreatingArea(true);
    try {
      await serviceAreaService.createArea({ name: newAreaName.trim() });
      toast.success(`Area "${newAreaName.trim()}" added successfully`);
      setFormData((prev) => ({ ...prev, area: newAreaName.trim() }));
      setNewAreaName('');
      setIsAddAreaModalOpen(false);
      await loadAreas();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create area');
    } finally {
      setIsCreatingArea(false);
    }
  };

  const handlePackageSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const pkg = packages.find((p) => String(p.id) === selectedId);
    if (pkg) {
      setFormData((prev) => ({
        ...prev,
        planId: String(pkg.id),
        packageName: pkg.name,
        planPrice: pkg.price,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        planId: '',
      }));
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!id) return;

    if (!formData.fullName.trim()) {
      toast.error('Customer Full Name is required');
      setActiveTab('identity');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Mobile Phone number is required');
      setActiveTab('identity');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload: any = {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        alternatePhone: formData.alternatePhone.trim() || undefined,
        email: formData.email.trim() || undefined,
        nationalId: formData.nationalId.trim() || undefined,
        dob: formData.dob || undefined,
        installationAddress: formData.installationAddress.trim() || undefined,
        billingAddress: formData.billingAddress.trim() || undefined,
        internalNotes: formData.internalNotes.trim() || undefined,

        district: formData.district.trim() || undefined,
        thana: formData.thana.trim() || undefined,
        area: formData.area.trim() || undefined,
        subArea: formData.subArea.trim() || undefined,
        postalCode: formData.postalCode.trim() || undefined,

        password: formData.password ? formData.password.trim() : undefined,
        macAddress: formData.macAddress.trim() || undefined,
        ipAddress: formData.ipAddress.trim() || undefined,

        billingStatus: formData.billingStatus,
        status: formData.status,
        connectionDate: formData.connectionDate || undefined,
      };

      if (formData.planId) {
        payload.planId = formData.planId;
      }

      await customersService.updateCustomer(id, payload);
      toast.success('Customer profile updated successfully!');
      navigate(`/dashboard/customers/view/${id}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update customer.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-[80vh] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Loading customer profile...</p>
      </div>
    );
  }

  if (error && !customerData) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 space-y-4">
        <button
          onClick={() => navigate('/dashboard/customers')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Back to Customers
        </button>
        <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          <p className="font-semibold text-base mb-1">Failed to Load Customer</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'identity', label: 'Identity & Contact', icon: <UserIcon className="w-4 h-4" /> },
    { key: 'network', label: 'Network & MikroTik', icon: <ServerIcon className="w-4 h-4" /> },
    { key: 'billing', label: 'Package & Billing', icon: <CreditCardIcon className="w-4 h-4" /> },
    { key: 'location', label: 'Location & Area', icon: <MapPinIcon className="w-4 h-4" /> },
  ];

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'due':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'expired':
        return 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'suspended':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-3 sm:p-6 space-y-6 animate-in fade-in duration-300">
      {/* TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-sky-200/60 dark:border-slate-700 shadow-xl shadow-sky-500/5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/dashboard/customers/view/${id}`)}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all hover:scale-105"
            title="Back to Customer Profile"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Edit Customer
              </h1>
              {customerData && (
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  {customerData.customer.customerCode || `#${customerData.customer.id}`}
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${getStatusBadge(formData.billingStatus)}`}>
                {formData.billingStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Modify subscriber credentials, billing policy, and network routing configurations
            </p>
          </div>
        </div>

        {/* Action Buttons Top Right */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate(`/dashboard/customers/view/${id}`)}
            disabled={isSaving}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !formData.fullName.trim() || !formData.phone.trim()}
            className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-teal-600 hover:from-sky-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-sky-500 to-teal-600 text-white shadow-md shadow-sky-500/20'
                  : 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* FORM BODY CONTAINER */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* TAB 1: IDENTITY & CONTACT */}
        {activeTab === 'identity' && (
          <div className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-sky-200/60 dark:border-slate-700 p-5 sm:p-6 shadow-xl shadow-sky-500/5 space-y-5">
            <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-sky-600 dark:text-teal-400" />
                Personal Profile & Contact Information
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Primary subscriber name, telephone contacts, identification, and installation location
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all"
                    placeholder="e.g. John Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Primary Mobile Phone <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <PhoneIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 font-mono transition-all"
                    placeholder="01XXXXXXXXX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Alternate Phone / WhatsApp
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <PhoneIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={formData.alternatePhone}
                    onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 font-mono transition-all"
                    placeholder="Optional secondary phone"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <EnvelopeIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all"
                    placeholder="customer@domain.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  National ID (NID) / Passport No
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <IdentificationIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={formData.nationalId}
                    onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 font-mono transition-all"
                    placeholder="NID or Smart Card No"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Date of Birth (DOB)
                </label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Installation / Connection Address
                </label>
                <textarea
                  rows={3}
                  value={formData.installationAddress}
                  onChange={(e) => setFormData({ ...formData, installationAddress: e.target.value })}
                  className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 resize-none transition-all"
                  placeholder="House, Road, Apartment, Village/Area"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Billing Address
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, billingAddress: formData.installationAddress })}
                    className="text-[11px] font-semibold text-sky-600 dark:text-teal-400 hover:underline"
                  >
                    Copy from Installation
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={formData.billingAddress}
                  onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                  className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 resize-none transition-all"
                  placeholder="Billing postal address if different"
                />
              </div>
            </div>

            {/* Internal Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Internal Notes & Remarks
              </label>
              <textarea
                rows={2}
                value={formData.internalNotes}
                onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 resize-none transition-all"
                placeholder="Special instructions, optical power readings, or customer history notes"
              />
            </div>
          </div>
        )}

        {/* TAB 2: NETWORK & MIKROTIK */}
        {activeTab === 'network' && (
          <div className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-sky-200/60 dark:border-slate-700 p-5 sm:p-6 shadow-xl shadow-sky-500/5 space-y-5">
            <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ServerIcon className="w-5 h-5 text-sky-600 dark:text-teal-400" />
                Network Credentials & MikroTik Configuration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                PPPoE secrets, hardware MAC bindings, static IP assignments, and router connection details
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Protocol */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Connection Protocol
                </label>
                <div className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 font-mono font-semibold">
                  {formData.protocol.toUpperCase()}
                </div>
              </div>

              {/* Target Router */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Assigned MikroTik Router / NAS
                </label>
                <div className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-2">
                  <ServerIcon className="w-4 h-4 text-sky-500" />
                  <span>{formData.routerName || 'Core MikroTik Router'}</span>
                </div>
              </div>

              {/* PPPoE Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  PPPoE Secret Username
                </label>
                <input
                  type="text"
                  readOnly
                  value={formData.username}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 font-mono cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1">Username is immutable to prevent session breaks</p>
              </div>

              {/* PPPoE Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  PPPoE Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 font-mono transition-all"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-teal-600 dark:text-teal-400 mt-1">
                  ⚡ Saving automatically syncs secret to active MikroTik router
                </p>
              </div>

              {/* Static / Remote IP */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Remote / Static IP Address
                </label>
                <input
                  type="text"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  placeholder="e.g. 192.168.10.50 (Leave blank for pool)"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 font-mono transition-all"
                />
              </div>

              {/* MAC Address */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Customer Router MAC Address
                  </label>
                  {formData.deviceVendor && formData.deviceVendor !== 'Unknown' && (
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {formData.deviceVendor}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={formData.macAddress}
                  onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 font-mono uppercase transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">Used for MAC caller-ID binding and auto OLT ONU matching</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PACKAGE & BILLING */}
        {activeTab === 'billing' && (
          <div className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-sky-200/60 dark:border-slate-700 p-5 sm:p-6 shadow-xl shadow-sky-500/5 space-y-5">
            <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CreditCardIcon className="w-5 h-5 text-sky-600 dark:text-teal-400" />
                Package Plan & Billing Setup
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Service bandwidth tier, subscription billing cycle, and subscriber status
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Package Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Package Plan
                </label>
                <select
                  value={formData.planId}
                  onChange={handlePackageSelect}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all"
                >
                  <option value="">Current: {formData.packageName || 'Select Package'}</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — ৳{pkg.price}/month
                    </option>
                  ))}
                </select>
              </div>

              {/* Monthly Price */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Monthly Subscription Fee (BDT)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">
                    ৳
                  </div>
                  <input
                    type="number"
                    value={formData.planPrice}
                    readOnly
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Billing Cycle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Billing Cycle
                </label>
                <select
                  value={formData.billingCycle}
                  onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all capitalize"
                >
                  <option value="monthly">Monthly Calendar Cycle</option>
                  <option value="custom">Day-based / Custom Period</option>
                </select>
              </div>

              {/* Connection Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Connection Activation Date
                </label>
                <input
                  type="date"
                  value={formData.connectionDate}
                  onChange={(e) => setFormData({ ...formData, connectionDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              {/* Billing Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Billing Status
                </label>
                <select
                  value={formData.billingStatus}
                  onChange={(e) => setFormData({ ...formData, billingStatus: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all font-semibold"
                >
                  <option value="Paid">Active (Paid)</option>
                  <option value="Due">Due</option>
                  <option value="Expired">Expired</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Left">Left (Terminated)</option>
                </select>
              </div>

              {/* Account Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Account Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all font-semibold capitalize"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LOCATION & AREA */}
        {activeTab === 'location' && (
          <div className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-sky-200/60 dark:border-slate-700 p-5 sm:p-6 shadow-xl shadow-sky-500/5 space-y-5">
            <div className="border-b border-slate-200 dark:border-slate-700 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <MapPinIcon className="w-5 h-5 text-sky-600 dark:text-teal-400" />
                  Service Area & Geographical Hierarchy
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Zone assignment, district, thana, and distribution sub-areas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAreaModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-teal-400 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>New Area</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  District (City)
                </label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  placeholder="e.g. Dhaka, Chittagong"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Thana (Upazila)
                </label>
                <input
                  type="text"
                  value={formData.thana}
                  onChange={(e) => setFormData({ ...formData, thana: e.target.value })}
                  placeholder="e.g. Dhanmondi, Mirpur"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Service Area
                </label>
                <select
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all font-medium"
                >
                  <option value="">Select Service Area</option>
                  {areas.map((a) => (
                    <option key={a.serviceAreaId} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Sub Area
                </label>
                <input
                  type="text"
                  value={formData.subArea}
                  onChange={(e) => setFormData({ ...formData, subArea: e.target.value })}
                  placeholder="e.g. Block C, Sector 4"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="e.g. 1205"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 font-mono transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM SAVE FOOTER */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-sky-200/60 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Fields marked with <span className="text-red-500 font-bold">*</span> are required
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/dashboard/customers/view/${id}`)}
              disabled={isSaving}
              className="px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !formData.fullName.trim() || !formData.phone.trim()}
              className="flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-teal-600 hover:from-sky-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  <span>Save All Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ADD AREA MODAL */}
      {isAddAreaModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-sky-200/80 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-sky-500 to-teal-600 px-5 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-base flex items-center gap-2">
                <MapPinIcon className="w-5 h-5" />
                Add New Service Area
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddAreaModalOpen(false);
                  setNewAreaName('');
                }}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Area Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newAreaName.trim()) {
                      handleAddArea();
                    }
                  }}
                  placeholder="e.g. Dhanmondi 27, Banani DOHS"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddAreaModalOpen(false);
                    setNewAreaName('');
                  }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddArea}
                  disabled={isCreatingArea || !newAreaName.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-teal-600 hover:from-sky-600 hover:to-teal-700 text-white shadow-md disabled:opacity-50 transition-all"
                >
                  {isCreatingArea ? 'Creating...' : 'Create Area'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
