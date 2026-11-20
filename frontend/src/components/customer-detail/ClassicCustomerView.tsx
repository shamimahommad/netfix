import { useState } from 'react';
import { CustomerDetailResponse } from '@/types/customer.types';
import { isLifetimeExpiry } from '@/lib/formatExpiry';
import PageHeader from '@/components/common/PageHeader';
import {
  Users,
  User,
  Phone,
  MapPin,
  CreditCard,
  Server,
  Wifi,
  Calendar,
  DollarSign,
  Activity,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Power,
  Lock,
  Unlock,
  FileText,
  Send,
  Eye,
  EyeOff,
  Share2,
  Sliders,
  Receipt,
  Sparkles,
  LayoutGrid,
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
  Network,
  Cpu,
  Clock,
  Radio,
  ArrowLeft,
  ChevronRight,
  ShieldAlert,
  Zap,
} from 'lucide-react';

export interface CustomerViewProps {
  id: string;
  customerData: CustomerDetailResponse['data'];
  displayId: string;
  isSuspended: boolean;
  isLeft: boolean;
  isSuspending: boolean;
  isMarkingLeft: boolean;
  isActivating: boolean;
  isPingLoading: boolean;
  isSyncing: boolean;
  isDisconnecting: boolean;
  copiedMac: string | null;
  macBindingStatus: { hasCallerId: boolean; callerId: string | null } | null;
  currentTemplate: 'modern' | 'classic';
  onTemplateChange: (template: 'modern' | 'classic') => void;
  canConfigureTemplate?: boolean;
  onBack: () => void;
  onEdit: () => void;
  onSms: () => void;
  onLogs: () => void;
  onCash: () => void;
  onRenew: () => void;
  onMigrate: () => void;
  onSuspendRestore: () => void;
  onMarkLeftActivate: () => void;
  onInvoices: () => void;
  onLiveTraffic: () => void;
  onBindMac: () => void;
  onRouterLoginOpen: () => void;
  onPing: () => void;
  onSync: () => void;
  onDisconnectOpen: () => void;
  onCopy: (text: string) => void;
  formatCurrencyBDT: (amount: number | null) => string;
  formatDate: (dateString: string | null) => string;
  formatDateTime: (dateString: string | null | undefined) => string;
  formatUptime: (seconds: number | string | null | undefined) => string;
  formatTraffic: (bytes: number | string | null | undefined) => string;
  getAccountStatusBadgeClass: (status: any) => string;
  getBillingStatusBadgeClass: (status: any) => string;
}

