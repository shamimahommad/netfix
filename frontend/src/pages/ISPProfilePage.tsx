import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Calendar,
  Map,
  Activity,
  CreditCard,
  MessageSquare,
  ChevronDown,
  Save,
  AlertCircle,
  Loader2,
  Server,
  Radio,
  Users,
  Key,
  Edit,
  LogIn,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Globe,
  Layers,
  Clock,
} from 'lucide-react';
import { tenantProfileService } from '@/services/tenant-profile.service';
import { useToastContext } from '@/contexts/ToastContext';
import { useTenantStore } from '@/stores/tenantStore';
import {
  TenantProfile,
  PaymentGatewayConfig,
  BkashCredentials,
  SmsProvider,
  TenantDeviceItem,
  TenantUserItem,
} from '@/types/tenant-profile.types';

type ProfileTab = 'network' | 'limits' | 'features' | 'payment' | 'sms' | 'users';

const itemUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

export default function ISPProfilePage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();
  const { setSelectedTenant } = useTenantStore();

  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<ProfileTab>('network');

  // Feature toggles state
  const [features, setFeatures] = useState({
    mapEnabled: false,
    monitoringEnabled: false,
  });
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);

  // Limits state
  const [limitsForm, setLimitsForm] = useState({
    maxCustomers: 5000,
    maxRouters: 10,
    maxOlts: 5,
    maxUsers: 50,
  });
  const [isSavingLimits, setIsSavingLimits] = useState(false);

  // Payment gateways state
  const [paymentGateways, setPaymentGateways] = useState<PaymentGatewayConfig[]>([
    { gateway: 'bkash', isEnabled: false, credentials: {} },
    { gateway: 'surjopay', isEnabled: false, credentials: {} },
    { gateway: 'ssl', isEnabled: false, credentials: {} },
  ]);
  const [isSavingPaymentGateways, setIsSavingPaymentGateways] = useState(false);
  const [expandedGateway, setExpandedGateway] = useState<string | null>(null);
  const [showTestAmountModal, setShowTestAmountModal] = useState(false);
  const [testAmount, setTestAmount] = useState<string>('100');
  const [showGatewaySelectModal, setShowGatewaySelectModal] = useState(false);
  const [testProcessingGateway, setTestProcessingGateway] = useState<string | null>(null);

  // SMS gateway state
  const [smsProviders, setSmsProviders] = useState<SmsProvider[]>([]);
  const [smsGateway, setSmsGateway] = useState({
    providerName: '',
    isEnabled: false,
    credentials: {} as Record<string, any>,
  });
  const [isSavingSmsGateway, setIsSavingSmsGateway] = useState(false);
  const [showSmsTestModal, setShowSmsTestModal] = useState(false);
  const [testSmsNumber, setTestSmsNumber] = useState('');
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);

  // Edit Tenant Info Modal
  const [showEditTenantModal, setShowEditTenantModal] = useState(false);
  const [isSavingTenantInfo, setIsSavingTenantInfo] = useState(false);
  const [tenantEditForm, setTenantEditForm] = useState({
    tenantName: '',
    businessEmail: '',
    businessPhone: '',
    businessAddress: '',
    countryCode: 'BD',
    status: 'active',
  });

  // Reset Admin Password Modal
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  useEffect(() => {
    if (tenantId) {
      loadProfile();
    }
  }, [tenantId]);

  const loadProfile = async (isManualRefresh = false) => {
    if (!tenantId) return;

    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const [response, providersRes] = await Promise.all([
        tenantProfileService.getTenantProfile(tenantId),
        tenantProfileService.getSmsProviders().catch(() => ({ success: true, data: [] as SmsProvider[] })),
      ]);

      if (providersRes?.data) setSmsProviders(providersRes.data);

      const pData = response.data;
      setProfile(pData);

      // Populate Edit Form
      if (pData.tenant) {
        setTenantEditForm({
          tenantName: pData.tenant.tenantName || '',
          businessEmail: pData.tenant.businessEmail || '',
          businessPhone: pData.tenant.businessPhone || '',
          businessAddress: pData.tenant.businessAddress || '',
          countryCode: pData.tenant.countryCode || 'BD',
          status: pData.tenant.status || 'active',
        });
      }

      // Populate Limits
      const l = pData.limits || pData.tenant?.limits;
      if (l) {
        setLimitsForm({
          maxCustomers: l.maxCustomers || 5000,
          maxRouters: l.maxRouters || 10,
          maxOlts: l.maxOlts || 5,
          maxUsers: l.maxUsers || 50,
        });
      }

      // Feature toggles
      if (pData.settings) {
        setFeatures({
          mapEnabled: Boolean(pData.settings.mapEnabled),
          monitoringEnabled: Boolean(pData.settings.monitoringEnabled),
        });
      }

      // Payment gateways
      const gateways: PaymentGatewayConfig[] = [
        { gateway: 'bkash', isEnabled: false, credentials: {} },
        { gateway: 'surjopay', isEnabled: false, credentials: {} },
        { gateway: 'ssl', isEnabled: false, credentials: {} },
      ];

      if (Array.isArray(pData.paymentGateways)) {
        pData.paymentGateways.forEach((pg) => {
          const index = gateways.findIndex((g) => g.gateway === pg.gateway);
          if (index !== -1) {
            gateways[index] = {
              gateway: pg.gateway,
              isEnabled: pg.isEnabled,
              credentials: pg.credentials || {},
            };
          }
        });
      }
      setPaymentGateways(gateways);

      // SMS gateway
      if (Array.isArray(pData.smsGateways) && pData.smsGateways.length > 0) {
        const sms = pData.smsGateways[0];
        setSmsGateway({
          providerName: sms.providerName,
          isEnabled: sms.isEnabled,
          credentials: sms.credentials || {},
        });
      }
    } catch (err: any) {
      console.error('Error loading tenant profile:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to load ISP profile';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleImpersonateLogin = () => {
    if (!profile?.tenant) return;
    setSelectedTenant(profile.tenant);
    navigate('/dashboard');
  };

  const handleSaveFeatures = async () => {
    if (!tenantId) return;
    setIsSavingFeatures(true);
    try {
      await tenantProfileService.updateTenantFeatures(tenantId, features);
      toast.success('Feature toggles updated successfully');
      loadProfile(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update features');
    } finally {
      setIsSavingFeatures(false);
    }
  };

  const handleSaveLimits = async () => {
    if (!tenantId) return;
    setIsSavingLimits(true);
    try {
      await tenantProfileService.updateTenantLimits(tenantId, limitsForm);
      toast.success('Plan quotas and limits updated successfully');
      loadProfile(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update limits');
    } finally {
      setIsSavingLimits(false);
    }
  };

  const handleSaveTenantInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setIsSavingTenantInfo(true);
    try {
      await tenantProfileService.updateTenantDetails(tenantId, tenantEditForm);
      toast.success('ISP details updated successfully');
      setShowEditTenantModal(false);
      loadProfile(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update ISP details');
    } finally {
      setIsSavingTenantInfo(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !newAdminPassword.trim()) return;
    setIsResettingPassword(true);
    try {
      await tenantProfileService.resetAdminPassword(tenantId, newAdminPassword.trim());
      toast.success('Admin password reset successfully');
      setShowResetPasswordModal(false);
      setNewAdminPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reset admin password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const updateGatewayCredentials = (gateway: string, key: string, value: any) => {
    setPaymentGateways((prev) =>
      prev.map((g) => {
        if (g.gateway === gateway) {
          return {
            ...g,
            credentials: {
              ...g.credentials,
              [key]: value,
            },
          };
        }
        return g;
      }),
    );
  };

  const handleSavePaymentGateways = async () => {
    if (!tenantId) return;
    setIsSavingPaymentGateways(true);
    try {
      await tenantProfileService.updatePaymentGateways(tenantId, { gateways: paymentGateways });
      toast.success('Payment gateways updated successfully');
      loadProfile(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save payment gateways');
    } finally {
      setIsSavingPaymentGateways(false);
    }
  };

  const updateSmsCredentials = (key: string, value: any) => {
    setSmsGateway((prev) => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        [key]: value,
      },
    }));
  };

  const handleSaveSmsGateway = async () => {
    if (!tenantId) return;
    setIsSavingSmsGateway(true);
    try {
      await tenantProfileService.updateSmsGateway(tenantId, {
        providerName: smsGateway.providerName,
        isEnabled: smsGateway.isEnabled,
        credentials: smsGateway.credentials,
      });
      toast.success('SMS gateway updated successfully');
      loadProfile(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save SMS gateway');
    } finally {
      setIsSavingSmsGateway(false);
    }
  };

  const handleSendTestSms = async () => {
    if (!tenantId || !testSmsNumber.trim()) {
      toast.error('Please enter a mobile number');
      return;
    }
    setIsSendingTestSms(true);
    try {
      const res = await tenantProfileService.sendSmsTest(tenantId, testSmsNumber.trim());
      toast.success(res.message || 'Test SMS sent successfully');
      setShowSmsTestModal(false);
      setTestSmsNumber('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send test SMS');
    } finally {
      setIsSendingTestSms(false);
    }
  };

  const enabledGateways = paymentGateways.filter((g) => g.isEnabled);

  const openTestFlow = () => {
    if (enabledGateways.length === 0) {
      toast.error('Enable and save at least one payment gateway first');
      return;
    }
    setShowTestAmountModal(true);
  };

  const handlePayNowFromAmountModal = () => {
    const amount = parseFloat(testAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setShowTestAmountModal(false);
    setShowGatewaySelectModal(true);
  };

  const handleTestGateway = async (gateway: string) => {
    if (!tenantId) return;
    const amount = parseFloat(testAmount);
    setTestProcessingGateway(gateway);
    try {
      const callbackURL = `${window.location.origin}/saas/tenants/${tenantId}/payment-callback`;
      const res = await tenantProfileService.testPaymentGateway(tenantId, gateway, amount, callbackURL);
      const url = res.payment_url || res.redirectURL || res.bkashURL;
      if (url) {
        window.location.href = url;
      } else {
        toast.error(`Failed to get checkout URL for ${gateway.toUpperCase()}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to initiate ${gateway} test`);
    } finally {
      setTestProcessingGateway(null);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-sm font-medium">Loading ISP Profile & Telemetry...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="w-full max-w-lg mx-auto py-16">
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-6 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h3 className="text-lg font-bold text-red-900 dark:text-red-200">Unable to Load ISP Profile</h3>
          <p className="text-sm text-red-700 dark:text-red-300">{error || 'Tenant not found'}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => navigate('/saas/tenants')}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold"
            >
              Back to Tenants
            </button>
            <button
              onClick={() => loadProfile()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { tenant } = profile;
  const routers = profile.routers || [];
  const olts = profile.olts || [];
  const users = profile.users || [];
  const stats = profile.stats || {
    totalCustomers: tenant.totalCustomers || 0,
    totalRouters: tenant.totalRouters || 0,
    totalOlts: olts.length,
    totalOnus: olts.reduce((sum, o) => sum + (o.totalOnus || 0), 0),
    totalResellers: 0,
  };

  const maxCustomers = limitsForm.maxCustomers || 5000;
  const customerPercent = Math.min(Math.round((stats.totalCustomers / maxCustomers) * 100), 100);

  return (
    <div className="w-full space-y-6">
      {/* Top Header Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <button
              onClick={() => navigate('/saas/tenants')}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
              title="Back to All Tenants"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
              {(tenant.tenantName || 'I').charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {tenant.tenantName}
                </h1>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                  {tenant.tenantCode}
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    tenant.status === 'active'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : tenant.status === 'trial'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {tenant.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {tenant.businessEmail}
                </span>
                {tenant.businessPhone && (
                  <span className="flex items-center gap-1.5 shrink-0">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {tenant.businessPhone}
                  </span>
                )}
                <span className="flex items-center gap-1.5 shrink-0">
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {tenant.countryCode || 'BD'} · {tenant.currencyCode || 'BDT'}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  Joined {new Date(tenant.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => loadProfile(true)}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
              title="Refresh profile data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            <button
              onClick={() => setShowResetPasswordModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-amber-500" />
              Reset Admin Password
            </button>

            <button
              onClick={() => setShowEditTenantModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
            >
              <Edit className="w-3.5 h-3.5 text-blue-500" />
              Edit ISP Info
            </button>

            <button
              onClick={handleImpersonateLogin}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              Login to Tenant
            </button>
          </div>
        </div>
      </div>

      {/* 5 Top Telemetry Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Subscribers */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Subscribers</p>
          <div className="flex items-baseline justify-between mt-1">
            <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {stats.totalCustomers.toLocaleString()}
            </h4>
            <span className="text-[11px] font-semibold text-slate-400">/ {maxCustomers}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                customerPercent > 90 ? 'bg-red-500' : customerPercent > 70 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${customerPercent}%` }}
            />
          </div>
        </div>

        {/* MikroTik Routers */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">MikroTik Routers</p>
            <Server className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {routers.length}
            </h4>
            <span className="text-[11px] font-semibold text-slate-400">/ {limitsForm.maxRouters} max</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {routers.filter((r) => r.status === 'active').length} online nodes
          </p>
        </div>

        {/* OLT Devices */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">OLT Devices</p>
            <Radio className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {olts.length}
            </h4>
            <span className="text-[11px] font-semibold text-slate-400">/ {limitsForm.maxOlts} max</span>
          </div>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-2">
            Fiber PON Nodes
          </p>
        </div>

        {/* Active ONUs */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Synced ONUs</p>
            <Layers className="w-4 h-4 text-emerald-500" />
          </div>
          <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {stats.totalOnus.toLocaleString()}
          </h4>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3 text-emerald-500" />
            Background cached
          </p>
        </div>

        {/* Staff & Admins */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Staff & Users</p>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {users.length}
            </h4>
            <span className="text-[11px] font-semibold text-slate-400">/ {limitsForm.maxUsers} limit</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Admins & Resellers
          </p>
        </div>
      </div>

      {/* Tabs Navigation Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-px overflow-x-auto">
        {[
          { id: 'network', label: 'Network Devices (MikroTik & OLT)', icon: Server, count: routers.length + olts.length },
          { id: 'limits', label: 'Plan Quotas & Limits', icon: Sliders },
          { id: 'features', label: 'Feature Toggles', icon: Activity },
          { id: 'payment', label: 'Payment Gateways', icon: CreditCard, count: enabledGateways.length },
          { id: 'sms', label: 'SMS Gateway', icon: MessageSquare },
          { id: 'users', label: 'Tenant Staff & Admins', icon: Users, count: users.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ProfileTab)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Network Devices (MikroTik & OLT) */}
      {activeTab === 'network' && (
        <motion.div {...itemUp} className="space-y-6">
          {/* Section: MikroTik Routers */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">MikroTik Routers</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Core routing & bandwidth shaping nodes</p>
                </div>
              </div>
              <button
                onClick={handleImpersonateLogin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Manage in Tenant
              </button>
            </div>

            <div className="overflow-x-auto">
              {routers.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                  No MikroTik routers configured for this tenant yet.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-slate-700/80">
                    <tr>
                      <th className="py-3 px-4">Router Name</th>
                      <th className="py-3 px-4">Device Code</th>
                      <th className="py-3 px-4">Management Host / IP</th>
                      <th className="py-3 px-4">API Port</th>
                      <th className="py-3 px-4">Winbox Port</th>
                      <th className="py-3 px-4">Subscribers</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 dark:divide-slate-700/80">
                    {routers.map((r) => (
                      <tr key={r.networkDeviceId} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {r.deviceName}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {r.deviceCode}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-800 dark:text-slate-200">
                          {r.managementIp || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 font-mono">
                          {r.managementPort}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 font-mono">
                          {r.winboxPort || 8291}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {r.totalCustomers || 0}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                              r.status === 'active'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Section: OLT Devices */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">OLT Devices</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Optical line terminals & GPON/EPON telemetry</p>
                </div>
              </div>
              <button
                onClick={handleImpersonateLogin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                View in OLT Page
              </button>
            </div>

            <div className="overflow-x-auto">
              {olts.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                  No OLT devices registered for this tenant yet.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-slate-700/80">
                    <tr>
                      <th className="py-3 px-4">OLT Name</th>
                      <th className="py-3 px-4">Vendor</th>
                      <th className="py-3 px-4">Management IP</th>
                      <th className="py-3 px-4">PON Standard</th>
                      <th className="py-3 px-4">PON Ports</th>
                      <th className="py-3 px-4">Cached ONUs</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 dark:divide-slate-700/80">
                    {olts.map((o) => (
                      <tr key={o.networkDeviceId} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {o.deviceName}
                        </td>
                        <td className="py-3 px-4 text-xs uppercase font-bold text-slate-600 dark:text-slate-300">
                          {o.vendor}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-800 dark:text-slate-200">
                          {o.managementIp}:{o.managementPort}
                        </td>
                        <td className="py-3 px-4 text-xs font-bold uppercase text-purple-600 dark:text-purple-400">
                          {o.ponType || 'GPON'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                          {o.totalPonPorts || 8} Ports
                        </td>
                        <td className="py-3 px-4 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {o.totalOnus || 0} ONUs
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                              o.status === 'active'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab 2: Plan Quotas & Limits */}
      {activeTab === 'limits' && (
        <motion.div {...itemUp} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-700/80">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-600" />
              Tenant Resource Limits & Quotas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enforce maximum subscribers, network devices, and reseller user accounts allowed on this ISP plan
            </p>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Max Allowed Customers / Subscribers
              </label>
              <input
                type="number"
                min="10"
                step="50"
                value={limitsForm.maxCustomers}
                onChange={(e) => setLimitsForm({ ...limitsForm, maxCustomers: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Currently used: {stats.totalCustomers} customers</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Max Allowed MikroTik Routers
              </label>
              <input
                type="number"
                min="1"
                value={limitsForm.maxRouters}
                onChange={(e) => setLimitsForm({ ...limitsForm, maxRouters: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Currently used: {routers.length} routers</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Max Allowed OLT Devices
              </label>
              <input
                type="number"
                min="1"
                value={limitsForm.maxOlts}
                onChange={(e) => setLimitsForm({ ...limitsForm, maxOlts: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Currently used: {olts.length} OLTs</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Max Allowed Staff & Reseller Accounts
              </label>
              <input
                type="number"
                min="1"
                value={limitsForm.maxUsers}
                onChange={(e) => setLimitsForm({ ...limitsForm, maxUsers: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Currently used: {users.length} user accounts</p>
            </div>
          </div>

          <div className="p-5 border-t border-slate-200/80 dark:border-slate-700/80 flex justify-end">
            <button
              onClick={handleSaveLimits}
              disabled={isSavingLimits}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSavingLimits ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSavingLimits ? 'Saving...' : 'Save Plan Quotas'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Tab 3: Feature Toggles */}
      {activeTab === 'features' && (
        <motion.div {...itemUp} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-700/80">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Tenant Feature Flags
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enable or disable optional software modules for this specific ISP
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Map className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Interactive Map / GIS Service</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Allows customer location tagging and optic fiber cable mapping on Leaflet</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={features.mapEnabled}
                  onChange={(e) => setFeatures({ ...features, mapEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Network Live Traffic Monitoring</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Enables high-frequency interface traffic graphing and latency telemetry</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={features.monitoringEnabled}
                  onChange={(e) => setFeatures({ ...features, monitoringEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>
          </div>

          <div className="p-5 border-t border-slate-200/80 dark:border-slate-700/80 flex justify-end">
            <button
              onClick={handleSaveFeatures}
              disabled={isSavingFeatures}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSavingFeatures ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSavingFeatures ? 'Saving...' : 'Save Feature Flags'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Tab 4: Payment Gateways */}
      {activeTab === 'payment' && (
        <motion.div {...itemUp} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
                Payment Gateways & PGW Configuration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure bKash Tokenized, SurjoPay, and SSLCommerz credentials for this tenant
              </p>
            </div>
            <button
              onClick={openTestFlow}
              className="px-3.5 py-1.5 rounded-xl border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-xs font-semibold transition-colors"
            >
              Test Payment Flow
            </button>
          </div>

          <div className="p-6 space-y-4">
            {paymentGateways.map((gateway) => (
              <div
                key={gateway.gateway}
                className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50/50 dark:bg-slate-900/20"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 font-bold text-sm flex items-center justify-center uppercase">
                      {gateway.gateway.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize">
                        {gateway.gateway === 'bkash' ? 'bKash Tokenized Checkout' : gateway.gateway === 'ssl' ? 'SSLCommerz Gateway' : 'SurjoPay PGW'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {gateway.isEnabled ? 'Active on customer portal' : 'Disabled'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={gateway.isEnabled}
                        onChange={(e) =>
                          setPaymentGateways((prev) =>
                            prev.map((g) => (g.gateway === gateway.gateway ? { ...g, isEnabled: e.target.checked } : g)),
                          )
                        }
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                    </label>

                    <button
                      onClick={() => setExpandedGateway(expandedGateway === gateway.gateway ? null : gateway.gateway)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedGateway === gateway.gateway ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {expandedGateway === gateway.gateway && (
                  <div className="p-4 bg-white dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    {gateway.gateway === 'bkash' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">API Context Root</label>
                          <input
                            type="text"
                            value={(gateway.credentials as BkashCredentials)?.apiContextRoot || ''}
                            onChange={(e) => updateGatewayCredentials('bkash', 'apiContextRoot', e.target.value)}
                            placeholder="https://tokenized.sandbox.bka.sh"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">PGW Username</label>
                          <input
                            type="text"
                            value={(gateway.credentials as BkashCredentials)?.username || ''}
                            onChange={(e) => updateGatewayCredentials('bkash', 'username', e.target.value)}
                            placeholder="Merchant username"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">PGW Password</label>
                          <input
                            type="password"
                            value={(gateway.credentials as BkashCredentials)?.password || ''}
                            onChange={(e) => updateGatewayCredentials('bkash', 'password', e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">App Key</label>
                          <input
                            type="text"
                            value={(gateway.credentials as BkashCredentials)?.appKey || ''}
                            onChange={(e) => updateGatewayCredentials('bkash', 'appKey', e.target.value)}
                            placeholder="bKash App Key"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">App Secret</label>
                          <input
                            type="password"
                            value={(gateway.credentials as BkashCredentials)?.appSecret || ''}
                            onChange={(e) => updateGatewayCredentials('bkash', 'appSecret', e.target.value)}
                            placeholder="bKash App Secret"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Gateway Mode</label>
                          <select
                            value={(gateway.credentials as BkashCredentials)?.sandbox === false ? 'live' : 'sandbox'}
                            onChange={(e) => updateGatewayCredentials('bkash', 'sandbox', e.target.value === 'sandbox')}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          >
                            <option value="sandbox">Sandbox (Test Mode)</option>
                            <option value="live">Live Production</option>
                          </select>
                        </div>
                      </div>
                    ) : gateway.gateway === 'ssl' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Store ID</label>
                          <input
                            type="text"
                            value={gateway.credentials?.store_id || gateway.credentials?.appKey || ''}
                            onChange={(e) => updateGatewayCredentials('ssl', 'store_id', e.target.value)}
                            placeholder="e.g. test_store123"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Store Password</label>
                          <input
                            type="password"
                            value={gateway.credentials?.store_passwd || gateway.credentials?.appSecret || ''}
                            onChange={(e) => updateGatewayCredentials('ssl', 'store_passwd', e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Gateway Mode</label>
                          <select
                            value={gateway.credentials?.sandbox === false ? 'live' : 'sandbox'}
                            onChange={(e) => updateGatewayCredentials('ssl', 'sandbox', e.target.value === 'sandbox')}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          >
                            <option value="sandbox">Sandbox (Test Mode)</option>
                            <option value="live">Live Production</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">SP Username</label>
                          <input
                            type="text"
                            value={gateway.credentials?.username || gateway.credentials?.apiKey || ''}
                            onChange={(e) => updateGatewayCredentials('surjopay', 'username', e.target.value)}
                            placeholder="Merchant username"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">SP Password</label>
                          <input
                            type="password"
                            value={gateway.credentials?.password || gateway.credentials?.apiSecret || ''}
                            onChange={(e) => updateGatewayCredentials('surjopay', 'password', e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Order Prefix</label>
                          <input
                            type="text"
                            value={gateway.credentials?.prefix || 'NOK'}
                            onChange={(e) => updateGatewayCredentials('surjopay', 'prefix', e.target.value)}
                            placeholder="e.g. NOK / SP / NETFIX"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Gateway Mode</label>
                          <select
                            value={gateway.credentials?.sandbox === false ? 'live' : 'sandbox'}
                            onChange={(e) => updateGatewayCredentials('surjopay', 'sandbox', e.target.value === 'sandbox')}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          >
                            <option value="sandbox">Sandbox (Test Mode)</option>
                            <option value="live">Live Production</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-5 border-t border-slate-200/80 dark:border-slate-700/80 flex justify-end">
            <button
              onClick={handleSavePaymentGateways}
              disabled={isSavingPaymentGateways}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSavingPaymentGateways ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSavingPaymentGateways ? 'Saving...' : 'Save Payment Gateways'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Tab 5: SMS Gateway */}
      {activeTab === 'sms' && (
        <motion.div {...itemUp} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-600" />
                Tenant SMS Gateway Configuration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automated SMS alerts for expiry notices, recharge confirmations, and OTPs
              </p>
            </div>
            <button
              onClick={() => setShowSmsTestModal(true)}
              className="px-3.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-xs font-semibold transition-colors"
            >
              Test SMS
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  SMS Gateway Provider
                </label>
                <select
                  value={smsGateway.providerName}
                  onChange={(e) => setSmsGateway({ ...smsGateway, providerName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Select a provider...</option>
                  {smsProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Gateway Active Status
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smsGateway.isEnabled}
                      onChange={(e) => setSmsGateway({ ...smsGateway, isEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600" />
                  </label>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {smsGateway.isEnabled ? 'Enabled for customer alerts' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Sender ID / Masking Name
                </label>
                <input
                  type="text"
                  value={smsGateway.credentials?.senderName || smsGateway.credentials?.senderId || ''}
                  onChange={(e) => updateSmsCredentials('senderName', e.target.value)}
                  placeholder="e.g. NETFIX"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  API Key / Token
                </label>
                <input
                  type="password"
                  value={smsGateway.credentials?.apikey || smsGateway.credentials?.apiKey || ''}
                  onChange={(e) => updateSmsCredentials('apikey', e.target.value)}
                  placeholder="Enter API token from SMS provider"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-slate-200/80 dark:border-slate-700/80 flex justify-end">
            <button
              onClick={handleSaveSmsGateway}
              disabled={isSavingSmsGateway}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSavingSmsGateway ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSavingSmsGateway ? 'Saving...' : 'Save SMS Gateway'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Tab 6: Tenant Staff & Admins */}
      {activeTab === 'users' && (
        <motion.div {...itemUp} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Tenant Staff & Administrator Accounts
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Authorized user logins registered under this ISP tenant
              </p>
            </div>
            <button
              onClick={() => setShowResetPasswordModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-amber-500" />
              Reset Admin Password
            </button>
          </div>

          <div className="overflow-x-auto">
            {users.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                No staff users found under this tenant.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold border-b border-slate-200 dark:border-slate-700/80">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-700/80">
                  {users.map((u) => (
                    <tr key={u.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {u.firstName} {u.lastName}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {u.username || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {u.email}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {u.phone || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 uppercase">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 capitalize">
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      )}

      {/* Edit Tenant Modal */}
      <AnimatePresence>
        {showEditTenantModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-lg"
            >
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Edit ISP Tenant Details</h3>
              <form onSubmit={handleSaveTenantInfo} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company / ISP Name</label>
                  <input
                    type="text"
                    required
                    value={tenantEditForm.tenantName}
                    onChange={(e) => setTenantEditForm({ ...tenantEditForm, tenantName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Business Phone</label>
                    <input
                      type="text"
                      value={tenantEditForm.businessPhone}
                      onChange={(e) => setTenantEditForm({ ...tenantEditForm, businessPhone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                    <select
                      value={tenantEditForm.status}
                      onChange={(e) => setTenantEditForm({ ...tenantEditForm, status: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Office / Business Address</label>
                  <textarea
                    rows={2}
                    value={tenantEditForm.businessAddress}
                    onChange={(e) => setTenantEditForm({ ...tenantEditForm, businessAddress: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowEditTenantModal(false)}
                    className="px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTenantInfo}
                    className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50"
                  >
                    {isSavingTenantInfo ? 'Saving...' : 'Update Details'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Admin Password Modal */}
      <AnimatePresence>
        {showResetPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm"
            >
              <div className="flex items-center gap-3 mb-3 text-amber-600 dark:text-amber-400">
                <Key className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Reset ISP Admin Password</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Set a new login password for <strong>{tenant.tenantName}</strong> primary admin account.
              </p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPasswordModal(false);
                      setNewAdminPassword('');
                    }}
                    className="px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResettingPassword}
                    className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl disabled:opacity-50"
                  >
                    {isResettingPassword ? 'Resetting...' : 'Save New Password'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Test Payment Amount Modal */}
      <AnimatePresence>
        {showTestAmountModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTestAmountModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm"
            >
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">Test Payment Gateway</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Enter an amount in ৳ to simulate a recharge via this tenant's PGW credentials.
              </p>
              <input
                type="number"
                min="1"
                step="any"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                className="w-full px-4 py-2.5 mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm font-bold"
              />
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowTestAmountModal(false)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePayNowFromAmountModal}
                  className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm"
                >
                  Proceed to Pay
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Test Payment Gateway Select Modal */}
      <AnimatePresence>
        {showGatewaySelectModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => !testProcessingGateway && setShowGatewaySelectModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm"
            >
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Select Gateway</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Choose an enabled gateway to initiate the payment test:
              </p>
              <div className="space-y-2">
                {enabledGateways.map((g) => (
                  <button
                    key={g.gateway}
                    type="button"
                    disabled={!!testProcessingGateway}
                    onClick={() => handleTestGateway(g.gateway)}
                    className="w-full px-4 py-3 rounded-xl font-semibold capitalize bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 text-purple-900 dark:text-purple-200 text-xs flex items-center justify-center gap-2"
                  >
                    {testProcessingGateway === g.gateway ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        Connecting to {g.gateway}...
                      </>
                    ) : (
                      <>Pay ৳{testAmount} via {g.gateway}</>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Test SMS Modal */}
      <AnimatePresence>
        {showSmsTestModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => !isSendingTestSms && setShowSmsTestModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm"
            >
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Send Test SMS</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Enter a mobile number to test the tenant's gateway credentials.
              </p>
              <input
                type="text"
                value={testSmsNumber}
                onChange={(e) => setTestSmsNumber(e.target.value)}
                placeholder="88018xxxxxxxx"
                className="w-full px-4 py-2.5 mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowSmsTestModal(false)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendTestSms}
                  disabled={isSendingTestSms}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl disabled:opacity-50"
                >
                  {isSendingTestSms ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {isSendingTestSms ? 'Sending...' : 'Send SMS'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
