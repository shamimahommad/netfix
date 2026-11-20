import React from 'react';
import { CustomerDetailResponse } from '@/types/customer.types';
import { isLifetimeExpiry } from '@/lib/formatExpiry';
import { LayoutGrid, Sparkles } from 'lucide-react';

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

// Classic SVG Icons
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

function CalendarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

function ChartBarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function DevicePhoneMobileIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function DocumentTextIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

function CopyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
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

function ArrowLeftIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function CurrencyDollarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SignalIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ArrowPathIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ExclamationTriangleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function RouterIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  );
}

function InfoRow({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex justify-between gap-1 sm:gap-2 min-w-0">
      <div className="flex gap-1 sm:gap-2 min-w-0 flex-1">
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium flex-shrink-0 w-24 sm:w-28">{label}:</p>
        <div className="text-xs sm:text-base font-semibold text-slate-900 dark:text-slate-100 min-w-0 flex-1 break-words">
          {value}
        </div>
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-sky-50 via-teal-50/30 to-cyan-50 dark:from-slate-900 dark:via-sky-950/30 dark:to-slate-900 p-2 sm:p-4">
      <div className="w-full max-w-7xl mx-auto space-y-3 sm:space-y-4">
        {/* Header: back + title + status + template switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={onBack}
              className="flex-shrink-0 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-white/80 dark:bg-slate-800/80 border border-sky-200/60 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-teal-400 hover:bg-sky-50/80 dark:hover:bg-sky-900/20 shadow-sm hover:shadow-md transition-all duration-300"
              title="Back to Customers"
            >
              <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 sm:gap-2 truncate min-w-0">
              <UserIcon className="w-5 h-5 sm:w-6 sm:h-6 text-sky-500 dark:text-teal-400 flex-shrink-0" />
              <span className="truncate">Customer Information</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Design switcher pill */}
            <div className="inline-flex items-center bg-white/90 dark:bg-slate-800/90 border border-sky-200 dark:border-slate-700 rounded-xl p-1 shadow-xs">
              <button
                type="button"
                onClick={() => onTemplateChange('classic')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  currentTemplate === 'classic'
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Current Classic Layout"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Classic</span>
              </button>
              <button
                type="button"
                onClick={() => onTemplateChange('modern')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  currentTemplate === 'modern'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
                title="Switch to New Modern Pro Layout"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Modern Pro</span>
              </button>
            </div>

            <span className={`inline-flex flex-shrink-0 px-2 py-1 sm:px-4 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold border-2 ${getAccountStatusBadgeClass(billing.accountStatus)} shadow-sm whitespace-nowrap`}>
              {billing.accountStatus ? billing.accountStatus.charAt(0).toUpperCase() + billing.accountStatus.slice(1) : 'Unknown'}
            </span>
          </div>
        </div>

        {/* Three Panel Layout */}
        <div className="grid grid-cols-12 gap-3 sm:gap-4">
          {/* LEFT: Account Information */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 rounded-xl sm:rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-sky-200/60 dark:border-slate-600/80 shadow-xl shadow-sky-500/5 p-3 sm:p-5 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10 hover:border-sky-300/80 dark:hover:border-teal-500/30">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/40">
                <UserIcon className="w-5 h-5 text-sky-600 dark:text-teal-400" />
              </span>
              Account Information
            </h2>
            <div className="space-y-3">
              <div className="flex gap-3 pb-3 border-b border-sky-200/60 dark:border-slate-600">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-400 to-teal-500 flex flex-shrink-0 items-center justify-center shadow-lg shadow-sky-500/20">
                  <UserIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer ID</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{displayId}</p>
                </div>
              </div>

              <div className="space-y-2">
                <InfoRow label="Name" value={customer.fullName} />
                <InfoRow label="Address" value={customer.installationAddress || '—'} />
                <div>
                  <div className="flex justify-between mb-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Mobile No:</p>
                    <div className="flex gap-1">
                      <a href={`tel:${customer.phone}`} className="p-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white transition-all duration-300 hover:scale-110 hover:shadow-md" title="Call">
                        <PhoneIcon className="w-4 h-4" />
                      </a>
                      <a href={`sms:${customer.phone}`} className="p-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white transition-all duration-300 hover:scale-110 hover:shadow-md" title="SMS">
                        <DevicePhoneMobileIcon className="w-4 h-4" />
                      </a>
                      <a href={`https://wa.me/${customer.phone?.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white transition-all duration-300 hover:scale-110 hover:shadow-md" title="WhatsApp">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{customer.phone || '—'}</p>
                </div>
                <InfoRow label="Email" value={customer.email || '—'} />
                <div className="flex justify-between gap-4">
                  <div className="flex gap-2 flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">NID No:</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{customer.nationalId || '—'}</p>
                  </div>
                  <div className="flex gap-2 flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">DOB:</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{customer.dob ? formatDate(customer.dob) : '—'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 py-1 text-sm">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">District:</span>
                  <span className="text-slate-800 dark:text-slate-100 font-medium">{customer.district || '—'}</span>
                  <span className="text-slate-300 dark:text-slate-500 select-none">·</span>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Thana:</span>
                  <span className="text-slate-800 dark:text-slate-100 font-medium">{customer.thana || '—'}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Area:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{customer.area || '—'}</span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span className="text-gray-600 dark:text-gray-400">Sub Area:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{customer.subArea || '—'}</span>
                </div>
                <InfoRow label="Notes" value={customer.internalNotes || '—'} />
                <div className="flex justify-between gap-4">
                  <div className="flex gap-2 flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Join:</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{formatDate(customer.connectionDate || customer.createdAt)}</p>
                  </div>
                  <div className="flex gap-2 flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Update:</p>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{formatDate(customer.updatedAt)}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-sky-200/60 dark:border-slate-600 mt-3 grid grid-cols-3 gap-1 sm:gap-2">
                <button 
                  onClick={onEdit}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md min-w-0"
                >
                  <DocumentTextIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Edit</span>
                </button>
                <button
                  type="button"
                  onClick={onSms}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md min-w-0"
                >
                  <DevicePhoneMobileIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">SMS</span>
                </button>
                <button
                  onClick={onLogs}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-sky-600 hover:bg-sky-700 dark:bg-teal-700 dark:hover:bg-teal-600 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md min-w-0"
                >
                  <DocumentTextIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Logs</span>
                </button>
              </div>
            </div>
          </div>

          {/* MIDDLE: Billing Information */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 rounded-xl sm:rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-sky-200/60 dark:border-slate-600/80 shadow-xl shadow-sky-500/5 p-3 sm:p-5 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10 hover:border-sky-300/80 dark:hover:border-teal-500/30">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/40">
                <CreditCardIcon className="w-5 h-5 text-sky-600 dark:text-teal-400" />
              </span>
              Billing Information
            </h2>
            <div className="space-y-2">
              <InfoRow label="Protocol Type" value={network.protocolType ? network.protocolType.toUpperCase() : '—'} />
              <InfoRow label="Package Plan" value={servicePackageName(customerData)} />
              <InfoRow
                label="Balance"
                value={
                  <span className={`font-bold ${(billing.balance ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {formatCurrencyBDT(billing.balance ?? 0) || '৳0'}
                  </span>
                }
              />
              <InfoRow label="Plan Price" value={<span className="font-bold">{formatCurrencyBDT(billing.planPrice) || '—'}</span>} />
              <InfoRow label="Discount" value="0" />
              <InfoRow label="Billing Cycle" value={serviceBillingCycle(customerData)} />
              <InfoRow label="Customer Type" value={serviceCustomerType(customerData)} />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium">Billing Status:</p>
                <div className="flex gap-2">
                  <span className={`inline-flex px-3 py-1 rounded-lg text-sm font-semibold border-2 ${getBillingStatusBadgeClass(billing.billingStatus)}`}>
                    {billing.billingStatus === 'Paid'
                      ? 'Active'
                      : billing.billingStatus === 'Expired'
                        ? 'Expired'
                        : billing.billingStatus === 'Due'
                          ? 'Due'
                          : billing.billingStatus === 'Left'
                            ? 'Left'
                            : billing.billingStatus === 'Suspended'
                              ? 'Suspended'
                              : billing.billingStatus === 'Pending'
                                ? 'Pending'
                                : 'Active'}
                  </span>
                  {billing.billingStatus !== 'Left' &&
                    billing.billingStatus !== 'Suspended' &&
                    billing.billingStatus !== 'Pending' && (
                    <>
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-ping" />
                      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Enabled</span>
                    </>
                  )}
                </div>
              </div>
              <InfoRow
                label="Expiry Date"
                value={
                  <span className={billing.billingStatus === 'Left' ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}>
                    {billing.expiryDate ? (isLifetimeExpiry(billing.expiryDate) ? 'Lifetime' : formatDateTime(billing.expiryDate)) : '—'}
                  </span>
                }
              />
              <InfoRow 
                label="Connected By" 
                value={
                  billing.connectedBy ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {billing.connectedBy}
                      </span>
                      {billing.connectedByRole && !['admin', 'isp_admin', 'saas_admin'].includes(billing.connectedByRole.toLowerCase()) && (
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                          {billing.connectedByRole.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  ) : 'Admin'
                } 
              />
              <InfoRow label="Location" value={billing.location || '—'} />

              <div className="pt-3 border-t border-sky-200/60 dark:border-slate-600 mt-3 grid grid-cols-3 gap-1 sm:gap-2">
                <button
                  onClick={onCash}
                  disabled={billing.billingStatus === 'Left'}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 min-w-0"
                >
                  <CurrencyDollarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Cash</span>
                </button>
                <button
                  onClick={onRenew}
                  disabled={billing.billingStatus === 'Left'}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 min-w-0"
                >
                  <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Renew</span>
                </button>
                <button
                  onClick={onMigrate}
                  disabled={billing.billingStatus !== 'Expired'}
                  title={billing.billingStatus !== 'Expired' ? 'Only expired customers can migrate' : undefined}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed min-w-0"
                >
                  <DocumentTextIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Migrate</span>
                </button>
                <button
                  onClick={onSuspendRestore}
                  disabled={isSuspending || network.protocolType !== 'pppoe'}
                  title={network.protocolType !== 'pppoe' ? 'Suspend/Restore is only available for PPPoE customers' : (isSuspended ? 'Restore customer' : 'Suspend customer')}
                  className={`flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md min-w-0 ${
                    isSuspended
                      ? 'bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white'
                      : 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                >
                  <ExclamationTriangleIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${isSuspending ? 'animate-spin' : ''}`} />
                  <span className="truncate">{isSuspending ? '...' : isSuspended ? 'Restore' : 'Suspend'}</span>
                </button>
                <button
                  onClick={onInvoices}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-sky-600 hover:bg-sky-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md min-w-0"
                >
                  <DocumentTextIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Invoices</span>
                </button>
                <button
                  onClick={onMarkLeftActivate}
                  disabled={isMarkingLeft || isActivating || (isLeft ? network.protocolType !== 'pppoe' : false)}
                  className={`flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-0 ${
                    isLeft ? 'bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white' : 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white'
                  }`}
                >
                  {isMarkingLeft || isActivating ? (
                    <ArrowPathIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 animate-spin" />
                  ) : (
                    <ChartBarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  )}
                  <span className="truncate">{isMarkingLeft ? '...' : isActivating ? '...' : isLeft ? 'Activate' : 'Left'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Server Information */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 rounded-xl sm:rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-sky-200/60 dark:border-slate-600/80 shadow-xl shadow-sky-500/5 p-3 sm:p-5 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10 hover:border-sky-300/80 dark:hover:border-teal-500/30">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/40">
                <ServerIcon className="w-5 h-5 text-sky-600 dark:text-teal-400" />
              </span>
              Server Information
            </h2>
            <div className="space-y-2">
              <InfoRow label="Server" value={network.serverName || '—'} />
              <InfoRow label="Username" value={network.username || '—'} />
              <InfoRow label="Password" value={network.password || '—'} />
              <InfoRow label="Save Mac" value={network.macAddress || '—'} />
              <InfoRow 
                label="Device/Vendor" 
                value={
                  network.deviceVendor && network.deviceVendor !== '—' && network.deviceVendor !== 'Unknown' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800/60 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                      {network.deviceVendor}
                    </span>
                  ) : (
                    network.deviceVendor || (network.macAddress ? 'Unknown' : '—')
                  )
                } 
              />
              <InfoRow label="Active Mac" value={network.activeMacAddress || '—'} />
              
              {/* Grouped Status Info */}
              <div className="pt-3 border-t border-sky-200/60 dark:border-slate-600 space-y-2">
                <div className="flex gap-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400 w-20 font-medium">Status:</p>
                  <div className="flex gap-2">
                    <div className={`w-3 h-3 rounded-full ${network.onlineStatus ? 'bg-green-500 animate-ping' : 'bg-red-500'}`} />
                    <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {network.onlineStatus ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
                {network.onlineStatus ? (
                  <>
                    <div className="flex gap-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400 w-20 font-medium">IP:</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {network.ipAddress ? (
                          <a href={`http://${network.ipAddress}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-mono transition-colors">
                            {network.ipAddress}
                          </a>
                        ) : '—'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400 w-20 font-medium">Uptime:</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{formatUptime(network.uptime) || '—'}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400 w-20 font-medium">IP:</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">—</p>
                    </div>
                    <div className="flex gap-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400 w-20 font-medium">Uptime:</p>
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">—</p>
                    </div>
                  </>
                )}
                <div className="flex gap-2 items-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 w-20 font-medium">MAC:</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100 font-mono flex items-center gap-1.5">
                    <span>{network.activeMacAddress || network.macAddress || onu?.routerMac || '—'}</span>
                    {(network.activeMacAddress || network.macAddress || onu?.routerMac) && (
                      <button
                        type="button"
                        onClick={() => onCopy((network.activeMacAddress || network.macAddress || onu?.routerMac)!)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                        title="Copy MAC"
                      >
                        {copiedMac === (network.activeMacAddress || network.macAddress || onu?.routerMac) ? (
                          <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <CopyIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400 w-20 font-medium flex-shrink-0">Last Logout:</p>
                  <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 min-w-0">
                    {formatDateTime(network.lastLogoutTime) || 'Never'}
                    {network.lastDisconnectReason ? (
                      <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                        ({network.lastDisconnectReason})
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 w-20 font-medium flex-shrink-0">Traffic:</p>
                  <div className="flex items-center gap-3 min-w-0 flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Download:</span>
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {formatTraffic(network.downloadBytes)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Upload:</span>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatTraffic(network.uploadBytes)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-sky-200/60 dark:border-slate-600 mt-3 grid grid-cols-3 gap-1 sm:gap-2">
                <button
                  onClick={onLiveTraffic}
                  disabled={!network.username || !network.serverName || !network.onlineStatus}
                  title={!network.onlineStatus ? 'Available when customer is online' : 'Monitor live bandwidth'}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-0"
                >
                  <ChartBarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Traffic</span>
                </button>
                <button
                  onClick={onBindMac}
                  disabled={network.protocolType !== 'pppoe' || !network.onlineStatus}
                  title={!network.onlineStatus ? 'Available when customer is online' : undefined}
                  className={`flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-0 ${
                    macBindingStatus?.hasCallerId
                      ? 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500 text-white'
                      : 'bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white'
                  }`}
                >
                  <WifiIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">{macBindingStatus?.hasCallerId ? 'Unbind' : 'Bind'}</span>
                </button>
                <button
                  onClick={onRouterLoginOpen}
                  disabled={!network.onlineStatus}
                  title={!network.onlineStatus ? 'Available when customer is online' : undefined}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-0"
                >
                  <RouterIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">R.Login</span>
                </button>
                <button
                  onClick={onPing}
                  disabled={isPingLoading || network.protocolType !== 'pppoe' || !network.onlineStatus}
                  title={!network.onlineStatus ? 'Available when customer is online' : (network.protocolType !== 'pppoe' ? 'Ping is only for PPPoE customers' : 'Ping customer IP from MikroTik')}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-0"
                >
                  <SignalIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${isPingLoading ? 'animate-pulse' : ''}`} />
                  <span className="truncate">{isPingLoading ? '...' : 'Ping'}</span>
                </button>
                <button
                  type="button"
                  onClick={onSync}
                  disabled={isSyncing || network.protocolType !== 'pppoe'}
                  title={network.protocolType !== 'pppoe' ? 'Sync is only for PPPoE customers' : 'Sync session with MikroTik'}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-sky-600 hover:bg-sky-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-0"
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="truncate">{isSyncing ? '...' : 'Sync'}</span>
                </button>
                <button
                  type="button"
                  onClick={onDisconnectOpen}
                  disabled={isDisconnecting || network.protocolType !== 'pppoe' || !network.onlineStatus}
                  title={!network.onlineStatus ? 'Customer is already offline' : undefined}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-0"
                >
                  <XMarkIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${isDisconnecting ? 'animate-spin' : ''}`} />
                  <span className="truncate">{isDisconnecting ? '...' : 'Disconnect'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM: ONU & Optical Link Information */}
        <div className="rounded-xl sm:rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-sky-200/60 dark:border-slate-600/80 shadow-xl shadow-sky-500/5 p-3 sm:p-5 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/40">
                <WifiIcon className="w-5 h-5 text-sky-600 dark:text-teal-400" />
              </span>
              <span>ONU & Optical Link Details</span>
            </h2>
            {onu?.olt && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                <ServerIcon className="w-3.5 h-3.5" />
                {onu.olt}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            <InfoRow label="OLT Device" value={onu?.olt || '—'} />
            <InfoRow label="PON Port" value={onu?.ponId || '—'} />
            <InfoRow 
              label="VLAN ID" 
              value={
                onu?.vlan && onu.vlan !== '—' ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono text-xs font-semibold border border-blue-200 dark:border-blue-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                    VLAN {onu.vlan}
                  </span>
                ) : '—'
              } 
            />
            <InfoRow 
              label="ONU MAC" 
              value={
                onu?.onuMac ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 font-mono">
                      <span>{onu.onuMac}</span>
                      <button
                        type="button"
                        onClick={() => onCopy(onu.onuMac!)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                        title="Copy ONU MAC"
                      >
                        {copiedMac === onu.onuMac ? (
                          <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <CopyIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    {onu.onuVendor && onu.onuVendor !== 'Unknown' && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {onu.onuVendor}
                      </span>
                    )}
                  </div>
                ) : '—'
              } 
            />
            <InfoRow 
              label="Router MAC" 
              value={
                (onu?.routerMac || network.macAddress || network.activeMacAddress) ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      <span>{onu?.routerMac || network.macAddress || network.activeMacAddress}</span>
                      <button
                        type="button"
                        onClick={() => onCopy((onu?.routerMac || network.macAddress || network.activeMacAddress)!)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                        title="Copy Router MAC"
                      >
                        {copiedMac === (onu?.routerMac || network.macAddress || network.activeMacAddress) ? (
                          <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <CopyIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    {network.deviceVendor && network.deviceVendor !== '—' && network.deviceVendor !== 'Unknown' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                        <span className="w-1 h-1 rounded-full bg-indigo-500 inline-block" />
                        {network.deviceVendor}
                      </span>
                    )}
                  </div>
                ) : '—'
              } 
            />
            <InfoRow 
              label="Rx Power" 
              value={
                onu?.rxPower != null ? (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border font-medium ${
                    onu.rxPower >= -24
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                      : onu.rxPower >= -27
                      ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                      : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                  }`}>
                    <span className="font-bold">{onu.power}</span>
                    <span className="text-[10px] opacity-80">
                      ({onu.rxPower >= -24 ? 'Optimal' : onu.rxPower >= -27 ? 'Fair' : 'Critical Low'})
                    </span>
                  </span>
                ) : (
                  onu?.power || '—'
                )
              } 
            />
            <InfoRow 
              label="Link Status" 
              value={
                onu?.status ? (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    onu.status.toLowerCase() === 'online'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${onu.status.toLowerCase() === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    {onu.status.toUpperCase()}
                  </span>
                ) : '—'
              } 
            />
            <InfoRow label="Optical Link" value={onu?.distance || (onu?.status ? onu.status.charAt(0).toUpperCase() + onu.status.slice(1) : '—')} />
            <InfoRow label="Last Synced" value={onu?.lastUpdate ? formatDateTime(onu.lastUpdate) : '—'} />
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
