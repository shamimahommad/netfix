import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastContext } from '@/contexts/ToastContext';
import { useAuthStore } from '@/stores/authStore';
import { customersService } from '@/services/customers.service';
import { networkService } from '@/services/network.service';
import { networkPackagesService } from '@/services/network-packages.service';
import { serviceAreaService } from '@/services/service-area.service';
import { resellerService } from '@/services/reseller.service';
import { Reseller } from '@/services/reseller.service';
import { NetworkDevice, NetworkPackage, NetworkProtocol } from '@/types/network.types';
import { ServiceArea, SubArea } from '@/types/service-area.types';
import { CreateClientPayload } from '@/types/client-onboarding.types';
import { BD_DISTRICTS, getThanaNamesForDistrict } from '@/data/bd-districts-thanas';
import MapPickerModal from '@/components/MapPickerModal';

type Step = 1 | 2 | 3 | 4 | 5;

const PROTOCOLS: Array<{ label: string; value: NetworkProtocol }> = [
  { label: 'PPPoE', value: 'pppoe' },
  { label: 'Hotspot', value: 'hotspot' },
  { label: 'Static', value: 'static' },
  { label: 'OVPN', value: 'ovpn' },
  { label: 'PPTP', value: 'pptp' },
];

function randomString(length: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function VIPIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6L12 2z" />
    </svg>
  );
}

function FreeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
  );
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, '');
}

