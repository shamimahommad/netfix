import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { customersService } from '@/services/customers.service';
import { Customer } from '@/types/customer.types';
import { useToastContext } from '@/contexts/ToastContext';
import { useTenantStore } from '@/stores/tenantStore';
import CreateCustomerModal from '@/components/CreateCustomerModal';
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

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'pending_activation', label: 'Pending Activation' },
  { value: 'terminated', label: 'Terminated' },
];

const getBillingStatusBadgeClass = (status: Customer['billing_status']): string => {
  const classes: Record<string, string> = {
    Paid: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
    Due: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700',
    Expired: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
    Left: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700 font-bold',
    Suspended: 'bg-red-200 text-red-900 border-red-600 dark:bg-red-900/60 dark:text-red-100 dark:border-red-500 font-semibold',
  };
  return classes[status || ''] || 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700';
};

/** Icons for billing status: Active/Paid, Due, Expired, Left, Suspended */
const getBillingStatusIcon = (status: Customer['billing_status']): JSX.Element | null => {
  if (!status) return null;
  const className = 'w-3.5 h-3.5 mr-1.5 shrink-0';
  switch (status) {
    case 'Paid':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    case 'Due':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      );
    case 'Expired':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      );
    case 'Left':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path fillRule="evenodd" d="M3 10a1 1 0 011-1h10a1 1 0 110 2H4a1 1 0 01-1-1zm12.707-4.707a1 1 0 00-1.414-1.414L10 9.586 7.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    case 'Suspended':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    default:
      return null;
  }
};

