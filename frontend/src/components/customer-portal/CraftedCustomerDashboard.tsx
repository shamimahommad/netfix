import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Router,
  Radio,
  HardDrive,
  Zap,
  Copy,
  Check,
  ArrowUpRight,
  BarChart3,
  FileText,
  Ticket,
  PhoneCall,
  Wifi,
  WifiOff,
  Download,
  Upload,
  Calendar,
  Layers,
  UserCog,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  CustomerDashboardData,
  CustomerPaymentHistoryItem,
} from '@/services/customer-portal.service';
import { useCustomerPortalProfile } from '@/contexts/CustomerPortalContext';
import { CustomerProfileModal } from './CustomerProfileModal';

interface CraftedDashboardProps {
  data: CustomerDashboardData;
  payments: CustomerPaymentHistoryItem[];
  tickets: any[];
  copyText: (text: string, type: 'mac' | 'id') => void;
  copiedMac: boolean;
  copiedId: boolean;
}

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
  if (bytes == null || bytes === 0) return '0.00 GB';
  const gb = Number(bytes) / 1e9;
  return `${gb.toFixed(2)} GB`;
}

export function CraftedCustomerDashboard({
  data,
  payments,
  tickets,
  copyText,
  copiedMac,
  copiedId,
}: CraftedDashboardProps) {
  const { setDesignMode } = useCustomerPortalProfile();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const d = data;
  const isOnline = Boolean(d.network?.onlineStatus);
  const companyName = d.company?.name || 'Broadband ISP';
  const onu = d.onu;
  const router = d.router;
  const usage = d.monthlyUsage;

  const downVal = usage ? usage.downloadGB : Number(d.network?.downloadBytes ?? 0) / 1e9;
  const upVal = usage ? usage.uploadGB : Number(d.network?.uploadBytes ?? 0) / 1e9;
  const totalVal = usage ? usage.totalGB : downVal + upVal;

  const usageChartData = [
    { name: 'Download', value: Math.max(0.01, downVal), fill: '#2563eb' },
    { name: 'Upload', value: Math.max(0.01, upVal), fill: '#059669' },
  ];

  // Laser Status Configuration & Signal Scale
  const rx = onu?.rxPower;
  const getLaserInfo = (status?: string, val?: number | null) => {
    if (val === null || val === undefined || status === 'offline' || val > -8) {
      return {
        label: 'Offline / LOS',
        textColor: 'text-slate-600 dark:text-slate-400',
        badgeBg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
        barColor: 'bg-slate-400',
        barPercent: 0,
      };
    }
    // Expected range: -8 dBm (too strong) down to -32 dBm (too weak)
    // Optimal window: -12 to -24 dBm
    // Map -8 to -32 onto 100% to 0%
    const clamped = Math.max(-32, Math.min(-8, val));
    const percent = Math.round(((clamped - (-32)) / ((-8) - (-32))) * 100);

    if (val >= -24.0) {
      return {
        label: 'Optimal Link',
        textColor: 'text-emerald-700 dark:text-emerald-400',
        badgeBg: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80',
        barColor: 'bg-emerald-500',
        barPercent: percent,
      };
    }
    if (val >= -27.0) {
      return {
        label: 'Warning Attenuation',
        textColor: 'text-amber-700 dark:text-amber-400',
        badgeBg: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/80',
        barColor: 'bg-amber-500',
        barPercent: percent,
      };
    }
    return {
      label: 'Critical High Loss',
      textColor: 'text-rose-700 dark:text-rose-400',
      badgeBg: 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800/80',
      barColor: 'bg-rose-500',
      barPercent: percent,
    };
  };

  const laserInfo = getLaserInfo(onu?.laserStatus, rx);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ────────────────── 1. SUBSCRIBER TELEMETRY HEADER ────────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] p-5 sm:p-6 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Identity & Technical Metadata */}
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {companyName}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {isOnline ? 'PPPoE Session Online' : 'PPPoE Offline'}
              </span>

              <span className="text-slate-400 hidden sm:inline">|</span>

              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Design: <strong className="text-slate-700 dark:text-slate-300 font-semibold">Crafted UI</strong>
              </span>

              <button
                type="button"
                onClick={() => setDesignMode('classic')}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium ml-1"
                title="Switch back to Classic design"
              >
                <Layers className="w-3 h-3" />
                Switch to Classic UI
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Welcome, {d.customer.fullName}
              </h1>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200/80 dark:border-slate-700 transition-colors"
                title="Edit your name, phone, and address"
              >
                <UserCog className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Edit Profile</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-mono pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">ID:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{d.customer.customerCode}</span>
                <button
                  type="button"
                  onClick={() => copyText(d.customer.customerCode, 'id')}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Copy Subscriber ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <span>·</span>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">PPPoE:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {d.network?.username || d.customer.customerCode}
                </span>
              </div>

              {d.company?.supportPhone && (
                <>
                  <span>·</span>
                  <a
                    href={`tel:${d.company.supportPhone}`}
                    className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-sans transition-colors"
                  >
                    <PhoneCall className="w-3 h-3" />
                    Support: {d.company.supportPhone}
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Billing & Action Section */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between lg:justify-end gap-3 sm:gap-4 shrink-0 border-t lg:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
            <div className="text-left sm:text-left lg:text-right">
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Billing Account</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {d.balance > 0 ? (
                  <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">Due ৳{d.balance.toFixed(0)}</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">Balance ৳0.00</span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Expiry: {formatDate(d.expiryDate)}
              </p>
            </div>

            <Link
              to="/customer/pay-bill"
              className="w-full sm:w-auto text-center justify-center inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98] shrink-0 whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
              <span className="whitespace-nowrap">{d.balance > 0 ? 'Pay Outstanding Bill' : 'Renew Subscription'}</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
            </Link>
          </div>
        </div>
      </section>

      {/* ────────────────── 2. FOUR TELEMETRY INSTRUMENTS ────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* CARD 1: Connected Router & Gateway */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Router className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Gateway Router
              </span>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate" title={router?.routerName}>
              {router?.routerName || 'MikroTik Gateway'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              Vendor: {router?.deviceVendor || 'Standard Router'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">MAC:</span>
              <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                <span>{router?.macAddress || '—'}</span>
                {router?.macAddress && router.macAddress !== '—' && (
                  <button
                    type="button"
                    onClick={() => copyText(router.macAddress, 'mac')}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title="Copy MAC Address"
                  >
                    {copiedMac ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">IP:</span>
              <span className="text-slate-700 dark:text-slate-300">{router?.currentIp || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Uptime:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {router?.uptimeFormatted || '0m'}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: Optical Power (ONU Laser) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Optical Rx Power
              </span>
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold ${laserInfo.badgeBg}`}>
                {laserInfo.label}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {rx != null ? `${rx.toFixed(2)} dBm` : (onu?.power || '—')}
              </span>
              <span className="text-[11px] font-mono text-slate-400">Laser Rx</span>
            </div>

            {/* Visual Signal Gauge Track */}
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${laserInfo.barColor}`}
                  style={{ width: `${laserInfo.barPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Optimal: -12.0 to -24.0 dBm
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">OLT:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={onu?.oltName}>
                {onu?.oltName || 'OLT Gateway'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">PON Port:</span>
              <span className="text-slate-700 dark:text-slate-300">{onu?.ponPort || 'PON 0/1'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Fiber State:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                {onu?.status || 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: Monthly Bandwidth Usage */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Monthly Usage
              </span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold">
                {usage?.monthName || new Date().toLocaleString('default', { month: 'short' })}
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {totalVal.toFixed(2)}
              </span>
              <span className="text-xs font-mono font-semibold text-slate-400">GB Total</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Recorded monthly subscriber transfer
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <Download className="w-3 h-3 text-blue-600 dark:text-blue-400" /> Down:
              </span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {downVal.toFixed(2)} GB
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <Upload className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Up:
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {upVal.toFixed(2)} GB
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Disconnects:</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {usage?.disconnectCount ?? 0} time{usage?.disconnectCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 4: Current Package & Validity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Plan & Validity
              </span>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                  d.billingStatus === 'Paid'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : d.billingStatus === 'Expired'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {d.billingStatus || 'Active'}
              </span>
            </div>

            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
              {d.packageName || 'Broadband Standard'}
            </p>
            <p className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
              {d.planPrice != null ? `৳${d.planPrice.toFixed(0)} / month` : '—'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Expiry:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(d.expiryDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Total Due:</span>
              <span className={`font-bold ${d.balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                ৳{d.balance.toFixed(0)}
              </span>
            </div>
            <div className="pt-1">
              <Link
                to="/customer/pay-bill"
                className="w-full py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-center block transition-colors font-sans text-xs"
              >
                Renew Plan →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────── 3. ANALYTICS & RECENT INVOICES ────────────────── */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Monthly Traffic Breakdown */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Monthly Traffic Breakdown
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Aggregated volume for {usage?.monthName || 'current cycle'}
              </p>
            </div>
            <Link
              to="/customer/report"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Live Speed Graph</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-44 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageChartData} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `${v.toFixed(1)} GB`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={75} />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                  formatter={(value: any) => [`${Number(value).toFixed(2)} GB`, 'Data']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={400}>
                  {usageChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 gap-3 text-xs font-mono">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                Down: {downVal.toFixed(2)} GB
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Up: {upVal.toFixed(2)} GB
              </span>
            </div>
            <Link
              to="/customer/report"
              className="text-xs font-sans text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              View Connection Logs →
            </Link>
          </div>
        </section>

        {/* Payment History & Ledger */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Recent Payment Statements
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Verified billing receipts & gateway transactions
              </p>
            </div>
            <Link
              to="/customer/payment-history"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Full History</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1">
            {payments.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4">
                <FileText className="w-7 h-7 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-slate-400 text-xs">No previous payment statements found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto customer-portal-scrollbar rounded-lg border border-slate-100 dark:border-slate-800">
                <table className="w-full text-left text-xs font-mono min-w-[340px] whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payments.slice(0, 4).map((p) => (
                      <tr key={p.paymentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 font-sans">{formatDate(p.paidAt)}</td>
                        <td className="px-3 py-2.5 uppercase font-semibold text-slate-600 dark:text-slate-400">{p.gateway || 'CASH'}</td>
                        <td className="px-3 py-2.5 font-bold text-emerald-600 dark:text-emerald-400">৳{Number(p.amount ?? 0).toFixed(0)}</td>
                        <td className="px-3 py-2.5 text-right font-sans">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
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
            <span className="text-slate-400">Need to settle monthly dues?</span>
            <Link
              to="/customer/pay-bill"
              className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Pay Online via Gateway →
            </Link>
          </div>
        </section>
      </div>

      {/* ────────────────── 4. TECHNICAL SUPPORT TICKETS ────────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Technical Support Desk
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ISP NOC line diagnostics & subscriber inquiries
            </p>
          </div>
          <div>
            <Link
              to="/customer/ticket"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95"
            >
              <span>+ Open Support Ticket</span>
            </Link>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            No active technical tickets logged. Fiber link is performing normally.
          </div>
        ) : (
          <div className="overflow-x-auto customer-portal-scrollbar rounded-lg border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-xs font-mono min-w-[420px] whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-3.5 py-2">Ticket #</th>
                  <th className="px-3.5 py-2">Subject</th>
                  <th className="px-3.5 py-2">Created</th>
                  <th className="px-3.5 py-2">Desk</th>
                  <th className="px-3.5 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tickets.map((t) => (
                  <tr key={t.ticket_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-3.5 py-2.5 font-bold text-blue-600 dark:text-blue-400">{t.ticket_number}</td>
                    <td className="px-3.5 py-2.5 font-sans font-medium text-slate-800 dark:text-slate-200">{t.title}</td>
                    <td className="px-3.5 py-2.5 text-slate-500 font-sans">{formatDate(t.created_at)}</td>
                    <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 font-sans">{t.assigned_to || 'NOC Team'}</td>
                    <td className="px-3.5 py-2.5 text-right font-sans">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Customer Profile Edit Modal */}
      <CustomerProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </div>
  );
}
