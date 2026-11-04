import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  User,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  MapPin,
  Building,
  Navigation,
  Map as MapIcon,
  Server,
  Package as PackageIcon,
  Search,
  Lock,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  AlertTriangle,
  Star,
  Gift,
  Clock,
  Layers,
} from 'lucide-react';
import { useToastContext } from '@/contexts/ToastContext';
import { useAuthStore } from '@/stores/authStore';
import { customersService } from '@/services/customers.service';
import { networkService } from '@/services/network.service';
import { networkPackagesService } from '@/services/network-packages.service';
import { serviceAreaService } from '@/services/service-area.service';
import { resellerService, Reseller } from '@/services/reseller.service';
import { NetworkDevice, NetworkPackage, NetworkProtocol } from '@/types/network.types';
import { ServiceArea, SubArea } from '@/types/service-area.types';
import { CreateClientPayload } from '@/types/client-onboarding.types';
import { BD_DISTRICTS, getThanaNamesForDistrict } from '@/data/bd-districts-thanas';
import MapPickerModal from '@/components/MapPickerModal';
import { PageHeader } from '@/components/common';

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { n: 1 as Step, label: 'Customer Info', icon: User, desc: 'Personal details' },
  { n: 2 as Step, label: 'Location & Area', icon: MapPin, desc: 'Address & coordinates' },
  { n: 3 as Step, label: 'Network & Plan', icon: Server, desc: 'Router, profile & credentials' },
  { n: 4 as Step, label: 'Billing & Status', icon: CreditCard, desc: 'Owner, cycle & charges' },
  { n: 5 as Step, label: 'Review & Confirm', icon: CheckCircle2, desc: 'Verify & activate' },
];

