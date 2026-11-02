import { useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { billingService } from '@/services/billing.service';
import { Customer } from '@/types/customer.types';
import { useToastContext } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCustomerIdDisplay } from '@/lib/formatCustomerId';
import { formatExpiryDisplay } from '@/lib/formatExpiry';
import { openSuspendRestoreModal } from '@/lib/suspendRestoreModal';
import { openTransferToResellerModal } from '@/lib/transferToResellerModal';
import { openChangeAreaModal } from '@/lib/changeAreaModal';
import { openChangeCustomerTypeModal } from '@/lib/changeCustomerTypeModal';
import { openChangeBillingTypeModal } from '@/lib/changeBillingTypeModal';
import { openChangeServerModal } from '@/lib/changeServerModal';
import { openChangePlanModal } from '@/lib/changePlanModal';
import { openChangeExpiryDateModal } from '@/lib/changeExpiryDateModal';
import { openLeftCustomerModal } from '@/lib/leftCustomerModal';
import { openDeleteCustomerModal } from '@/lib/deleteCustomerModal';
import { customersService } from '@/services/customers.service';
import { PageHeader, MetricCard } from '@/components/common';
import { Users, Receipt, CreditCard, AlertCircle } from 'lucide-react';

const BILLING_TYPES = {
  all: { title: 'All Accounts', filter: 'all' },
  active: { title: 'Active Accounts', filter: 'active' },
  'new-customers': { title: 'New Customers', filter: 'new-customers' },
  'expire-3-days': { title: 'Expire In 3 Days', filter: 'expire-3-days' },
  'expire-7-days': { title: 'Expire In 7 Days', filter: 'expire-7-days' },
  expired: { title: 'Expired Accounts', filter: 'expired' },
  suspended: { title: 'Suspend Accounts', filter: 'suspended' },
  left: { title: 'Left Customers', filter: 'left' },
};

const getBillingStatusBadgeClass = (status: string | null): string => {
  const classes: Record<string, string> = {
    Paid: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
    Due: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700',
    Expired: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
    Left: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700 font-bold',
    Suspended: 'bg-red-200 text-red-900 border-red-600 dark:bg-red-900/60 dark:text-red-100 dark:border-red-500 font-semibold',
  };
  return classes[status || ''] || 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700';
};

