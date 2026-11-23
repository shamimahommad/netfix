import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Zap,
  WifiOff,
  FileText,
  BarChart3,
  ChevronRight,
  Router,
  Radio,
  HardDrive,
  Copy,
  Check,
  PhoneCall,
  Ticket,
  ArrowUpRight,
  Download,
  Upload,
  Sparkles,
  UserCog,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCustomerPortalProfile } from '@/contexts/CustomerPortalContext';
import {
  customerPortalService,
  CustomerDashboardData,
  CustomerPaymentHistoryItem,
} from '@/services/customer-portal.service';
import { PortalSkeleton, CraftedCustomerDashboard, CustomerProfileModal } from '@/components/customer-portal';

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatTraffic(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '0 MB';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;
  return `${bytes} B`;
}

const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};
const itemUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { setProfile, designMode, setDesignMode } = useCustomerPortalProfile();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [payments, setPayments] = useState<CustomerPaymentHistoryItem[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedMac, setCopiedMac] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await customerPortalService.getDashboard();
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      const res = await customerPortalService.getPaymentHistory(1, 5);
      setPayments(res.data || []);
    } catch {
      setPayments([]);
    }
  };

  const loadTickets = async () => {
    try {
      const res = await customerPortalService.getTickets(1, 4);
      setTickets(res.data || []);
    } catch {
      setTickets([]);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadPayments();
    loadTickets();
  }, []);

  useEffect(() => {
    if (data?.customer) {
      setProfile({
        fullName: data.customer.fullName,
        customerCode: data.customer.customerCode,
        phone: data.customer.phone ?? null,
        email: data.customer.email ?? null,
        address: data.customer.address ?? null,
        onlineStatus: data.network?.onlineStatus ?? false,
        company: data.company ?? null,
      });
    }
  }, [data, setProfile]);

  const copyText = (text: string, type: 'mac' | 'id') => {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text);
    if (type === 'mac') {
      setCopiedMac(true);
      setTimeout(() => setCopiedMac(false), 1500);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PortalSkeleton className="h-32 w-full rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <PortalSkeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <PortalSkeleton className="h-72 rounded-2xl" />
          <PortalSkeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-700 max-w-md w-full text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-4">
            <WifiOff className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Connection Error</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate('/customer/login', { replace: true })}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow transition-all active:scale-95"
          >
            Sign In Again
          </button>
        </motion.div>
      </div>
    );
  }

  const d = data!;
  const isOnline = Boolean(d.network?.onlineStatus);
  const companyName = d.company?.name || 'Broadband ISP';
  const onu = d.onu;
  const router = d.router;
  const usage = d.monthlyUsage;

  if (designMode === 'crafted') {
    return (
      <CraftedCustomerDashboard
        data={d}
        payments={payments}
        tickets={tickets}
        copyText={copyText}
        copiedMac={copiedMac}
        copiedId={copiedId}
      />
    );
  }

  // Chart telemetry
  const downVal = usage ? usage.downloadGB : Number(d.network?.downloadBytes ?? 0) / 1e9;
  const upVal = usage ? usage.uploadGB : Number(d.network?.uploadBytes ?? 0) / 1e9;
  const usageChartData = [
    { name: 'Download', value: Math.max(0.01, downVal), fill: '#3b82f6' },
    { name: 'Upload', value: Math.max(0.01, upVal), fill: '#10b981' },
  ];

  // Laser Status Configuration
  const getLaserBadge = (status?: string, rx?: number | null) => {
    if (rx === null || rx === undefined || status === 'offline' || rx > -8) {
      return { label: 'Offline', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300' };
    }
    if (rx >= -24.0) {
      return { label: 'Optimal Link', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300/40' };
    }
    if (rx >= -27.0) {
      return { label: 'Warning Signal', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300/40' };
    }
    return { label: 'Critical / High Loss', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300/40' };
  };

  const laserBadge = getLaserBadge(onu?.laserStatus, onu?.rxPower);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* ────────────────── TOP WELCOME BANNER ────────────────── */}
      <motion.section
        variants={itemUp}
        initial="initial"
        animate="animate"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-6 sm:p-8 shadow-xl shadow-blue-500/15 border border-blue-400/20"
      >
        {/* Ambient background rings */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/20">
                {companyName}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md ${
                  isOnline
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                    : 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                {isOnline ? 'Line Active' : 'Disconnected'}
              </span>
              <button
                type="button"
                onClick={() => setDesignMode('crafted')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 backdrop-blur-md transition-all active:scale-95 ml-auto sm:ml-0"
                title="Switch to modern Crafted design"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Switch to Crafted UI</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
                Welcome back, {d.customer.fullName}!
              </h1>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95 border border-white/20"
                title="Edit your name, phone, and address"
              >
                <UserCog className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-blue-100/90 pt-1">
              <span className="inline-flex items-center gap-1">
                ID: <span className="font-mono font-bold text-white">{d.customer.customerCode}</span>
                <button
                  type="button"
                  onClick={() => copyText(d.customer.customerCode, 'id')}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Copy ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </span>
              <span>·</span>
              <span>Username: <span className="font-mono font-semibold text-white">{d.network?.username || d.customer.customerCode}</span></span>
              {d.company?.supportPhone && (
                <>
                  <span>·</span>
                  <a
                    href={`tel:${d.company.supportPhone}`}
                    className="inline-flex items-center gap-1 text-white hover:underline"
                  >
                    <PhoneCall className="w-3 h-3" />
                    Helpdesk: {d.company.supportPhone}
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Quick Pay CTA */}
          <div className="w-full md:w-auto flex items-center shrink-0">
            <Link
              to="/customer/pay-bill"
              className="w-full md:w-auto justify-center inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm shadow-lg shadow-black/10 transition-all active:scale-95 shrink-0 whitespace-nowrap"
            >
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
              <span className="whitespace-nowrap">Pay Bill / Recharge</span>
              <ArrowUpRight className="w-4 h-4 shrink-0" />
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ────────────────── 4 TELEMETRY METRIC CARDS ────────────────── */}
      <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* CARD 1: Router & Session Info ("Mac to router name") */}
        <motion.div
          variants={itemUp}
          whileHover={{ y: -2 }}
          className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Router className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Connected Router
            </span>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                isOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="space-y-1 mb-3">
            <p className="font-display font-bold text-slate-900 dark:text-slate-100 text-base truncate" title={router?.routerName}>
              {router?.routerName || 'MikroTik Core'}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Device Vendor:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[130px]" title={router?.deviceVendor}>
                {router?.deviceVendor || 'Standard Router'}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Router MAC:</span>
              <span className="flex items-center gap-1 font-mono font-medium text-slate-700 dark:text-slate-300">
                <span>{router?.macAddress || '—'}</span>
                {router?.macAddress && router.macAddress !== '—' && (
                  <button
                    type="button"
                    onClick={() => copyText(router.macAddress, 'mac')}
                    className="p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                    title="Copy MAC"
                  >
                    {copiedMac ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Assigned IP:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{router?.currentIp || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Session Uptime:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{router?.uptimeFormatted || '0m'}</span>
            </div>
          </div>
        </motion.div>

        {/* CARD 2: ONU Optical Laser Power ("Onur laser") */}
        <motion.div
          variants={itemUp}
          whileHover={{ y: -2 }}
          className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              ONU Laser Power
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${laserBadge.color}`}>
              {laserBadge.label}
            </span>
          </div>

          <div className="mb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-display font-extrabold text-slate-900 dark:text-slate-100">
                {onu?.power || (onu?.rxPower != null ? `${onu.rxPower} dBm` : '—')}
              </span>
              <span className="text-xs text-slate-400">Optical Rx</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Target safe range: -12.0 to -24.0 dBm
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">OLT Node:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[130px]" title={onu?.oltName || 'OLT'}>
                {onu?.oltName || 'OLT Link'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">PON Interface:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 font-medium truncate max-w-[130px]">
                {onu?.ponPort || 'EPON/GPON'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Fiber Status:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400 uppercase">{onu?.status || 'Active'}</span>
            </div>
          </div>
        </motion.div>

        {/* CARD 3: Monthly Bandwidth Usage ("saramas a koto gb use korce") */}
        <motion.div
          variants={itemUp}
          whileHover={{ y: -2 }}
          className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Monthly Data Usage
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {usage?.monthName || new Date().toLocaleString('default', { month: 'short' })}
            </span>
          </div>

          <div className="mb-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-display font-extrabold text-slate-900 dark:text-slate-100">
                {usage ? usage.totalGB.toFixed(2) : ((Number(d.network?.downloadBytes ?? 0) + Number(d.network?.uploadBytes ?? 0)) / 1e9).toFixed(2)}
              </span>
              <span className="text-sm font-bold text-slate-500">GB Used</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Total internet traffic this month
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Download className="w-3 h-3 text-blue-500" /> Download:
              </span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {usage ? `${usage.downloadGB.toFixed(2)} GB` : formatTraffic(d.network?.downloadBytes)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Upload className="w-3 h-3 text-emerald-500" /> Upload:
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {usage ? `${usage.uploadGB.toFixed(2)} GB` : formatTraffic(d.network?.uploadBytes)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Disconnects:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {usage?.disconnectCount ?? 0} time{usage?.disconnectCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* CARD 4: Current Package & Validity */}
        <motion.div
          variants={itemUp}
          whileHover={{ y: -2 }}
          className="glass-card rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              Package & Validity
            </span>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                d.billingStatus === 'Paid'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : d.billingStatus === 'Expired'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}
            >
              {d.billingStatus || 'Active'}
            </span>
          </div>

          <div className="mb-3">
            <p className="font-display font-bold text-slate-900 dark:text-slate-100 text-lg truncate">
              {d.packageName || 'Broadband Standard'}
            </p>
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
              {d.planPrice != null ? `৳${d.planPrice.toFixed(0)} / month` : '—'}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Expiry Date:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatDate(d.expiryDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Total Due:</span>
              <span className={`font-bold ${d.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                ৳{d.balance.toFixed(0)}
              </span>
            </div>
            <div className="pt-1">
              <Link
                to="/customer/pay-bill"
                className="w-full py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/25 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-center block transition-colors"
              >
                Renew Package
              </Link>
            </div>
          </div>
        </motion.div>

      </motion.div>

      {/* ────────────────── TWO COLUMN SECTION: CHART & INVOICES ────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Realtime Bandwidth Graph */}
        <motion.section
          variants={itemUp}
          initial="initial"
          animate="animate"
          whileHover={{ y: -1 }}
          className="glass-card rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Monthly Traffic Breakdown
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Total usage recorded for {usage?.monthName || 'current cycle'}
              </p>
            </div>
            <Link
              to="/customer/report"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
            >
              <span>Live Speed</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-44 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageChartData} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `${v.toFixed(1)} GB`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={75} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                  formatter={(value: any) => [`${Number(value).toFixed(2)} GB`, 'Data']}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={600}>
                  {usageChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 gap-3 text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Download: {downVal.toFixed(2)} GB
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Upload: {upVal.toFixed(2)} GB
              </span>
            </div>
            <Link
              to="/customer/report"
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-colors"
            >
              View Session Logs →
            </Link>
          </div>
        </motion.section>

        {/* Payment History & Quick Receipts */}
        <motion.section
          variants={itemUp}
          initial="initial"
          animate="animate"
          whileHover={{ y: -1 }}
          className="glass-card rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Recent Payment History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Past billing statements & gateway receipts
              </p>
            </div>
            <Link
              to="/customer/payment-history"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1">
            {payments.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4">
                <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-xs">No payment history recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto customer-portal-scrollbar rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-left text-xs min-w-[340px] whitespace-nowrap">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Method</th>
                      <th className="px-3.5 py-2.5">Amount</th>
                      <th className="px-3.5 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {payments.slice(0, 4).map((p) => (
                      <tr key={p.paymentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-3.5 py-2.5 font-medium text-slate-700 dark:text-slate-300">{formatDate(p.paidAt)}</td>
                        <td className="px-3.5 py-2.5 uppercase font-bold text-slate-600 dark:text-slate-400">{p.gateway || 'CASH'}</td>
                        <td className="px-3.5 py-2.5 font-semibold text-emerald-600 dark:text-emerald-400">৳{Number(p.amount ?? 0).toFixed(0)}</td>
                        <td className="px-3.5 py-2.5 text-right">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {p.status || 'Paid'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">Need an invoice receipt?</span>
            <Link
              to="/customer/pay-bill"
              className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Pay Outstanding Bill →
            </Link>
          </div>
        </motion.section>

      </div>

      {/* ────────────────── RECENT SUPPORT TICKETS ────────────────── */}
      <motion.section
        variants={itemUp}
        initial="initial"
        animate="animate"
        whileHover={{ y: -1 }}
        className="glass-card rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
              <Ticket className="w-4 h-4 text-amber-500" />
              Technical Support Desk & Tickets
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Submit issues directly to your ISP technical support team
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/customer/ticket"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
            >
              + Create Support Ticket
            </Link>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
            No active support tickets. Your broadband line is operating normally.
          </div>
        ) : (
          <div className="overflow-x-auto customer-portal-scrollbar rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-xs min-w-[420px] whitespace-nowrap">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Ticket #</th>
                  <th className="px-4 py-2.5">Subject</th>
                  <th className="px-4 py-2.5">Created Date</th>
                  <th className="px-4 py-2.5">Desk</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {tickets.map((t) => (
                  <tr key={t.ticket_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">{t.ticket_number}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{t.title}</td>
                    <td className="px-4 py-2.5 text-slate-500">{formatDate(t.created_at)}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{t.assigned_to || 'NOC Support'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>

      {/* Customer Profile Edit Modal */}
      <CustomerProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </motion.div>
  );
}
