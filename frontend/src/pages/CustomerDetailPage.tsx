import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { customersService } from '@/services/customers.service';
import { CustomerDetailResponse } from '@/types/customer.types';
import { serviceAreaService } from '@/services/service-area.service';
import { ServiceArea } from '@/types/service-area.types';
import { useToastContext } from '@/contexts/ToastContext';
import { smsService } from '@/services/sms.service';
import { billingService } from '@/services/billing.service';
import { networkPackagesService } from '@/services/network-packages.service';
import { NetworkPackage } from '@/types/network.types';
import { paymentsService } from '@/services/payments.service';
import { usersService, ReceivedByOption } from '@/services/users.service';
import { formatCustomerIdDisplay } from '@/lib/formatCustomerId';
import { isLifetimeExpiry } from '@/lib/formatExpiry';
import { useAuthStore } from '@/stores/authStore';

// Icon Components (matching project pattern)
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

function CalendarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

function ClockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function PlusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function KeyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
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

function RouterIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
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

function BanknotesIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-2V9a2 2 0 012-2h2a2 2 0 012 2v6m-6 10a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2" />
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

// Status color helper
const getAccountStatusBadgeClass = (status: 'active' | 'suspended' | 'expired' | 'free' | null): string => {
  const classes: Record<string, string> = {
    active: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-400 dark:from-green-900/40 dark:to-emerald-900/40 dark:text-green-300 dark:border-green-600',
    suspended: 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border-orange-400 dark:from-orange-900/40 dark:to-amber-900/40 dark:text-orange-300 dark:border-orange-600',
    expired: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-400 dark:from-red-900/40 dark:to-rose-900/40 dark:text-red-300 dark:border-red-600',
    free: 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border-blue-400 dark:from-blue-900/40 dark:to-indigo-900/40 dark:text-blue-300 dark:border-blue-600',
  };
  return classes[status || ''] || 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border-gray-400 dark:from-gray-900/40 dark:to-slate-900/40 dark:text-gray-300 dark:border-gray-600';
};

const getBillingStatusBadgeClass = (status: 'Paid' | 'Due' | 'Expired' | 'Left' | 'Suspended' | 'Pending' | null): string => {
  const classes: Record<string, string> = {
    Paid: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-400 dark:from-green-900/40 dark:to-emerald-900/40 dark:text-green-300 dark:border-green-600',
    Due: 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border-orange-400 dark:from-orange-900/40 dark:to-amber-900/40 dark:text-orange-300 dark:border-orange-600',
    Expired: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-400 dark:from-red-900/40 dark:to-rose-900/40 dark:text-red-300 dark:border-red-600',
    Left: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-amber-400 dark:from-amber-900/40 dark:to-yellow-900/40 dark:text-amber-300 dark:border-amber-600 font-bold',
    Suspended: 'bg-gradient-to-r from-red-200 to-red-300 text-red-900 border-red-600 dark:from-red-900/60 dark:to-red-800/60 dark:text-red-100 dark:border-red-500 font-semibold',
    Pending: 'bg-gradient-to-r from-slate-100 to-gray-200 text-slate-800 border-slate-400 dark:from-slate-800/50 dark:to-gray-800/50 dark:text-slate-200 dark:border-slate-600 font-semibold',
  };
  return classes[status || ''] || 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border-gray-400 dark:from-gray-900/40 dark:to-slate-900/40 dark:text-gray-300 dark:border-gray-600';
};