export default function CustomersListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToastContext();
  const { selectedTenant } = useTenantStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showExportSubmenu, setShowExportSubmenu] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [isBulkRenewModalOpen, setIsBulkRenewModalOpen] = useState(false);
  const [bulkRenewDuration, setBulkRenewDuration] = useState<string>('full_month');
  const moreMenuRef = useRef<HTMLDivElement>(null);

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

  // Update search and status from URL params (e.g. drill-down from Reseller/Area Wise reports)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlStatus = searchParams.get('status') || '';
    setSearch(urlSearch);
    setStatusFilter(urlStatus);
  }, [searchParams]);

  // Load customers when filters change (debounced for search)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadCustomers();
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(timeoutId);
  }, [statusFilter, search, searchParams]);

  // Close more menu and action menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
        setShowExportSubmenu(false);
      }
      // Close action menus when clicking outside
      if (openActionMenu) {
        setOpenActionMenu(null);
      }
    };

    if (showMoreMenu || openActionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu, openActionMenu]);

  const loadCustomers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const ownerId = searchParams.get('ownerId') || undefined;
      const area = searchParams.get('area') || undefined;
      const serverId = searchParams.get('serverId') || undefined;
      const response = await customersService.getCustomers({
        status: statusFilter || undefined,
        search: search || undefined,
        ownerId,
        area,
        serverId,
        page: 1,
        limit: 100,
      });

      setCustomers(response.data);
      setTotal(response.meta.total);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load customers. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loadCustomers();
  };

  const handleView = (customerId: string) => {
    navigate(`/dashboard/customers/view/${customerId}`);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null): string => {
    if (amount === null || amount === undefined) return '—';
    return `৳${Number(amount).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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

  const handleBulkRenew = () => {
    if (selectedCustomers.size === 0) {
      toast.error('Please select customers to renew');
      return;
    }
    setIsBulkRenewModalOpen(true);
  };

  const handleBulkSMS = () => {
    if (selectedCustomers.size === 0) {
      toast.error('Please select customers to send SMS');
      return;
    }
    toast.info(`Bulk SMS for ${selectedCustomers.size} customers (not implemented)`);
  };

  const handleQuickRenew = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenActionMenu(null);
    navigate(`/dashboard/customers/view/${customerId}`, { state: { openRenew: true } });
  };

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
      const isLeft = (c: Customer) =>
        c.billing_status === 'Left' || c.status === 'terminated' || c.status === 'cancelled';
      const notLeft = customerList.filter((c) => !isLeft(c));
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

  /** Build CSV with Mobile and Customer ID always quoted so leading zeros (e.g. 017...) are preserved in Excel. */
  const buildExportCsv = () => {
    const ids = Array.from(selectedCustomers);
    const toExport = customers.filter(
      (c) => (c.customer_id || c.customerId) && ids.includes(c.customer_id || c.customerId || '')
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
    const formatDateCsv = (dateString: string | null | undefined): string => {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };
    const formatCurrencyCsv = (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined) return '';
      return `৳${Number(amount).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };
    const headers = [
      'Customer ID',
      'Username',
      'Name',
      'Mobile',
      'Package',
      'Protocol',
      'Bill Amount',
      'Balance',
      'Expiry Date',
      'Last Payment Date',
      'Billing Status',
      'Status',
    ];
    const rows = toExport.map((c) => {
      const customerId = formatCustomerIdDisplay(c.customer_code || c.customerCode || '');
      const mobile = c.phone || c.mobile || '';
      return [
        quoteForText(customerId),
        escapeCsv(c.username ?? ''),
        escapeCsv(c.full_name || c.fullName || ''),
        quoteForText(mobile),
        escapeCsv(c.package_name ?? ''),
        escapeCsv(c.protocol ?? ''),
        formatCurrencyCsv(c.bill_amount ?? c.package_price ?? null),
        formatCurrencyCsv(c.balance ?? null),
        formatDateCsv(c.expiry_date),
        formatDateCsv(c.last_payment_date),
        escapeCsv(c.billing_status ?? ''),
        escapeCsv(c.status ?? ''),
      ];
    });
    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.join(',')),
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
        'Protocol',
        'Bill Amount',
        'Balance',
        'Expiry Date',
        'Last Payment Date',
        'Billing Status',
        'Status',
      ];
      const formatDateCsv = (d: string | null | undefined) =>
        !d ? '' : new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const formatCur = (n: number | null | undefined) =>
        n == null ? '' : `৳${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      const rows = toExport.map((c) => [
        formatCustomerIdDisplay(c.customer_code || c.customerCode || ''),
        c.username ?? '',
        c.full_name || c.fullName || '',
        c.phone || c.mobile || '',
        c.package_name ?? '',
        c.protocol ?? '',
        formatCur(c.bill_amount ?? c.package_price ?? null),
        formatCur(c.balance ?? null),
        formatDateCsv(c.expiry_date),
        formatDateCsv(c.last_payment_date),
        c.billing_status ?? '',
        c.status ?? '',
      ]);
      const tableRows = rows
        .map(
          (row) =>
            '<tr>' + row.map((cell) => `<td style="border:1px solid #ccc;padding:6px;">${String(cell).replace(/</g, '&lt;')}</td>`).join('') + '</tr>'
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
      if (option === 'Print') toast.success(`Print view opened for ${toExport.length} customer(s)`);
      else toast.success(`PDF/Print view opened for ${toExport.length} customer(s)`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="max-w-[1920px] mx-auto space-y-6">
        {/* Page Header */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            Customer List
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            {isLoading ? 'Loading...' : `${total} ${total === 1 ? 'customer' : 'customers'}`}
          </p>
        </div>

        {/* Top Actions Bar */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Filter/Search Section */}
            <form onSubmit={handleSearch} className="flex flex-1 gap-4 items-center">
              <div className="flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, phone, or customer code..."
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                />
              </div>
              <div className="w-48">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm text-slate-900 dark:text-slate-100 transition-all"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="px-6 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 whitespace-nowrap"
              >
                Filter
              </button>
            </form>

            {/* Bulk Actions */}
            <div className="flex gap-2 items-center">
              <button
                onClick={handleBulkRenew}
                disabled={selectedCustomers.size === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
              >
                Bulk Renew
              </button>
              <button
                onClick={handleBulkSMS}
                disabled={selectedCustomers.size === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
              >
                Bulk SMS
              </button>
              
              {/* More Dropdown */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all shadow-sm hover:shadow-md whitespace-nowrap text-sm flex items-center gap-2"
                >
                  More
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                    <div className="py-2">
                      {showExportSubmenu ? (
                        <>
                          <button
                            onClick={() => setShowExportSubmenu(false)}
                            className="w-full px-4 py-2 text-left text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
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
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              {opt}
                            </button>
                          ))}
                        </>
                      ) : (
                        moreMenuItems.map((item) => (
                          <button
                            key={item}
                            onClick={() => handleMoreMenuAction(item)}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            {item}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl p-12">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && customers.length === 0 && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 mb-6">
              <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No customers found</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              {search || statusFilter
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by adding your first customer'}
            </p>
            {!search && !statusFilter && (
              <button
                onClick={() => {
                  if (!selectedTenant) {
                    toast.error('Please select an ISP first');
                    return;
                  }
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Customer</span>
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {!isLoading && !error && customers.length > 0 && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px]">
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-800/50 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left" style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedCustomers.size === customers.length && customers.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Customer ID</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">User ID / Username</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Mobile</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Package</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Protocol</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Bill Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Balance</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Expiry Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Last Payment Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Billing Status</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {customers.map((customer) => {
                    const customerId = customer.customer_id || customer.customerId || '';
                    const customerCode = customer.customer_code || customer.customerCode || '';
                    const fullName = customer.full_name || customer.fullName || '—';
                    const phone = customer.phone || customer.mobile || '—';
                    const username = customer.username || '—';
                    const isSelected = selectedCustomers.has(customerId);
                    const isExpired = customer.billing_status === 'Expired';

                    return (
                      <tr
                        key={customerId}
                        className={`hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-blue-900/10 dark:hover:to-indigo-900/10 transition-all duration-200 ${
                          isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectCustomer(customerId)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                          <button
                            onClick={() => handleView(customerId)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors font-semibold"
                            title="View customer profile"
                          >
                            {formatCustomerIdDisplay(customerCode)}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          <button
                            onClick={() => handleView(customerId)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                            title="View customer profile"
                          >
                            {username}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={fullName}>
                          <button
                            onClick={() => handleView(customerId)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors font-semibold truncate max-w-[200px] block"
                            title={`View ${fullName}'s profile`}
                          >
                            {fullName}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {phone}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {customer.package_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 uppercase">
                          {customer.protocol || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-bold">
                          {formatCurrency(customer.bill_amount || customer.package_price)}
                        </td>
                        <td className={`px-4 py-3 text-sm font-bold ${(customer.balance ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                          {formatCurrency(customer.balance)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {formatExpiryDisplay(customer.expiry_date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {formatDate(customer.last_payment_date)}
                        </td>
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {isExpired && (
                              <button
                                onClick={(e) => handleQuickRenew(customerId, e)}
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
                                        handleQuickRenew(customerId, e);
                                        setOpenActionMenu(null);
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

            {/* Pagination */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-800/50 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Showing {customers.length} of {total} customers
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    disabled
                    className="px-4 py-2 text-sm font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    disabled
                    className="px-4 py-2 text-sm font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Customer Modal */}
        <CreateCustomerModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            loadCustomers();
          }}
        />

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
                <button type="button" onClick={() => setIsBulkRenewModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50">Cancel</button>
                <button
                type="button"
                onClick={() => {
                  const ids = Array.from(selectedCustomers);
                  setIsBulkRenewModalOpen(false);
                  navigate('/dashboard/billing/bulk-renew', { state: { customerIds: ids, duration: bulkRenewDuration, customers: [] } });
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
    </div>
  );
}
