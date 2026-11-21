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
  Clock,
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
  DollarSign,
  Radio,
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
} from 'lucide-react';
import { CustomerViewProps } from './ClassicCustomerView';

export default function ModernCustomerView(props: CustomerViewProps) {
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
    hideCustomerPassword,
    canCollectPayment,
    canRecharge,
    canChangePackage,
    canDeleteCustomer,
    canViewInvoice,
    canSendSms,
    pppoeDisconnect,
    pppoeBindMac,
  } = props;

  const { customer, billing, network, onu } = customerData;
  const [showPassword, setShowPassword] = useState(false);
  const [billCopied, setBillCopied] = useState(false);

  // Copy Bill Summary for customer communication (WhatsApp/SMS)
  const handleCopyBillSummary = () => {
    const summary = `NetFix ISP Customer Notice\n` +
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

  // Optical Power Level analysis
  const rxPower = onu?.rxPower;
  const isOptimalPower = rxPower != null && rxPower >= -24;
  const isFairPower = rxPower != null && rxPower >= -27 && rxPower < -24;
  const isCriticalPower = rxPower != null && rxPower < -27;

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* 1. Standard Unified PageHeader */}
      <PageHeader
        icon={<Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title={`Customer 360° Profile — ${customer.fullName || 'Customer'}`}
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
                onClick={() => onTemplateChange('modern')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  currentTemplate === 'modern'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
                title="Current Modern Pro Layout"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Modern Pro</span>
              </button>
              <button
                type="button"
                onClick={() => onTemplateChange('classic')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  currentTemplate === 'classic'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Switch to Classic 3-Column Layout"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Classic</span>
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

            {/* Edit Customer */}
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-xs shadow-md transition-all active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          </div>
        }
      />

      {/* 2. Hero Overview & Key Telemetry Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="grid grid-cols-12 gap-5 items-center">
          {/* Identity & Direct Contacts */}
          <div className="col-span-12 lg:col-span-5 flex items-start gap-4">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-black text-2xl sm:text-3xl flex-shrink-0">
                {customer.fullName ? customer.fullName.charAt(0).toUpperCase() : 'C'}
              </div>
              <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center ${
                network.onlineStatus ? 'bg-emerald-500' : 'bg-rose-500'
              }`}>
                {network.onlineStatus ? (
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </span>
            </div>

            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {customer.fullName || 'Unnamed Customer'}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${getBillingStatusBadgeClass(billing.billingStatus)}`}>
                  {billing.billingStatus || 'Active'}
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${getAccountStatusBadgeClass(billing.accountStatus)}`}>
                  {billing.accountStatus ? billing.accountStatus.toUpperCase() : 'ACTIVE'}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate">{customer.installationAddress || customer.area || 'No address assigned'}</span>
              </p>

              {/* Quick Contact Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-xs transition-colors"
                  title="Direct Phone Call"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{customer.phone || 'Call'}</span>
                </a>
                <button
                  type="button"
                  onClick={onSms}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-xs transition-colors"
                  title="Send Quick SMS"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>SMS</span>
                </button>
                {customer.phone && (
                  <a
                    href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-xs transition-colors"
                    title="Open WhatsApp Chat"
                  >
                    <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    <span>Chat</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* 4 Key Metrics Tiles */}
          <div className="col-span-12 lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* 1. Account Balance */}
            <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                Ledger Balance
              </span>
              <p className={`text-lg font-bold truncate ${(billing.balance ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {formatCurrencyBDT(billing.balance ?? 0) || '৳0'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Rate: {formatCurrencyBDT(billing.planPrice) || '—'}
              </p>
            </div>

            {/* 2. Active Session IP */}
            <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1">
                <Network className="w-3.5 h-3.5 text-indigo-500" />
                Assigned IP
              </span>
              <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 truncate">
                {network.onlineStatus && network.ipAddress ? (
                  <a href={`http://${network.ipAddress}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                    {network.ipAddress}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-400">Offline</span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                Up: {network.onlineStatus ? formatUptime(network.uptime) : '—'}
              </p>
            </div>

            {/* 3. Optical Rx Power */}
            <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-teal-500" />
                Optical Signal
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {onu?.power || (onu?.rxPower != null ? `${onu.rxPower} dBm` : '—')}
              </p>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isOptimalPower ? 'bg-emerald-500' : isFairPower ? 'bg-amber-500' : isCriticalPower ? 'bg-rose-500' : 'bg-slate-400'}`} />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {isOptimalPower ? 'Optimal' : isFairPower ? 'Fair' : isCriticalPower ? 'Critical' : (onu?.status || 'No ONU')}
                </span>
              </div>
            </div>

            {/* 4. Expiry Date */}
            <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Account Expiry
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {billing.expiryDate ? (isLifetimeExpiry(billing.expiryDate) ? 'Lifetime Access' : formatDate(billing.expiryDate)) : '—'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                Cycle: {serviceBillingCycle(customerData)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Action Command Hub (Cleanly Segmented Executive Toolbars) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Operations & Command Center
            </h3>
          </div>
          <span className="text-xs text-slate-400">All customer management & network tools</span>
        </div>

        {/* Action Buttons Hub Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {/* 1. Cash Payment */}
          <button
            type="button"
            onClick={onCash}
            disabled={billing.billingStatus === 'Left' || canCollectPayment === false}
            title={canCollectPayment === false ? 'No permission to collect payments' : undefined}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <DollarSign className="w-4 h-4 flex-shrink-0" />
            <span>Cash Pay</span>
          </button>

          {/* 2. Renew Account */}
          <button
            type="button"
            onClick={onRenew}
            disabled={billing.billingStatus === 'Left' || canRecharge === false}
            title={canRecharge === false ? 'No permission to recharge subscriptions' : undefined}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4 flex-shrink-0" />
            <span>Renew Plan</span>
          </button>

          {/* 3. Migrate Package */}
          <button
            type="button"
            onClick={onMigrate}
            disabled={billing.billingStatus !== 'Expired' || canChangePackage === false}
            title={canChangePackage === false ? 'No permission to change packages' : (billing.billingStatus !== 'Expired' ? 'Only expired customers can migrate' : 'Change customer package plan')}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Receipt className="w-4 h-4 flex-shrink-0" />
            <span>Migrate Plan</span>
          </button>

          {/* 4. Invoices */}
          <button
            type="button"
            onClick={onInvoices}
            disabled={canViewInvoice === false}
            title={canViewInvoice === false ? 'No permission to view invoices' : undefined}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span>Invoices</span>
          </button>

          {/* 5. Suspend / Restore */}
          <button
            type="button"
            onClick={onSuspendRestore}
            disabled={isSuspending || network.protocolType !== 'pppoe'}
            title={network.protocolType !== 'pppoe' ? 'PPPoE customers only' : (isSuspended ? 'Restore customer' : 'Suspend customer')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 ${
              isSuspended
                ? 'bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white'
                : 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500 text-white'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${isSuspending ? 'animate-spin' : ''}`} />
            <span>{isSuspending ? 'Processing...' : isSuspended ? 'Restore' : 'Suspend'}</span>
          </button>

          {/* 6. Left / Activate */}
          <button
            type="button"
            onClick={onMarkLeftActivate}
            disabled={isMarkingLeft || isActivating || canDeleteCustomer === false || (isLeft ? network.protocolType !== 'pppoe' : false)}
            title={canDeleteCustomer === false ? 'No permission to cancel or mark customer left' : undefined}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 ${
              isLeft
                ? 'bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white'
                : 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white'
            }`}
          >
            <Power className="w-4 h-4 flex-shrink-0" />
            <span>{isMarkingLeft ? '...' : isActivating ? '...' : isLeft ? 'Activate' : 'Mark Left'}</span>
          </button>

          {/* 7. Live Traffic Monitoring */}
          <button
            type="button"
            onClick={onLiveTraffic}
            disabled={!network.username || !network.serverName || !network.onlineStatus}
            title={!network.onlineStatus ? 'Available when online' : 'Monitor live customer bandwidth'}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Activity className="w-4 h-4 flex-shrink-0" />
            <span>Live Traffic</span>
          </button>

          {/* 8. Ping Customer */}
          <button
            type="button"
            onClick={onPing}
            disabled={isPingLoading || network.protocolType !== 'pppoe' || !network.onlineStatus}
            title={!network.onlineStatus ? 'Available when online' : 'ICMP Ping customer IP from MikroTik'}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Gauge className={`w-4 h-4 flex-shrink-0 ${isPingLoading ? 'animate-pulse' : ''}`} />
            <span>{isPingLoading ? 'Pinging...' : 'Ping IP'}</span>
          </button>

          {/* 9. Sync Session with MikroTik */}
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing || network.protocolType !== 'pppoe'}
            title="Synchronize PPPoE secret profile with MikroTik"
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 flex-shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Session'}</span>
          </button>

          {/* 10. Router Login Details */}
          <button
            type="button"
            onClick={onRouterLoginOpen}
            disabled={!network.onlineStatus}
            title={!network.onlineStatus ? 'Available when online' : 'Customer CPE Router credentials'}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Cpu className="w-4 h-4 flex-shrink-0" />
            <span>Router CPE</span>
          </button>

          {/* 11. Bind / Unbind MAC */}
          <button
            type="button"
            onClick={onBindMac}
            disabled={network.protocolType !== 'pppoe' || !network.onlineStatus}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              macBindingStatus?.hasCallerId
                ? 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500 text-white'
                : 'bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white'
            }`}
          >
            {macBindingStatus?.hasCallerId ? <Unlock className="w-4 h-4 flex-shrink-0" /> : <Lock className="w-4 h-4 flex-shrink-0" />}
            <span>{macBindingStatus?.hasCallerId ? 'Unbind MAC' : 'Bind MAC'}</span>
          </button>

          {/* 12. Disconnect Active Session */}
          <button
            type="button"
            onClick={onDisconnectOpen}
            disabled={isDisconnecting || network.protocolType !== 'pppoe' || !network.onlineStatus}
            title={!network.onlineStatus ? 'Customer already offline' : 'Terminate active PPPoE interface session'}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500 text-white shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      {/* 4. Bento Grid: Detailed Operational Information Cards */}
      <div className="grid grid-cols-12 gap-6">
        {/* CARD 1: Customer Profile & Demographics */}
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Customer Profile
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Demographic data, contact info & geo-tagging
                </p>
              </div>
              <button
                type="button"
                onClick={() => onLogs()}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Customer Logs →
              </button>
            </div>

            <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Customer ID</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  {displayId}
                  <button
                    type="button"
                    onClick={() => onCopy(displayId)}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                    title="Copy ID"
                  >
                    {copiedMac === displayId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Full Name</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{customer.fullName || '—'}</span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Mobile Phone</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{customer.phone || '—'}</span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Email Address</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{customer.email || '—'}</span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">National ID / DOB</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {customer.nationalId || '—'} {customer.dob ? `(${formatDate(customer.dob)})` : ''}
                </span>
              </div>

              <div className="flex justify-between py-1.5 items-start">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Installation Address</span>
                <span className="font-medium text-slate-900 dark:text-slate-100 text-right max-w-[200px]">
                  {customer.installationAddress || '—'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Area / Sub Area</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {customer.area || '—'} {customer.subArea ? `(${customer.subArea})` : ''}
                </span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">District / Thana</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {customer.district || '—'} • {customer.thana || '—'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Internal Notes</span>
                <span className="text-slate-600 dark:text-slate-400 italic text-right max-w-[200px]">
                  {customer.internalNotes || 'No notes'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs text-slate-400">
            <span>Joined: {formatDate(customer.connectionDate || customer.createdAt)}</span>
            <span>Updated: {formatDate(customer.updatedAt)}</span>
          </div>
        </div>

        {/* CARD 2: Subscription & Billing Intelligence */}
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Plan & Subscription
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Package speed, billing status & ledger history
                </p>
              </div>
              <button
                type="button"
                onClick={onInvoices}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Invoices History →
              </button>
            </div>

            <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Assigned Package</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{servicePackageName(customerData)}</span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Monthly Plan Rate</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrencyBDT(billing.planPrice) || '—'}</span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Account Balance</span>
                <span className={`font-bold ${(billing.balance ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatCurrencyBDT(billing.balance ?? 0) || '৳0'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Billing Cycle</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{serviceBillingCycle(customerData)}</span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Customer Type</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{serviceCustomerType(customerData)}</span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Expiry Timestamp</span>
                <span className={`font-bold ${billing.billingStatus === 'Left' ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>
                  {billing.expiryDate ? (isLifetimeExpiry(billing.expiryDate) ? 'Lifetime Access' : formatDateTime(billing.expiryDate)) : '—'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Onboarding Staff</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{billing.connectedBy || 'Admin'}</span>
                  {billing.connectedByRole && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {billing.connectedByRole}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">POP / Location</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{billing.location || 'Central NOC'}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Discount Applied: ৳0</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Auto-Invoicing Enabled</span>
          </div>
        </div>

        {/* CARD 3: Network & MikroTik Telemetry */}
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  MikroTik Telemetry
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  PPPoE secrets, active MAC binding & session
                </p>
              </div>
              <button
                type="button"
                onClick={onSync}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Sync Secret
              </button>
            </div>

            <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Router / NAS</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{network.serverName || '—'}</span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">PPPoE Username</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  {network.username || '—'}
                  {network.username && (
                    <button
                      type="button"
                      onClick={() => onCopy(network.username!)}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {copiedMac === network.username ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">PPPoE Password</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {hideCustomerPassword || (network as any)?.isPasswordHidden ? '••••••••' : (showPassword ? (network.password || '—') : '••••••••')}
                  </span>
                  {!(hideCustomerPassword || (network as any)?.isPasswordHidden) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      {network.password && (
                        <button
                          type="button"
                          onClick={() => onCopy(network.password!)}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          {copiedMac === network.password ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Bound MAC</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  {network.macAddress || 'Not Bound'}
                  {network.macAddress && (
                    <button
                      type="button"
                      onClick={() => onCopy(network.macAddress!)}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {copiedMac === network.macAddress ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </span>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Active Connected MAC</span>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{network.activeMacAddress || '—'}</span>
                  {network.deviceVendor && network.deviceVendor !== '—' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                      {network.deviceVendor}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Data Consumed</span>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-blue-600 dark:text-blue-400 flex items-center">
                    <ArrowDownRight className="w-3 h-3" />
                    {formatTraffic(network.downloadBytes)}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center">
                    <ArrowUpRight className="w-3 h-3" />
                    {formatTraffic(network.uploadBytes)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between py-1.5 items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Last Disconnect</span>
                <span className="text-slate-700 dark:text-slate-300 text-right">
                  {formatDateTime(network.lastLogoutTime) || 'Never'}
                  {network.lastDisconnectReason ? ` (${network.lastDisconnectReason})` : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Caller ID Lock: {macBindingStatus?.hasCallerId ? 'Active' : 'Disabled'}</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">MikroTik v6/v7 Compatible</span>
          </div>
        </div>

        {/* CARD 4: Optical Link & Fiber Infrastructure (PON / OLT / ONU) */}
        <div className="col-span-12 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Wifi className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Optical Fiber Network & ONU Hardware Infrastructure
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time optical power (dBm), PON port mapping, and hardware provisioning
              </p>
            </div>
            {onu?.olt && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                <Server className="w-3.5 h-3.5" />
                OLT: {onu.olt}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {/* OLT Device */}
            <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">OLT Device</span>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{onu?.olt || '—'}</p>
            </div>

            {/* PON Port */}
            <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">PON Port</span>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{onu?.ponId || '—'}</p>
            </div>

            {/* VLAN ID */}
            <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">VLAN ID</span>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate">
                {onu?.vlan && onu.vlan !== '—' ? `VLAN ${onu.vlan}` : '—'}
              </p>
            </div>

            {/* ONU MAC & Vendor */}
            <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">ONU MAC</span>
              <div className="flex items-center gap-1 font-mono text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                <span>{onu?.onuMac || '—'}</span>
                {onu?.onuMac && (
                  <button
                    type="button"
                    onClick={() => onCopy(onu.onuMac!)}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {copiedMac === onu.onuMac ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
              {onu?.onuVendor && <p className="text-[10px] text-slate-400 truncate">{onu.onuVendor}</p>}
            </div>

            {/* Router MAC */}
            <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Router MAC</span>
              <div className="flex items-center gap-1 font-mono text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                <span>{onu?.routerMac || network.macAddress || network.activeMacAddress || '—'}</span>
                {(onu?.routerMac || network.macAddress) && (
                  <button
                    type="button"
                    onClick={() => onCopy((onu?.routerMac || network.macAddress)!)}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    {copiedMac === (onu?.routerMac || network.macAddress) ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>

            {/* Optical Rx Power with Visual Health */}
            <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Optical Rx Signal</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-bold ${
                  isOptimalPower ? 'text-emerald-600 dark:text-emerald-400' : isFairPower ? 'text-amber-600 dark:text-amber-400' : isCriticalPower ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {onu?.power || (onu?.rxPower != null ? `${onu.rxPower} dBm` : '—')}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  isOptimalPower ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : isFairPower ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : isCriticalPower ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' : 'bg-slate-100 text-slate-600'
                }`}>
                  {isOptimalPower ? 'Good' : isFairPower ? 'Fair' : isCriticalPower ? 'Low' : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function servicePackageName(customerData: CustomerDetailResponse['data']) {
  return (customerData as any).service?.packageName || (customerData.network as any)?.package || '—';
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
