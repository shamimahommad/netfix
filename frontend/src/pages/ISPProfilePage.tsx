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
} from 'lucide-react';
import { tenantProfileService } from '@/services/tenant-profile.service';
import { useToastContext } from '@/contexts/ToastContext';
import {
  TenantProfile,
  UpdateTenantFeaturesPayload,
  UpdatePaymentGatewaysPayload,
  UpdateSmsGatewayPayload,
  PaymentGatewayConfig,
  BkashCredentials,
  SmsProvider,
} from '@/types/tenant-profile.types';

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const itemUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

export default function ISPProfilePage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();

  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feature toggles state
  const [features, setFeatures] = useState({
    mapEnabled: false,
    monitoringEnabled: false,
  });
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);

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
  const [showSmsCredentials, setShowSmsCredentials] = useState(true);
  const [showSmsTestModal, setShowSmsTestModal] = useState(false);
  const [testSmsNumber, setTestSmsNumber] = useState('');
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);

  useEffect(() => {
    if (tenantId) {
      loadProfile();
    }
  }, [tenantId]);

  const loadProfile = async () => {
    if (!tenantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [response, providersRes] = await Promise.all([
        tenantProfileService.getTenantProfile(tenantId),
        tenantProfileService.getSmsProviders().catch(() => ({ success: true, data: [] as SmsProvider[] })),
      ]);
      if (providersRes?.data) setSmsProviders(providersRes.data);

      setProfile(response.data);

      // Set feature toggles
      if (response.data.settings) {
        setFeatures({
          mapEnabled: response.data.settings.mapEnabled,
          monitoringEnabled: response.data.settings.monitoringEnabled,
        });
      }

      // Set payment gateways
      const gateways: PaymentGatewayConfig[] = [
        { gateway: 'bkash', isEnabled: false, credentials: {} },
        { gateway: 'surjopay', isEnabled: false, credentials: {} },
        { gateway: 'ssl', isEnabled: false, credentials: {} },
      ];

      response.data.paymentGateways.forEach((pg) => {
        const index = gateways.findIndex((g) => g.gateway === pg.gateway);
        if (index !== -1) {
          gateways[index] = {
            gateway: pg.gateway,
            isEnabled: pg.isEnabled,
            credentials: pg.credentials || {},
          };
        }
      });
      setPaymentGateways(gateways);

      // Set SMS gateway
      if (response.data.smsGateways.length > 0) {
        const sms = response.data.smsGateways[0];
        setSmsGateway({
          providerName: sms.providerName,
          isEnabled: sms.isEnabled,
          credentials: sms.credentials || {},
        });
      }
    } catch (err: any) {
      console.error('Error loading tenant profile:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load ISP profile';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFeatures = async () => {
    if (!tenantId) return;

    setIsSavingFeatures(true);
    try {
      const payload: UpdateTenantFeaturesPayload = {
        mapEnabled: features.mapEnabled,
        monitoringEnabled: features.monitoringEnabled,
      };

      await tenantProfileService.updateTenantFeatures(tenantId, payload);
      toast.success('Features updated successfully!');
      loadProfile();
    } catch (err: any) {
      console.error('Error updating features:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update features';
      toast.error(errorMessage);
    } finally {
      setIsSavingFeatures(false);
    }
  };

  const handleSavePaymentGateways = async () => {
    if (!tenantId) return;

    setIsSavingPaymentGateways(true);
    try {
      const payload: UpdatePaymentGatewaysPayload = {
        gateways: paymentGateways,
      };

      await tenantProfileService.updatePaymentGateways(tenantId, payload);
      toast.success('Payment gateways updated successfully!');
      loadProfile();
    } catch (err: any) {
      console.error('Error updating payment gateways:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update payment gateways';
      toast.error(errorMessage);
    } finally {
      setIsSavingPaymentGateways(false);
    }
  };

  const handleSaveSmsGateway = async () => {
    if (!tenantId) return;

    if (!smsGateway.providerName.trim()) {
      toast.error('Please select an SMS company');
      return;
    }

    setIsSavingSmsGateway(true);
    try {
      const payload: UpdateSmsGatewayPayload = {
        providerName: smsGateway.providerName.trim(),
        isEnabled: smsGateway.isEnabled,
        credentials: smsGateway.credentials,
      };

      await tenantProfileService.updateSmsGateway(tenantId, payload);
      toast.success('SMS gateway updated successfully!');
      loadProfile();
    } catch (err: any) {
      console.error('Error updating SMS gateway:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update SMS gateway';
      toast.error(errorMessage);
    } finally {
      setIsSavingSmsGateway(false);
    }
  };

  const handleSendTestSms = async () => {
    if (!tenantId) return;
    const digits = testSmsNumber.replace(/\D/g, '');
    const mobile = digits.startsWith('88') ? digits : `88${digits}`;
    if (mobile.length < 12) {
      toast.error('Enter a valid mobile number (e.g. 88018xxxxxxxx)');
      return;
    }
    setIsSendingTestSms(true);
    try {
      await tenantProfileService.sendSmsTest(tenantId, mobile);
      toast.success('Test SMS sent successfully!');
      setShowSmsTestModal(false);
      setTestSmsNumber('');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to send test SMS';
      toast.error(msg);
    } finally {
      setIsSendingTestSms(false);
    }
  };

  const enabledGateways = paymentGateways.filter((g) => g.isEnabled);

  const openTestFlow = () => {
    setTestAmount('100');
    setShowTestAmountModal(true);
  };

  const closeTestAmountModal = () => {
    setShowTestAmountModal(false);
  };

  const handlePayNowFromAmountModal = () => {
    const amount = parseFloat(testAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (enabledGateways.length === 0) {
      toast.error('Enable at least one payment gateway first');
      return;
    }
    setShowTestAmountModal(false);
    setShowGatewaySelectModal(true);
  };

  const handleTestGateway = async (gateway: string) => {
    if (!tenantId) return;
    const amount = parseFloat(testAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setTestProcessingGateway(gateway);

    if (gateway === 'bkash') {
      try {
        const callbackURL = `${window.location.origin}/saas/tenants/${tenantId}/payment-callback`;
        const data = await tenantProfileService.createBkashPayment(tenantId, amount, callbackURL);
        setShowGatewaySelectModal(false);
        setTestProcessingGateway(null);
        if (data?.bkashURL) {
          window.location.href = data.bkashURL;
          return;
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Failed to start Bkash payment';
        toast.error(msg);
      } finally {
        setTestProcessingGateway(null);
      }
      return;
    }

    // Other gateways: simulate for now
    await new Promise((r) => setTimeout(r, 1500));
    setTestProcessingGateway(null);
    setShowGatewaySelectModal(false);
    toast.success('Test complete');
  };

  const updateGatewayCredentials = (gateway: string, key: string, value: string | boolean) => {
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

  const updateSmsCredentials = (key: string, value: string) => {
    setSmsGateway((prev) => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        [key]: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6"
      >
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
          <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading ISP profile…</p>
        </div>
      </motion.div>
    );
  }

  if (error || !profile) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6"
      >
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[50vh]">
          <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-6 flex flex-col items-center gap-4 w-full">
            <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400" />
            <p className="text-red-800 dark:text-red-300 font-medium text-center">{error || 'Failed to load ISP profile'}</p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/saas/tenants')}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tenants
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/saas/tenants')}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </motion.button>
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
              <Building2 className="w-8 h-8" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 via-blue-800 to-indigo-800 dark:from-slate-100 dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
                {profile.tenant.tenantName}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Profile & configuration</p>
            </div>
          </div>
        </motion.div>

        {/* ISP Info Section */}
        <motion.section
          variants={itemUp}
          initial="initial"
          animate="animate"
          className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl overflow-hidden"
        >
          <div className="p-5 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">ISP Information</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex items-start gap-3">
              <span className="text-slate-400 dark:text-slate-500 mt-0.5">Code</span>
              <p className="text-slate-900 dark:text-slate-100 font-semibold">{profile.tenant.tenantCode}</p>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <p className="text-slate-900 dark:text-slate-100 font-medium truncate">{profile.tenant.businessEmail}</p>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <p className="text-slate-900 dark:text-slate-100 font-medium">{profile.tenant.businessPhone || '—'}</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-slate-400 dark:text-slate-500 mt-0.5">Status</span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 capitalize">
                {profile.tenant.status}
              </span>
            </div>
            <div className="flex items-start gap-3 sm:col-span-2">
              <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Created {new Date(profile.tenant.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        </motion.section>

        {/* Feature Toggles Section */}
        <motion.section
          variants={itemUp}
          initial="initial"
          animate="animate"
          className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl overflow-hidden"
        >
          <div className="p-5 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Feature Toggles</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
                  <Map className="w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Map / GIS</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Interactive map and GIS</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={features.mapEnabled}
                  onChange={(e) => setFeatures((prev) => ({ ...prev, mapEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-indigo-600" />
              </label>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
                  <Activity className="w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Monitoring</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Network monitoring and analytics</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={features.monitoringEnabled}
                  onChange={(e) => setFeatures((prev) => ({ ...prev, monitoringEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-emerald-600 peer-checked:to-teal-600" />
              </label>
            </div>
          </div>
          <div className="p-5 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-end">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSaveFeatures}
              disabled={isSavingFeatures}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingFeatures ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSavingFeatures ? 'Saving…' : 'Save Features'}
            </motion.button>
          </div>
        </motion.section>

        {/* Payment Gateways Section */}
        <motion.section
          variants={itemUp}
          initial="initial"
          animate="animate"
          className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl overflow-hidden"
        >
          <div className="p-5 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Payment Gateways</h2>
          </div>
          <div className="p-6 space-y-4">
            {paymentGateways.map((gateway) => (
              <div key={gateway.gateway} className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden bg-slate-50/30 dark:bg-slate-900/20">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg uppercase">
                      {gateway.gateway.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 capitalize">{gateway.gateway}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Gateway configuration</p>
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
                      <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-pink-600" />
                    </label>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setExpandedGateway(expandedGateway === gateway.gateway ? null : gateway.gateway)}
                      className="p-2 rounded-lg text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                    >
                      <ChevronDown
                        className={`w-5 h-5 transition-transform duration-200 ${expandedGateway === gateway.gateway ? 'rotate-180' : ''}`}
                      />
                    </motion.button>
                  </div>
                </div>
                {expandedGateway === gateway.gateway && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                    {gateway.gateway === 'bkash' ? (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">API Context Root</label>
                          <input
                            type="text"
                            value={(gateway.credentials as BkashCredentials)?.apiContextRoot || ''}
                            onChange={(e) => updateGatewayCredentials('bkash', 'apiContextRoot', e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-purple-500 dark:focus:border-purple-400 outline-none text-slate-900 dark:text-slate-100"
                            placeholder="e.g. https://tokenized.sandbox.bka.sh"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Username (PGW)</label>
                          <input
                            type="text"
                            value={(gateway.credentials as BkashCredentials)?.username || ''}
                            onChange={(e) => updateGatewayCredentials('bkash', 'username', e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-purple-500 dark:focus:border-purple-400 outline-none text-slate-900 dark:text-slate-100"
                            placeholder="PGW username"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Password (PGW)</label>
                          <input
                            type="password"
                            value={(gateway.credentials as BkashCredentials)?.password || ''}
                            onChange={(e) => updateGatewayCredentials('bkash', 'password', e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-purple-500 dark:focus:border-purple-400 outline-none text-slate-900 dark:text-slate-100"
                            placeholder="PGW password"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">App Key (PGW)</label>
                          <input
                            type="text"
                            value={(gateway.credentials as BkashCredentials)?.appKey || ''}
                            onChange={(e) => updateGatewayCredentials('bkash', 'appKey', e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-purple-500 dark:focus:border-purple-400 outline-none text-slate-900 dark:text-slate-100"
                            placeholder="App key"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">App Secret (PGW)</label>
                          <input
                            type="password"
                            value={(gateway.credentials as BkashCredentials)?.appSecret || ''}
                            onChange={(e) => updateGatewayCredentials('bkash', 'appSecret', e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-purple-500 dark:focus:border-purple-400 outline-none text-slate-900 dark:text-slate-100"
                            placeholder="App secret"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Mode</label>
                          <select
                            value={(gateway.credentials as BkashCredentials)?.sandbox === false ? 'live' : 'sandbox'}
                            onChange={(e) => updateGatewayCredentials('bkash', 'sandbox', e.target.value === 'sandbox')}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-purple-500 dark:focus:border-purple-400 outline-none text-slate-900 dark:text-slate-100"
                          >
                            <option value="sandbox">Sandbox</option>
                            <option value="live">Live</option>
                          </select>
                        </div>
                      </>
                    ) : gateway.gateway === 'ssl' ? (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Store ID</label>
                          <input
                            type="text"
                            value={gateway.credentials?.store_id || gateway.credentials?.storeId || ''}
                            onChange={(e) => updateGatewayCredentials('ssl', 'store_id', e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-purple-500 dark:focus:border-purple-400 outline-none text-slate-900 dark:text-slate-100"
                            placeholder="SSLCommerz store_id"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Store Password</label>
                          <input
                            type="password"
                            value={gateway.credentials?.store_passwd || gateway.credentials?.storePassword || ''}
                            onChange={(e) => updateGatewayCredentials('ssl', 'store_passwd', e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-purple-500 dark:focus:border-purple-400 outline-none text-slate-900 dark:text-slate-100"
                            placeholder="SSLCommerz store_passwd"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Mode</label>
                          <select
                            value={(gateway.credentials?.is_live === true || gateway.credentials?.is_live === 'true') ? 'live' : 'sandbox'}
                            onChange={(e) => updateGatewayCredentials('ssl', 'is_live', e.target.value === 'live')}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-purple-500 dark:focus:border-purple-400 outline-none text-slate-900 dark:text-slate-100"
                          >
                            <option value="sandbox">Sandbox</option>
                            <option value="live">Live</option>
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">API Key</label>
                          <input
                            type="text"
                            value={gateway.credentials?.apiKey || ''}
                            onChange={(e) => updateGatewayCredentials(gateway.gateway, 'apiKey', e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-purple-500 dark:focus:border-purple-400 outline-none text-slate-900 dark:text-slate-100"
                            placeholder="Enter API key"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">API Secret</label>
                          <input
                            type="password"
                            value={gateway.credentials?.apiSecret || ''}
                            onChange={(e) => updateGatewayCredentials(gateway.gateway, 'apiSecret', e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-purple-500 dark:focus:border-purple-400 outline-none text-slate-900 dark:text-slate-100"
                            placeholder="Enter API secret"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="p-5 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap justify-between items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={openTestFlow}
              className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Test payment
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSavePaymentGateways}
              disabled={isSavingPaymentGateways}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingPaymentGateways ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSavingPaymentGateways ? 'Saving…' : 'Save Payment Gateways'}
            </motion.button>
          </div>
        </motion.section>

        {/* Test Payment - Amount Modal */}
        <AnimatePresence>
          {showTestAmountModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={closeTestAmountModal}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-md"
              >
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Test Payment</h3>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Amount (৳)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 dark:text-slate-100"
                  placeholder="Enter amount"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeTestAmountModal}
                  className="px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePayNowFromAmountModal}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700"
                >
                  Pay Now
                </button>
              </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Test Payment - Select Gateway Modal (enabled gateways only) */}
        <AnimatePresence>
          {showGatewaySelectModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={() => !testProcessingGateway && setShowGatewaySelectModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Select gateway</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Pay with one of the enabled gateways to complete the test.</p>
              <div className="space-y-2">
                {enabledGateways.map((g) => (
                  <button
                    key={g.gateway}
                    type="button"
                    disabled={!!testProcessingGateway}
                    onClick={() => handleTestGateway(g.gateway)}
                    className="w-full px-4 py-3 rounded-xl font-medium capitalize bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-800/30 dark:hover:to-pink-800/30 text-slate-900 dark:text-slate-100 flex items-center justify-center gap-2"
                  >
                    {testProcessingGateway === g.gateway ? (
                      <>
                        <span className="inline-block w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>Pay with {g.gateway}</>
                    )}
                  </button>
                ))}
              </div>
              {!testProcessingGateway && (
                <button
                  type="button"
                  onClick={() => setShowGatewaySelectModal(false)}
                  className="mt-4 w-full px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 rounded-xl font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
              )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SMS Gateway Section */}
        <motion.section
          variants={itemUp}
          initial="initial"
          animate="animate"
          className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl overflow-hidden"
        >
          <div className="p-5 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">SMS Gateway</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shrink-0">
                  <MessageSquare className="w-6 h-6" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">SMS Company</label>
                  <select
                    value={smsGateway.providerName}
                    onChange={(e) => setSmsGateway((prev) => ({ ...prev, providerName: e.target.value, credentials: prev.providerName === e.target.value ? prev.credentials : {} }))}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-amber-500 outline-none text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select company</option>
                    {smsProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Tenant-wise SMS gateway (API only)</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                <input
                  type="checkbox"
                  checked={smsGateway.isEnabled}
                  onChange={(e) => setSmsGateway((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-amber-600 peer-checked:to-orange-600"></div>
              </label>
            </div>

            {smsGateway.providerName === 'MiMSMS' && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <a href="https://www.mimsms.com/api-documentation/" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-600">MiMSMS API docs</a>
                </p>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">UserName</label>
                  <input
                    type="text"
                    value={smsGateway.credentials?.userName ?? smsGateway.credentials?.UserName ?? ''}
                    onChange={(e) => updateSmsCredentials('userName', e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-amber-500 outline-none text-slate-900 dark:text-slate-100"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Apikey</label>
                  <input
                    type="password"
                    value={smsGateway.credentials?.apikey ?? smsGateway.credentials?.Apikey ?? ''}
                    onChange={(e) => updateSmsCredentials('apikey', e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-amber-500 outline-none text-slate-900 dark:text-slate-100"
                    placeholder="API Key from MiMSMS"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Sender Name</label>
                  <input
                    type="text"
                    value={smsGateway.credentials?.senderName ?? smsGateway.credentials?.SenderName ?? ''}
                    onChange={(e) => updateSmsCredentials('senderName', e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-amber-500 outline-none text-slate-900 dark:text-slate-100"
                    placeholder="Registered sender ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Transaction Type</label>
                  <select
                    value={smsGateway.credentials?.transactionType ?? smsGateway.credentials?.TransactionType ?? 'T'}
                    onChange={(e) => updateSmsCredentials('transactionType', e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 outline-none text-slate-900 dark:text-slate-100"
                  >
                    <option value="T">T – Transactional</option>
                    <option value="P">P – Promotional</option>
                    <option value="D">D – Dynamic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Campaign ID (optional, for Promotional)</label>
                  <input
                    type="text"
                    value={smsGateway.credentials?.campaignId ?? smsGateway.credentials?.CampaignId ?? ''}
                    onChange={(e) => updateSmsCredentials('campaignId', e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-amber-500 outline-none text-slate-900 dark:text-slate-100"
                    placeholder="null or approved campaign ID"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="p-5 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-end gap-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowSmsTestModal(true)}
              disabled={!smsGateway.providerName || isSavingSmsGateway}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-amber-500 dark:border-amber-400 text-amber-600 dark:text-amber-400 font-semibold hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Test SMS
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSaveSmsGateway}
              disabled={isSavingSmsGateway}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingSmsGateway ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSavingSmsGateway ? 'Saving…' : 'Save SMS Gateway'}
            </motion.button>
          </div>
        </motion.section>

        {/* Test SMS Modal */}
        <AnimatePresence>
          {showSmsTestModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={() => !isSendingTestSms && setShowSmsTestModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm"
              >
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Send Test SMS</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Save gateway first, then enter a mobile number (e.g. 88018xxxxxxxx).</p>
                <input
                  type="text"
                  value={testSmsNumber}
                  onChange={(e) => setTestSmsNumber(e.target.value)}
                  placeholder="88018xxxxxxxx"
                  className="w-full px-4 py-2 mb-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-slate-100"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => !isSendingTestSms && setShowSmsTestModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendTestSms}
                    disabled={isSendingTestSms}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white font-medium disabled:opacity-50"
                  >
                    {isSendingTestSms ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isSendingTestSms ? 'Sending…' : 'Send Test SMS'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