const PROTOCOLS: Array<{ label: string; value: NetworkProtocol }> = [
  { label: 'PPPoE (Broadband)', value: 'pppoe' },
  { label: 'Hotspot (Card / Voucher)', value: 'hotspot' },
  { label: 'Static IP', value: 'static' },
  { label: 'OpenVPN', value: 'ovpn' },
  { label: 'PPTP', value: 'pptp' },
];

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
    clientCategory: 'prepaid',
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

  // Reseller dropdown options
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
      if (!form.mobileNo.trim()) nextErrors.mobileNo = 'Mobile number is required';
      else if (mobileDigits.length !== 11) nextErrors.mobileNo = 'Mobile number must be 11 digits (e.g. 017XXXXXXXX)';
      if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Invalid email address';
      if (form.customerCode?.trim() && !/^\d{6,}$/.test(form.customerCode.replace(/\D/g, ''))) {
        nextErrors.customerCode = 'Customer ID must be a numeric serial (at least 6 digits)';
      }
    }

    if (s === 2) {
      if (!form.address?.trim()) nextErrors.address = 'Installation address is required';
      if (!form.thana?.trim()) nextErrors.thana = 'Thana is required';
    }

    if (s === 3) {
      if (!form.serverId) nextErrors.serverId = 'Server / Router is required';
      if (!form.protocol) nextErrors.protocol = 'Protocol is required';
      if (!form.packageId) nextErrors.packageId = 'Please select a package plan';
      if (!form.username.trim()) nextErrors.username = 'Username is required';
      if (!form.password.trim()) nextErrors.password = 'Password is required';

      if (isProfileRequired && selectedPackage && !selectedPackage.mikrotikProfileId && !(selectedPackage as any).mikrotikProfile) {
        nextErrors.packageId = 'Selected package missing MikroTik profile mapping';
      }
    }

    if (s === 4) {
      if (!form.billingCycle) nextErrors.billingCycle = 'Billing cycle is required';
    }

    return nextErrors;
  };

  const isStepValid = (s: Step) => Object.keys(getStepErrors(s)).length === 0;
  const canSubmit =
    isStepValid(1) &&
    isStepValid(2) &&
    isStepValid(3) &&
    isStepValid(4) &&
    (form.serverId && form.protocol ? packages.length > 0 && form.packageId : true);

  // Expiry preview calculation
  const expiryPreview = useMemo(() => {
    if (form.clientCategory === 'free') return null;
    if (form.clientCategory === 'prepaid' || form.clientCategory === 'postpaid' || form.clientCategory === 'vip') {
      return new Date();
    }
    if (!selectedPackage) return null;
    const base = new Date();
    const expiry = new Date(base);
    const days = selectedPackage.validity?.days ?? (selectedPackage as any).validityDays ?? 30;
    const hours = selectedPackage.validity?.hours ?? (selectedPackage as any).validityHours ?? 0;
    expiry.setDate(expiry.getDate() + days);
    expiry.setHours(expiry.getHours() + hours);
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

  const loadServers = async () => {
    try {
      const res = await networkService.getDevicesDropdown('router');
      // Strictly only keep routers / MikroTik and exclude OLT devices
      const list = (res.data || [])
        .filter((d) => d.type !== 'olt' && d.vendor?.toLowerCase() !== 'vsol')
        .map((d) => ({
          networkDeviceId: d.id,
          deviceName: d.name,
        })) as NetworkDevice[];
      setServers(list);
      if (list.length > 0) {
        setForm((prev) => {
          const isValidCurrent = prev.serverId && list.some((s) => s.networkDeviceId === prev.serverId);
          return isValidCurrent ? prev : { ...prev, serverId: list[0].networkDeviceId };
        });
      } else {
        setForm((prev) => ({ ...prev, serverId: '' }));
      }
    } catch (err: any) {
      console.warn('Failed to load servers:', err);
    }
  };

  const loadAreas = async () => {
    try {
      const res = await serviceAreaService.listAreas();
      setAreas(res.data || []);
    } catch (err: any) {
      console.warn('Failed to load areas:', err);
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
      console.warn('Failed to load sub areas:', err);
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
        search: packageSearch.trim() || undefined,
        page,
        limit: 8,
      });
      const list = res.data || [];
      setPackages(list);
      setPackagesMeta({
        page: res.meta?.page ?? page,
        totalPages: res.meta?.totalPages ?? 1,
        total: res.meta?.total ?? list.length,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load packages';
      setPackagesError(msg);
      setPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
    loadAreas();
  }, []);

  // Auto-fill Customer ID from backend sequence (strictly numeric 6-digit serial)
  useEffect(() => {
    customersService
      .getNextCustomerCode()
      .then((res) => {
        if (res?.customerCode) {
          const cleanCode = String(res.customerCode).replace(/\D/g, '').padStart(6, '0');
          setForm((p) => ({ ...p, customerCode: cleanCode }));
        }
      })
      .catch(() => {
        // Fallback or leave manual
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
  }, [step, canSelectOwner]);

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
    if (!validateStep(step)) {
      toast.error('Please fill in the required fields before continuing');
      return;
    }
    setStep((prev) => (prev === 5 ? 5 : ((prev + 1) as Step)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setStep((prev) => (prev === 1 ? 1 : ((prev - 1) as Step)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      toast.error('Please fix the highlighted errors in previous steps');
      return;
    }
    if (!selectedPackage) {
      toast.error('Please select a package plan in Step 3');
      return;
    }

    if (isProfileRequired && !selectedPackage.mikrotikProfileId && !(selectedPackage as any).mikrotikProfile) {
      toast.error('Selected package is missing MikroTik profile mapping');
      return;
    }

    setIsSaving(true);
    try {
      const payload: CreateClientPayload = {
        ...form,
        clientName: form.clientName.trim(),
        fullName: form.clientName.trim(),
        mobileNo: normalizePhone(form.mobileNo),
        phone: normalizePhone(form.mobileNo),
        email: form.email?.trim() ? form.email.trim() : undefined,
        nidNo: form.nidNo?.trim() ? form.nidNo.trim() : undefined,
        dob: form.dob?.trim() ? form.dob.trim() : undefined,
        address: form.address?.trim() ? form.address.trim() : undefined,
        installationAddress: form.address?.trim() ? form.address.trim() : undefined,
        area: form.area?.trim() ? form.area.trim() : undefined,
        subArea: form.subArea?.trim() ? form.subArea.trim() : undefined,
        district: form.district?.trim() ? form.district.trim() : undefined,
        thana: form.thana?.trim() ? form.thana.trim() : undefined,
        username: form.username.trim(),
        password: form.password.trim(),
        remoteAddress: form.remoteAddress?.trim() ? form.remoteAddress.trim() : undefined,
        ownerId: isAgent ? undefined : form.ownerId?.trim() || userId || undefined,
        clientCategory: form.clientCategory?.trim() ? form.clientCategory : undefined,
        addLessAmount: (form.addLessAmount ?? 0) !== 0 ? form.addLessAmount : undefined,
        installationCharge: (form.installationCharge ?? 0) > 0 ? form.installationCharge : undefined,
        customerCode:
          (form.customerCode?.replace(/\D/g, '').length ?? 0) >= 6 ? form.customerCode?.replace(/\D/g, '') : undefined,
        latitude: form.latitude != null ? form.latitude : undefined,
        longitude: form.longitude != null ? form.longitude : undefined,
        initialStatus: 'active',
      };

      const res = await customersService.onboardClient(payload);
      toast.success('Customer created and provisioned successfully');

      const cid =
        (res as any)?.data?.customerId ||
        (res as any)?.customerId ||
        (res as any)?.data?.id ||
        (res as any)?.id;

      if (cid) {
        navigate(`/dashboard/customers/view/${cid}`);
      } else {
        navigate('/dashboard/customers');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create customer';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Add New Customer"
        subtitle="Step-by-step customer onboarding, network provisioning, and billing activation"
        actions={
          <button
            type="button"
            onClick={() => navigate('/dashboard/customers/all')}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm shadow-2xs"
          >
            Cancel
          </button>
        }
      />

      {/* Modern Stepper Progress Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isActive = step === s.n;
            const isCompleted = step > s.n;

            return (
              <button
                key={s.n}
                type="button"
                onClick={() => {
                  if (s.n < step || isStepValid(step)) {
                    setStep(s.n);
                  }
                }}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100/60'
                    : 'bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0 truncate">
                  <p className="text-xs font-semibold truncate leading-tight">{s.label}</p>
                  <p className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    {s.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Form Content Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Warning Banners */}
        {step === 2 && areas.length === 0 && (
          <div className="m-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">No Service Area created yet</p>
              <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-400">
                You can still proceed by entering your Thana and address, or create areas under Network &gt; Service Areas.
              </p>
            </div>
          </div>
        )}

        {step === 3 && packagesError && (
          <div className="m-5 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Error Loading Packages</p>
              <p className="text-xs mt-0.5 text-red-700 dark:text-red-400">{packagesError}</p>
            </div>
          </div>
        )}

        {step === 3 && form.serverId && form.protocol && !packagesLoading && !packagesError && packages.length === 0 && (
          <div className="m-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">No package plans found for this server/protocol</p>
              <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-400">
                Please create a package in Network &gt; Package Plans or choose another server/protocol.
              </p>
            </div>
          </div>
        )}

        {/* ================= STEP 1: CUSTOMER INFO ================= */}
        {step === 1 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Customer Identity & Contact Information
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Primary subscriber credentials and contact details
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Customer Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={form.clientName}
                    onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                      errors.clientName ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                    }`}
                    placeholder="e.g. Tanvir Ahmed"
                  />
                </div>
                {errors.clientName && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.clientName}</p>}
              </div>

              {/* Mobile No */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Mobile No (11 Digits) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={form.mobileNo}
                    onChange={(e) => setForm((p) => ({ ...p, mobileNo: e.target.value }))}
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                      errors.mobileNo ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                    }`}
                    placeholder="017XXXXXXXX"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Used for SMS billing alerts & customer portal login.</p>
                {errors.mobileNo && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.mobileNo}</p>}
              </div>

              {/* Customer ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Customer ID (System Code)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={form.customerCode || ''}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-mono font-bold text-sm outline-none cursor-not-allowed select-none shadow-inner"
                    placeholder="Auto-generating (e.g. 100001)..."
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Strictly numeric globally unique serial ID (e.g. 100001).</p>
                {errors.customerCode && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.customerCode}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Email Address <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all ${
                      errors.email ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                    }`}
                    placeholder="customer@domain.com"
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.email}</p>}
              </div>

              {/* NID No */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  National ID (NID) <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={form.nidNo || ''}
                    onChange={(e) => setForm((p) => ({ ...p, nidNo: e.target.value }))}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="Smart Card or Old NID number"
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Date of Birth <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={form.dob || ''}
                    onChange={(e) => setForm((p) => ({ ...p, dob: e.target.value }))}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Document Upload Section */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors w-fit">
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
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Attach KYC Verification Document?
                </span>
              </label>

              {uploadDocuments && (
                <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Document Type
                    </label>
                    <select
                      value={documentType}
                      onChange={(e) =>
                        setDocumentType(e.target.value as 'driving_license' | 'nid' | 'passport' | '')
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Select document type</option>
                      <option value="nid">National ID Card (NID)</option>
                      <option value="driving_license">Driving License</option>
                      <option value="passport">Passport</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Upload File (.pdf, .jpg, .png)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/40 dark:file:text-blue-300 file:font-semibold file:cursor-pointer hover:file:bg-blue-100"
                      />
                      {documentFile && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-[150px]">
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

        {/* ================= STEP 2: LOCATION & AREA ================= */}
        {step === 2 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Physical Installation Address & Service Area
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Define geographic location, zone coverage, and GPS coordinates
              </p>
            </div>

            <div className="space-y-4">
              {/* Installation Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Installation Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <textarea
                    rows={2}
                    value={form.address || ''}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none ${
                      errors.address ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                    }`}
                    placeholder="House / Holding, Road no, Floor/Flat, Block/Sector..."
                  />
                </div>
                {errors.address && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.address}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* District */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    District <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <select
                    value={form.district || ''}
                    onChange={(e) => {
                      const district = e.target.value;
                      setForm((p) => ({ ...p, district, thana: '' }));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select District</option>
                    {BD_DISTRICTS.map((d) => (
                      <option key={d.districtEn} value={d.districtEn}>
                        {d.districtEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Thana */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    Thana / Upazila <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.thana || ''}
                    onChange={(e) => setForm((p) => ({ ...p, thana: e.target.value }))}
                    disabled={!form.district}
                    className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                      errors.thana ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <option value="">{form.district ? 'Select Thana' : 'Select District first'}</option>
                    {form.district &&
                      getThanaNamesForDistrict(form.district).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                  </select>
                  {errors.thana && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.thana}</p>}
                </div>

                {/* Area */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    Service Area <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <select
                    value={selectedAreaId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedAreaId(id);
                      const areaName = areas.find((a) => a.serviceAreaId === id)?.name ?? '';
                      setForm((p) => ({ ...p, area: areaName }));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Select Service Area</option>
                    {areas.map((area) => (
                      <option key={area.serviceAreaId} value={area.serviceAreaId}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sub Area */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    Sub Area <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <select
                    value={form.subArea || ''}
                    onChange={(e) => {
                      const subAreaName = e.target.value;
                      setForm((p) => ({ ...p, subArea: subAreaName }));
                    }}
                    disabled={!selectedAreaId}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">{selectedAreaId ? 'Select Sub Area' : 'Select Area first'}</option>
                    {subAreas.map((subArea) => (
                      <option key={subArea.subAreaId} value={subArea.name}>
                        {subArea.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Geographic Coordinates & Map */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      GPS Coordinates (Latitude, Longitude)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Pin subscriber on coverage map for technicians and maintenance
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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
                            toast.success('Current location detected successfully');
                          } catch {
                            toast.error('Unable to retrieve location. Please use "Select On Map".');
                          }
                        } else {
                          toast.error('Geolocation is not supported by your browser.');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <Navigation className="w-3.5 h-3.5 text-blue-500" /> Current GPS
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMapModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <MapIcon className="w-3.5 h-3.5 text-emerald-500" /> Select On Map
                    </button>
                  </div>
                </div>

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
                  placeholder="e.g. 23.8103, 90.4125"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: NETWORK & PLAN ================= */}
        {step === 3 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" />
                Network Router, Bandwidth Plan & Credentials
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Select target MikroTik gateway, assign bandwidth package, and configure login credentials
              </p>
            </div>

            {/* Gateway & Protocol */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Target Server / Router <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.serverId}
                  onChange={(e) => setForm((p) => ({ ...p, serverId: e.target.value }))}
                  className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${
                    errors.serverId ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <option value="">Select Router</option>
                  {servers.length === 0 && <option value="0">Default Gateway / Standalone</option>}
                  {servers.map((s) => (
                    <option key={s.networkDeviceId} value={s.networkDeviceId}>
                      {s.deviceName}
                    </option>
                  ))}
                </select>
                {errors.serverId && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.serverId}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Access Protocol <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.protocol}
                  onChange={(e) => setForm((p) => ({ ...p, protocol: e.target.value as NetworkProtocol }))}
                  className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${
                    errors.protocol ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {PROTOCOLS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {errors.protocol && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.protocol}</p>}
              </div>
            </div>

            {/* Package Selection Cards */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Select Bandwidth Package <span className="text-rose-500">*</span>
                </label>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={packageSearch}
                    onChange={(e) => setPackageSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadPackages(1)}
                    placeholder="Search package..."
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                  />
                  {packageSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setPackageSearch('');
                        loadPackages(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Package Grid Container */}
              <div
                className={`rounded-xl border ${
                  errors.packageId ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                } overflow-hidden bg-slate-50/50 dark:bg-slate-800/20`}
              >
                {packagesLoading ? (
                  <div className="p-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 animate-spin text-blue-600" /> Loading package plans...
                  </div>
                ) : packages.length === 0 ? (
                  <div className="p-8 text-center space-y-1">
                    <PackageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      No packages found for {form.protocol.toUpperCase()} on this router.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Create packages in Network &gt; Package Plans first.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto">
                    {packages.map((p) => {
                      const isSelected = form.packageId === p.id;
                      const color = p.color || (p as any).colorHex || '#2563EB';
                      const validityDays = p.validity?.days ?? (p as any).validityDays ?? 30;
                      const volType = p.volume?.type ?? (p as any).volumeType ?? (p as any).dataVolumeType ?? 'unlimited';
                      const volGb = p.volume?.gb ?? (p as any).volumeGb ?? (p as any).dataVolumeGb;

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, packageId: p.id }));
                            setSelectedPackage(p);
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next.packageId;
                              return next;
                            });
                          }}
                          className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-50/80 dark:bg-blue-900/30 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1 mb-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                ৳{Number(p.price).toLocaleString()}
                              </span>
                            </div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                              {p.name}
                            </p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{validityDays} Days</span>
                            <span>{volType === 'unlimited' ? 'Unlimited' : `${volGb ?? 0}GB`}</span>
                          </div>

                          {isSelected && (
                            <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Pagination footer */}
                {packagesMeta.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100/60 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 text-xs">
                    <button
                      type="button"
                      disabled={packagesMeta.page <= 1}
                      onClick={() => loadPackages(packagesMeta.page - 1)}
                      className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="text-slate-500 font-medium">
                      Page {packagesMeta.page} of {packagesMeta.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={packagesMeta.page >= packagesMeta.totalPages}
                      onClick={() => loadPackages(packagesMeta.page + 1)}
                      className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
              {errors.packageId && <p className="text-xs text-rose-500 font-medium">{errors.packageId}</p>}
            </div>

            {/* PPPoE / Radius Credentials */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  PPPoE Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    placeholder="Type PPPoE username"
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${
                      errors.username ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                </div>
                {errors.username && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.username}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  PPPoE Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={passwordRevealed ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Type PPPoE password"
                    className={`w-full pl-9 pr-9 py-2.5 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${
                      errors.password ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordRevealed(!passwordRevealed)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {passwordRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-rose-500 font-medium">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Remote IP (Static IP) <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.remoteAddress || ''}
                  onChange={(e) => setForm((p) => ({ ...p, remoteAddress: e.target.value }))}
                  placeholder="e.g. 192.168.10.50"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Price and Expiry Summary Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Plan Rate (Monthly)
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedPackage ? `৳${Number(selectedPackage.price).toLocaleString()}` : '—'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Auto-assigned from selected package</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Initial Expiry Date
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
                  {form.clientCategory === 'free'
                    ? 'Lifetime Free'
                    : form.clientCategory === 'prepaid' ||
                      form.clientCategory === 'postpaid' ||
                      form.clientCategory === 'vip'
                    ? 'Today (Awaiting First Payment / Recharge)'
                    : expiryPreview
                    ? expiryPreview.toLocaleDateString('en-GB')
                    : 'Select a package plan'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Updates on billing cycle renewal or recharge</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: BILLING & STATUS ================= */}
        {step === 4 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Reseller Ownership, Category & Billing Adjustments
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configure owner assignment, billing cycle, subscriber privileges, and OTC installation fees
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Owner Assignment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  {isAgent ? 'Reseller (Agent Parent)' : 'Assign Subscriber To'}
                </label>
                {isAgent ? (
                  <input
                    value={resellerLabel}
                    readOnly
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 text-sm outline-none cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={form.ownerId || userId}
                    onChange={(e) => setForm((p) => ({ ...p, ownerId: e.target.value }))}
                    disabled={resellersLoading}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
                  >
                    {resellersLoading ? (
                      <option value={userId}>Loading resellers...</option>
                    ) : (
                      ownerOptions.map((r) => (
                        <option key={r.userId} value={r.userId}>
                          {r.name} ({r.role})
                        </option>
                      ))
                    )}
                  </select>
                )}
                <p className="mt-1 text-[11px] text-slate-400">Account billing and commissions will accrue to this owner.</p>
              </div>

              {/* Billing Cycle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Billing Cycle <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.billingCycle}
                  onChange={(e) => setForm((p) => ({ ...p, billingCycle: e.target.value as any }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="monthly">Monthly (Calendar Month)</option>
                  <option value="custom">Custom (Validity Based)</option>
                </select>
              </div>

              {/* Customer Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Subscriber Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { val: 'prepaid', label: 'Prepaid', icon: Clock },
                    { val: 'postpaid', label: 'Postpaid', icon: Layers },
                    { val: 'vip', label: 'VIP', icon: Star, color: 'text-amber-500' },
                    { val: 'free', label: 'Free', icon: Gift, color: 'text-emerald-500' },
                  ].map((cat) => {
                    const isChecked = form.clientCategory === cat.val;
                    const CatIcon = cat.icon;
                    return (
                      <button
                        key={cat.val}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            clientCategory: cat.val as CreateClientPayload['clientCategory'],
                          }))
                        }
                        className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                          isChecked
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500/20'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <CatIcon className={`w-4 h-4 ${cat.color || ''}`} />
                        <span className="text-xs">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Discount / Adjustment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Monthly Discount (৳)
                </label>
                <input
                  type="number"
                  value={form.addLessAmount ?? 0}
                  onChange={(e) => setForm((p) => ({ ...p, addLessAmount: Number(e.target.value) || 0 }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  min={-999999}
                  max={999999}
                  step={50}
                />
                <p className="mt-1 text-[11px] text-slate-400">Regular recurring discount deducted from bill.</p>
              </div>

              {/* Installation Charge / OTC */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Installation Charge / OTC (৳)
                </label>
                <input
                  type="number"
                  value={form.installationCharge ?? 0}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, installationCharge: Math.max(0, Number(e.target.value) || 0) }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  min={0}
                  max={999999}
                  step={50}
                />
                <p className="mt-1 text-[11px] text-slate-400">One-time installation or optical ONU setup fee.</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 5: REVIEW & CONFIRM ================= */}
        {step === 5 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Review & Confirm Customer Registration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Verify all information before creating the subscriber and activating network access
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Customer Identity */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  <User className="w-3.5 h-3.5" /> 1. Customer Identity
                </div>
                <div className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Customer ID:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {form.customerCode || 'Auto-generated on save'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Name:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{form.clientName || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Mobile No:</span>
                    <span className="font-mono font-medium">{form.mobileNo || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Email:</span>
                    <span>{form.email || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">NID / Smart Card:</span>
                    <span className="font-mono">{form.nidNo || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">KYC Document:</span>
                    <span>{uploadDocuments && documentFile ? `${documentType.toUpperCase()} (${documentFile.name})` : 'None'}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Coverage & Location */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  <MapPin className="w-3.5 h-3.5" /> 2. Address & Coverage
                </div>
                <div className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Address:</span>
                    <span className="font-medium text-right max-w-[200px] truncate">{form.address || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Thana / Upazila:</span>
                    <span className="font-medium">{form.thana || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">District:</span>
                    <span className="font-medium">{form.district || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Service Area:</span>
                    <span className="font-medium">{form.area || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Sub Area:</span>
                    <span className="font-medium">{form.subArea || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">GPS Coordinates:</span>
                    <span className="font-mono text-[11px]">
                      {form.latitude != null && form.longitude != null
                        ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Network & Gateway */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  <Server className="w-3.5 h-3.5" /> 3. Router & Service Plan
                </div>
                <div className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Server / Router:</span>
                    <span className="font-semibold">{servers.find((s) => s.networkDeviceId === form.serverId)?.deviceName ?? 'Default Gateway'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Protocol:</span>
                    <span className="uppercase font-mono font-semibold">{protocolLabel}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Package Plan:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {previewPackage?.name ?? '—'}{' '}
                      {previewPackage ? `(৳${Number(previewPackage.price).toLocaleString()})` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Username:</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{form.username || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Password:</span>
                    <span className="font-mono">••••••••</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Remote Static IP:</span>
                    <span className="font-mono">{form.remoteAddress || 'Dynamic Pool'}</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Commercials & Billing */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="w-3.5 h-3.5" /> 4. Billing & Category
                </div>
                <div className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Assigned Owner:</span>
                    <span className="font-medium">
                      {form.ownerId && ownerOptions.length
                        ? ownerOptions.find((r) => r.userId === (form.ownerId || userId))?.name ?? resellerLabel
                        : resellerLabel}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Billing Cycle:</span>
                    <span className="capitalize font-medium">{form.billingCycle}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Category:</span>
                    <span className="capitalize font-semibold">
                      {form.clientCategory === 'vip' ? '⭐ VIP' : form.clientCategory === 'free' ? '🎁 Free' : form.clientCategory}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Monthly Discount:</span>
                    <span className="font-semibold text-rose-600">
                      {(form.addLessAmount ?? 0) !== 0 ? `৳${Number(form.addLessAmount).toLocaleString()}` : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500">Installation OTC:</span>
                    <span className="font-semibold">
                      {(form.installationCharge ?? 0) > 0 ? `৳${Number(form.installationCharge).toLocaleString()}` : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Initial Expiry:</span>
                    <span className="font-medium">
                      {form.clientCategory === 'free'
                        ? 'Lifetime'
                        : expiryPreview
                        ? expiryPreview.toLocaleDateString('en-GB')
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= FOOTER ACTIONS ================= */}
        <div className="px-6 py-4 bg-slate-50/75 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1 || isSaving}
            className="px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {step < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
            >
              Next Step <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !canSubmit}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Creating Customer...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Create Customer
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Map Picker Modal */}
      <MapPickerModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        onSelect={(lat, lng) => {
          setLocationInput('');
          setForm((p) => ({ ...p, latitude: lat, longitude: lng }));
          setIsMapModalOpen(false);
          toast.success(`Coordinates selected: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }}
        initialLat={form.latitude ?? undefined}
        initialLng={form.longitude ?? undefined}
      />
    </div>
  );
}