// Sleek Clean InfoRow Component matching NetFix Theme
function InfoRow({ 
  label, 
  value, 
  highlight = false 
}: { 
  label: string; 
  value: React.ReactNode; 
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 last:border-0 ${
      highlight ? 'bg-blue-50/50 dark:bg-blue-950/20 px-2 rounded-lg' : ''
    }`}>
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-right min-w-0 break-words">
        {value}
      </div>
    </div>
  );
}

export default function ClassicCustomerView(props: CustomerViewProps) {
  const {
    customerData,
    displayId,
    isSuspended,
    isLeft,
    isSuspending,
    isMarkingLeft,
    isActivating,
    isPingLoading,
    isSyncing,
    isDisconnecting,
    copiedMac,
    macBindingStatus,
    currentTemplate,
    onTemplateChange,
    onBack,
    onEdit,
    onSms,
    onLogs,
    onCash,
    onRenew,
    onMigrate,
    onSuspendRestore,
    onMarkLeftActivate,
    onInvoices,
    onLiveTraffic,
    onBindMac,
    onRouterLoginOpen,
    onPing,
    onSync,
    onDisconnectOpen,
    onCopy,
    formatCurrencyBDT,
    formatDate,
    formatDateTime,
    formatUptime,
    formatTraffic,
    getAccountStatusBadgeClass,
    getBillingStatusBadgeClass,
  } = props;

  const { customer, billing, network, onu } = customerData;
  const [showPassword, setShowPassword] = useState(false);
  const [billCopied, setBillCopied] = useState(false);

  // Optical Power Level analysis
  const rxPower = onu?.rxPower;
  const isOptimalPower = rxPower != null && rxPower >= -24;
  const isFairPower = rxPower != null && rxPower >= -27 && rxPower < -24;
  const isCriticalPower = rxPower != null && rxPower < -27;

  // Copy Bill Summary for customer communication
  const handleCopyBillSummary = () => {
    const summary = `NetFix Subscriber Notice\n` +
      `--------------------------------\n` +
      `Customer: ${customer.fullName} (${displayId})\n` +
      `Phone: ${customer.phone || 'N/A'}\n` +
      `Package: ${servicePackageName(customerData)} (${formatCurrencyBDT(billing.planPrice) || '—'})\n` +
      `Balance: ${formatCurrencyBDT(billing.balance ?? 0) || '৳0'}\n` +
      `Billing Status: ${billing.billingStatus || 'Active'}\n` +
      `Expiry: ${billing.expiryDate ? (isLifetimeExpiry(billing.expiryDate) ? 'Lifetime' : formatDateTime(billing.expiryDate)) : 'N/A'}\n` +
      `Address: ${customer.installationAddress || customer.area || 'N/A'}\n` +
      `--------------------------------\n` +
      `Thank you for staying connected with NetFix!`;
    navigator.clipboard.writeText(summary);
    setBillCopied(true);
    setTimeout(() => setBillCopied(false), 2000);
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* 1. Standard Unified PageHeader matching NetFix Theme */}
      <PageHeader
        icon={<Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title={`Customer Profile — ${customer.fullName || 'Subscriber'}`}
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 dark:text-slate-200">ID: {displayId}</span>
            <span>•</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/60 font-semibold">
              {network.protocolType ? network.protocolType.toUpperCase() : 'PPPOE'}
            </span>
            <span>•</span>
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              Plan: {servicePackageName(customerData)}
            </span>
          </span>
        }
        onBack={onBack}
        badge={
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
            network.onlineStatus 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' 
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
          }`}>
            <span className={`w-2 h-2 rounded-full ${network.onlineStatus ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {network.onlineStatus ? 'ONLINE' : 'OFFLINE'}
          </span>
        }
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Design Selector Pill */}
            <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-xs">
              <button
                type="button"
                onClick={() => onTemplateChange('classic')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  currentTemplate === 'classic'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Active Classic 3-Column Layout"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Classic</span>
              </button>
              <button
                type="button"
                onClick={() => onTemplateChange('modern')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  currentTemplate === 'modern'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
                title="Switch to Modern Pro Layout"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Modern Pro</span>
              </button>
            </div>

            {/* Quick Bill Copy */}
            <button
              type="button"
              onClick={handleCopyBillSummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shadow-2xs"
              title="Copy customer bill notice to clipboard"
            >
              {billCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5 text-slate-500" />}
              <span>{billCopied ? 'Notice Copied' : 'Copy Notice'}</span>
            </button>

            {/* Edit Customer Profile */}
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          </div>
        }
      />

      {/* 2. The Signature 3-Column Layout (Account, Billing, Server) */}
      <div className="grid grid-cols-12 gap-5 items-start">

        {/* ======================================================== */}
        {/* COLUMN 1: Account Information                            */}
        {/* ======================================================== */}
        <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
                  <User className="w-4 h-4" />
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Account Details
                </h2>
              </div>
              <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${getAccountStatusBadgeClass(billing.accountStatus)}`}>
                {billing.accountStatus ? billing.accountStatus.toUpperCase() : 'ACTIVE'}
              </span>
            </div>

            {/* Subscriber ID & Avatar Banner */}
            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/80">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white font-black text-lg flex items-center justify-center shadow-xs flex-shrink-0">
                {customer.fullName ? customer.fullName.charAt(0).toUpperCase() : 'C'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Subscriber ID
                </p>
                <p className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 truncate">
                  {displayId}
                </p>
              </div>
              {customer.customerCode && customer.customerCode !== displayId && (
                <span className="text-[10px] font-mono font-medium px-2 py-1 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {customer.customerCode}
                </span>
              )}
            </div>

            {/* Account Info Rows */}
            <div className="space-y-1">
              <InfoRow label="Full Name" value={customer.fullName || '—'} />
              <InfoRow label="Address" value={customer.installationAddress || '—'} />
              
              {/* Phone with Call, SMS, WhatsApp Actions */}
              <div className="py-2 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Mobile Number
                  </span>
                  {customer.phone && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${customer.phone}`}
                        className="p-1 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 transition-colors"
                        title="Voice Call"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={onSms}
                        className="p-1 rounded-md bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 hover:bg-teal-100 transition-colors"
                        title="Quick SMS"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                        title="WhatsApp Chat"
                      >
                        <svg className="w-3.5 h-3.5 fill-emerald-600 dark:fill-emerald-400" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {customer.phone || '—'}
                </p>
              </div>

              <InfoRow label="Email" value={customer.email || '—'} />
              <InfoRow label="National ID (NID)" value={customer.nationalId || '—'} />
              <InfoRow label="Date of Birth" value={customer.dob ? formatDate(customer.dob) : '—'} />
              
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  District / Thana
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {[customer.thana, customer.district].filter(Boolean).join(', ') || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Area / Sub Area
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {[customer.area, customer.subArea].filter(Boolean).join(' • ') || '—'}
                </span>
              </div>

              <InfoRow label="Joined Date" value={formatDate(customer.connectionDate || customer.createdAt)} />
              <InfoRow label="Last Updated" value={formatDate(customer.updatedAt)} />
              {customer.internalNotes && (
                <InfoRow label="Notes" value={customer.internalNotes} />
              )}
            </div>
          </div>

          {/* Account Actions Bar (Edit, SMS, Logs) */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2">
            <button 
              type="button"
              onClick={onEdit}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={onSms}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>SMS</span>
            </button>
            <button
              type="button"
              onClick={onLogs}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-xs font-semibold transition-all active:scale-95"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Logs</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2: Billing Information                            */}
        {/* ======================================================== */}
        <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40">
                  <CreditCard className="w-4 h-4" />
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Billing &amp; Subscription
                </h2>
              </div>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${getBillingStatusBadgeClass(billing.billingStatus)}`}>
                {billing.billingStatus || 'Active'}
              </span>
            </div>

            {/* Ledger Balance Banner */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Ledger Balance
                </p>
                <p className={`text-xl font-bold truncate ${
                  (billing.balance ?? 0) < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                }`}>
                  {formatCurrencyBDT(billing.balance ?? 0) || '৳0'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Plan Rate
                </p>
                <p className="text-base font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrencyBDT(billing.planPrice) || '—'}
                </p>
              </div>
            </div>

            {/* Billing Info Rows */}
            <div className="space-y-1">
              <InfoRow label="Protocol Type" value={network.protocolType ? network.protocolType.toUpperCase() : 'PPPOE'} />
              <InfoRow label="Package Plan" value={servicePackageName(customerData)} />
              <InfoRow label="Billing Cycle" value={serviceBillingCycle(customerData)} />
              <InfoRow label="Customer Type" value={serviceCustomerType(customerData)} />
              
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Billing Status
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${getBillingStatusBadgeClass(billing.billingStatus)}`}>
                    {billing.billingStatus || 'Active'}
                  </span>
                  {billing.billingStatus !== 'Left' &&
                    billing.billingStatus !== 'Suspended' &&
                    billing.billingStatus !== 'Pending' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Enabled
                    </span>
                  )}
                </div>
              </div>

              <InfoRow
                label="Expiry Date"
                value={
                  <span className={`font-semibold ${
                    billing.billingStatus === 'Expired' || billing.billingStatus === 'Due' 
                      ? 'text-amber-600 dark:text-amber-400 font-bold' 
                      : ''
                  }`}>
                    {billing.expiryDate ? (isLifetimeExpiry(billing.expiryDate) ? 'Lifetime' : formatDateTime(billing.expiryDate)) : '—'}
                  </span>
                }
              />

              <InfoRow 
                label="Connected By" 
                value={
                  billing.connectedBy ? (
                    <div className="flex items-center gap-1.5 justify-end flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {billing.connectedBy}
                      </span>
                      {billing.connectedByRole && !['admin', 'isp_admin', 'saas_admin'].includes(billing.connectedByRole.toLowerCase()) && (
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                          {billing.connectedByRole.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  ) : 'Admin'
                } 
              />
              <InfoRow label="Location" value={billing.location || '—'} />
            </div>
          </div>

          {/* Billing Actions Grid (Cash, Renew, Migrate, Suspend, Invoices, Left) */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2">
            {/* Cash Pay */}
            <button
              type="button"
              onClick={onCash}
              disabled={billing.billingStatus === 'Left'}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Cash</span>
            </button>

            {/* Renew */}
            <button
              type="button"
              onClick={onRenew}
              disabled={billing.billingStatus === 'Left'}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Renew</span>
            </button>

            {/* Migrate */}
            <button
              type="button"
              onClick={onMigrate}
              disabled={billing.billingStatus !== 'Expired'}
              title={billing.billingStatus !== 'Expired' ? 'Only expired customers can migrate' : undefined}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Migrate</span>
            </button>

            {/* Suspend / Restore */}
            <button
              type="button"
              onClick={onSuspendRestore}
              disabled={isSuspending || network.protocolType !== 'pppoe'}
              title={network.protocolType !== 'pppoe' ? 'Suspend/Restore is only available for PPPoE customers' : (isSuspended ? 'Restore customer' : 'Suspend customer')}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 ${
                isSuspended
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${isSuspending ? 'animate-spin' : ''}`} />
              <span>{isSuspending ? '...' : isSuspended ? 'Restore' : 'Suspend'}</span>
            </button>

            {/* Invoices */}
            <button
              type="button"
              onClick={onInvoices}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-xs font-semibold transition-all active:scale-95"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Invoices</span>
            </button>

            {/* Mark Left / Activate */}
            <button
              type="button"
              onClick={onMarkLeftActivate}
              disabled={isMarkingLeft || isActivating || (isLeft ? network.protocolType !== 'pppoe' : false)}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 ${
                isLeft
                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                  : 'bg-slate-700 hover:bg-slate-800 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Power className={`w-3.5 h-3.5 ${isMarkingLeft || isActivating ? 'animate-spin' : ''}`} />
              <span>{isMarkingLeft ? '...' : isActivating ? '...' : isLeft ? 'Activate' : 'Left'}</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3: Server & Network Information                   */}
        {/* ======================================================== */}
        <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/40">
                  <Server className="w-4 h-4" />
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Network &amp; Server
                </h2>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                network.onlineStatus 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300' 
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${network.onlineStatus ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {network.onlineStatus ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            {/* Server & Credentials */}
            <div className="space-y-1">
              <InfoRow label="MikroTik Server" value={network.serverName || '—'} />
              <InfoRow 
                label="Username (Secret)" 
                value={
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {network.username || '—'}
                  </span>
                } 
              />
              
              {/* Password with Eye Toggle */}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Password
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {showPassword ? (network.password || '—') : '••••••••'}
                  </span>
                  {network.password && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Saved MAC with copy */}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Saved Caller MAC
                </span>
                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                  <span>{network.macAddress || '—'}</span>
                  {network.macAddress && (
                    <button
                      type="button"
                      onClick={() => onCopy(network.macAddress!)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      title="Copy MAC"
                    >
                      {copiedMac === network.macAddress ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Device / Vendor */}
              <InfoRow 
                label="Device Vendor" 
                value={
                  network.deviceVendor && network.deviceVendor !== '—' && network.deviceVendor !== 'Unknown' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                      {network.deviceVendor}
                    </span>
                  ) : (
                    network.deviceVendor || (network.macAddress ? 'Unknown' : '—')
                  )
                } 
              />

              {/* Live Session Telemetry (IP, Uptime, Traffic) */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/80 space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    Active IP Address:
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {network.onlineStatus && network.ipAddress ? (
                      <a 
                        href={`http://${network.ipAddress}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        {network.ipAddress}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    Uptime:
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {network.onlineStatus ? (formatUptime(network.uptime) || '—') : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    Session Traffic:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      ↓ {formatTraffic(network.downloadBytes)}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      ↑ {formatTraffic(network.uploadBytes)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    Last Logout:
                  </span>
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 text-right truncate">
                    {formatDateTime(network.lastLogoutTime) || 'Never'}
                    {network.lastDisconnectReason ? ` (${network.lastDisconnectReason})` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Server Actions Grid (Traffic, Bind, R.Login, Ping, Sync, Disconnect) */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2">
            {/* Traffic Monitor */}
            <button
              type="button"
              onClick={onLiveTraffic}
              disabled={!network.username || !network.serverName || !network.onlineStatus}
              title={!network.onlineStatus ? 'Available when customer is online' : 'Monitor live bandwidth'}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Traffic</span>
            </button>

            {/* Bind / Unbind MAC */}
            <button
              type="button"
              onClick={onBindMac}
              disabled={network.protocolType !== 'pppoe' || !network.onlineStatus}
              title={!network.onlineStatus ? 'Available when customer is online' : undefined}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 ${
                macBindingStatus?.hasCallerId
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {macBindingStatus?.hasCallerId ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{macBindingStatus?.hasCallerId ? 'Unbind' : 'Bind'}</span>
            </button>

            {/* Router Web Login */}
            <button
              type="button"
              onClick={onRouterLoginOpen}
              disabled={!network.onlineStatus}
              title={!network.onlineStatus ? 'Available when customer is online' : undefined}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>R.Login</span>
            </button>

            {/* Ping */}
            <button
              type="button"
              onClick={onPing}
              disabled={isPingLoading || network.protocolType !== 'pppoe' || !network.onlineStatus}
              title={!network.onlineStatus ? 'Available when customer is online' : (network.protocolType !== 'pppoe' ? 'Ping is only for PPPoE customers' : 'Ping customer IP from MikroTik')}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Radio className={`w-3.5 h-3.5 ${isPingLoading ? 'animate-pulse' : ''}`} />
              <span>{isPingLoading ? '...' : 'Ping'}</span>
            </button>

            {/* Sync */}
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing || network.protocolType !== 'pppoe'}
              title={network.protocolType !== 'pppoe' ? 'Sync is only for PPPoE customers' : 'Sync session with MikroTik'}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? '...' : 'Sync'}</span>
            </button>

            {/* Disconnect Session */}
            <button
              type="button"
              onClick={onDisconnectOpen}
              disabled={isDisconnecting || network.protocolType !== 'pppoe' || !network.onlineStatus}
              title={!network.onlineStatus ? 'Customer is already offline' : undefined}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Power className={`w-3.5 h-3.5 ${isDisconnecting ? 'animate-spin' : ''}`} />
              <span>{isDisconnecting ? '...' : 'Cut'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 3. ONU & Optical Link Information Card                   */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-900/40">
              <Cpu className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ONU &amp; Optical Link Telemetry
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                EPON / GPON physical layer &amp; optical power telemetry
              </p>
            </div>
          </div>
          {onu?.olt && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              <Server className="w-3.5 h-3.5 text-blue-500" />
              <span>{onu.olt}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. OLT Device & PON Port */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              OLT Device &amp; Port
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {onu?.olt || '—'}
            </p>
            <p className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
              Port: {onu?.ponId || '—'}
            </p>
          </div>

          {/* 2. ONU MAC & VLAN */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              ONU MAC &amp; VLAN
            </span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
              <span className="truncate">{onu?.onuMac || '—'}</span>
              {onu?.onuMac && (
                <button
                  type="button"
                  onClick={() => onCopy(onu.onuMac!)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  title="Copy ONU MAC"
                >
                  {copiedMac === onu.onuMac ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
            <p className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
              VLAN: {onu?.vlan || '—'}
            </p>
          </div>

          {/* 3. Optical Rx Power Level */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Rx Optical Power</span>
              {onu?.rxPower != null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                  isOptimalPower 
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : isFairPower
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                }`}>
                  {isOptimalPower ? 'Optimal' : isFairPower ? 'Fair' : 'Critical'}
                </span>
              )}
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {onu?.power || (onu?.rxPower != null ? `${onu.rxPower} dBm` : '—')}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Distance: {onu?.distance || '—'}
            </p>
          </div>

          {/* 4. ONU Status & Sync */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Link Status &amp; Sync
            </span>
            <div>
              {onu?.status ? (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  onu.status.toLowerCase() === 'online'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${onu.status.toLowerCase() === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {onu.status.toUpperCase()}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Not Synced</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Updated: {onu?.lastUpdate ? formatDateTime(onu.lastUpdate) : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helpers for nested package/service values
function servicePackageName(customerData: CustomerDetailResponse['data']) {
  return (customerData as any).service?.packageName || customerData.network?.package || '—';
}

function serviceBillingCycle(customerData: CustomerDetailResponse['data']) {
  const cycle = (customerData as any).service?.billingCycle || 'Monthly';
  return cycle ? cycle.charAt(0).toUpperCase() + cycle.slice(1) : '—';
}

function serviceCustomerType(customerData: CustomerDetailResponse['data']) {
  const s = (customerData as any).service;
  if (!s) return 'Retail';
  return s.customerType ? String(s.customerType).charAt(0).toUpperCase() + String(s.customerType).slice(1) : (s.billingType || 'Retail');
}