const getBillingStatusIcon = (status: string | null): JSX.Element | null => {
  switch (status) {
    case 'Paid':
      return (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    case 'Due':
      return (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    case 'Expired':
      return (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      );
    case 'Left':
      return (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l2-2a1 1 0 00-1.414-1.414L11 9.586V7a1 1 0 10-2 0v2.586l-1.293-1.293z" clipRule="evenodd" />
        </svg>
      );
    case 'Suspended':
      return (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
        </svg>
      );
    default:
      return null;
  }
};

const getProtocolIcon = (protocol: string | null | undefined): JSX.Element | null => {
  if (!protocol) return null;
  const protocolLower = protocol.toLowerCase();
  if (protocolLower === 'pppoe') {
    return (
      <svg className="w-4 h-4 mr-1.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    );
  } else if (protocolLower === 'hotspot' || protocolLower === 'ppp') {
    return (
      <svg className="w-4 h-4 mr-1.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    );
  }
  return null;
};

// More-menu icons (matched to Customers page style)
const moreMenuIcons: Record<string, JSX.Element> = {
  'Suspend / Restore': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  'Transfer to Reseller': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  'Change Area': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'Change Customer Type': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  'Change Billing Type': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  'Change Server': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  ),
  'Change Package': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  'Advance Renew': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  'Change Expiry Date': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  'BTRC Report': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  'Export': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  'Left Customer': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  'Delete Customer': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
};

// Ensure every menu icon is colored (no gray icons).
const moreMenuIconColors: Record<string, string> = {
  'Suspend / Restore': 'text-orange-500',
  'Transfer to Reseller': 'text-indigo-500',
  'Change Area': 'text-teal-500',
  'Change Customer Type': 'text-purple-500',
  'Change Billing Type': 'text-fuchsia-500',
  'Change Server': 'text-sky-500',
  'Change Package': 'text-violet-500',
  'Advance Renew': 'text-emerald-500',
  'Change Expiry Date': 'text-amber-500',
  'BTRC Report': 'text-blue-500',
  'Export': 'text-cyan-500',
  'Left Customer': 'text-red-500',
  'Delete Customer': 'text-red-500',
};

export default function BillingPage() {
  const { type = 'all' } = useParams<{ type: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToastContext();
  const { theme, toggleTheme } = useTheme();
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [newCustomersCount, setNewCustomersCount] = useState<number | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showExportSubmenu, setShowExportSubmenu] = useState(false);
  const [moreMenuPosition, setMoreMenuPosition] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  
  // Date range state for New Customers
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [isBulkRenewModalOpen, setIsBulkRenewModalOpen] = useState(false);
  const [bulkRenewDuration, setBulkRenewDuration] = useState<string>('full_month');

  const billingType = BILLING_TYPES[type as keyof typeof BILLING_TYPES] || BILLING_TYPES.all;

  const BULK_RENEW_OPTIONS = [
    { value: 'full_month', label: 'Full Month' },
    { value: '20', label: '20 Days' },
    { value: '15', label: '15 Days' },
    { value: '10', label: '10 Days' },
    { value: '7', label: '7 Days' },
    { value: '5', label: '5 Days' },
    { value: '3', label: '3 Days' },
    { value: '1', label: '1 Day' },
  ];

  // Update search from URL params
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    setSearch(urlSearch);
  }, [searchParams]);

  // Load customers when filters change (including search)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadCustomers();
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(timeoutId);
  }, [type, dateRange, startDate, endDate, search]);

  const moreMenuItems = [
    'Suspend / Restore',
    'Transfer to Reseller',
    'Change Area',
    'Change Customer Type',
    'Change Billing Type',
    'Change Server',
    'Change Package',
    'Advance Renew',
    'Change Expiry Date',
    'BTRC Report',
    'Export',
    'Left Customer',
    'Delete Customer',
  ];

  const handleMoreMenuAction = async (action: string) => {
    if (action === 'Export') {
      setShowExportSubmenu(true);
      return;
    }
    if (selectedCustomers.size === 0) {
      toast.error('Please select customers first');
      return;
    }
    setShowMoreMenu(false);
    setShowExportSubmenu(false);
    setMoreMenuPosition(null);

    if (action === 'Suspend / Restore') {
      const confirmed = await openSuspendRestoreModal();
      if (!confirmed) return;
      const ids = Array.from(selectedCustomers);
      let successCount = 0;
      const errors: string[] = [];
      for (const customerId of ids) {
        try {
          await customersService.toggleSuspendRestore(customerId);
          successCount += 1;
        } catch (e: any) {
          errors.push(`${customerId}: ${e?.response?.data?.message || e?.message || 'Failed'}`);
        }
      }
      if (successCount > 0) {
        toast.success(`Suspend/Restore completed for ${successCount} customer(s).`);
        loadCustomers();
      }
      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : ''));
      }
      return;
    }

    if (action === 'Transfer to Reseller') {
      const resellerUserId = await openTransferToResellerModal();
      if (!resellerUserId) return;
      const ids = Array.from(selectedCustomers);
      let successCount = 0;
      const errors: string[] = [];
      for (const customerId of ids) {
        try {
          await customersService.updateCustomer(customerId, { ownerId: resellerUserId });
          successCount += 1;
        } catch (e: any) {
          errors.push(`${customerId}: ${e?.response?.data?.message || e?.message || 'Failed'}`);
        }
      }
      if (successCount > 0) {
        toast.success(`Transferred ${successCount} customer(s) to reseller.`);
        loadCustomers();
      }
      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : ''));
      }
      return;
    }

    if (action === 'Change Area') {
      const changeResult = await openChangeAreaModal();
      if (!changeResult) return;
      const ids = Array.from(selectedCustomers);
      let successCount = 0;
      const errors: string[] = [];
      for (const customerId of ids) {
        try {
          await customersService.updateCustomer(customerId, {
            metadata: { area: changeResult.areaName, subArea: changeResult.subAreaName },
          });
          successCount += 1;
        } catch (e: any) {
          errors.push(`${customerId}: ${e?.response?.data?.message || e?.message || 'Failed'}`);
        }
      }
      if (successCount > 0) {
        toast.success(`Area updated for ${successCount} customer(s).`);
        loadCustomers();
      }
      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : ''));
      }
      return;
    }

    if (action === 'Change Customer Type') {
      const customerType = await openChangeCustomerTypeModal();
      if (!customerType) return;
      const ids = Array.from(selectedCustomers);
      let successCount = 0;
      const errors: string[] = [];
      for (const customerId of ids) {
        try {
          await customersService.updateCustomer(customerId, { metadata: { clientCategory: customerType } });
          successCount += 1;
        } catch (e: any) {
          errors.push(`${customerId}: ${e?.response?.data?.message || e?.message || 'Failed'}`);
        }
      }
      if (successCount > 0) {
        toast.success(`Customer type updated for ${successCount} customer(s).`);
        loadCustomers();
      }
      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : ''));
      }
      return;
    }

    if (action === 'Change Billing Type') {
      const billingType = await openChangeBillingTypeModal();
      if (!billingType) return;
      const ids = Array.from(selectedCustomers);
      let successCount = 0;
      const errors: string[] = [];
      for (const customerId of ids) {
        try {
          await customersService.updateCustomer(customerId, { billingCycle: billingType });
          successCount += 1;
        } catch (e: any) {
          errors.push(`${customerId}: ${e?.response?.data?.message || e?.message || 'Failed'}`);
        }
      }
      if (successCount > 0) {
        toast.success(`Billing type updated for ${successCount} customer(s).`);
        loadCustomers();
      }
      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : ''));
      }
      return;
    }

    if (action === 'Change Server') {
      const serverId = await openChangeServerModal();
      if (!serverId) return;
      const ids = Array.from(selectedCustomers);
      let successCount = 0;
      const errors: string[] = [];
      for (const customerId of ids) {
        try {
          await customersService.updateCustomer(customerId, { serverId });
          successCount += 1;
        } catch (e: any) {
          errors.push(`${customerId}: ${e?.response?.data?.message || e?.message || 'Failed'}`);
        }
      }
      if (successCount > 0) {
        toast.success(`Server updated for ${successCount} customer(s).`);
        loadCustomers();
      }
      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : ''));
      }
      return;
    }

    if (action === 'Change Package') {
      const planId = await openChangePlanModal();
      if (!planId) return;
      const ids = Array.from(selectedCustomers);
      let successCount = 0;
      const errors: string[] = [];
      for (const customerId of ids) {
        try {
          await customersService.updateCustomer(customerId, { planId });
          successCount += 1;
        } catch (e: any) {
          errors.push(`${customerId}: ${e?.response?.data?.message || e?.message || 'Failed'}`);
        }
      }
      if (successCount > 0) {
        toast.success(`Package updated for ${successCount} customer(s).`);
        loadCustomers();
      }
      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : ''));
      }
      return;
    }

    if (action === 'Change Expiry Date') {
      const changeResult = await openChangeExpiryDateModal();
      if (!changeResult) return;
      const ids = Array.from(selectedCustomers);
      let successCount = 0;
      const errors: string[] = [];
      const payload: { expiryDate: string; serviceStatus?: 'active' | 'expired' } = { expiryDate: changeResult.expiryDate };
      if (changeResult.status) payload.serviceStatus = changeResult.status;
      for (const customerId of ids) {
        try {
          await customersService.updateCustomer(customerId, payload);
          successCount += 1;
        } catch (e: any) {
          errors.push(`${customerId}: ${e?.response?.data?.message || e?.message || 'Failed'}`);
        }
      }
      if (successCount > 0) {
        toast.success(`Expiry date updated for ${successCount} customer(s).`);
        loadCustomers();
      }
      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : ''));
      }
      return;
    }

    if (action === 'Left Customer') {
      const confirmed = await openLeftCustomerModal();
      if (!confirmed) return;
      const ids = Array.from(selectedCustomers);
      let successCount = 0;
      const errors: string[] = [];
      for (const customerId of ids) {
        try {
          await customersService.markLeft(customerId);
          successCount += 1;
        } catch (e: any) {
          errors.push(`${customerId}: ${e?.response?.data?.message || e?.message || 'Failed'}`);
        }
      }
      if (successCount > 0) {
        toast.success(`Marked ${successCount} customer(s) as Left.`);
        loadCustomers();
      }
      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : ''));
      }
      return;
    }

    if (action === 'Delete Customer') {
      const ids = Array.from(selectedCustomers);
      const customerList = customers.filter(
        (c) => (c.customer_id || c.customerId) && ids.includes(c.customer_id || c.customerId || '')
      );
      const notLeft = customerList.filter((c) => c.billing_status !== 'Left');
      if (notLeft.length > 0) {
        toast.error('Only Left customers can be deleted. Mark the customer(s) as Left first.');
        return;
      }
      const confirmed = await openDeleteCustomerModal();
      if (!confirmed) return;
      let successCount = 0;
      const errors: string[] = [];
      for (const customerId of ids) {
        try {
          await customersService.deleteCustomer(customerId);
          successCount += 1;
        } catch (e: any) {
          errors.push(`${customerId}: ${e?.response?.data?.message || e?.message || 'Failed'}`);
        }
      }
      if (successCount > 0) {
        toast.success(`Deleted ${successCount} customer(s).`);
        loadCustomers();
      }
      if (errors.length > 0) {
        toast.error(errors.slice(0, 3).join('; ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : ''));
      }
      return;
    }

    toast.info(`${action} for ${selectedCustomers.size} customers (not implemented)`);
  };

  const handleOpenMoreMenu = (buttonElement: HTMLButtonElement) => {
    const rect = buttonElement.getBoundingClientRect();
    const menuWidth = 224; // min-w-[224px]
    const menuHeight = 320; // max-h-[320px]

    // Prefer aligning right edge of menu to button right edge
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < menuHeight + 12;
    const top = openUpward ? rect.top - menuHeight - 8 : rect.bottom + 8;

    setMoreMenuPosition({ top: Math.max(8, top), left, openUpward });
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const clickedInsideMore =
        target.closest('[data-more-dropdown]') ||
        (moreMenuButtonRef.current && moreMenuButtonRef.current.contains(target));

      const clickedInsideAction = target.closest('[data-action-dropdown]');

      if (showMoreMenu && !clickedInsideMore) {
        setShowMoreMenu(false);
        setShowExportSubmenu(false);
        setMoreMenuPosition(null);
      }

      if (openActionMenu && !clickedInsideAction) {
        setOpenActionMenu(null);
      }
    };

    if (showMoreMenu || openActionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu, openActionMenu]);

  const loadCustomers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filterType = billingType.filter as any;
      
      const filters: any = {
        limit: 1000,
        search: search || undefined,
      };

      // Add date range filters for New Customers
      if (type === 'new-customers') {
        filters.dateRange = dateRange;
        if (dateRange === 'custom' && startDate && endDate) {
          filters.startDate = startDate;
          filters.endDate = endDate;
        }
      }

      const response = await billingService.getBillingAccounts(filterType, filters);
      
      // Debug: Log to see what data we're getting
      console.log('Billing accounts response:', response);
      if (response.data && response.data.length > 0) {
        console.log('Sample customer data:', response.data[0]);
        console.log('Fields:', Object.keys(response.data[0]));
      }
      
      setCustomers(response.data || []);
      setTotalCount(response.meta?.total || 0);
      setNewCustomersCount(response.meta?.newCustomersCount || null);
    } catch (err: any) {
      console.error('Error loading billing accounts:', err);
      setError('Failed to load billing accounts');
      toast.error('Failed to load billing accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Search is handled by the main Topbar component
    // This handler is kept for compatibility but search is now in Topbar
  };

  const handleView = (customerId: string) => {
    navigate(`/dashboard/customers/view/${customerId}`);
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '—';
    return `৳${Math.round(amount).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCustomers(new Set(customers.map(c => c.customer_id || c.customerId || '')));
    } else {
      setSelectedCustomers(new Set());
    }
  };

  const handleSelectCustomer = (customerId: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const buildExportCsv = () => {
    const ids = Array.from(selectedCustomers);
    const toExport = customers.filter(
      (c: any) => (c.customer_id || c.customerId) && ids.includes(c.customer_id || c.customerId || '')
    );
    const quoteForText = (v: string | number | null | undefined) =>
      '"' + (v == null ? '' : String(v)).replace(/"/g, '""') + '"';
    const escapeCsv = (v: string | number | null | undefined): string => {
      const s = v == null ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const formatDateCsv = (d: string | null | undefined) =>
      !d ? '' : new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const formatCurrencyCsv = (n: number | null | undefined) =>
      n == null ? '' : `৳${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const headers = [
      'Customer ID',
      'Username',
      'Name',
      'Mobile',
      'Package',
      'Bill Amount',
      'Balance',
      'Expiry Date',
      'Last Payment Date',
      'Billing Status',
    ];
    const rows = toExport.map((c: any) => {
      const customerId = formatCustomerIdDisplay(c.customer_code || c.customerCode || '');
      const mobile = c.phone || c.mobile || '';
      return [
        quoteForText(customerId),
        escapeCsv(c.username ?? ''),
        escapeCsv(c.full_name || c.fullName || ''),
        quoteForText(mobile),
        escapeCsv(c.package_name ?? ''),
        formatCurrencyCsv(c.bill_amount ?? c.package_price ?? null),
        formatCurrencyCsv(c.balance ?? null),
        formatDateCsv(c.expiry_date),
        formatDateCsv(c.last_payment_date),
        escapeCsv(c.billing_status ?? ''),
      ];
    });
    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row: string[]) => row.join(',')),
    ].join('\r\n');
    return { csvContent: '\uFEFF' + csvContent, toExport };
  };

  const handleExportOption = async (option: 'Copy' | 'Excel' | 'CSV' | 'PDF' | 'Print') => {
    if (selectedCustomers.size === 0) {
      toast.error('Please select customers first');
      return;
    }
    const { csvContent, toExport } = buildExportCsv();
    if (toExport.length === 0) {
      toast.error('No selected customers to export');
      return;
    }
    setShowMoreMenu(false);
    setShowExportSubmenu(false);
    setMoreMenuPosition(null);

    const dateStr = new Date().toISOString().slice(0, 10);
    if (option === 'Copy') {
      try {
        await navigator.clipboard.writeText(csvContent);
        toast.success(`Copied ${toExport.length} customer(s) to clipboard`);
      } catch {
        toast.error('Failed to copy to clipboard');
      }
      return;
    }
    if (option === 'Excel' || option === 'CSV') {
      const ext = option === 'Excel' ? 'xls' : 'csv';
      const mime = option === 'Excel' ? 'application/vnd.ms-excel;charset=utf-8;' : 'text/csv;charset=utf-8;';
      const blob = new Blob([csvContent], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customer-list-${dateStr}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${toExport.length} customer(s) as ${option}`);
      return;
    }
    if (option === 'PDF' || option === 'Print') {
      const headers = [
        'Customer ID',
        'Username',
        'Name',
        'Mobile',
        'Package',
        'Bill Amount',
        'Balance',
        'Expiry Date',
        'Last Payment Date',
        'Billing Status',
      ];
      const formatDateCsv = (d: string | null | undefined) =>
        !d ? '' : new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const formatCur = (n: number | null | undefined) =>
        n == null ? '' : `৳${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      const rows = toExport.map((c: any) => [
        formatCustomerIdDisplay(c.customer_code || c.customerCode || ''),
        c.username ?? '',
        c.full_name || c.fullName || '',
        c.phone || c.mobile || '',
        c.package_name ?? '',
        formatCur(c.bill_amount ?? c.package_price ?? null),
        formatCur(c.balance ?? null),
        formatDateCsv(c.expiry_date),
        formatDateCsv(c.last_payment_date),
        c.billing_status ?? '',
      ]);
      const tableRows = rows
        .map(
          (row) =>
            '<tr>' +
            row.map((cell) => `<td style="border:1px solid #ccc;padding:6px;">${String(cell).replace(/</g, '&lt;')}</td>`).join('') +
            '</tr>'
        )
        .join('');
      const headerRow =
        '<tr>' +
        headers.map((h) => `<th style="border:1px solid #ccc;padding:6px;background:#f0f0f0;">${h}</th>`).join('') +
        '</tr>';
      const html = `<!DOCTYPE html><html><head><title>Customer List</title></head><body><table style="border-collapse:collapse;width:100%;">${headerRow}${tableRows}</table></body></html>`;
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => {
          win.print();
          if (option === 'PDF') win.close();
        }, 250);
      }
      toast.success(option === 'Print' ? `Print view opened for ${toExport.length} customer(s)` : `PDF/Print view opened for ${toExport.length} customer(s)`);
    }
  };

  const totalSubscribers = customers.length;
  const totalBilled = customers.reduce((sum, c: any) => sum + (parseFloat(String(c.bill_amount || c.package_price || 0)) || 0), 0);
  const totalAdvance = customers.filter((c: any) => (c.balance ?? 0) > 0).reduce((sum, c: any) => sum + (c.balance ?? 0), 0);
  const totalDue = customers.filter((c: any) => (c.balance ?? 0) < 0).reduce((sum, c: any) => sum + Math.abs(c.balance ?? 0), 0);

  return (
    <div className="w-full min-w-0 space-y-4 md:space-y-6">
        {/* Page Header */}
        <PageHeader
          icon={
            type === 'left' ? (
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )
          }
          title={billingType.title}
          subtitle={`Manage subscription statuses, renewals, invoices, and payment cycles`}
          badge={`${totalCount} ${totalCount === 1 ? 'Account' : 'Accounts'}`}
        />

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard
            title="Subscribers"
            value={totalSubscribers}
            subtext="In this category"
            variant="blue"
            icon={<Users className="w-5 h-5" />}
          />
          <MetricCard
            title="Total Bill"
            value={formatCurrency(totalBilled)}
            subtext="Monthly package revenue"
            variant="indigo"
            icon={<Receipt className="w-5 h-5" />}
          />
          <MetricCard
            title="Advance Balance"
            value={formatCurrency(totalAdvance)}
            subtext="Prepaid customer credits"
            variant="emerald"
            icon={<CreditCard className="w-5 h-5" />}
          />
          <MetricCard
            title="Total Due"
            value={formatCurrency(totalDue)}
            subtext="Outstanding receivables"
            variant="rose"
            icon={<AlertCircle className="w-5 h-5" />}
          />
        </div>

        {/* Top Actions & Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* Search + Filter */}
            <form onSubmit={(e) => { e.preventDefault(); loadCustomers(); }} className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="flex-1 min-w-0 relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, phone, or customer code..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-all"
                />
              </div>
              <div className="w-full sm:w-44 relative">
                <select className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-slate-900 dark:text-slate-100 transition-all">
                  <option>All Status</option>
                </select>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all shadow-sm active:scale-95 whitespace-nowrap text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Filter
              </button>
            </form>

            {/* Bulk Actions */}
            <div className="flex flex-wrap gap-2 items-center pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => selectedCustomers.size > 0 && setIsBulkRenewModalOpen(true)}
                disabled={selectedCustomers.size === 0}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-xs flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Bulk Renew
              </button>
              <button
                type="button"
                onClick={() => toast.info('Bulk SMS (not implemented)')}
                disabled={selectedCustomers.size === 0}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-xs flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Bulk SMS
              </button>
              <button
                type="button"
                ref={moreMenuButtonRef}
                onClick={(e) => {
                  const button = e.currentTarget;
                  if (showMoreMenu) {
                    setShowMoreMenu(false);
                    setMoreMenuPosition(null);
                  } else {
                    handleOpenMoreMenu(button);
                    setShowMoreMenu(true);
                  }
                }}
                className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all shadow-sm whitespace-nowrap text-xs flex items-center gap-1.5"
              >
                More
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Date Range Picker for New Customers */}
            {type === 'new-customers' && (
              <div className="flex gap-4 items-center w-full lg:w-auto">
                <div className="w-48">
                  <select
                    value={dateRange}
                    onChange={(e) => {
                      setDateRange(e.target.value as any);
                      if (e.target.value !== 'custom') {
                        setStartDate('');
                        setEndDate('');
                      }
                    }}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm text-slate-900 dark:text-slate-100 transition-all"
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last_7_days">Last 7 Days</option>
                    <option value="last_30_days">Last 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                {dateRange === 'custom' && (
                  <div className="flex gap-2 items-center">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm text-slate-900 dark:text-slate-100"
                    />
                    <span className="text-slate-600 dark:text-slate-400">to</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}

                <button
                  onClick={loadCustomers}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 whitespace-nowrap"
                >
                  Filter
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading State - same as Customers */}
        {isLoading && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-xl md:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl p-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-transparent border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Loading billing accounts...
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please wait while we fetch the data</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State - same as Customers */}
        {!isLoading && !error && customers.length === 0 && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-xl md:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden">
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 mb-6">
                <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No accounts found</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                {search ? 'Try adjusting your search criteria' : `No ${billingType.title.toLowerCase()} found`}
              </p>
            </div>
          </div>
        )}

        {/* Error State - same as Customers */}
        {error && !isLoading && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800 rounded-xl md:rounded-2xl p-6 shadow-lg">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Table */}
        {!isLoading && !error && customers.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]" style={{ tableLayout: 'auto' }}>
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-left" style={{ width: '48px' }}>
                      <input
                        type="checkbox"
                        checked={selectedCustomers.size === customers.length && customers.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">ID</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        USER ID
                      </span>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">NAME</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">MOBILE</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        PACKAGE
                      </span>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">PROTOCOL</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        BILL
                      </span>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        BALANCE
                      </span>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        EXP DATE
                      </span>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-teal-500 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        LAST PAY DATE
                      </span>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">BILLING STATUS</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap sticky right-0 z-20 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700" style={{ minWidth: '64px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                  {customers.map((customer: any) => {
                    const customerId = String(customer.customer_id || customer.customerId || '');
                    const customerCode = customer.customer_code || customer.customerCode || '';
                    const fullName = customer.full_name || customer.fullName || '—';
                    const phone = customer.phone || customer.mobile || '—';
                    const username = customer.username || null;
                    const isSelected = selectedCustomers.has(customerId);
                    const isExpired = customer.billing_status === 'Expired';

                    return (
                      <tr
                        key={customerId}
                        className={`hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-blue-900/10 dark:hover:to-indigo-900/10 transition-all duration-200 ${
                          isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectCustomer(customerId)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                        </td>
                        <td className="px-2 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                          <button
                            onClick={() => handleView(customerId)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors font-semibold"
                            title="View customer profile"
                          >
                            {formatCustomerIdDisplay(customerCode)}
                          </button>
                        </td>
                        <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400">
                          {username && username !== '—' ? (
                            <button
                              onClick={() => handleView(customerId)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                              title="View customer profile"
                            >
                              {username}
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-2 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={fullName}>
                          <button
                            onClick={() => handleView(customerId)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors font-semibold truncate max-w-[200px] block"
                            title={`View ${fullName}'s profile`}
                          >
                            {fullName}
                          </button>
                        </td>
                        <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400">
                          {phone}
                        </td>
                        <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400">
                          {customer.package_name ? (
                            <span className="inline-flex items-center">
                              <svg className="w-4 h-4 mr-1.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                              {customer.package_name}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 uppercase">
                          {customer.protocol ? (
                            <span className="inline-flex items-center">
                              {getProtocolIcon(customer.protocol)}
                              {customer.protocol}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 font-bold">
                          {formatCurrency(customer.bill_amount || customer.package_price)}
                        </td>
                        <td className={`px-4 py-3 text-sm font-bold ${(customer.balance ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                          {formatCurrency(customer.balance)}
                        </td>
                        <td className={`px-4 py-3 text-sm font-medium ${customer.billing_status === 'Left' ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                          {formatExpiryDisplay(customer.expiry_date)}
                        </td>
                        <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400">
                          {formatDate(customer.last_payment_date)}
                        </td>
                        <td className="px-2 py-2">
                          {customer.billing_status ? (
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getBillingStatusBadgeClass(customer.billing_status)}`}
                            >
                              {getBillingStatusIcon(customer.billing_status)}
                              {customer.billing_status}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {isExpired && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionMenu(null);
                                  navigate(`/dashboard/customers/view/${customerId}`, { state: { openRenew: true } });
                                }}
                                className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
                                title="Renew"
                              >
                                Renew
                              </button>
                            )}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionMenu(openActionMenu === customerId ? null : customerId);
                                }}
                                className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                                title="Actions"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              </button>
                              {openActionMenu === customerId && (
                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50">
                                  <div className="py-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleView(customerId);
                                        setOpenActionMenu(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    >
                                      View Details
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenActionMenu(null);
                                        navigate(`/dashboard/customers/view/${customerId}`, { state: { openRenew: true } });
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    >
                                      Renew
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenActionMenu(null);
                                        navigate(`/dashboard/customers/edit/${customerId}`);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            <div className="bg-slate-50/80 dark:bg-slate-800/60 px-6 py-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="text-base font-medium text-slate-600 dark:text-slate-400">
                  Total Users: <span className="text-blue-600 dark:text-blue-400 font-semibold">{customers.length}</span>
                  {selectedCustomers.size > 0 && (
                    <span className="text-slate-500 dark:text-slate-400 font-normal"> ({selectedCustomers.size} selected)</span>
                  )}
                </div>
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="text-base font-medium text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Total Bill: <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatCurrency(customers.reduce((sum, c) => sum + (parseFloat(String(c.bill_amount || c.package_price || 0)) || 0), 0))}
                      </span>
                    </span>
                  </div>
                  <div className="text-base font-medium text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Advance: <span className="text-green-600 dark:text-green-400 font-bold">
                        {formatCurrency(customers.filter(c => (c.balance ?? 0) > 0).reduce((sum, c) => sum + (c.balance ?? 0), 0))}
                      </span>
                    </span>
                  </div>
                  <div className="text-base font-medium text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Due: <span className="text-orange-600 dark:text-orange-400 font-bold">
                        {formatCurrency(customers.filter(c => (c.balance ?? 0) < 0).reduce((sum, c) => sum + Math.abs(c.balance ?? 0), 0))}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Portal-based More Menu Dropdown (copied from Customers page) */}
        {showMoreMenu && moreMenuPosition && (
          createPortal(
            <div
              data-more-dropdown
              className="fixed bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-2 border-blue-200 dark:border-blue-800 rounded-xl shadow-2xl z-[9999] min-w-[224px] max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-transparent"
              style={{
                top: `${moreMenuPosition.top}px`,
                left: `${moreMenuPosition.left}px`,
                opacity: 1,
                animation: 'fadeInScale 0.15s ease-out',
              }}
            >
              <style>{`
                @keyframes fadeInScale {
                  from {
                    opacity: 0;
                    transform: ${moreMenuPosition.openUpward ? 'translateY(4px) scale(0.95)' : 'translateY(-4px) scale(0.95)'};
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                  }
                }
              `}</style>
              <div className="py-1">
                {showExportSubmenu ? (
                  <>
                    <button
                      onClick={() => setShowExportSubmenu(false)}
                      className="w-full px-4 py-2 text-left text-sm text-slate-500 dark:text-slate-400 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-colors flex items-center gap-3"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Export
                    </button>
                    <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                    {(['Copy', 'Excel', 'CSV', 'PDF', 'Print'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleExportOption(opt)}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-colors flex items-center gap-3"
                      >
                        <span className="text-blue-500">
                          {moreMenuIcons['Export'] ?? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    ))}
                  </>
                ) : (
                  moreMenuItems.map((item) => {
                    const icon = moreMenuIcons[item] ?? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v.01M12 12v.01M12 18v.01" />
                      </svg>
                    );
                    const iconColor = moreMenuIconColors[item] || 'text-indigo-500';

                    return (
                      <button
                        key={item}
                        onClick={() => handleMoreMenuAction(item)}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-colors flex items-center gap-3 group"
                      >
                        <span className={iconColor}>
                          {icon}
                        </span>
                        <span className="flex-1">{item}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )
        )}

      {/* Bulk Renew Modal */}
      {isBulkRenewModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 dark:bg-black/60" onClick={() => setIsBulkRenewModalOpen(false)} aria-hidden />
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-600 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Bulk Renew</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{selectedCustomers.size} customer(s) selected</p>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Renewal Selected Customer For</label>
            <select
              value={bulkRenewDuration}
              onChange={(e) => setBulkRenewDuration(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {BULK_RENEW_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsBulkRenewModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const ids = Array.from(selectedCustomers);
                  const selectedRows = customers.filter((c: any) => selectedCustomers.has(String(c.customer_id ?? c.customerId ?? '')));
                  setIsBulkRenewModalOpen(false);
                  navigate('/dashboard/billing/bulk-renew', { state: { customerIds: ids, duration: bulkRenewDuration, customers: selectedRows } });
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