export default function AddClientPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const { user } = useAuthStore();

  const [step, setStep] = useState<Step>(1);
  const [isSaving, setIsSaving] = useState(false);

  const [servers, setServers] = useState<NetworkDevice[]>([]);
  const [packages, setPackages] = useState<NetworkPackage[]>([]);
  const [packagesMeta, setPackagesMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [packageSearch, setPackageSearch] = useState('');

  const [selectedPackage, setSelectedPackage] = useState<NetworkPackage | null>(null);

  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [subAreas, setSubAreas] = useState<SubArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<CreateClientPayload>({
    clientName: '',
    mobileNo: '',
    email: '',
    nidNo: '',
    dob: '',
    customerCode: '',
    address: '',
    area: '',
    subArea: '',
    district: '',
    thana: '',
    latitude: undefined,
    longitude: undefined,

    serverId: '',
    protocol: 'pppoe',
    packageId: '',
    username: '',
    password: '',
    remoteAddress: '',
    billingCycle: 'monthly',

    ownerId: '',
    clientCategory: '',
    addLessAmount: 0,
    installationCharge: 0,
  });

  const [resellersList, setResellersList] = useState<Reseller[]>([]);
  const [resellersLoading, setResellersLoading] = useState(false);

  const [uploadDocuments, setUploadDocuments] = useState(false);
  const [documentType, setDocumentType] = useState<'driving_license' | 'nid' | 'passport' | ''>('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const [passwordRevealed, setPasswordRevealed] = useState(false);

  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [locationInput, setLocationInput] = useState('');

  const userId = (user as { user_id?: string } | null)?.user_id ?? '';

  const resellerLabel = useMemo(() => {
    if (!user) return '—';
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return name || user.email;
  }, [user]);

  const roleCode = (user as { role_code?: string } | null)?.role_code?.toLowerCase() ?? '';
  const isAdminOrManager = roleCode === 'admin' || roleCode === 'manager' || roleCode === 'tenant_admin' || roleCode === 'isp_admin';
  const canSelectOwner = isAdminOrManager || roleCode === 'reseller' || roleCode === 'sub_reseller';
  const isAgent = roleCode === 'agent';

  // Reseller dropdown options: Admin/Manager = all; Reseller/Sub Reseller = self + downline
  const ownerOptions = useMemo(() => {
    if (!canSelectOwner) return [];
    const self = userId ? [{ userId, name: resellerLabel, role: roleCode }] : [];
    const downline = resellersList.filter((r) => r.userId !== userId);
    return [...self, ...downline];
  }, [canSelectOwner, userId, resellerLabel, roleCode, resellersList]);

  const isProfileRequired = form.protocol === 'pppoe' || form.protocol === 'hotspot';

  const getStepErrors = (s: Step): Record<string, string> => {
    const nextErrors: Record<string, string> = {};

    if (s === 1) {
      if (!form.clientName.trim()) nextErrors.clientName = 'Customer name is required';
      const mobileDigits = normalizePhone(form.mobileNo);
      if (!form.mobileNo.trim()) nextErrors.mobileNo = 'Mobile no is required';
      else if (mobileDigits.length !== 11) nextErrors.mobileNo = 'Mobile number must be 11 digits';
      if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Invalid email';
      if (form.customerCode?.trim() && !/^\d{6}$/.test(form.customerCode.replace(/\D/g, ''))) nextErrors.customerCode = 'Customer ID must be exactly 6 digits';
    }

    // Step 2 (Data And Location) – Address and Thana required
    if (s === 2) {
      if (!form.address?.trim()) nextErrors.address = 'Address is required';
      if (!form.thana?.trim()) nextErrors.thana = 'Thana is required';
    }

    if (s === 3) {
      if (!form.serverId) nextErrors.serverId = 'Server is required';
      if (!form.protocol) nextErrors.protocol = 'Protocol is required';
      if (!form.packageId) nextErrors.packageId = 'Package is required';
      if (!form.username.trim()) nextErrors.username = 'Username is required';
      if (!form.password.trim()) nextErrors.password = 'Password is required';

      if (isProfileRequired && selectedPackage && !selectedPackage.mikrotikProfileId) {
        nextErrors.packageId = 'Selected package missing MikroTik profile mapping';
      }
    }

    if (s === 4) {
      if (!form.billingCycle) nextErrors.billingCycle = 'Billing cycle is required';
    }

    // Step 5 (Preview) has no form validation
    if (s === 5) {
      // no errors
    }

    return nextErrors;
  };

  const isStepValid = (s: Step) => Object.keys(getStepErrors(s)).length === 0;
  const canSubmit = isStepValid(1) && isStepValid(2) && isStepValid(3) && isStepValid(4) && (form.serverId && form.protocol ? (packages.length > 0 && form.packageId) : true);

  // Prepaid/Postpaid/VIP: expiry = created date until Recharge/Renew/Topup; Free: Lifetime
  const expiryPreview = useMemo(() => {
    if (form.clientCategory === 'free') return null; // shown as "Lifetime" in UI
    if (form.clientCategory === 'prepaid' || form.clientCategory === 'postpaid' || form.clientCategory === 'vip') {
      return new Date(); // created date = expiry until recharge
    }
    if (!selectedPackage) return null;
    const base = new Date();
    const expiry = new Date(base);
    expiry.setDate(expiry.getDate() + (selectedPackage.validity?.days || 0));
    expiry.setHours(expiry.getHours() + (selectedPackage.validity?.hours || 0));
    return expiry;
  }, [selectedPackage, form.clientCategory]);

  const previewPackage = useMemo(
    () => selectedPackage ?? packages.find((p) => String(p.id) === String(form.packageId)),
    [selectedPackage, packages, form.packageId],
  );

  const protocolLabel = useMemo(
    () => PROTOCOLS.find((p) => p.value === form.protocol)?.label ?? form.protocol ?? '—',
    [form.protocol],
  );

  // Auto-generate username/password when mobile changes (only if empty)
  useEffect(() => {
    const digits = normalizePhone(form.mobileNo);
    if (!digits) return;
    setForm((prev) => {
      const next = { ...prev };
      if (!next.username.trim()) next.username = `u${digits.slice(-8)}`;
      if (!next.password.trim()) next.password = randomString(10);
      return next;
    });
  }, [form.mobileNo]);

  const loadServers = async () => {
    try {
      const res = await networkService.getDevicesDropdown();
      const list = (res.data || []).map((d) => ({
        networkDeviceId: d.id,
        deviceName: d.name,
      })) as NetworkDevice[];
      setServers(list);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to load servers');
    }
  };

  const loadAreas = async () => {
    try {
      const res = await serviceAreaService.listAreas();
      setAreas(res.data || []);
    } catch (err: any) {
      console.error('Failed to load areas:', err);
      // Don't show toast for areas - it's optional
    }
  };

  const loadSubAreas = async (areaId?: string) => {
    if (!areaId) {
      setSubAreas([]);
      return;
    }
    try {
      const res = await serviceAreaService.listSubAreas(areaId);
      setSubAreas(res.data || []);
    } catch (err: any) {
      console.error('Failed to load sub areas:', err);
      // Don't show toast for sub areas - it's optional
    }
  };

  const loadPackages = async (page = 1) => {
    if (!form.serverId || !form.protocol) {
      setPackages([]);
      setSelectedPackage(null);
      setForm((p) => ({ ...p, packageId: '' }));
      return;
    }
    setPackagesLoading(true);
    setPackagesError(null);
    try {
      const res = await networkPackagesService.list({
        serverId: form.serverId,
        protocol: form.protocol,
        search: packageSearch || undefined,
        page,
        limit: 10,
      });
      setPackages(res.data || []);
      setPackagesMeta({
        page: res.meta.page,
        totalPages: res.meta.totalPages,
        total: res.meta.total,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load packages';
      setPackagesError(msg);
      toast.error(msg);
    } finally {
      setPackagesLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
    loadAreas();
  }, []);

  // Auto-fill Customer ID from backend (next available 6-digit from MySQL)
  useEffect(() => {
    customersService
      .getNextCustomerCode()
      .then((res) => {
        if (res?.customerCode) {
          setForm((p) => ({ ...p, customerCode: res.customerCode }));
        }
      })
      .catch(() => {
        // Ignore – user can leave blank or enter manually
      });
  }, []);

  useEffect(() => {
    if (step !== 4 || !canSelectOwner) return;
    setResellersLoading(true);
    resellerService
      .list()
      .then((res) => setResellersList(res.data ?? []))
      .catch(() => setResellersList([]))
      .finally(() => setResellersLoading(false));
  }, [step === 4, canSelectOwner]);

  // Load sub areas when area is selected
  useEffect(() => {
    loadSubAreas(selectedAreaId);
    if (!selectedAreaId) {
      setForm((p) => ({ ...p, area: '', subArea: '' }));
    } else {
      const selectedArea = areas.find((a) => a.serviceAreaId === selectedAreaId);
      if (selectedArea) {
        setForm((p) => ({ ...p, area: selectedArea.name, subArea: '' }));
      }
    }
  }, [selectedAreaId, areas]);

  // Reload packages when server/protocol changes
  useEffect(() => {
    loadPackages(1);
    // reset package selection
    setSelectedPackage(null);
    setForm((p) => ({ ...p, packageId: '' }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.packageId;
      return next;
    });
  }, [form.serverId, form.protocol]);

  const validateStep = (s: Step) => {
    const nextErrors = getStepErrors(s);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((prev) => (prev === 5 ? 5 : ((prev + 1) as Step)));
  };

  const handleBack = () => setStep((prev) => (prev === 1 ? 1 : ((prev - 1) as Step)));

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      toast.error('Please fix the highlighted errors');
      return;
    }
    if (!selectedPackage) {
      toast.error('Please select a package');
      return;
    }

    // Enforce profile rules
    if (isProfileRequired && !selectedPackage.mikrotikProfileId) {
      toast.error('Selected package is missing MikroTik profile mapping');
      return;
    }

    setIsSaving(true);
    try {
      const payload: CreateClientPayload = {
        ...form,
        clientName: form.clientName.trim(),
        mobileNo: normalizePhone(form.mobileNo),
        email: form.email?.trim() ? form.email.trim() : undefined,
        nidNo: form.nidNo?.trim() ? form.nidNo.trim() : undefined,
        dob: form.dob?.trim() ? form.dob.trim() : undefined,
        address: form.address?.trim() ? form.address.trim() : undefined,
        area: form.area?.trim() ? form.area.trim() : undefined,
        subArea: form.subArea?.trim() ? form.subArea.trim() : undefined,
        district: form.district?.trim() ? form.district.trim() : undefined,
        thana: form.thana?.trim() ? form.thana.trim() : undefined,
        username: form.username.trim(),
        password: form.password.trim(),
        remoteAddress: form.remoteAddress?.trim() ? form.remoteAddress.trim() : undefined,
        ownerId: isAgent ? undefined : (form.ownerId?.trim() || userId || undefined),
        clientCategory: form.clientCategory?.trim() ? form.clientCategory : undefined,
        addLessAmount: (form.addLessAmount ?? 0) !== 0 ? form.addLessAmount : undefined,
        installationCharge: (form.installationCharge ?? 0) > 0 ? form.installationCharge : undefined,
        customerCode: form.customerCode?.replace(/\D/g, '').length === 6 ? form.customerCode.replace(/\D/g, '') : undefined,
        latitude: form.latitude != null ? form.latitude : undefined,
        longitude: form.longitude != null ? form.longitude : undefined,
        initialStatus: 'active',
      };

      const res = await customersService.onboardClient(payload);
      toast.success('Customer created and provisioned successfully');
      navigate(`/dashboard/customers/view/${res.data.customerId}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create customer';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-teal-50/30 to-sky-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg p-6 rounded-2xl border border-sky-200/60 dark:border-slate-600 shadow-xl flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 via-teal-600 to-sky-600 dark:from-sky-400 dark:via-teal-400 dark:to-sky-400 bg-clip-text text-transparent">
              Add New Customer
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              Create a new customer account and provision network access
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard/customers/all')}
            className="px-6 py-3 bg-white dark:bg-slate-700 border border-sky-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-sky-50 dark:hover:bg-slate-600 transition-all shadow-sm hover:shadow-md"
          >
            Cancel
          </button>
        </div>

        {/* Stepper */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg p-4 rounded-2xl border border-sky-200/60 dark:border-slate-600 shadow-xl">
          <div className="grid grid-cols-5 gap-2">
            {[
              { n: 1 as const, label: 'Customer Info' },
              { n: 2 as const, label: 'Data And Location' },
              { n: 3 as const, label: 'Server' },
              { n: 4 as const, label: 'Billing' },
              { n: 5 as const, label: 'Preview' },
            ].map((s) => (
              <button
                key={s.n}
                onClick={() => setStep(s.n)}
                className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  step === s.n
                    ? 'bg-gradient-to-r from-sky-500 to-teal-500 text-white shadow-lg'
                    : 'bg-sky-50/80 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:bg-sky-100 dark:hover:bg-slate-900/60 border border-sky-200/60 dark:border-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg p-6 rounded-2xl border border-sky-200/60 dark:border-slate-600 shadow-xl">
          {/* Validation Messages */}
          {step === 2 && areas.length === 0 && (
            <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-xl">
              <p className="text-sm font-semibold">Please create Service Area first</p>
              <p className="text-xs mt-1">You need to create at least one Service Area before adding customers.</p>
            </div>
          )}

          {step === 3 && form.serverId && form.protocol && !packagesLoading && packages.length === 0 && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded-xl">
              <p className="text-sm font-semibold">No package found</p>
              <p className="text-xs mt-1">Please create a package first for the selected server and protocol.</p>
            </div>
          )}

          {/* Step section labels - sky/teal accent */}
          {step === 1 && (
            <div className="mb-4 pb-2 border-b border-sky-200/60 dark:border-slate-600">
              <h2 className="text-lg font-bold text-sky-700 dark:text-sky-300">Customer information</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Basic details</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.clientName}
                    onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 ${
                      errors.clientName ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                    }`}
                    placeholder="Customer name"
                  />
                  {errors.clientName && <p className="mt-1 text-xs text-red-500">{errors.clientName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Mobile No <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.mobileNo}
                    onChange={(e) => setForm((p) => ({ ...p, mobileNo: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 ${
                      errors.mobileNo ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                    }`}
                    placeholder="01XXXXXXXXX (11 digits)"
                  />
                  {errors.mobileNo && <p className="mt-1 text-xs text-red-500">{errors.mobileNo}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Customer ID</label>
                  <input
                    type="text"
                    readOnly
                    value={form.customerCode || ''}
                    className={`w-full px-4 py-3 rounded-xl border bg-sky-50/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 outline-none cursor-not-allowed ${
                      errors.customerCode ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                    }`}
                    placeholder="Loading…"
                  />
                  <p className="mt-1 text-xs text-slate-500">Auto-assigned from system. Cannot be changed.</p>
                  {errors.customerCode && <p className="mt-1 text-xs text-red-500">{errors.customerCode}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                  <input
                    value={form.email || ''}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 ${
                      errors.email ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                    }`}
                    placeholder="email@domain.com"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">NID No</label>
                  <input
                    value={form.nidNo || ''}
                    onChange={(e) => setForm((p) => ({ ...p, nidNo: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dob || ''}
                    onChange={(e) => setForm((p) => ({ ...p, dob: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                  />
                </div>
              </div>

              {/* Upload Documents */}
              <div className="pt-4 border-t border-sky-200/60 dark:border-slate-600">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uploadDocuments}
                    onChange={(e) => {
                      setUploadDocuments(e.target.checked);
                      if (!e.target.checked) {
                        setDocumentType('');
                        setDocumentFile(null);
                      }
                    }}
                    className="w-5 h-5 rounded border-sky-300 text-sky-600 focus:ring-sky-500 focus:ring-2"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Upload Documents?</span>
                </label>
                {uploadDocuments && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Document Type</label>
                      <select
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value as 'driving_license' | 'nid' | 'passport' | '')}
                        className="w-full px-4 py-3 rounded-xl border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                      >
                        <option value="">Select type</option>
                        <option value="driving_license">Driving License</option>
                        <option value="nid">NID</option>
                        <option value="passport">Passport</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Browse</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
                          className="block w-full text-sm text-slate-600 dark:text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-sky-100 file:text-sky-700 dark:file:bg-sky-900/50 dark:file:text-sky-300 file:font-semibold file:cursor-pointer hover:file:bg-sky-200 dark:hover:file:bg-sky-800/50"
                        />
                        {documentFile && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]" title={documentFile.name}>
                            {documentFile.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="mb-4 pb-2 border-b border-sky-200/60 dark:border-slate-600">
                <h2 className="text-lg font-bold text-sky-700 dark:text-sky-300">Data And Location</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Address and service area</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Address <span className="text-red-500">*</span></label>
                  <textarea
                    rows={2}
                    value={form.address || ''}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 resize-none ${
                      errors.address ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                    }`}
                    placeholder="Enter address"
                  />
                  {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    District <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={form.district || ''}
                    onChange={(e) => {
                      const district = e.target.value;
                      setForm((p) => ({ ...p, district, thana: '' }));
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                  >
                    <option value="">Select District</option>
                    {BD_DISTRICTS.map((d) => (
                      <option key={d.districtEn} value={d.districtEn}>
                        {d.districtEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Thana <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.thana || ''}
                    onChange={(e) => setForm((p) => ({ ...p, thana: e.target.value }))}
                    disabled={!form.district}
                    className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                      errors.thana ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                    }`}
                  >
                    <option value="">Select Thana</option>
                    {form.district &&
                      getThanaNamesForDistrict(form.district).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                  </select>
                  {errors.thana && <p className="mt-1 text-xs text-red-500">{errors.thana}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Area <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={selectedAreaId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedAreaId(id);
                      const areaName = areas.find((a) => a.serviceAreaId === id)?.name ?? '';
                      setForm((p) => ({ ...p, area: areaName }));
                    }}
                    className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 ${
                      errors.area ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                    }`}
                  >
                    <option value="">Select Area</option>
                    {areas.map((area) => (
                      <option key={area.serviceAreaId} value={area.serviceAreaId}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                  {errors.area && <p className="mt-1 text-xs text-red-500">{errors.area}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Sub Area <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={form.subArea || ''}
                    onChange={(e) => {
                      const subAreaName = e.target.value;
                      setForm((p) => ({ ...p, subArea: subAreaName }));
                    }}
                    disabled={!selectedAreaId}
                    className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                      errors.subArea ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                    }`}
                  >
                    <option value="">Select Sub Area</option>
                    {subAreas.map((subArea) => (
                      <option key={subArea.subAreaId} value={subArea.name}>
                        {subArea.name}
                      </option>
                    ))}
                  </select>
                  {errors.subArea && <p className="mt-1 text-xs text-red-500">{errors.subArea}</p>}
                </div>
              </div>

              {/* Location */}
              <div className="pt-4 border-t border-sky-200/60 dark:border-slate-600">
                <h3 className="text-sm font-bold text-sky-700 dark:text-sky-300 mb-3">Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Enter Latitude, Longitude</label>
                    <input
                      type="text"
                      value={
                        locationInput !== ''
                          ? locationInput
                          : form.latitude != null && form.longitude != null
                            ? `${form.latitude}, ${form.longitude}`
                            : ''
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setLocationInput(v);
                        if (!v.trim()) {
                          setForm((p) => ({ ...p, latitude: undefined, longitude: undefined }));
                          return;
                        }
                        const parts = v.split(/[\s,]+/).filter(Boolean);
                        const lat = parts[0] ? parseFloat(parts[0]) : NaN;
                        const lng = parts[1] ? parseFloat(parts[1]) : NaN;
                        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                          setForm((p) => ({ ...p, latitude: lat, longitude: lng }));
                        }
                      }}
                      onBlur={() => setLocationInput('')}
                      placeholder="Enter Latitude, Longitude"
                      className="w-full px-4 py-3 rounded-xl border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (navigator.geolocation) {
                        try {
                          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, {
                              enableHighAccuracy: true,
                              timeout: 10000,
                              maximumAge: 0,
                            });
                          });
                          setLocationInput('');
                          setForm((p) => ({
                            ...p,
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                          }));
                          toast.success('Location retrieved successfully');
                        } catch {
                          toast.error('Failed to get current location. Try Select On Map.');
                        }
                      } else {
                        toast.error('Geolocation is not supported by your browser.');
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl border border-sky-300 dark:border-slate-600 bg-sky-50 dark:bg-slate-800 text-sky-700 dark:text-sky-300 font-semibold text-sm hover:bg-sky-100 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Get Current Location
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMapModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl border border-sky-300 dark:border-slate-600 bg-sky-50 dark:bg-slate-800 text-sky-700 dark:text-sky-300 font-semibold text-sm hover:bg-sky-100 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Select On Map
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="mb-4 pb-2 border-b border-sky-200/60 dark:border-slate-600">
                <h2 className="text-lg font-bold text-sky-700 dark:text-sky-300">Server & package</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Select server, protocol and package</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Server Name <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.serverId}
                    onChange={(e) => setForm((p) => ({ ...p, serverId: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 ${
                      errors.serverId ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                    }`}
                  >
                    <option value="">Select server</option>
                    {servers.map((s) => (
                      <option key={s.networkDeviceId} value={s.networkDeviceId}>
                        {s.deviceName}
                      </option>
                    ))}
                  </select>
                  {errors.serverId && <p className="mt-1 text-xs text-red-500">{errors.serverId}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Protocol <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.protocol}
                    onChange={(e) => setForm((p) => ({ ...p, protocol: e.target.value as NetworkProtocol }))}
                    className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 ${
                      errors.protocol ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                    }`}
                  >
                    {PROTOCOLS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  {errors.protocol && <p className="mt-1 text-xs text-red-500">{errors.protocol}</p>}
                </div>
              </div>

              {/* Package */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Package <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      value={packageSearch}
                      onChange={(e) => setPackageSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && form.serverId && form.protocol && loadPackages(1)}
                      disabled={!form.serverId || !form.protocol}
                      className="px-3 py-2 rounded-xl border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder={form.serverId && form.protocol ? 'Search package' : 'Select server and protocol first'}
                    />
                    <button
                      onClick={() => loadPackages(1)}
                      disabled={!form.serverId || !form.protocol}
                      className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                    >
                      Search
                    </button>
                  </div>
                </div>

                <div className={`rounded-2xl border ${errors.packageId ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'} overflow-hidden ${!form.serverId || !form.protocol ? 'opacity-50' : ''}`}>
                  <div className="bg-sky-50/80 dark:bg-slate-900/40 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-sky-200/60 dark:border-slate-600">
                    {!form.serverId || !form.protocol
                      ? 'Select server and protocol first'
                      : packagesLoading
                      ? 'Loading packages…'
                      : `${packagesMeta.total} packages`}
                  </div>
                  {packagesError && (
                    <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{packagesError}</div>
                  )}
                  {!packagesLoading && !packagesError && packages.length === 0 && form.serverId && form.protocol && (
                    <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400 font-semibold">
                      No packages found for this server/protocol. Please create a package first.
                    </div>
                  )}
                  {(!form.serverId || !form.protocol) && (
                    <div className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      Please select a server and protocol to load packages.
                    </div>
                  )}
                  <div className={`max-h-72 overflow-y-auto divide-y divide-sky-100 dark:divide-slate-700 bg-white dark:bg-slate-800 ${!form.serverId || !form.protocol ? 'pointer-events-none' : ''}`}>
                    {packages.map((p) => {
                      const isActive = form.packageId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, packageId: p.id }));
                            setSelectedPackage(p);
                          }}
                          disabled={!form.serverId || !form.protocol}
                          className={`w-full text-left px-4 py-3 hover:bg-sky-50 dark:hover:bg-sky-900/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isActive ? 'bg-sky-100 dark:bg-sky-900/20 border-l-2 border-sky-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</div>
                            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">৳{Number(p.price).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                          </div>
                          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            Validity: {p.validity.days}d {p.validity.hours}h • Volume:{' '}
                            {p.volume.type === 'unlimited' ? 'Unlimited' : `${p.volume.gb ?? 0}GB`}
                          </div>
                          {isProfileRequired && (
                            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                              MikroTik Profile: <span className="font-semibold">{p.mikrotikProfileName || '—'}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 bg-sky-50/80 dark:bg-slate-900/40 border-t border-sky-200/60 dark:border-slate-600">
                    <button
                      type="button"
                      disabled={packagesMeta.page <= 1 || !form.serverId || !form.protocol}
                      onClick={() => loadPackages(packagesMeta.page - 1)}
                      className="px-4 py-2 rounded-xl border border-sky-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Prev
                    </button>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {form.serverId && form.protocol ? `Page ${packagesMeta.page} / ${packagesMeta.totalPages}` : '—'}
                    </div>
                    <button
                      type="button"
                      disabled={packagesMeta.page >= packagesMeta.totalPages || !form.serverId || !form.protocol}
                      onClick={() => loadPackages(packagesMeta.page + 1)}
                      className="px-4 py-2 rounded-xl border border-sky-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
                {errors.packageId && <p className="mt-1 text-xs text-red-500">{errors.packageId}</p>}
              </div>

              {/* Credentials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 ${
                      errors.username ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                    }`}
                  />
                  {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div
                    onMouseEnter={() => setPasswordRevealed(true)}
                    onMouseLeave={() => setPasswordRevealed(false)}
                    className="relative"
                  >
                    <input
                      type={passwordRevealed ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 ${
                        errors.password ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                      }`}
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Hover over field to view password</p>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Remote Address (Static IP)</label>
                  <input
                    value={form.remoteAddress || ''}
                    onChange={(e) => setForm((p) => ({ ...p, remoteAddress: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* Price and Expiry preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-sky-200 dark:border-slate-600 bg-sky-50/80 dark:bg-slate-900/40 p-4">
                  <div className="text-sm font-semibold text-sky-700 dark:text-sky-300">Price</div>
                  <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {selectedPackage ? `৳${Number(selectedPackage.price).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">Auto-filled from package</p>
                </div>
                <div className="rounded-2xl border border-sky-200 dark:border-slate-600 bg-sky-50/80 dark:bg-slate-900/40 p-4">
                  <div className="text-sm font-semibold text-sky-700 dark:text-sky-300">Billing / Exp Date</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {form.clientCategory === 'free' ? 'Lifetime' : (form.clientCategory === 'prepaid' || form.clientCategory === 'postpaid' || form.clientCategory === 'vip') ? 'Today Date' : expiryPreview ? expiryPreview.toLocaleString() : 'Select a package to calculate expiry'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="mb-4 pb-2 border-b border-sky-200/60 dark:border-slate-600">
                <h2 className="text-lg font-bold text-sky-700 dark:text-sky-300">Billing & status</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Reseller, cycle and initial status</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {isAgent ? 'Reseller' : 'Assign to'}
                  </label>
                  {isAgent ? (
                    <>
                      <input
                        value={resellerLabel}
                        readOnly
                        className="w-full px-4 py-3 rounded-xl border border-sky-200 dark:border-slate-600 bg-sky-50/80 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 outline-none"
                      />
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">Agent = logged-in user</p>
                    </>
                  ) : (
                    <>
                      <select
                        value={form.ownerId || userId}
                        onChange={(e) => setForm((p) => ({ ...p, ownerId: e.target.value }))}
                        disabled={resellersLoading}
                        className="w-full px-4 py-3 rounded-xl border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 disabled:opacity-50"
                      >
                        {resellersLoading ? (
                          <option value={userId}>Loading…</option>
                        ) : (
                          ownerOptions.map((r) => (
                            <option key={r.userId} value={r.userId}>
                              {r.name} ({r.role})
                            </option>
                          ))
                        )}
                      </select>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Billing Cycle <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.billingCycle}
                    onChange={(e) => setForm((p) => ({ ...p, billingCycle: e.target.value as any }))}
                    className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 ${
                      errors.billingCycle ? 'border-red-400' : 'border-sky-200 dark:border-slate-600'
                    }`}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom</option>
                  </select>
                  {errors.billingCycle && <p className="mt-1 text-xs text-red-500">{errors.billingCycle}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Customer Category</label>
                  <select
                    value={form.clientCategory || ''}
                    onChange={(e) => setForm((p) => ({ ...p, clientCategory: (e.target.value || undefined) as CreateClientPayload['clientCategory'] }))}
                    className="w-full px-4 py-3 rounded-xl border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                  >
                    <option value="">Select category</option>
                    <option value="prepaid">Prepaid</option>
                    <option value="postpaid">Postpaid</option>
                    <option value="vip">VIP</option>
                    <option value="free">Free</option>
                  </select>
                  {form.clientCategory === 'vip' && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <VIPIcon className="w-4 h-4" /> VIP
                    </div>
                  )}
                  {form.clientCategory === 'free' && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <FreeIcon className="w-4 h-4" /> Free
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Discount (৳)</label>
                  <input
                    type="number"
                    value={form.addLessAmount ?? 0}
                    onChange={(e) => setForm((p) => ({ ...p, addLessAmount: Number(e.target.value) || 0 }))}
                    className="w-full px-4 py-3 rounded-xl border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                    min={-999999}
                    max={999999}
                    step={50}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Installation Charge / OTC (৳)</label>
                  <input
                    type="number"
                    value={form.installationCharge ?? 0}
                    onChange={(e) => setForm((p) => ({ ...p, installationCharge: Math.max(0, Number(e.target.value) || 0) }))}
                    className="w-full px-4 py-3 rounded-xl border border-sky-200 dark:border-slate-600 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400"
                    min={0}
                    max={999999}
                    step={50}
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">One-time installation / OTC charge</p>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="mb-4 pb-2 border-b border-sky-200/60 dark:border-slate-600">
                <h2 className="text-lg font-bold text-sky-700 dark:text-sky-300">Preview</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Review all details before creating the customer</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-sky-200 dark:border-slate-600 border-l-4 border-l-sky-500 bg-sky-50/80 dark:bg-slate-900/40 p-4 space-y-3 shadow-[-4px_0_10px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_12px_rgba(0,0,0,0.2)]">
                  <h3 className="text-sm font-bold text-sky-700 dark:text-sky-300">Customer info</h3>
                  <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                    <p><span className="font-medium">Customer ID:</span> {form.customerCode ? form.customerCode : 'Auto-assigned on save'}</p>
                    <p><span className="font-medium">Name:</span> {form.clientName || '—'}</p>
                    <p><span className="font-medium">Mobile:</span> {form.mobileNo || '—'}</p>
                    <p><span className="font-medium">Email:</span> {form.email || '—'}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-sky-200 dark:border-slate-600 border-l-4 border-l-sky-500 bg-sky-50/80 dark:bg-slate-900/40 p-4 space-y-3 shadow-[-4px_0_10px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_12px_rgba(0,0,0,0.2)]">
                  <h3 className="text-sm font-bold text-sky-700 dark:text-sky-300">Data And Location</h3>
                  <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                    {(form.address || form.district || form.thana || form.area || form.subArea || (form.latitude != null && form.longitude != null)) ? (
                      <>
                        {form.address && <p><span className="font-medium">Address:</span> {form.address}</p>}
                        {form.district && <p><span className="font-medium">District:</span> {form.district}</p>}
                        {form.thana && <p><span className="font-medium">Thana:</span> {form.thana}</p>}
                        {form.area && <p><span className="font-medium">Area:</span> {form.area}</p>}
                        {form.subArea && <p><span className="font-medium">Sub Area:</span> {form.subArea}</p>}
                        {form.latitude != null && form.longitude != null && (
                          <p><span className="font-medium">Location:</span> {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-500">—</p>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-sky-200 dark:border-slate-600 border-l-4 border-l-sky-500 bg-sky-50/80 dark:bg-slate-900/40 p-4 space-y-3 shadow-[-4px_0_10px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_12px_rgba(0,0,0,0.2)]">
                  <h3 className="text-sm font-bold text-sky-700 dark:text-sky-300">Server & package</h3>
                  <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                    <p><span className="font-medium">Server:</span> {servers.find(s => s.networkDeviceId === form.serverId)?.deviceName ?? '—'}</p>
                    <p><span className="font-medium">Protocol:</span> {protocolLabel}</p>
                    <p><span className="font-medium">Package:</span> {previewPackage?.name ?? '—'} {previewPackage ? `(৳${Number(previewPackage.price).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})` : ''}</p>
                    <p><span className="font-medium">Username:</span> {form.username || '—'}</p>
                    <p><span className="font-medium">Password:</span> ••••••••</p>
                    <p><span className="font-medium">Created Date:</span> {new Date().toLocaleString()}</p>
                    <p><span className="font-medium">Expiry:</span> {form.clientCategory === 'free' ? 'Lifetime' : expiryPreview ? expiryPreview.toLocaleString() : '—'}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-sky-200 dark:border-slate-600 border-l-4 border-l-sky-500 bg-sky-50/80 dark:bg-slate-900/40 p-4 space-y-3 shadow-[-4px_0_10px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_12px_rgba(0,0,0,0.2)]">
                  <h3 className="text-sm font-bold text-sky-700 dark:text-sky-300">Billing & status</h3>
                  <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                    <p><span className="font-medium">Owner:</span> {(form.ownerId && ownerOptions.length) ? (ownerOptions.find((r) => r.userId === (form.ownerId || userId))?.name ?? resellerLabel) : resellerLabel}</p>
                    <p><span className="font-medium">Billing cycle:</span> {form.billingCycle ?? '—'}</p>
                    <p><span className="font-medium">Customer category:</span>{' '}
                      {form.clientCategory === 'vip' && <span className="inline-flex items-center gap-1"><VIPIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" /> VIP</span>}
                      {form.clientCategory === 'free' && <span className="inline-flex items-center gap-1"><FreeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Free</span>}
                      {form.clientCategory && form.clientCategory !== 'vip' && form.clientCategory !== 'free' && String(form.clientCategory).charAt(0).toUpperCase() + String(form.clientCategory).slice(1)}
                      {!form.clientCategory && '—'}
                    </p>
                    <p><span className="font-medium">Discount:</span> {(form.addLessAmount ?? 0) !== 0 ? `৳${(form.addLessAmount ?? 0).toLocaleString('en-BD')}` : '—'}</p>
                    <p><span className="font-medium">Installation charge / OTC:</span> {(form.installationCharge ?? 0) > 0 ? `৳${(form.installationCharge ?? 0).toLocaleString('en-BD')}` : '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="mt-8 flex items-center justify-between pt-6 border-t border-sky-200/60 dark:border-slate-600">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1 || isSaving}
              className="px-6 py-3 bg-white dark:bg-slate-700 border border-sky-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-sky-50 dark:hover:bg-slate-600 transition-all shadow-sm hover:shadow-md disabled:opacity-50"
            >
              Back
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={isSaving || !isStepValid(step)}
                className="px-6 py-3 bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              /* Step 5: Preview - Create Customer */
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving || !canSubmit}
                className="px-6 py-3 bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Customer Creating…
                  </>
                ) : (
                  'Create Customer'
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <MapPickerModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        onSelect={(lat, lng) => {
          setLocationInput('');
          setForm((p) => ({ ...p, latitude: lat, longitude: lng }));
          setIsMapModalOpen(false);
        }}
        initialLat={form.latitude ?? undefined}
        initialLng={form.longitude ?? undefined}
      />
    </div>
  );
}