// Format helpers
const formatCurrencyBDT = (amount: number | null): string => {
  if (amount === null || amount === undefined) return '';
  return '৳' + new Intl.NumberFormat('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '—';
  const cleanStr = String(dateString).trim();
  if (cleanStr.startsWith('1970') || cleanStr.startsWith('jan/01/1970') || cleanStr.startsWith('0000') || cleanStr === '—' || cleanStr.toLowerCase() === 'never') {
    return 'Never';
  }
  let date = new Date(cleanStr.replace(' ', 'T'));
  if (isNaN(date.getTime())) {
    // Handle RouterOS date string format like 'nov/06/2026 18:38:50'
    date = new Date(cleanStr.replace(/\//g, ' '));
  }
  if (isNaN(date.getTime())) {
    // Return raw date string if parsing fails
    return cleanStr;
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${day}-${month}-${year} ${String(displayHours).padStart(2, '0')}:${minutes} ${ampm}`;
};

const formatUptime = (seconds: number | string | null | undefined): string => {
  if (seconds === null || seconds === undefined || seconds === '') return '—';
  if (typeof seconds === 'string') {
    if (isNaN(Number(seconds))) {
      return seconds;
    }
    seconds = Number(seconds);
  }
  if (seconds <= 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
};

const formatTraffic = (bytes: number | string | null | undefined): string => {
  if (bytes === null || bytes === undefined) return '0 GB';
  const num = Number(bytes);
  if (isNaN(num) || num <= 0) return '0 GB';
  const gb = num / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  if (gb >= 0.01) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = num / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${(num / (1024 * 1024 * 1024)).toFixed(3)} GB`;
};


export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToastContext();
  const { user } = useAuthStore();
  const [customerData, setCustomerData] = useState<CustomerDetailResponse['data'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [isAddAreaModalOpen, setIsAddAreaModalOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [isRouterModalOpen, setIsRouterModalOpen] = useState(false);
  const [routerData, setRouterData] = useState({
    routerIp: '',
    routerModel: '',
    routerPort: '80',
    routerUsername: '',
    routerPassword: '',
  });
  const [isSavingRouter, setIsSavingRouter] = useState(false);
  const [macBindingStatus, setMacBindingStatus] = useState<{ hasCallerId: boolean; callerId: string | null } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isCashReceivedModalOpen, setIsCashReceivedModalOpen] = useState(false);
  const [cashReceivedForm, setCashReceivedForm] = useState({
    amount: '',
    notes: '',
    receivedByUserId: '',
    receivedByRole: '',
    sendSms: true,
  });
  const [receivedByOptions, setReceivedByOptions] = useState<ReceivedByOption[]>([]);
  const [isLoadingReceivedBy, setIsLoadingReceivedBy] = useState(false);
  const [isSubmittingCashReceived, setIsSubmittingCashReceived] = useState(false);
  const [packages, setPackages] = useState<NetworkPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [isMarkingLeft, setIsMarkingLeft] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [renewForm, setRenewForm] = useState({
    billing_cycle: 'Monthly' as 'Monthly' | 'Day-based',
    no_of_month: 1,
    selected_days: 30,
    plan_id: '',
    plan_price: 0,
    send_sms: false,
    renew_as_reseller: false,
    pay_from_customer_balance: false,
  });
  const [isChangePackageModalOpen, setIsChangePackageModalOpen] = useState(false);
  const [changePackageForm, setChangePackageForm] = useState({ plan_id: '', plan_price: 0 });
  const [isChangingPackage, setIsChangingPackage] = useState(false);
  const [changePackagePackages, setChangePackagePackages] = useState<NetworkPackage[]>([]);
  const [isLoadingChangePackagePackages, setIsLoadingChangePackagePackages] = useState(false);
  const [isPingModalOpen, setIsPingModalOpen] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; address?: string; uptime?: string; lines: string[]; bandwidthLines: string[]; error?: string } | null>(null);
  const [isPingLoading, setIsPingLoading] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<{ username?: string; mikrotikDetailLines?: string[]; message?: string; error?: string; secretExists?: boolean } | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const [copiedMac, setCopiedMac] = useState<string | null>(null);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);

  const handleCopy = (text: string) => {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text);
    setCopiedMac(text);
    setTimeout(() => setCopiedMac(null), 2000);
  };

  useEffect(() => {
    if (id) {
      loadCustomerDetail();
      loadAreas();
    }
  }, [id]);

  // Show "taking longer" message after 2.5s to set expectations on slow networks (e.g. mobile)
  useEffect(() => {
    if (!isLoading || !id) return;
    const t = setTimeout(() => setSlowLoad(true), 2500);
    return () => clearTimeout(t);
  }, [isLoading, id]);
  useEffect(() => {
    if (!isLoading) setSlowLoad(false);
  }, [isLoading]);

  useEffect(() => {
    if (id && customerData && customerData.network.protocolType === 'pppoe') {
      loadMacStatus();
    }
  }, [id, customerData]);

  // Open renew modal when navigated from customer list with state.openRenew
  useEffect(() => {
    const openRenew = (location.state as { openRenew?: boolean })?.openRenew;
    if (customerData && openRenew) {
      setIsRenewModalOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [customerData, location.state, location.pathname, navigate]);

  const loadMacStatus = async () => {
    if (!id) return;
    try {
      const response = await customersService.getMacStatus(id);
      const d = response?.data || response;
      setMacBindingStatus({
        hasCallerId: Boolean(d?.hasCallerId),
        callerId: d?.callerId || null,
      });
    } catch (err) {
      // If API fails, assume no caller-id
      setMacBindingStatus({ hasCallerId: false, callerId: null });
    }
  };

  useEffect(() => {
    if (isCashReceivedModalOpen) {
      loadReceivedByOptions();
    }
  }, [isCashReceivedModalOpen]);

  useEffect(() => {
    if (isRenewModalOpen && customerData) {
      // Initialize form with current customer data
      if (customerData.service && customerData.billing) {
        setRenewForm({
          billing_cycle: customerData.service.billingCycle === 'monthly' ? 'Monthly' : 'Day-based',
          no_of_month: 1,
          selected_days: 30,
          plan_id: '', // Will be set when packages load
          plan_price: customerData.billing.planPrice || 0,
          send_sms: false,
          renew_as_reseller: false,
          pay_from_customer_balance: false,
        });
      }
      // Load packages after form initialization
      loadPackagesForRenew();
    }
  }, [isRenewModalOpen, customerData]);

  useEffect(() => {
    if (isChangePackageModalOpen && customerData) {
      setChangePackageForm({
        plan_id: '',
        plan_price: customerData.billing.planPrice || 0,
      });
      loadPackagesForChangePackage();
    }
  }, [isChangePackageModalOpen, customerData]);

  const loadPackagesForChangePackage = async () => {
    if (!customerData) return;
    setIsLoadingChangePackagePackages(true);
    try {
      let allPackages: NetworkPackage[] = [];
      let page = 1;
      let hasMore = true;
      const maxPages = 50;
      while (hasMore && page <= maxPages) {
        const response = await networkPackagesService.list({ page, limit: 100 });
        if (!response?.data) break;
        const pagePackages = response.data || [];
        allPackages = [...allPackages, ...pagePackages];
        const totalPages = response.meta?.totalPages || 1;
        hasMore = pagePackages.length === 100 && page < totalPages;
        page++;
      }
      const validPackages = allPackages.filter((pkg) => pkg.id);
      setChangePackagePackages(validPackages);
      let activePackage: NetworkPackage | null = null;
      if (customerData.service.packageName && validPackages.length > 0) {
        activePackage = validPackages.find((pkg) => pkg.name === customerData.service.packageName) || null;
        if (!activePackage && customerData.billing.planPrice) {
          activePackage = validPackages.find((pkg) => pkg.price === customerData.billing.planPrice) || null;
        }
      }
      if (activePackage?.id) {
        setChangePackageForm((prev) => ({
          ...prev,
          plan_id: activePackage!.id,
          plan_price: activePackage!.price || 0,
        }));
      }
    } catch (err) {
      console.error('Failed to load packages for migration:', err);
      setChangePackagePackages([]);
    } finally {
      setIsLoadingChangePackagePackages(false);
    }
  };

  const handleChangePackage = async () => {
    if (!id || !customerData) return;
    if (!changePackageForm.plan_id) {
      toast.error('Please select a package');
      return;
    }
    const selectedPackage = changePackagePackages.find((pkg) => pkg.id === changePackageForm.plan_id);
    if (selectedPackage?.name === customerData.service.packageName) {
      toast.error('Selected package is already the current package');
      return;
    }
    setIsChangingPackage(true);
    try {
      const result = await billingService.changePackage({
        customer_id: id,
        plan_id: changePackageForm.plan_id,
        plan_price: changePackageForm.plan_price,
      });
      if (result.success) {
        toast.success(result.message || 'Migration successful');
        setIsChangePackageModalOpen(false);
        loadCustomerDetail();
      } else {
        toast.error(result.message || 'Failed to migrate');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to migrate');
    } finally {
      setIsChangingPackage(false);
    }
  };

  const loadPackagesForRenew = async () => {
    if (!customerData) return;
    setIsLoadingPackages(true);
    try {
      // Load all packages - fetch multiple pages if needed
      let allPackages: NetworkPackage[] = [];
      let page = 1;
      let hasMore = true;
      const maxPages = 50; // Safety limit to prevent infinite loops
      
      while (hasMore && page <= maxPages) {
        const response = await networkPackagesService.list({
          page,
          limit: 100,
        });
        
        if (!response || !response.data) {
          break;
        }
        
        const pagePackages = response.data || [];
        allPackages = [...allPackages, ...pagePackages];
        
        // Check if there are more pages
        const totalPages = response.meta?.totalPages || 1;
        hasMore = pagePackages.length === 100 && page < totalPages;
        page++;
      }
      
      // Filter out packages with invalid IDs before setting
      const validPackages = allPackages.filter((pkg) => pkg.id);
      setPackages(validPackages);
      
      // Find and auto-select current/active package
      let activePackage: NetworkPackage | null = null;
      if (customerData.service.packageName && validPackages.length > 0) {
        // Try to match by exact package name first (backend returns 'name', not 'profileName')
        activePackage = validPackages.find(
          (pkg) => pkg.name === customerData.service.packageName
        ) || null;
        
        // If exact match not found, try to match by price
        if (!activePackage && customerData.billing.planPrice) {
          activePackage = validPackages.find(
            (pkg) => pkg.price === customerData.billing.planPrice
          ) || null;
        }
      }
      
      // Auto-select active package if found
      if (activePackage && activePackage.id) {
        setRenewForm((prev) => ({
          ...prev,
          plan_id: activePackage!.id,
          plan_price: activePackage!.price || 0,
        }));
      }
    } catch (err: any) {
      console.error('Failed to load packages:', err);
      // Silently handle package loading errors - showError will be called if needed
      console.error('Failed to load packages:', err);
      setPackages([]); // Set empty array on error
    } finally {
      setIsLoadingPackages(false);
    }
  };

  // Get the active/running plan ID for highlighting
  const getActivePlanId = (): string | null => {
    if (!customerData || !customerData.service.packageName) return null;
    const activePackage = packages.find(
      (pkg) => pkg.name === customerData.service.packageName
    );
    return activePackage?.id || null;
  };

  // Calculate new expiry date based on form inputs
  const calculateNewExpiryDate = (): string | null => {
    if (!customerData || !customerData.billing.expiryDate) return null;
    
    const oldExpireDate = new Date(customerData.billing.expiryDate);
    let newExpireDate: Date;

    if (renewForm.billing_cycle === 'Monthly') {
      if (!renewForm.no_of_month || renewForm.no_of_month < 1) return null;
      newExpireDate = new Date(oldExpireDate);
      newExpireDate.setMonth(newExpireDate.getMonth() + renewForm.no_of_month);
    } else {
      // Day-based
      if (!renewForm.selected_days || renewForm.selected_days < 1) return null;
      newExpireDate = new Date(oldExpireDate);
      newExpireDate.setDate(newExpireDate.getDate() + renewForm.selected_days);
    }

    return newExpireDate.toISOString();
  };

  const handleRenew = async () => {
    if (!id || !customerData) return;

    // Validate form
    if (!renewForm.plan_id) {
      toast.error('Please select a plan');
      return;
    }

    if (renewForm.billing_cycle === 'Monthly' && (!renewForm.no_of_month || renewForm.no_of_month < 1)) {
      toast.error('Please enter number of months');
      return;
    }

    if (renewForm.billing_cycle === 'Day-based' && (!renewForm.selected_days || renewForm.selected_days < 1)) {
      toast.error('Please select number of days');
      return;
    }

    // Calculate values for success message
    const selectedPackage = packages.find((pkg) => pkg.id === renewForm.plan_id);
    const packageName = selectedPackage?.name || 'Selected Package';
    const billAmount = renewForm.billing_cycle === 'Monthly' && renewForm.no_of_month
      ? (renewForm.plan_price * renewForm.no_of_month).toFixed(0)
      : renewForm.billing_cycle === 'Day-based' && renewForm.selected_days
      ? ((renewForm.plan_price / 30) * renewForm.selected_days).toFixed(0)
      : '0';
    
    const newExpiryDate = calculateNewExpiryDate();
    const formattedNewExpiry = newExpiryDate 
      ? new Date(newExpiryDate).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(',', '')
      : 'N/A';

    setIsRenewing(true);

    try {
      const hasCustomerBalance = (customerData.billing.balance ?? 0) !== 0;
      const payload = {
        customer_id: id,
        old_expire_date: customerData.billing.expiryDate || new Date().toISOString(),
        billing_cycle: renewForm.billing_cycle,
        no_of_month: renewForm.billing_cycle === 'Monthly' ? renewForm.no_of_month : undefined,
        selected_days: renewForm.billing_cycle === 'Day-based' ? renewForm.selected_days : undefined,
        plan_id: renewForm.plan_id,
        plan_price: renewForm.plan_price,
        send_sms: renewForm.send_sms,
        renew_as_reseller: renewForm.renew_as_reseller,
        pay_from_customer_balance: hasCustomerBalance ? renewForm.pay_from_customer_balance : false,
      };

      const response = await billingService.renewService(payload);
      
      if (response.success) {
        toast.success(`Service renewed successfully! New Expiry: ${formattedNewExpiry}, Bill: ৳${Number(billAmount).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
        setIsRenewModalOpen(false);
        // Reload customer data to show updated expiry
        loadCustomerDetail();
      }
    } catch (err: any) {
      console.error('Renewal failed:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      
      // Extract detailed error message
      let errorMessage = 'Failed to renew service. Please try again.';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsRenewing(false);
    }
  };

  const loadReceivedByOptions = async () => {
    setIsLoadingReceivedBy(true);
    try {
      const list = await usersService.getReceivedByOptions();
      setReceivedByOptions(list);
      if (list.length > 0 && !cashReceivedForm.receivedByUserId) {
        setCashReceivedForm((prev) => ({
          ...prev,
          receivedByUserId: list[0].userId,
          receivedByRole: list[0].roleCode,
        }));
      }
    } catch {
      setReceivedByOptions([]);
    } finally {
      setIsLoadingReceivedBy(false);
    }
  };

  const handleRecordCashReceived = async () => {
    if (!id) return;
    const amount = parseFloat(cashReceivedForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!cashReceivedForm.receivedByUserId?.trim()) {
      toast.error('Please select Received By');
      return;
    }
    setIsSubmittingCashReceived(true);
    try {
      await paymentsService.recordPayment({
        customerId: id,
        amount,
        paymentMethod: 'Cash',
        notes: cashReceivedForm.notes.trim() || undefined,
        receivedByUserId: cashReceivedForm.receivedByUserId,
        receivedByRole: cashReceivedForm.receivedByRole || undefined,
        sendSms: cashReceivedForm.sendSms,
      });
      toast.success(`Cash received: ৳${amount} recorded successfully`);
      setIsCashReceivedModalOpen(false);
      setCashReceivedForm({ amount: '', notes: '', receivedByUserId: '', receivedByRole: '', sendSms: true });
      loadCustomerDetail();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to record cash received';
      toast.error(msg);
    } finally {
      setIsSubmittingCashReceived(false);
    }
  };

  const isLeft = customerData?.billing?.billingStatus === 'Left' || customerData?.customer?.status === 'terminated' || customerData?.customer?.status === 'cancelled';

  const handleMarkLeft = async () => {
    if (!id) return;
    if (isLeft) {
      toast.info('Customer is already marked as Left.');
      return;
    }
    const result = await Swal.fire({
      title: 'Mark as Left?',
      html: 'This will set <strong>Customer Status</strong> to Left, <strong>Billing Status</strong> to Left, show Expiry Date in yellow, and delete the PPPoE secret from MikroTik (if PPPoE).',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Mark Left',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#64748b',
    });
    if (!result.isConfirmed) return;
    setIsMarkingLeft(true);
    try {
      await customersService.markLeft(id);
      toast.success('Customer marked as Left. PPPoE secret removed from MikroTik if applicable.');
      loadCustomerDetail();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to mark customer as Left';
      toast.error(msg);
    } finally {
      setIsMarkingLeft(false);
    }
  };

  const handleActivate = async () => {
    if (!id) return;
    if (!isLeft) {
      toast.info('Customer is not Left.');
      return;
    }
    const swalResult = await Swal.fire({
      title: 'Activate Customer?',
      html: 'PPPoE secret will be re-created on MikroTik.<br/><strong>Expired billing</strong> → Expired_Profile<br/><strong>Active billing</strong> → package profile',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Activate',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0d9488',
      cancelButtonColor: '#64748b',
    });
    if (!swalResult.isConfirmed) return;
    setIsActivating(true);
    try {
      const result = await customersService.activateFromLeft(id);
      toast.success(result.message);
      loadCustomerDetail();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to activate customer';
      toast.error(msg);
    } finally {
      setIsActivating(false);
    }
  };

  const handlePing = async () => {
    if (!id) return;
    setIsPingModalOpen(true);
    setPingResult(null);
    setIsPingLoading(true);
    try {
      const result = await customersService.pingCustomer(id);
      setPingResult(result);
      if (!result.success && result.error) {
        toast.error(result.error);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Ping failed';
      toast.error(msg);
      setPingResult({ success: false, lines: [], bandwidthLines: [], error: msg });
    } finally {
      setIsPingLoading(false);
    }
  };

  const loadRouterData = async () => {
    if (!id || !customerData) return;
    try {
      const response = await customersService.getCustomerRouter(id);
      if (response.data) {
        setRouterData({
          routerIp: response.data.routerIp || customerData?.network.ipAddress || '',
          routerModel: response.data.routerModel || '',
          routerPort: response.data.routerPort || '80',
          routerUsername: response.data.routerUsername || '',
          routerPassword: response.data.routerPassword || '',
        });
      } else {
        // Initialize with customer IP if no saved data
        setRouterData({
          routerIp: customerData?.network.ipAddress || '',
          routerModel: '',
          routerPort: '80',
          routerUsername: '',
          routerPassword: '',
        });
      }
    } catch (err: any) {
      // If API fails (e.g., table doesn't exist yet or network error), initialize with customer IP
      console.warn('Failed to load router data:', err);
      setRouterData({
        routerIp: customerData?.network.ipAddress || '',
        routerModel: '',
        routerPort: '80',
        routerUsername: '',
        routerPassword: '',
      });
    }
  };

  const loadAreas = async () => {
    try {
      const response = await serviceAreaService.listAreas();
      setAreas(response.data || []);
    } catch (err) {
      console.error('Failed to load areas:', err);
    }
  };

  const loadCustomerDetail = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await customersService.getCustomerDetail(id);
      // API may return { customer, service, network, billing, onu } or { success, data: { ... } }
      const detail =
        data && typeof data === 'object' && 'customer' in data
          ? data
          : (data as { data?: { customer?: unknown } })?.data;
      if (detail && typeof detail === 'object' && detail.customer) {
        setCustomerData(detail as CustomerDetailResponse['data']);
        setIsSuspended((detail as { network?: { isSuspended?: boolean } })?.network?.isSuspended ?? false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load customer details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRouter = async () => {
    if (!id || !routerData.routerIp) {
      return;
    }
    setIsSavingRouter(true);
    try {
      await customersService.saveCustomerRouter(id, routerData);
      toast.success('Router details saved successfully.');
      setIsRouterModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save router details.');
    } finally {
      setIsSavingRouter(false);
    }
  };

  const handleRouterLogin = () => {
    if (!routerData.routerIp) {
      alert('Please enter Router IP first.');
      return;
    }
    const port = (routerData.routerPort || '80').trim();
    const url = port === '80' ? `http://${routerData.routerIp}` : `http://${routerData.routerIp}:${port}`;
    window.open(url, '_blank');
  };

  const handleSendQuickSms = async () => {
    const targetPhone = smsPhone.trim() || customerData?.customer.mobileNumber || customerData?.customer.phone;
    if (!targetPhone) {
      toast.error('Recipient phone number is required');
      return;
    }
    if (!smsMessage.trim()) {
      toast.error('Please enter SMS message body');
      return;
    }

    setIsSendingSms(true);
    try {
      await smsService.send({
        toNumbers: [targetPhone],
        message: smsMessage.trim(),
      });
      toast.success(`SMS successfully dispatched to ${targetPhone}`);
      setIsSmsModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to send SMS');
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleBindMac = async () => {
    if (!id || !customerData) return;

    const hasCallerId = macBindingStatus?.hasCallerId || false;
    const isOnline = customerData.network.onlineStatus;

    if (hasCallerId) {
      // Unbind MAC
      const macAddr = macBindingStatus?.callerId || customerData.network.macAddress || '';
      const result = await Swal.fire({
        title: 'Unbind MAC?',
        html: `Are you sure you want to unbind the MAC address <strong>${macAddr}</strong>? This will remove the caller-id from the PPPoE secret.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0d9488',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, unbind',
      });
      if (!result.isConfirmed) return;
      try {
        await customersService.bindMac(id);
        setMacBindingStatus({ hasCallerId: false, callerId: null });
        await Swal.fire({ title: 'Done', text: 'MAC address unbound successfully from PPPoE secret.', icon: 'success', timer: 1000, showConfirmButton: false });
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to unbind MAC address.';
        await Swal.fire({ title: 'Error', text: msg, icon: 'error' });
      }
    } else {
      // Bind MAC from active session
      if (!isOnline) {
        await Swal.fire({
          title: 'Customer offline',
          text: 'Customer must be online to bind MAC address. Please wait for the customer to connect.',
          icon: 'info',
        });
        return;
      }

      const activeMac = customerData.network.activeMacAddress;
      if (!activeMac || activeMac.trim() === '') {
        await Swal.fire({
          title: 'No active MAC',
          text: 'No active MAC address found. Customer must be online with an active session to bind MAC.',
          icon: 'info',
        });
        return;
      }

      const result = await Swal.fire({
        title: 'Bind MAC?',
        html: `Bind MAC address <strong>${activeMac}</strong> from active PPPoE session to this customer's secret?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#0d9488',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, bind',
      });
      if (!result.isConfirmed) return;
      try {
        await customersService.bindMac(id);
        setMacBindingStatus({ hasCallerId: true, callerId: activeMac });
        await Swal.fire({ title: 'Done', text: `MAC address "${activeMac}" bound successfully to PPPoE secret.`, icon: 'success', timer: 1000, showConfirmButton: false });
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to bind MAC address.';
        await Swal.fire({ title: 'Error', text: msg, icon: 'error' });
      }
    }
  };

  const handleSync = async () => {
    if (!id || !customerData) return;

    setIsSyncing(true);
    try {
      const response = await customersService.syncSession(id);
      if (response.success) {
        const d = response.data;
        if (d) {
          setSyncResult({
            username: d.username,
            mikrotikDetailLines: d.mikrotikDetailLines,
            message: d.message,
            secretExists: d.secretExists,
          });
        }
        await loadCustomerDetail();
        if (customerData.network.protocolType === 'pppoe') {
          await loadMacStatus();
        }
      } else {
        setSyncResult({ error: response.message || 'Sync failed.' });
      }
    } catch (err: any) {
      setSyncResult({ error: err?.message || 'Failed to sync session data.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleProvisionToRouter = async () => {
    if (!id || !customerData) return;
    setIsProvisioning(true);
    try {
      const response = await customersService.provisionToMikrotik(id);
      if (response.success) {
        toast.success(response.message || 'Secret provisioned successfully to MikroTik router');
        const d = response.data;
        if (d) {
          setSyncResult({
            username: d.username,
            mikrotikDetailLines: d.mikrotikDetailLines,
            message: response.message,
            secretExists: d.secretExists,
          });
        }
        await loadCustomerDetail();
        if (customerData.network.protocolType === 'pppoe') {
          await loadMacStatus();
        }
      } else {
        toast.error(response.message || 'Failed to provision secret to router');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Provisioning failed');
    } finally {
      setIsProvisioning(false);
    }
  };

  const confirmDisconnectSession = async () => {
    if (!id || !customerData) return;

    setIsDisconnecting(true);
    try {
      const response = await customersService.disconnectSession(id);
      if (response.success) {
        toast.success(response.message || 'Session disconnected successfully.');
        setIsDisconnectModalOpen(false);
        // Reload customer data to show updated status
        await loadCustomerDetail();
        // Reload MAC status if PPPoE
        if (customerData.network.protocolType === 'pppoe') {
          await loadMacStatus();
        }
      } else {
        toast.error(response.message || 'Failed to disconnect session.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to disconnect session.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSuspendRestore = async () => {
    if (!id || !customerData) return;

    if (customerData.network.protocolType !== 'pppoe') {
      toast.error('Suspend/Restore is only available for PPPoE customers.');
      return;
    }

    setIsSuspending(true);
    try {
      const response = await customersService.toggleSuspendRestore(id);
      if (response.success) {
        toast.success(response.message);
        const suspended = response.action === 'suspended';
        // Update suspended state and button text (Restore / Suspend)
        setIsSuspended(suspended);
        // Optimistically update billing status and account status so UI shows "Suspended" and badge immediately
        setCustomerData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            billing: {
              ...prev.billing,
              billingStatus: suspended ? 'Suspended' : 'Paid',
              accountStatus: suspended ? 'suspended' : 'active',
            },
            network: {
              ...prev.network,
              isSuspended: suspended,
            },
          };
        });
        // Reload customer data to stay in sync with server
        await loadCustomerDetail();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to suspend/restore customer.');
    } finally {
      setIsSuspending(false);
    }
  };


  const handleAddArea = async () => {
    if (!newAreaName.trim()) return;
    setIsCreatingArea(true);
    try {
      await serviceAreaService.createArea({ name: newAreaName.trim() });
      setNewAreaName('');
      setIsAddAreaModalOpen(false);
      await loadAreas();
    } catch (err: any) {
      alert(err.message || 'Failed to create area.');
    } finally {
      setIsCreatingArea(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-sky-50 via-teal-50/30 to-cyan-50 dark:from-slate-900 dark:via-sky-950/30 dark:to-slate-900 p-2 sm:p-4">
        <div className="w-full max-w-7xl mx-auto space-y-3 sm:space-y-4">
          {/* Skeleton header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            </div>
            <div className="h-8 w-20 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
          </div>
          {/* Skeleton cards - match real layout */}
          <div className="grid grid-cols-12 gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="col-span-12 md:col-span-6 lg:col-span-4 rounded-xl sm:rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-sky-200/60 dark:border-slate-600/80 p-3 sm:p-5">
                <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-700 animate-pulse mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="flex justify-between gap-2">
                      <div className="h-4 flex-1 max-w-[40%] rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                      <div className="h-4 flex-1 max-w-[50%] rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600 grid grid-cols-3 gap-1 sm:gap-2">
                  {[1, 2, 3].map((k) => (
                    <div key={k} className="h-9 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Spinner + status message */}
          <div className="flex flex-col items-center justify-center gap-3 py-4">
            <div
              className="w-10 h-10 rounded-full border-2 border-sky-200 dark:border-slate-600 border-t-sky-600 dark:border-t-teal-400 animate-spin"
              aria-hidden
            />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading customer details…</p>
            {slowLoad && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Taking longer than usual. Please wait…</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error || !customerData || !customerData.customer) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-sky-50 via-teal-50/30 to-cyan-50 dark:from-slate-900 dark:via-sky-950/30 dark:to-slate-900 p-4">
        <div className="w-full max-w-7xl mx-auto space-y-4">
          <button
            onClick={() => navigate('/dashboard/customers')}
            className="flex items-center gap-2 px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-teal-400 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-sky-200/60 dark:border-slate-600 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 font-medium"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to Customers
          </button>
          <div className="rounded-2xl bg-red-50/80 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 shadow-sm">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">{error || 'Customer not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const customer = customerData?.customer || ({} as any);
  const service = customerData?.service || ({} as any);
  const network = customerData?.network || ({} as any);
  const billing = customerData?.billing || ({} as any);
  const onu = customerData?.onu || ({} as any);
  const displayId = formatCustomerIdDisplay(customer?.customerCode ?? '');

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-sky-50 via-teal-50/30 to-cyan-50 dark:from-slate-900 dark:via-sky-950/30 dark:to-slate-900 p-2 sm:p-4">
      <div className="w-full max-w-7xl mx-auto space-y-3 sm:space-y-4">
        {/* Header: back + title + status - compact on mobile */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate('/dashboard/customers')}
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
          <span className={`inline-flex flex-shrink-0 px-2 py-1 sm:px-4 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold border-2 ${getAccountStatusBadgeClass(billing.accountStatus)} shadow-sm whitespace-nowrap`}>
            {billing.accountStatus ? billing.accountStatus.charAt(0).toUpperCase() + billing.accountStatus.slice(1) : 'Unknown'}
          </span>
        </div>

        {/* Three Panel Layout - no cards, modern sections */}
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

              {/* Action Buttons - 3 per row, compact on mobile */}
              <div className="pt-3 border-t border-sky-200/60 dark:border-slate-600 mt-3 grid grid-cols-3 gap-1 sm:gap-2">
                <button 
                  onClick={() => navigate(`/dashboard/customers/edit/${id}`)}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md min-w-0"
                >
                  <DocumentTextIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const phone = customerData?.customer.phone || customerData?.customer.mobileNumber || '';
                    setSmsPhone(phone);
                    if (!smsMessage) {
                      setSmsMessage(`Dear ${customerData?.customer.fullName || 'Customer'}, your monthly internet bill is due. Please pay to ensure continuous high-speed service. Thank you, NetFix.`);
                    }
                    setIsSmsModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md min-w-0"
                >
                  <DevicePhoneMobileIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">SMS</span>
                </button>
                <button
                  onClick={() => navigate(`/dashboard/customers/task-logs/${id}`)}
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
              <InfoRow label="Package Plan" value={service.packageName || '—'} />
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
              <InfoRow label="Billing Cycle" value={service.billingCycle ? service.billingCycle.charAt(0).toUpperCase() + service.billingCycle.slice(1) : '—'} />
              <InfoRow label="Customer Type" value={service.customerType ? String(service.customerType).charAt(0).toUpperCase() + String(service.customerType).slice(1) : (service.billingType || '—')} />
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
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {billing.connectedBy}
                    </span>
                  ) : 'Admin'
                } 
              />
              <InfoRow label="Location" value={billing.location || '—'} />

              <div className="pt-3 border-t border-sky-200/60 dark:border-slate-600 mt-3 grid grid-cols-3 gap-1 sm:gap-2">
                <button
                  onClick={() => {
                    setCashReceivedForm({ amount: '', notes: '', receivedByUserId: '', receivedByRole: '', sendSms: true });
                    setIsCashReceivedModalOpen(true);
                  }}
                  disabled={billing.billingStatus === 'Left'}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 min-w-0"
                >
                  <CurrencyDollarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Cash</span>
                </button>
                <button
                  onClick={() => setIsRenewModalOpen(true)}
                  disabled={billing.billingStatus === 'Left'}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 min-w-0"
                >
                  <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Renew</span>
                </button>
                <button
                  onClick={() => setIsChangePackageModalOpen(true)}
                  disabled={billing.billingStatus !== 'Expired'}
                  title={billing.billingStatus !== 'Expired' ? 'Only expired customers can migrate' : undefined}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed min-w-0"
                >
                  <DocumentTextIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Migrate</span>
                </button>
                <button
                  onClick={handleSuspendRestore}
                  disabled={isSuspending || customerData?.network?.protocolType !== 'pppoe'}
                  title={customerData?.network?.protocolType !== 'pppoe' ? 'Suspend/Restore is only available for PPPoE customers' : (isSuspended ? 'Restore customer (set profile back to package)' : 'Suspend customer (Expired_Profile + disconnect)')}
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
                  onClick={() => navigate(`/dashboard/customers/view/${id}/invoices`)}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-sky-600 hover:bg-sky-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md min-w-0"
                >
                  <DocumentTextIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Invoices</span>
                </button>
                <button
                  onClick={isLeft ? handleActivate : handleMarkLeft}
                  disabled={isMarkingLeft || isActivating || (isLeft ? customerData?.network?.protocolType !== 'pppoe' : false)}
                  title={isLeft ? (customerData?.network?.protocolType !== 'pppoe' ? 'Activate is only for PPPoE customers' : 'Activate customer: re-create PPPoE secret. Expired billing → Expired_Profile; active → package profile') : undefined}
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
              
              {/* Grouped Status Info - Compact */}
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
                        onClick={() => handleCopy((network.activeMacAddress || network.macAddress || onu?.routerMac)!)}
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
                {/* When customer is offline, only Sync is clickable; all other buttons disabled */}
                <button
                  onClick={() => {
                    if (customerData && customerData.network.username && customerData.network.serverName) {
                      navigate(`/dashboard/network/monitoring/live-traffic?username=${encodeURIComponent(customerData.network.username)}&serverName=${encodeURIComponent(customerData.network.serverName)}&user_id=${id}`);
                    } else {
                      toast.error('User traffic monitoring requires username and server information');
                    }
                  }}
                  disabled={!customerData || !customerData.network.username || !customerData.network.serverName || !network.onlineStatus}
                  title={!network.onlineStatus ? 'Available when customer is online' : undefined}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-0"
                >
                  <ChartBarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Traffic</span>
                </button>
                <button
                  onClick={handleBindMac}
                  disabled={!customerData || customerData.network.protocolType !== 'pppoe' || !network.onlineStatus}
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
                  onClick={() => {
                    setRouterData((prev) => ({ ...prev, routerIp: customerData?.network?.ipAddress ?? prev.routerIp ?? '' }));
                    setIsRouterModalOpen(true);
                  }}
                  disabled={!network.onlineStatus}
                  title={!network.onlineStatus ? 'Available when customer is online' : undefined}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-0"
                >
                  <RouterIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">R.Login</span>
                </button>
                <button
                  onClick={handlePing}
                  disabled={isPingLoading || !customerData || customerData.network.protocolType !== 'pppoe' || !network.onlineStatus}
                  title={!network.onlineStatus ? 'Available when customer is online' : (customerData?.network?.protocolType !== 'pppoe' ? 'Ping is only for PPPoE customers' : 'Ping customer IP from MikroTik')}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-0"
                >
                  <SignalIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${isPingLoading ? 'animate-pulse' : ''}`} />
                  <span className="truncate">{isPingLoading ? '...' : 'Ping'}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setIsSyncModalOpen(true); setSyncResult(null); handleSync(); }}
                  disabled={isSyncing || !customerData || customerData.network.protocolType !== 'pppoe'}
                  title={customerData?.network?.protocolType !== 'pppoe' ? 'Sync is only for PPPoE customers' : 'Sync session with MikroTik'}
                  className="flex items-center justify-center gap-1 sm:gap-2 px-1.5 py-1.5 sm:px-3 sm:py-2.5 bg-sky-600 hover:bg-sky-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 min-w-0"
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="truncate">{isSyncing ? '...' : 'Sync'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDisconnectModalOpen(true)}
                  disabled={isDisconnecting || !customerData || customerData.network.protocolType !== 'pppoe' || !network.onlineStatus}
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
                        onClick={() => handleCopy(onu.onuMac!)}
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
                        onClick={() => handleCopy((onu?.routerMac || network.macAddress || network.activeMacAddress)!)}
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

      {/* Router Login Modal */}
      {isRouterModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-lg shadow-2xl max-w-md w-full border border-sky-200/80 dark:border-slate-600">
            <div className="p-4 border-b border-sky-200/60 dark:border-slate-600 flex justify-between items-center bg-sky-50/80 dark:bg-sky-900/20 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/40">
                  <KeyIcon className="w-5 h-5 text-sky-600 dark:text-teal-400" />
                </span>
                Customer Router Details
              </h3>
              <button
                onClick={() => {
                  setIsRouterModalOpen(false);
                }}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all duration-300 hover:scale-110"
              >
                <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-sky-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Router IP:
                </label>
                <input
                  type="text"
                  value={routerData.routerIp}
                  readOnly
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 cursor-not-allowed"
                  placeholder="Customer current IP (auto)"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-sky-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  Router Model:
                </label>
                <input
                  type="text"
                  value={routerData.routerModel}
                  onChange={(e) => setRouterData({ ...routerData, routerModel: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:focus:border-teal-500 transition-all shadow-sm"
                  placeholder="Enter router model"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-sky-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Router Port:
                </label>
                <input
                  type="text"
                  value={routerData.routerPort}
                  onChange={(e) => setRouterData({ ...routerData, routerPort: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:focus:border-teal-500 transition-all shadow-sm"
                  placeholder="80"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-sky-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Router Username:
                </label>
                <input
                  type="text"
                  value={routerData.routerUsername}
                  onChange={(e) => setRouterData({ ...routerData, routerUsername: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:focus:border-teal-500 transition-all shadow-sm"
                  placeholder="Enter router username"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-sky-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Router Password:
                </label>
                <input
                  type="password"
                  value={routerData.routerPassword}
                  onChange={(e) => setRouterData({ ...routerData, routerPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:focus:border-teal-500 transition-all shadow-sm"
                  placeholder="Enter router password"
                />
              </div>
            </div>

            <div className="p-4 border-t border-sky-200/60 dark:border-slate-600 flex justify-end gap-3 bg-slate-50/80 dark:bg-slate-900/50 rounded-b-2xl">
              <button
                onClick={() => setIsRouterModalOpen(false)}
                className="px-4 py-2.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all duration-300 font-semibold"
                disabled={isSavingRouter}
              >
                Close
              </button>
              <button
                onClick={handleRouterLogin}
                disabled={isSavingRouter || !routerData.routerIp || !routerData.routerPort}
                className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <KeyIcon className="w-4 h-4" />
                Login
              </button>
              <button
                onClick={handleSaveRouter}
                disabled={isSavingRouter || !routerData.routerIp}
                className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSavingRouter ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Area Modal */}
      {isAddAreaModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-2xl max-w-md w-full border border-sky-200/80 dark:border-slate-600">
            <div className="p-4 border-b border-sky-200/60 dark:border-slate-600 flex justify-between items-center bg-sky-50/80 dark:bg-sky-900/20 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/40">
                  <MapPinIcon className="w-5 h-5 text-sky-600 dark:text-teal-400" />
                </span>
                Add Area
              </h3>
              <button
                onClick={() => {
                  setIsAddAreaModalOpen(false);
                  setNewAreaName('');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Area Name:</label>
                <input
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newAreaName.trim()) {
                      handleAddArea();
                    }
                  }}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:focus:border-teal-500 transition-all"
                  placeholder="Enter area name"
                  autoFocus
                />
              </div>
              
              <div className="mb-4">
                <p className="text-xs text-sky-600 dark:text-teal-400">
                  To edit or delete area,{' '}
                  <a 
                    href="/dashboard/service-area/areas" 
                    className="text-sky-600 dark:text-teal-400 hover:underline font-medium"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/dashboard/service-area/areas');
                    }}
                  >
                    click here
                  </a>
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-sky-200/60 dark:border-slate-600 flex justify-end gap-3 bg-slate-50/80 dark:bg-slate-900/50 rounded-b-2xl">
              <button
                onClick={() => {
                  setIsAddAreaModalOpen(false);
                  setNewAreaName('');
                }}
                className="px-4 py-2.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all font-medium"
                disabled={isCreatingArea}
              >
                Close
              </button>
              <button
                onClick={handleAddArea}
                disabled={isCreatingArea || !newAreaName.trim()}
                className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingArea ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ping Modal - sky/teal modern UI */}
      {isPingModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-lg shadow-2xl max-w-lg w-full border border-sky-200/80 dark:border-slate-600 overflow-hidden">
            <div className="bg-gradient-to-r from-sky-500 to-teal-600 dark:from-sky-600 dark:to-teal-700 px-5 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="p-1.5 bg-white/20 rounded-lg">
                  <SignalIcon className="w-5 h-5 text-white" />
                </span>
                Ping from MikroTik
              </h3>
              <button
                onClick={() => { setIsPingModalOpen(false); setPingResult(null); }}
                disabled={isPingLoading}
                className="p-2 hover:bg-white/20 rounded-lg transition-all disabled:opacity-50"
              >
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-5 sm:p-6 min-h-[200px]">
              {isPingLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sky-600 dark:text-teal-400 font-medium">Pinging from router...</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">This may take a few seconds</p>
                </div>
              ) : pingResult ? (
                <div className="space-y-4">
                  {!pingResult.success && pingResult.error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
                      {pingResult.error}
                    </div>
                  )}
                  {pingResult.lines.length > 0 && (
                    <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200/60 dark:border-slate-600 p-4">
                      <div className="font-mono text-sm text-slate-800 dark:text-slate-200 space-y-1 break-all">
                        {pingResult.lines.map((line, i) => (
                          <div key={i} className="text-sky-800 dark:text-teal-200">{line}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {pingResult.bandwidthLines && pingResult.bandwidthLines.length > 0 && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600 p-4">
                      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Current BW Use (mbps)</h4>
                      <div className="font-mono text-sm text-slate-700 dark:text-slate-300 space-y-1">
                        {pingResult.bandwidthLines.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">No result yet.</div>
              )}
            </div>
            {!isPingLoading && pingResult && (
              <div className="px-5 py-3 border-t border-sky-200/60 dark:border-slate-600 bg-sky-50/50 dark:bg-slate-900/30 rounded-b-2xl flex justify-end">
                <button
                  onClick={() => { setIsPingModalOpen(false); setPingResult(null); }}
                  className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-xl font-semibold text-sm transition-all"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync Modal - sky/teal */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-lg shadow-2xl max-w-lg w-full border border-sky-200/80 dark:border-slate-600 overflow-hidden">
            <div className="bg-gradient-to-r from-sky-500 to-teal-600 dark:from-sky-600 dark:to-teal-700 px-5 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="p-1.5 bg-white/20 rounded-lg">
                  <ArrowPathIcon className="w-5 h-5 text-white" />
                </span>
                Sync with MikroTik
              </h3>
              <button
                onClick={() => { setIsSyncModalOpen(false); setSyncResult(null); }}
                disabled={isSyncing}
                className="p-2 hover:bg-white/20 rounded-lg transition-all disabled:opacity-50"
              >
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-5 sm:p-6 min-h-[200px]">
              {isSyncing ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sky-600 dark:text-teal-400 font-medium">Syncing with router...</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Verifying PPPoE secret</p>
                </div>
              ) : syncResult?.error ? (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
                  {syncResult.error}
                </div>
              ) : syncResult ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    User detail in MikroTik: <span className="font-mono text-sky-600 dark:text-teal-400">{syncResult.username ?? '—'}</span>
                  </p>
                  {syncResult.mikrotikDetailLines && syncResult.mikrotikDetailLines.length > 0 && (
                    <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200/60 dark:border-slate-600 p-4">
                      <div className="font-mono text-sm text-slate-800 dark:text-slate-200 space-y-1">
                        {syncResult.mikrotikDetailLines.map((line, i) => (
                          <div key={i} className="text-sky-800 dark:text-teal-200">{line}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {syncResult.username && syncResult.message && (
                    <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      {syncResult.username}: {syncResult.message}
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">No result yet.</div>
              )}
            </div>
            {!isSyncing && syncResult && (
              <div className="px-5 py-3 border-t border-sky-200/60 dark:border-slate-600 bg-sky-50/50 dark:bg-slate-900/30 rounded-b-2xl flex justify-between items-center gap-2">
                {syncResult.secretExists === false ? (
                  <button
                    type="button"
                    onClick={handleProvisionToRouter}
                    disabled={isProvisioning}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50"
                  >
                    {isProvisioning ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Provisioning to MikroTik...</span>
                      </>
                    ) : (
                      <>
                        <PlusIcon className="w-4 h-4" />
                        <span>Provision to MikroTik</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => { setIsSyncModalOpen(false); setSyncResult(null); }}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-xl font-semibold text-xs sm:text-sm transition-all"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disconnect PPPoE Session Modal */}
      {isDisconnectModalOpen && customerData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-lg shadow-2xl max-w-lg w-full border border-red-200/80 dark:border-red-900/50 overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-5 py-4 flex justify-between items-center text-white">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="p-1.5 bg-white/20 rounded-lg">
                  <XMarkIcon className="w-5 h-5 text-white" />
                </span>
                Disconnect PPPoE Session
              </h3>
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(false)}
                disabled={isDisconnecting}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-all disabled:opacity-50"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3.5 text-xs sm:text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Force Disconnect from MikroTik</p>
                  <p className="mt-1 text-amber-700 dark:text-amber-300/90 leading-relaxed text-xs sm:text-sm">
                    This will forcibly terminate the active PPPoE session directly on MikroTik router <strong>{customerData.network.serverName || 'Core Router'}</strong>. The client router will drop offline immediately.
                  </p>
                </div>
              </div>

              {/* Session Overview Table */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/80 p-3.5 space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Customer:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{customerData.customer.fullName} ({customerData.customer.customerCode})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">PPPoE User:</span>
                  <span className="font-mono font-semibold text-sky-600 dark:text-teal-400">{customerData.network.username}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">IP Address:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{customerData.network.ipAddress || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">MAC Address:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{customerData.network.activeMacAddress || customerData.network.macAddress || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Active Uptime:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatUptime(customerData.network.uptime)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 dark:text-slate-400">Current Status:</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online (Active Session)
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200/80 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(false)}
                disabled={isDisconnecting}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDisconnectSession}
                disabled={isDisconnecting}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50"
              >
                {isDisconnecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Disconnecting...</span>
                  </>
                ) : (
                  <>
                    <XMarkIcon className="w-4 h-4" />
                    <span>Disconnect Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {isRenewModalOpen && customerData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-5 md:p-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col border border-sky-200/80 dark:border-slate-600">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-sky-500 to-teal-600 dark:from-sky-600 dark:to-teal-700 px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between z-10 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Renew Service</h2>
              </div>
              <button
                onClick={() => setIsRenewModalOpen(false)}
                className="text-white/90 hover:text-white hover:bg-white/20 transition-all duration-200 p-1.5 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {/* Expiry Dates */}
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-900/50 dark:to-indigo-900/10 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-5">
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 bg-red-100 dark:bg-red-900/20 rounded-lg">
                      <ClockIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Old Expire Date</p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {customerData.billing.expiryDate 
                          ? (isLifetimeExpiry(customerData.billing.expiryDate) ? 'Lifetime' : new Date(customerData.billing.expiryDate).toLocaleString('en-US', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            }).replace(',', ''))
                          : '—'}
                      </p>
                    </div>
                  </div>
                  {calculateNewExpiryDate() && (
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
                        <CalendarIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">New Expire Date</p>
                        <p className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {new Date(calculateNewExpiryDate()!).toLocaleString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          }).replace(',', '')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Billing Cycle */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <CreditCardIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Billing Cycle <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={renewForm.billing_cycle}
                    onChange={(e) => setRenewForm((prev) => ({ ...prev, billing_cycle: e.target.value as 'Monthly' | 'Day-based' }))}
                    className="w-full px-3 py-2.5 pl-10 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236366f1%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-no-repeat bg-right-2 bg-[length:18px_18px] pr-8 transition-all text-sm"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Day-based">Day-based</option>
                  </select>
                  <CreditCardIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                </div>
              </div>

              {/* Number of Months or Selected Days */}
              {renewForm.billing_cycle === 'Monthly' ? (
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Number of Months <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      value={renewForm.no_of_month}
                      onChange={(e) => setRenewForm((prev) => ({ ...prev, no_of_month: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2.5 pl-10 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                    />
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    <ClockIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Select Days <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[20, 15, 10, 7, 5, 3, 1].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setRenewForm((prev) => ({ ...prev, selected_days: days }))}
                        className={`px-2 sm:px-3 py-2 rounded-lg border-2 transition-all duration-200 font-medium text-xs sm:text-sm ${
                          renewForm.selected_days === days
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-md scale-105'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'
                        }`}
                      >
                        {days} {days === 1 ? 'Day' : 'Days'}
                      </button>
                    ))}
                  </div>
                  {renewForm.selected_days && (
                    <div className="mt-2 flex items-center gap-2 text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                      Selected: {renewForm.selected_days} day(s)
                    </div>
                  )}
                </div>
              )}

              {/* Plan, Balance, Price, Remark Grid */}
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-900/50 dark:to-indigo-900/10 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-5">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      <WifiIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Plan: <span className="text-red-500">*</span>
                    </label>
                    {isLoadingPackages ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        Loading packages...
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <select
                            value={renewForm.plan_id}
                            onChange={(e) => {
                              const selectedPackage = packages.find((pkg) => pkg.id === e.target.value);
                              setRenewForm((prev) => ({
                                ...prev,
                                plan_id: e.target.value,
                                plan_price: selectedPackage?.price || 0,
                              }));
                            }}
                            className="w-full px-3 py-2.5 pl-10 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236366f1%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-no-repeat bg-right-2 bg-[length:16px_16px] pr-8 transition-all"
                          >
                            <option key="select-placeholder" value="">Select Package</option>
                            {packages.length === 0 ? (
                              <option key="no-packages" value="" disabled>No packages available</option>
                            ) : (
                              packages
                                .filter((pkg) => pkg.id)
                                .map((pkg) => {
                                  const isActive = getActivePlanId() === pkg.id;
                                  return (
                                    <option 
                                      key={pkg.id} 
                                      value={pkg.id}
                                      style={isActive ? { backgroundColor: '#dbeafe', fontWeight: 'bold' } : {}}
                                    >
                                      {pkg.name}{isActive ? ' (Active / Running Plan)' : ''}
                                    </option>
                                  );
                                })
                            )}
                          </select>
                          <WifiIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                        </div>
                        {renewForm.plan_price > 0 && (
                          <div className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-xs sm:text-sm font-bold min-w-[75px] text-center shadow-md">
                            {renewForm.plan_price}Tk
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      <CreditCardIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Customer Current Balance:
                    </label>
                    <div
                    className={`px-3 py-2 bg-white dark:bg-slate-900/40 border-2 rounded-lg text-xs sm:text-sm font-semibold ${
                      (customerData.billing.balance ?? 0) < 0
                        ? 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-bold'
                        : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {customerData.billing.balance ?? 0} Tk
                  </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-5 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      <ChartBarIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      My Price:
                    </label>
                    <div className="px-3 py-2 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-400">
                      {renewForm.billing_cycle === 'Monthly' && renewForm.no_of_month
                        ? (renewForm.plan_price * renewForm.no_of_month).toFixed(0)
                        : renewForm.billing_cycle === 'Day-based' && renewForm.selected_days
                        ? ((renewForm.plan_price / 30) * renewForm.selected_days).toFixed(0)
                        : 0} Tk
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      <DocumentTextIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      Remark:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter remark (optional)"
                        className="w-full px-3 py-2 pl-9 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                      />
                      <DocumentTextIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-900/50 dark:to-indigo-900/10 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 sm:p-4">
                <div className="space-y-2.5">
                  {user?.user_id !== customerData.customer?.ownerId && (
                    <label className="flex items-center gap-2.5 cursor-pointer group p-2 rounded-lg hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={renewForm.renew_as_reseller}
                          onChange={(e) => setRenewForm((prev) => ({ ...prev, renew_as_reseller: e.target.checked }))}
                          className="w-4 h-4 text-indigo-600 bg-white border-2 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 checked:bg-indigo-600 checked:border-indigo-600 dark:bg-slate-800 dark:checked:bg-indigo-500 dark:checked:border-indigo-500 transition-all duration-200 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <UserIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Renew As Reseller ?</span>
                      </div>
                    </label>
                  )}
                  {(customerData.billing.balance ?? 0) !== 0 && (
                    <label className="flex items-center gap-2.5 cursor-pointer group p-2 rounded-lg hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all" title="Use customer balance first; shortfall will be deducted from your (logged-in) balance.">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={renewForm.pay_from_customer_balance}
                          onChange={(e) => setRenewForm((prev) => ({ ...prev, pay_from_customer_balance: e.target.checked }))}
                          className="w-4 h-4 text-indigo-600 bg-white border-2 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 checked:bg-indigo-600 checked:border-indigo-600 dark:bg-slate-800 dark:checked:bg-indigo-500 dark:checked:border-indigo-500 transition-all duration-200 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Pay from balance (customer + your balance for shortfall)</span>
                      </div>
                    </label>
                  )}
                  <label className="flex items-center gap-2.5 cursor-pointer group p-2 rounded-lg hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={renewForm.send_sms}
                        onChange={(e) => setRenewForm((prev) => ({ ...prev, send_sms: e.target.checked }))}
                        className="w-4 h-4 text-indigo-600 bg-white border-2 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 checked:bg-indigo-600 checked:border-indigo-600 dark:bg-slate-800 dark:checked:bg-indigo-500 dark:checked:border-indigo-500 transition-all duration-200 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <DevicePhoneMobileIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Send SMS ?</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-4 sm:pt-5 border-t-2 border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setIsRenewModalOpen(false)}
                  disabled={isRenewing}
                  className="flex-1 px-3 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleRenew}
                  disabled={isRenewing || !renewForm.plan_id}
                  className="flex-1 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow flex items-center justify-center gap-2 text-sm"
                >
                  {isRenewing ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Renewing...
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="w-4 h-4" />
                      Renew Service
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Migration Modal */}
      {isChangePackageModalOpen && customerData && id && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 md:p-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-600 dark:from-orange-600 dark:to-red-700 px-4 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <DocumentTextIcon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-white">Migration</h2>
              </div>
              <button
                onClick={() => setIsChangePackageModalOpen(false)}
                disabled={isChangingPackage}
                className="text-white/90 hover:text-white hover:bg-white/20 transition-all duration-200 p-1.5 rounded-lg disabled:opacity-50"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Current package: <span className="font-semibold text-slate-800 dark:text-slate-200">{customerData.service.packageName || '—'}</span>
              </p>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <WifiIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  New Package <span className="text-red-500">*</span>
                </label>
                {isLoadingChangePackagePackages ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    Loading packages...
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={changePackageForm.plan_id}
                      onChange={(e) => {
                        const selectedPackage = changePackagePackages.find((pkg) => pkg.id === e.target.value);
                        setChangePackageForm((prev) => ({
                          ...prev,
                          plan_id: e.target.value,
                          plan_price: selectedPackage?.price ?? 0,
                        }));
                      }}
                      className="w-full px-3 py-2.5 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                    >
                      <option value="">Select Package</option>
                      {changePackagePackages.length === 0 ? (
                        <option value="" disabled>No packages available</option>
                      ) : (
                        changePackagePackages
                          .filter((pkg) => pkg.id)
                          .map((pkg) => (
                            <option key={pkg.id} value={pkg.id}>
                              {pkg.name} {pkg.name === customerData.service.packageName ? '(Current)' : ''} — ৳{pkg.price ?? 0}
                            </option>
                          ))
                      )}
                    </select>
                    {changePackageForm.plan_price > 0 && (
                      <div className="px-3 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg text-sm font-bold min-w-[70px] text-center">
                        ৳{changePackageForm.plan_price}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setIsChangePackageModalOpen(false)}
                  disabled={isChangingPackage}
                  className="flex-1 px-3 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePackage}
                  disabled={isChangingPackage || !changePackageForm.plan_id || isLoadingChangePackagePackages}
                  className="flex-1 px-3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow flex items-center justify-center gap-2"
                >
                  {isChangingPackage ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Migrating...
                    </>
                  ) : (
                    'Migration'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Received Modal */}
      {isCashReceivedModalOpen && id && customerData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-5 md:p-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-sky-200/80 dark:border-slate-600">
            <div className="sticky top-0 bg-gradient-to-r from-sky-500 to-teal-600 dark:from-sky-600 dark:to-teal-700 px-5 py-4 sm:px-6 sm:py-5 flex items-center justify-between z-10 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <BanknotesIcon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-white">Cash Received</h2>
              </div>
              <button
                onClick={() => {
                  setIsCashReceivedModalOpen(false);
                  setCashReceivedForm({ amount: '', notes: '', receivedByUserId: '', receivedByRole: '', sendSms: true });
                }}
                disabled={isSubmittingCashReceived}
                className="text-white/90 hover:text-white hover:bg-white/20 transition-all duration-200 p-1.5 rounded-lg disabled:opacity-50"
              >
                <XMarkIcon className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
              {/* Read-only: Customer Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Customer Name</label>
                <div className="px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-sm font-medium">
                  {customerData.customer.fullName || '—'}
                </div>
              </div>
              {/* Read-only: Current Balance */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Current Balance</label>
                <div
                  className={`px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600 text-sm font-bold ${
                    (customerData.billing.balance ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {formatCurrencyBDT(customerData.billing.balance ?? 0) || '৳0'}
                </div>
              </div>
              {/* Required: Amount */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <CreditCardIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Amount (৳) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Enter amount"
                  value={cashReceivedForm.amount}
                  onChange={(e) => setCashReceivedForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                />
              </div>
              {/* Required: Received By */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <UserIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Received By <span className="text-red-500">*</span>
                </label>
                {isLoadingReceivedBy ? (
                  <div className="px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600 text-slate-500 text-sm">Loading...</div>
                ) : (
                  <select
                    value={cashReceivedForm.receivedByUserId}
                    onChange={(e) => {
                      const opt = receivedByOptions.find((o) => o.userId === e.target.value);
                      setCashReceivedForm((prev) => ({
                        ...prev,
                        receivedByUserId: e.target.value,
                        receivedByRole: opt?.roleCode ?? '',
                      }));
                    }}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%230d9488%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-no-repeat bg-right-2 bg-[length:18px_18px] pr-9"
                  >
                    <option value="">Select name (Admin / Reseller / Sub-Reseller / Agent)</option>
                    {receivedByOptions.map((opt) => (
                      <option key={opt.userId} value={opt.userId}>
                        {opt.fullName} ({opt.roleCode.replace(/_/g, ' ')})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {/* Notes */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <DocumentTextIcon className="w-4 h-4 text-slate-500" />
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly bill payment"
                  value={cashReceivedForm.notes}
                  onChange={(e) => setCashReceivedForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                />
              </div>
              {/* Send SMS checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={cashReceivedForm.sendSms}
                  onChange={(e) => setCashReceivedForm((prev) => ({ ...prev, sendSms: e.target.checked }))}
                  className="w-4 h-4 text-emerald-600 bg-white border-2 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Send SMS notification</span>
              </label>
              <div className="flex gap-2 pt-4 pb-1 border-t border-slate-200 dark:border-slate-700 mt-2">
                <button
                  onClick={() => {
                    setIsCashReceivedModalOpen(false);
                    setCashReceivedForm({ amount: '', notes: '', receivedByUserId: '', receivedByRole: '', sendSms: true });
                  }}
                  disabled={isSubmittingCashReceived}
                  className="flex-1 px-3 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleRecordCashReceived}
                  disabled={
                    isSubmittingCashReceived ||
                    !cashReceivedForm.amount ||
                    parseFloat(cashReceivedForm.amount) <= 0 ||
                    !cashReceivedForm.receivedByUserId?.trim()
                  }
                  className="flex-1 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow flex items-center justify-center gap-2 text-sm"
                >
                  {isSubmittingCashReceived ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <BanknotesIcon className="w-4 h-4" />
                      Record Cash
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Quick SMS Notification Modal */}
      {isSmsModalOpen && customerData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-5 md:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-sky-200/80 dark:border-slate-700 max-w-lg w-full overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-emerald-600 px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <DevicePhoneMobileIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Send Quick SMS</h3>
                  <p className="text-xs text-teal-100">Direct instant notification via SMS gateway</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSmsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Recipient Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Recipient Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <PhoneIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
              </div>

              {/* Quick Template Chips */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Quick Message Templates
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const name = customerData.customer.fullName || 'Customer';
                      const due = customerData.billing.planPrice || 'bill';
                      setSmsMessage(`Dear ${name}, your monthly internet bill of BDT ${due} is due. Please pay promptly to avoid interruption. - NetFix`);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 transition-colors"
                  >
                    💳 Bill Due
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const name = customerData.customer.fullName || 'Customer';
                      const amt = customerData.billing.planPrice || '';
                      setSmsMessage(`Dear ${name}, we have received your internet bill payment of BDT ${amt}. Thank you for staying with us! - NetFix`);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                  >
                    ✅ Payment Received
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const name = customerData.customer.fullName || 'Customer';
                      setSmsMessage(`Dear ${name}, scheduled fiber optic maintenance is in progress in your area. Service will resume shortly. We regret any inconvenience. - NetFix`);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors"
                  >
                    ⚠️ Maintenance
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const name = customerData.customer.fullName || 'Customer';
                      const user = customerData.network.username || '';
                      const pass = customerData.network.password || '';
                      setSmsMessage(`Dear ${name}, welcome to NetFix! Your PPPoE Username: ${user}, Password: ${pass}. Helpline: 01800000000.`);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors"
                  >
                    🔑 Credentials
                  </button>
                </div>
              </div>

              {/* Message Content */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Message Body
                  </label>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {smsMessage.length} chars ({(Math.ceil(smsMessage.length / 160) || 1)} SMS)
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 resize-none shadow-inner"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsSmsModalOpen(false)}
                  disabled={isSendingSms}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendQuickSms}
                  disabled={isSendingSms || !smsPhone.trim() || !smsMessage.trim()}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  {isSendingSms ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <DevicePhoneMobileIcon className="w-4 h-4" />
                      Send SMS
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for info rows
function InfoRow({ label, value, icon, actions }: { label: string; value: string | React.ReactNode; icon?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-1 sm:gap-2 min-w-0">
      <div className="flex gap-1 sm:gap-2 min-w-0 flex-1">
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium flex-shrink-0">
          {label}:
        </p>
        <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 min-w-0 break-words">{value || '—'}</p>
      </div>
      {actions}
    </div>
  );
}
