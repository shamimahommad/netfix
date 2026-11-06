import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { customersService } from '@/services/customers.service';
import { Customer } from '@/types/customer.types';
import { useToastContext } from '@/contexts/ToastContext';
import AddClientPage from '@/pages/AddClientPage';
import { formatCustomerIdDisplay } from '@/lib/formatCustomerId';
import { formatExpiryDisplay, isLifetimeExpiry } from '@/lib/formatExpiry';
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
import { PageHeader } from '@/components/common';

const CUSTOMER_TYPES: Record<string, { title: string; description: string; statusFilter?: string }> = {
  all: { title: 'All Customers', description: 'View all customers in your system.' },
  add: { title: 'Add Customer', description: 'Create a new customer account.' },
  suspended: { title: 'Suspended Customers', description: 'View all suspended customers.', statusFilter: 'suspended' },
  'expiring-soon': { title: 'Expiring Soon', description: 'View customers whose subscriptions are expiring soon.' },
  online: { title: 'Online Customers', description: 'View all currently online customers.' },
  offline: { title: 'Offline Customers', description: 'View all currently offline customers.' },
};

// Icon Components
function UserIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function MoreVerticalIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  );
}

function ChevronDownIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CustomersIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function FilterIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

function RenewIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function SMSIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function PackageIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
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

function MoneyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// Sortable Header Component
type SortDirection = 'asc' | 'desc' | null;

interface SortableHeaderProps {
  label: string | ReactNode;
  sortKey: string;
  currentSort: { key: string; direction: SortDirection };
  onSort: (key: string) => void;
  className?: string;
  children?: ReactNode;
}

function SortableHeader({ label, sortKey, currentSort, onSort, className = '', children }: SortableHeaderProps) {
  const isActive = currentSort.key === sortKey;
  const direction = isActive ? currentSort.direction : null;

  const handleClick = () => {
    onSort(sortKey);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSort(sortKey);
    }
  };

  const getAriaSort = (): 'ascending' | 'descending' | 'none' | undefined => {
    if (!isActive) return 'none';
    return direction === 'asc' ? 'ascending' : 'descending';
  };

  const getSortIcon = () => {
    if (direction === 'asc') {
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    } else if (direction === 'desc') {
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      );
    } else {
      // Neutral state: ↕ (up-down arrows)
      return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
  };

  return (
    <th
      className={`px-2 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors group ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-sort={getAriaSort()}
      role="columnheader"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {children}
          {typeof label === 'string' ? <span>{label}</span> : label}
        </div>
        <span className={`transition-all duration-200 ${isActive ? 'text-blue-600 dark:text-blue-400 opacity-100' : 'text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100'}`}>
          {getSortIcon()}
        </span>
      </div>
    </th>
  );
}

// Icon mapping for More menu items
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

const getBillingStatusBadgeClass = (status: Customer['billing_status']): string => {
  const classes: Record<string, string> = {
    Paid: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-400 dark:from-green-900/40 dark:to-emerald-900/40 dark:text-green-300 dark:border-green-600 shadow-sm',
    Due: 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border-orange-400 dark:from-orange-900/40 dark:to-amber-900/40 dark:text-orange-300 dark:border-orange-600 shadow-sm',
    Expired: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-400 dark:from-red-900/40 dark:to-rose-900/40 dark:text-red-300 dark:border-red-600 shadow-sm',
    Left: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-amber-400 dark:from-amber-900/40 dark:to-yellow-900/40 dark:text-amber-300 dark:border-amber-600 font-bold shadow-sm',
    Suspended: 'bg-gradient-to-r from-red-200 to-red-300 text-red-900 border-red-600 dark:from-red-900/60 dark:to-red-800/60 dark:text-red-100 dark:border-red-500 font-semibold shadow-sm',
    Pending: 'bg-gradient-to-r from-slate-100 to-gray-200 text-slate-800 border-slate-400 dark:from-slate-800/50 dark:to-gray-800/50 dark:text-slate-200 dark:border-slate-600 font-semibold shadow-sm',
  };
  return classes[status || ''] || 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700';
};

/** Billing Status display: Paid → Active, Due → Due, Left → Left, Suspended → Suspended, Expired → Expired */
const getBillingStatusLabel = (status: Customer['billing_status']): string => {
  if (!status) return '—';
  const labels: Record<string, string> = {
    Paid: 'Active',
    Due: 'Due',
    Left: 'Left',
    Suspended: 'Suspended',
    Expired: 'Expired',
    Pending: 'Pending',
  };
  return labels[status] ?? status;
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
    case 'Pending':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      );
    default:
      return null;
  }
};

/**
 * Get status badge class based on account status or online status.
 * Status color rules (STRICT):
 * - ONLINE → Green
 * - OFFLINE → Gray
 * - SUSPENDED → Orange
 * - EXPIRED → Red
 * - FREE / TRIAL → Blue
 */
const getAccountStatusBadgeClass = (accountStatus: Customer['account_status'], onlineStatus?: boolean): string => {
  // If online_status is explicitly provided, use it
  if (onlineStatus === true) {
    return 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-400 dark:from-green-900/40 dark:to-emerald-900/40 dark:text-green-300 dark:border-green-600 shadow-sm';
  }
  if (onlineStatus === false) {
    return 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border-gray-400 dark:from-gray-900/40 dark:to-slate-900/40 dark:text-gray-300 dark:border-gray-600 shadow-sm';
  }
  
  // Otherwise use account_status
  const classes: Record<string, string> = {
    active: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-400 dark:from-green-900/40 dark:to-emerald-900/40 dark:text-green-300 dark:border-green-600 shadow-sm',
    suspended: 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border-orange-400 dark:from-orange-900/40 dark:to-amber-900/40 dark:text-orange-300 dark:border-orange-600 shadow-sm',
    expired: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-400 dark:from-red-900/40 dark:to-rose-900/40 dark:text-red-300 dark:border-red-600 shadow-sm',
  };
  return classes[accountStatus || ''] || 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border-gray-400 dark:from-gray-900/40 dark:to-slate-900/40 dark:text-gray-300 dark:border-gray-600 shadow-sm';
};

export default function CustomersPage() {
  const { type = 'all' } = useParams<{ type: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToastContext();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const urlOwnerId = searchParams.get('ownerId') || '';
  const urlStatusFromUrl = searchParams.get('status') || '';
  const [statusFilter, setStatusFilter] = useState(urlStatusFromUrl || '');
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showExportSubmenu, setShowExportSubmenu] = useState(false);
  const [moreMenuPosition, setMoreMenuPosition] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: SortDirection }>({ key: '', direction: null });
  const [sortedCustomers, setSortedCustomers] = useState<Customer[]>([]);
  const [isBulkRenewModalOpen, setIsBulkRenewModalOpen] = useState(false);
  const [bulkRenewDuration, setBulkRenewDuration] = useState<string>('full_month');

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
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  const actionButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const customerType = CUSTOMER_TYPES[type] || CUSTOMER_TYPES.all;

  // Sync status filter when URL status param changes (e.g. from Reseller Wise drill-down)
  useEffect(() => {
    if (urlStatusFromUrl) setStatusFilter(urlStatusFromUrl);
  }, [urlStatusFromUrl]);

  useEffect(() => {
    if (type === 'add') return;
    loadCustomers();
  }, [type, statusFilter, urlOwnerId]);

  // Apply sorting when customers or sortConfig changes
  useEffect(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      setSortedCustomers(customers);
      return;
    }

    const sorted = [...customers].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'id':
          const aCode = a.customer_code || a.customerCode || '';
          const bCode = b.customer_code || b.customerCode || '';
          aValue = parseInt(formatCustomerIdDisplay(aCode), 10) || 0;
          bValue = parseInt(formatCustomerIdDisplay(bCode), 10) || 0;
          break;
        case 'userId':
          aValue = (a.username || '').toLowerCase();
          bValue = (b.username || '').toLowerCase();
          break;
        case 'name':
          aValue = (a.full_name || a.fullName || '').toLowerCase();
          bValue = (b.full_name || b.fullName || '').toLowerCase();
          break;
        case 'mobile':
          aValue = (a.phone || a.mobile || '').toLowerCase();
          bValue = (b.phone || b.mobile || '').toLowerCase();
          break;
        case 'package':
          aValue = (a.package_name || '').toLowerCase();
          bValue = (b.package_name || '').toLowerCase();
          break;
        case 'protocol':
          aValue = (a.protocol || '').toLowerCase();
          bValue = (b.protocol || '').toLowerCase();
          break;
        case 'bill':
          aValue = a.bill_amount ?? a.package_price ?? 0;
          bValue = b.bill_amount ?? b.package_price ?? 0;
          break;
        case 'balance':
          aValue = a.balance ?? 0;
          bValue = b.balance ?? 0;
          break;
        case 'expDate':
          aValue = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
          bValue = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
          break;
        case 'lastPayDate':
          aValue = a.last_payment_date ? new Date(a.last_payment_date).getTime() : 0;
          bValue = b.last_payment_date ? new Date(b.last_payment_date).getTime() : 0;
          break;
        case 'billingStatus':
          const statusOrder: Record<string, number> = {
            Pending: 0,
            Paid: 1,
            Due: 2,
            Expired: 3,
            Suspended: 4,
            Left: 5,
          };
          aValue = statusOrder[a.billing_status || ''] ?? 6;
          bValue = statusOrder[b.billing_status || ''] ?? 6;
          break;
        case 'remainingDays':
          aValue = calculateRemainingDays(a.expiry_date) ?? 0;
          bValue = calculateRemainingDays(b.expiry_date) ?? 0;
          break;
        case 'uptime':
          aValue = a.uptime_seconds ?? 0;
          bValue = b.uptime_seconds ?? 0;
          break;
        case 'ip':
          aValue = (a.ip_address || '').toLowerCase();
          bValue = (b.ip_address || '').toLowerCase();
          break;
        case 'mac':
          aValue = (a.mac_address || '').toLowerCase();
          bValue = (b.mac_address || '').toLowerCase();
          break;
        case 'upload':
          aValue = a.upload_bytes ?? 0;
          bValue = b.upload_bytes ?? 0;
          break;
        case 'download':
          aValue = a.download_bytes ?? 0;
          bValue = b.download_bytes ?? 0;
          break;
        case 'lastOffline':
          aValue = a.last_logout_at ? new Date(a.last_logout_at).getTime() : 0;
          bValue = b.last_logout_at ? new Date(b.last_logout_at).getTime() : 0;
          break;
        default:
          return 0;
      }

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Compare values
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    setSortedCustomers(sorted);
  }, [customers, sortConfig]);

  // Calculate dropdown position
  const calculateDropdownPosition = (buttonElement: HTMLButtonElement, dropdownWidth: number = 224, maxHeight: number = 320) => {
    const rect = buttonElement.getBoundingClientRect();
    const spacing = 8; // Space between button and dropdown
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Check if we should open upward
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < maxHeight && spaceAbove > spaceBelow;
    
    // Calculate horizontal position (right-align to button)
    let left = rect.right - dropdownWidth;
    if (left < 8) left = 8; // Minimum margin from viewport edge
    if (left + dropdownWidth > viewportWidth - 8) left = viewportWidth - dropdownWidth - 8; // Ensure doesn't overflow right
    
    // Calculate vertical position
    const top = openUpward 
      ? rect.top - Math.min(maxHeight, 400) - spacing
      : rect.bottom + spacing;
    
    return { top, left, openUpward };
  };

  // Handle opening More menu
  const handleOpenMoreMenu = (buttonElement: HTMLButtonElement) => {
    const position = calculateDropdownPosition(buttonElement);
    setMoreMenuPosition(position);
    setShowMoreMenu(true);
  };

  // Handle opening Action menu for a specific customer
  const handleOpenActionMenu = (customerId: string, buttonElement: HTMLButtonElement) => {
    // Store button reference
    actionButtonRefs.current.set(customerId, buttonElement);
    
    // Calculate dropdown position (action menu is narrower, ~192px)
    const position = calculateDropdownPosition(buttonElement, 192, 200);
    setActionMenuPosition(position);
    setOpenActionMenu(customerId);
  };

  // Close more menu and action menus when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Close "More" dropdown
      if (showMoreMenu) {
        // Check if click is on the button that opened the menu
        if (moreMenuButtonRef.current && moreMenuButtonRef.current.contains(target)) {
          return; // Don't close if clicking the same button (toggle behavior)
        }
        
        // Check if click is inside the portal dropdown
        const dropdownElement = document.querySelector('[data-more-dropdown]');
        if (dropdownElement && dropdownElement.contains(target)) {
          return; // Don't close if clicking inside dropdown
        }
        
        setShowMoreMenu(false);
        setShowExportSubmenu(false);
        setMoreMenuPosition(null);
      }
      
      // Close action menu if clicking outside
      if (openActionMenu) {
        // Check if click is on the button that opened the menu
        const button = actionButtonRefs.current.get(openActionMenu);
        if (button && button.contains(target)) {
          return; // Don't close if clicking the same button (toggle behavior)
        }
        
        // Check if click is inside the portal dropdown
        const dropdownElement = document.querySelector('[data-action-dropdown]');
        if (dropdownElement && dropdownElement.contains(target)) {
          return; // Don't close if clicking inside dropdown
        }
        
        setOpenActionMenu(null);
        setActionMenuPosition(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (openActionMenu) {
          setOpenActionMenu(null);
          setActionMenuPosition(null);
        }
        if (showMoreMenu) {
          setShowMoreMenu(false);
          setShowExportSubmenu(false);
          setMoreMenuPosition(null);
        }
      }
    };

    // Update position on scroll/resize
    const handleScrollResize = () => {
      if (openActionMenu && actionMenuPosition && moreMenuButtonRef.current) {
        const button = actionButtonRefs.current.get(openActionMenu);
        if (button) {
          const newPosition = calculateDropdownPosition(button, 192, 200);
          setActionMenuPosition(newPosition);
        }
      }
      if (showMoreMenu && moreMenuPosition && moreMenuButtonRef.current) {
        const newPosition = calculateDropdownPosition(moreMenuButtonRef.current, 224, 320);
        setMoreMenuPosition(newPosition);
      }
    };

    if (showMoreMenu || openActionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      window.addEventListener('scroll', handleScrollResize, true);
      window.addEventListener('resize', handleScrollResize);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, [showMoreMenu, openActionMenu, actionMenuPosition, moreMenuPosition]);

  const loadCustomers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters: any = {
        page: 1,
        limit: 1000,
      };

      // For online/offline types, don't use statusFilter (it's not a valid status)
      // We'll filter by online_status client-side instead
      if (type === 'online' || type === 'offline') {
        // Fetch all customers, we'll filter by online_status below
        if (statusFilter) {
          filters.status = statusFilter;
        }
      } else if (customerType.statusFilter) {
        filters.status = customerType.statusFilter;
      } else if (statusFilter) {
        filters.status = statusFilter;
      }

      if (search) {
        filters.search = search;
      }

      if (urlOwnerId) {
        filters.ownerId = urlOwnerId;
      }

      if (type === 'expiring-soon') {
        filters.status = 'active';
      }

      const response = await customersService.getCustomers({
        ...filters,
        type: type, // Pass type to trigger realtime sync on backend
      });
      let filteredCustomers = response.data || [];

      // Client-side filtering for online/offline
      if (type === 'online') {
        filteredCustomers = filteredCustomers.filter(c => c.online_status === true);
      } else if (type === 'offline') {
        filteredCustomers = filteredCustomers.filter(c => c.online_status === false);
      }

      if (type === 'expiring-soon') {
        filteredCustomers = filteredCustomers.filter(c => c.status === 'active');
      }

      setCustomers(filteredCustomers);
      setTotal(filteredCustomers.length);
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

  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number | null): string => {
    if (amount === null || amount === undefined) return '—';
    return `৳${Math.round(amount).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Format uptime: HH:mm:ss or d HH:mm
  const formatUptime = (seconds: number | null | undefined): string => {
    if (!seconds || seconds === 0) return '—';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
      return `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format traffic: MB or GB. Use "—" for missing; never show 0 as fake value.
  const formatTraffic = (bytes: number | null | undefined): string => {
    if (bytes == null) return '—';
    const num = Number(bytes);
    if (isNaN(num) || num <= 0) return '0 GB';
    const gb = num / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = num / (1024 * 1024);
    if (mb >= 1) return `${gb.toFixed(2)} GB (${mb.toFixed(0)} MB)`;
    const kb = num / 1024;
    return `${(num / (1024 * 1024 * 1024)).toFixed(3)} GB (${kb.toFixed(0)} KB)`;
  };

  // Calculate remaining days from expiry date (Lifetime = null)
  const calculateRemainingDays = (expiryDate: string | null | undefined): number | null => {
    if (!expiryDate || isLifetimeExpiry(expiryDate)) return null;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const customersToUse = sortConfig.key && sortConfig.direction ? sortedCustomers : customers;
    if (e.target.checked) {
      setSelectedCustomers(new Set(customersToUse.map(c => c.customer_id || c.customerId || '')));
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
    setActionMenuPosition(null);
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

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key !== key) {
        // New column: start with ascending
        return { key, direction: 'asc' };
      } else {
        // Same column: toggle direction
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { key, direction: 'asc' };
        } else {
          return { key, direction: 'asc' };
        }
      }
    });
  };

  // For "Add Customer" type, show the form
  if (type === 'add') {
    return <AddClientPage />;
  }

  return (
    <div className="w-full min-w-0 space-y-4 md:space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<CustomersIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title={customerType.title}
        subtitle={customerType.description}
        badge={`${total} ${type === 'online' ? (total === 1 ? 'Online' : 'Online') : type === 'offline' ? (total === 1 ? 'Offline' : 'Offline') : (total === 1 ? 'Customer' : 'Customers')}`}
        actions={
          <button
            onClick={() => navigate('/dashboard/customers/add')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-all shadow-sm active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Customer
          </button>
        }
      />

      {/* Top Actions & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          {/* Filter/Search Section */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="flex-1 min-w-0 relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone, or customer code..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-all"
              />
            </div>
            {!customerType.statusFilter && (
              <div className="w-full sm:w-44 relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-slate-900 dark:text-slate-100 transition-all"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="pending_activation">Pending Activation</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
            )}
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all shadow-sm active:scale-95 whitespace-nowrap text-sm flex items-center justify-center gap-2"
            >
              <SearchIcon className="w-4 h-4" />
              Filter
            </button>
          </form>

          {/* Bulk Actions */}
          <div className="flex flex-wrap gap-2 items-center pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleBulkRenew}
              disabled={selectedCustomers.size === 0}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-xs flex items-center gap-1.5"
            >
              <RenewIcon className="w-3.5 h-3.5" />
              Bulk Renew
            </button>
            <button
              onClick={handleBulkSMS}
              disabled={selectedCustomers.size === 0}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-xs flex items-center gap-1.5"
            >
              <SMSIcon className="w-3.5 h-3.5" />
              Bulk SMS
            </button>
            
            {/* More Dropdown */}
            <button
              ref={moreMenuButtonRef}
              onClick={(e) => {
                const button = e.currentTarget;
                if (showMoreMenu) {
                  setShowMoreMenu(false);
                  setMoreMenuPosition(null);
                } else {
                  handleOpenMoreMenu(button);
                }
              }}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all shadow-sm whitespace-nowrap text-xs flex items-center gap-1.5"
            >
              More
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

        {/* Loading State */}
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
                  {type === 'online' ? 'Loading online customers...' : type === 'offline' ? 'Loading offline customers...' : 'Loading customers...'}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please wait while we fetch the data</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && customers.length === 0 && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-xl md:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden">
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 mb-6">
                  <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No customers found</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  {search ? 'Try adjusting your search criteria' : customerType.description}
                </p>
              </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800 rounded-xl md:rounded-2xl p-6 shadow-lg">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Table */}
        {!isLoading && !error && customers.length > 0 && (() => {
          const customersToDisplay = sortConfig.key && sortConfig.direction ? sortedCustomers : customers;
          const totalBill = customersToDisplay.reduce((sum, c) => sum + (c.bill_amount ?? c.package_price ?? 0), 0);
          const totalAdvance = customersToDisplay.filter(c => (c.balance ?? 0) > 0).reduce((sum, c) => sum + (c.balance ?? 0), 0);
          const totalDue = customersToDisplay.filter(c => (c.balance ?? 0) < 0).reduce((sum, c) => sum + Math.abs(c.balance ?? 0), 0);

          return (
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-xl md:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden">
              {/* Desktop (≥1024px): No horizontal scrollbar */}
              <div className="hidden lg:block overflow-x-auto overflow-y-visible">
                <table className="w-full" style={{ tableLayout: 'auto' }}>
                  <thead className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-700/50 dark:via-slate-800/50 dark:to-slate-800/50 border-b-2 border-blue-200 dark:border-slate-700 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 text-left" style={{ width: '48px' }}>
                        <input
                          type="checkbox"
                          checked={customersToDisplay.length > 0 && selectedCustomers.size === customersToDisplay.length}
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </th>
                      {type === 'online' || type === 'offline' ? (
                        // Online/Offline Customers columns
                        <>
                          <SortableHeader
                            label="ID"
                            sortKey="id"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Username / PPPoE user"
                            sortKey="userId"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          >
                            <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                          </SortableHeader>
                          <SortableHeader
                            label="Name"
                            sortKey="name"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Mobile"
                            sortKey="mobile"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Package"
                            sortKey="package"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          >
                            <PackageIcon className="w-3.5 h-3.5 text-purple-500" />
                          </SortableHeader>
                          <SortableHeader
                            label="R.Days"
                            sortKey="remainingDays"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Uptime"
                            sortKey="uptime"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="IP"
                            sortKey="ip"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="MAC Address"
                            sortKey="mac"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Up (Traffic)"
                            sortKey="upload"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Down (Traffic)"
                            sortKey="download"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Last Offline"
                            sortKey="lastOffline"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          >
                            <CalendarIcon className="w-3.5 h-3.5 text-gray-500" />
                          </SortableHeader>
                        </>
                      ) : (
                        // All Customers columns (default)
                        <>
                          <SortableHeader
                            label="ID"
                            sortKey="id"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="User ID"
                            sortKey="userId"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          >
                            <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                          </SortableHeader>
                          <SortableHeader
                            label="Name"
                            sortKey="name"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Mobile"
                            sortKey="mobile"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Package"
                            sortKey="package"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          >
                            <PackageIcon className="w-3.5 h-3.5 text-purple-500" />
                          </SortableHeader>
                          <SortableHeader
                            label="Protocol"
                            sortKey="protocol"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Bill"
                            sortKey="bill"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          >
                            <MoneyIcon className="w-3.5 h-3.5 text-emerald-500" />
                          </SortableHeader>
                          <SortableHeader
                            label="Balance"
                            sortKey="balance"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          >
                            <MoneyIcon className="w-3.5 h-3.5 text-blue-500" />
                          </SortableHeader>
                          <SortableHeader
                            label="Exp Date"
                            sortKey="expDate"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          >
                            <CalendarIcon className="w-3.5 h-3.5 text-orange-500" />
                          </SortableHeader>
                          <SortableHeader
                            label="Last Pay Date"
                            sortKey="lastPayDate"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          >
                            <CalendarIcon className="w-3.5 h-3.5 text-teal-500" />
                          </SortableHeader>
                          <SortableHeader
                            label="Billing Status"
                            sortKey="billingStatus"
                            currentSort={sortConfig}
                            onSort={handleSort}
                          />
                        </>
                      )}
                      <th 
                        className="px-2 py-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider sticky right-0 z-20 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-700/50 dark:via-slate-800/50 dark:to-slate-800/50" 
                        style={{ 
                          width: '64px', 
                          minWidth: '64px', 
                          maxWidth: '64px',
                          textAlign: 'center'
                        }}
                      >
                        Action
                      </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {customersToDisplay.map((customer) => {
                    const customerId = customer.customer_id || customer.customerId || '';
                    const customerCode = customer.customer_code || customer.customerCode || '';
                    const displayId = formatCustomerIdDisplay(customerCode);
                    const fullName = customer.full_name || customer.fullName || '—';
                    const phone = customer.phone || customer.mobile || '—';
                    const username = customer.username || '—';
                    const isSelected = selectedCustomers.has(customerId);
                    const remainingDays = calculateRemainingDays(customer.expiry_date);
                    
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
                        {type === 'online' || type === 'offline' ? (
                          // Online/Offline Customers cells
                          <>
                            <td className="px-2 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap" style={{ width: '80px' }}>
                              <button
                        onClick={() => handleView(customerId)}
                                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                                title="View customer profile"
                              >
                                {displayId}
                              </button>
                            </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                                <button
                                  onClick={() => handleView(customerId)}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                                  title="View customer profile"
                                >
                                  {username}
                                </button>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[150px]" title={fullName}>
                              <button
                                onClick={() => handleView(customerId)}
                                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors truncate max-w-[150px] block"
                                title={`View ${fullName}'s profile`}
                              >
                          {fullName}
                              </button>
                        </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300">
                          {phone}
                              </span>
                        </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <PackageIcon className="w-3.5 h-3.5 text-purple-500" />
                                <span className="truncate max-w-[120px]" title={customer.package_name || undefined}>
                                  {customer.package_name || '—'}
                                </span>
                              </div>
                        </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                              {remainingDays !== null ? remainingDays : '—'}
                            </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {formatUptime(customer.uptime_seconds)}
                            </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">
                              {customer.ip_address || '—'}
                            </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">
                              {customer.mac_address || '—'}
                            </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {/* Up (Traffic) = Upload = rx-byte = upload_bytes */}
                              {formatTraffic(customer.upload_bytes)}
                            </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {/* Down (Traffic) = Download = tx-byte = download_bytes */}
                              {formatTraffic(customer.download_bytes)}
                            </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <CalendarIcon className="w-3.5 h-3.5 text-gray-500" />
                                {customer.online_status ? '—' : formatDateTime(customer.last_logout_at)}
                              </div>
                            </td>
                          </>
                        ) : (
                          // All Customers cells (default)
                          <>
                            <td className="px-2 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap" style={{ width: '80px' }}>
                              <button
                                onClick={() => handleView(customerId)}
                                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                                title="View customer profile"
                              >
                                {displayId}
                              </button>
                            </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                                <button
                                  onClick={() => handleView(customerId)}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                                  title="View customer profile"
                                >
                                  {username}
                                </button>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[150px]" title={fullName}>
                              <button
                                onClick={() => handleView(customerId)}
                                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors truncate max-w-[150px] block"
                                title={`View ${fullName}'s profile`}
                              >
                                {fullName}
                              </button>
                            </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300">
                                {phone}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <PackageIcon className="w-3.5 h-3.5 text-purple-500" />
                                <span className="truncate max-w-[120px]" title={customer.package_name || undefined}>
                          {customer.package_name || '—'}
                                </span>
                              </div>
                        </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 uppercase whitespace-nowrap">
                              {customer.protocol ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium border border-indigo-200 dark:border-indigo-800">
                                  {customer.protocol}
                                </span>
                              ) : (
                                '—'
                              )}
                        </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 font-bold whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <MoneyIcon className="w-3.5 h-3.5 text-emerald-500" />
                                {formatCurrency(customer.bill_amount || customer.package_price)}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-sm font-bold whitespace-nowrap">
                              <div className={`flex items-center gap-1 ${(customer.balance ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                <MoneyIcon className="w-3.5 h-3.5 text-blue-500" />
                                {formatCurrency(customer.balance)}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <CalendarIcon className="w-3.5 h-3.5 text-orange-500" />
                                {formatExpiryDisplay(customer.expiry_date)}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <CalendarIcon className="w-3.5 h-3.5 text-teal-500" />
                                {formatDate(customer.last_payment_date)}
                              </div>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">
                          {customer.billing_status ? (
                            <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getBillingStatusBadgeClass(customer.billing_status)}`}
                            >
                              {getBillingStatusIcon(customer.billing_status)}
                              {getBillingStatusLabel(customer.billing_status)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                          </>
                        )}
                        <td 
                          className="px-2 py-2 whitespace-nowrap sticky right-0 z-20 bg-white dark:bg-slate-800"
                          style={{ 
                            width: '64px', 
                            minWidth: '64px', 
                            maxWidth: '64px',
                            textAlign: 'center'
                          }}
                        >
                          <button
                            ref={(el) => {
                              if (el) actionButtonRefs.current.set(customerId, el);
                              else actionButtonRefs.current.delete(customerId);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const button = e.currentTarget;
                              if (openActionMenu === customerId) {
                                setOpenActionMenu(null);
                                setActionMenuPosition(null);
                              } else {
                                handleOpenActionMenu(customerId, button);
                              }
                            }}
                            className="mx-auto flex items-center justify-center p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 rounded transition-all cursor-pointer"
                            title="Actions"
                          >
                            <MoreVerticalIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer Summary Row */}
                <tfoot className="bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-700/50 dark:to-blue-900/20 border-t-2 border-blue-200 dark:border-slate-700 sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={type === 'online' || type === 'offline' ? 2 : 2} className="px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {type === 'online' ? 'Online Users' : type === 'offline' ? 'Offline Users' : 'Total Users'}: <span className="text-blue-600 dark:text-blue-400">{customersToDisplay.length}</span>
                      {type !== 'online' && type !== 'offline' && selectedCustomers.size > 0 && (
                        <span className="text-slate-500 dark:text-slate-400 font-normal"> ({selectedCustomers.size} selected)</span>
                      )}
                    </td>
                    {type === 'online' || type === 'offline' ? (
                      <>
                        <td colSpan={10}></td>
                      </>
                    ) : (
                      <>
                        <td colSpan={7}></td>
                        <td className="px-2 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <MoneyIcon className="w-4 h-4 text-emerald-500" />
                            <span>Total Bill: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(totalBill)}</span></span>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <MoneyIcon className="w-4 h-4 text-blue-500" />
                            <span>Advance: <span className="text-green-600 dark:text-green-400 font-bold">{formatCurrency(totalAdvance)}</span></span>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <MoneyIcon className="w-4 h-4 text-orange-500" />
                            <span>Due: <span className="text-orange-600 dark:text-orange-400 font-bold">{formatCurrency(totalDue)}</span></span>
                          </div>
                        </td>
                      </>
                    )}
                    <td 
                      className="sticky right-0 z-20 bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-700/50 dark:to-blue-900/20"
                      style={{ 
                        width: '64px', 
                        minWidth: '64px', 
                        maxWidth: '64px'
                      }}
                    ></td>
                  </tr>
                </tfoot>
                </table>
              </div>

              {/* Tablet/Mobile (<1024px): Horizontal scroll with visible scrollbar */}
              <div className="lg:hidden">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                  <table className="w-full" style={{ minWidth: 'max-content', tableLayout: 'auto' }}>
                    <thead className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-700/50 dark:via-slate-800/50 dark:to-slate-800/50 border-b-2 border-blue-200 dark:border-slate-700 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-left" style={{ width: '48px' }}>
                          <input
                            type="checkbox"
                            checked={customersToDisplay.length > 0 && selectedCustomers.size === customersToDisplay.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                        </th>
                        {type === 'online' || type === 'offline' ? (
                          // Online/Offline Customers columns (mobile)
                          <>
                            <SortableHeader
                              label="ID"
                              sortKey="id"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Username / PPPoE user"
                              sortKey="userId"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            >
                              <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                            </SortableHeader>
                            <SortableHeader
                              label="Name"
                              sortKey="name"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Mobile"
                              sortKey="mobile"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Package"
                              sortKey="package"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            >
                              <PackageIcon className="w-3.5 h-3.5 text-purple-500" />
                            </SortableHeader>
                            <SortableHeader
                              label="R.Days"
                              sortKey="remainingDays"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Uptime"
                              sortKey="uptime"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="IP"
                              sortKey="ip"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="MAC Address"
                              sortKey="mac"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Up (Traffic)"
                              sortKey="upload"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Down (Traffic)"
                              sortKey="download"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Last Offline"
                              sortKey="lastOffline"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            >
                              <CalendarIcon className="w-3.5 h-3.5 text-gray-500" />
                            </SortableHeader>
                          </>
                        ) : (
                          // All Customers columns (mobile, default)
                          <>
                            <SortableHeader
                              label="ID"
                              sortKey="id"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="User ID"
                              sortKey="userId"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            >
                              <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                            </SortableHeader>
                            <SortableHeader
                              label="Name"
                              sortKey="name"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Mobile"
                              sortKey="mobile"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Package"
                              sortKey="package"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            >
                              <PackageIcon className="w-3.5 h-3.5 text-purple-500" />
                            </SortableHeader>
                            <SortableHeader
                              label="Protocol"
                              sortKey="protocol"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                            <SortableHeader
                              label="Bill"
                              sortKey="bill"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            >
                              <MoneyIcon className="w-3.5 h-3.5 text-emerald-500" />
                            </SortableHeader>
                            <SortableHeader
                              label="Balance"
                              sortKey="balance"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            >
                              <MoneyIcon className="w-3.5 h-3.5 text-blue-500" />
                            </SortableHeader>
                            <SortableHeader
                              label="Exp Date"
                              sortKey="expDate"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            >
                              <CalendarIcon className="w-3.5 h-3.5 text-orange-500" />
                            </SortableHeader>
                            <SortableHeader
                              label="Last Pay Date"
                              sortKey="lastPayDate"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            >
                              <CalendarIcon className="w-3.5 h-3.5 text-teal-500" />
                            </SortableHeader>
                            <SortableHeader
                              label="Billing Status"
                              sortKey="billingStatus"
                              currentSort={sortConfig}
                              onSort={handleSort}
                            />
                          </>
                        )}
                        <th 
                          className="px-2 py-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider sticky right-0 z-20 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-700/50 dark:via-slate-800/50 dark:to-slate-800/50" 
                          style={{ 
                            width: '64px', 
                            minWidth: '64px', 
                            maxWidth: '64px',
                            textAlign: 'center'
                          }}
                        >
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                      {customersToDisplay.map((customer) => {
                        const customerId = customer.customer_id || customer.customerId || '';
                        const customerCode = customer.customer_code || customer.customerCode || '';
                        const displayId = formatCustomerIdDisplay(customerCode);
                        const fullName = customer.full_name || customer.fullName || '—';
                        const phone = customer.phone || customer.mobile || '—';
                        const username = customer.username || '—';
                        const isSelected = selectedCustomers.has(customerId);
                        
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
                            {type === 'online' || type === 'offline' ? (
                              // Online/Offline Customers cells (mobile)
                              <>
                                <td className="px-2 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap" style={{ width: '80px' }}>
                                  <button
                                    onClick={() => handleView(customerId)}
                                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                                    title="View customer profile"
                                  >
                                    {displayId}
                                  </button>
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                                    <button
                                      onClick={() => handleView(customerId)}
                                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                                      title="View customer profile"
                                    >
                                      {username}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[150px]" title={fullName}>
                                  <button
                                    onClick={() => handleView(customerId)}
                                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors truncate max-w-[150px] block"
                                    title={`View ${fullName}'s profile`}
                                  >
                                    {fullName}
                                  </button>
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300">
                                    {phone}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                                    <PackageIcon className="w-3.5 h-3.5 text-purple-500" />
                                    <span className="truncate max-w-[120px]" title={customer.package_name || undefined}>
                                      {customer.package_name || '—'}
                                    </span>
                            </div>
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                                  {calculateRemainingDays(customer.expiry_date) !== null ? calculateRemainingDays(customer.expiry_date) : '—'}
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {formatUptime(customer.uptime_seconds)}
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">
                                  {customer.ip_address || '—'}
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">
                                  {customer.mac_address || '—'}
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {/* Up (Traffic) = Upload = rx-byte = upload_bytes */}
                                  {formatTraffic(customer.upload_bytes)}
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  {/* Down (Traffic) = Download = tx-byte = download_bytes */}
                                  {formatTraffic(customer.download_bytes)}
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <CalendarIcon className="w-3.5 h-3.5 text-gray-500" />
                                    {customer.online_status ? '—' : formatDateTime(customer.last_logout_at)}
                                  </div>
                                </td>
                              </>
                            ) : (
                              // All Customers cells (mobile, default)
                              <>
                                <td className="px-2 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap" style={{ width: '80px' }}>
                                  <button
                                    onClick={() => handleView(customerId)}
                                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                                    title="View customer profile"
                                  >
                                    {displayId}
                                  </button>
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                                    <button
                                      onClick={() => handleView(customerId)}
                                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                                      title="View customer profile"
                                    >
                                      {username}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[150px]" title={fullName}>
                                  <button
                                    onClick={() => handleView(customerId)}
                                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors truncate max-w-[150px] block"
                                    title={`View ${fullName}'s profile`}
                                  >
                                    {fullName}
                                  </button>
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300">
                                    {phone}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                                    <PackageIcon className="w-3.5 h-3.5 text-purple-500" />
                                    <span className="truncate max-w-[120px]" title={customer.package_name || undefined}>
                                      {customer.package_name || '—'}
                                    </span>
                            </div>
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 uppercase whitespace-nowrap">
                                  {customer.protocol ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium border border-indigo-200 dark:border-indigo-800">
                                      {customer.protocol}
                                    </span>
                                  ) : (
                                    '—'
                          )}
                        </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 font-bold whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <MoneyIcon className="w-3.5 h-3.5 text-emerald-500" />
                                    {formatCurrency(customer.bill_amount || customer.package_price)}
                                  </div>
                        </td>
                                <td className="px-2 py-2 text-sm font-bold whitespace-nowrap">
                                  <div className={`flex items-center gap-1 ${(customer.balance ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                    <MoneyIcon className="w-3.5 h-3.5 text-blue-500" />
                                    {formatCurrency(customer.balance)}
                                  </div>
                        </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <CalendarIcon className="w-3.5 h-3.5 text-orange-500" />
                                    {formatExpiryDisplay(customer.expiry_date)}
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <CalendarIcon className="w-3.5 h-3.5 text-teal-500" />
                                    {formatDate(customer.last_payment_date)}
                                  </div>
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap">
                                  {customer.billing_status ? (
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getBillingStatusBadgeClass(customer.billing_status)}`}
                                    >
                                      {getBillingStatusIcon(customer.billing_status)}
                                      {getBillingStatusLabel(customer.billing_status)}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              </>
                            )}
                            <td 
                              className="px-2 py-2 whitespace-nowrap sticky right-0 z-20 bg-white dark:bg-slate-800"
                              style={{ 
                                width: '64px', 
                                minWidth: '64px', 
                                maxWidth: '64px',
                                textAlign: 'center'
                              }}
                            >
                          <button
                                ref={(el) => {
                                  if (el) actionButtonRefs.current.set(customerId, el);
                                  else actionButtonRefs.current.delete(customerId);
                                }}
                            onClick={(e) => {
                              e.stopPropagation();
                                  const button = e.currentTarget;
                                  if (openActionMenu === customerId) {
                                    setOpenActionMenu(null);
                                    setActionMenuPosition(null);
                                  } else {
                                    handleOpenActionMenu(customerId, button);
                                  }
                                }}
                                className="mx-auto flex items-center justify-center p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 rounded transition-all cursor-pointer"
                                title="Actions"
                              >
                                <MoreVerticalIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                    {/* Footer Summary Row - Mobile */}
                    <tfoot className="bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-700/50 dark:to-blue-900/20 border-t-2 border-blue-200 dark:border-slate-700 sticky bottom-0 z-10">
                      <tr>
                        <td colSpan={type === 'online' || type === 'offline' ? 2 : 2} className="px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {type === 'online' ? 'Online Users' : type === 'offline' ? 'Offline Users' : 'Total Users'}: <span className="text-blue-600 dark:text-blue-400">{customersToDisplay.length}</span>
                          {type !== 'online' && type !== 'offline' && selectedCustomers.size > 0 && (
                            <span className="text-slate-500 dark:text-slate-400 font-normal"> ({selectedCustomers.size} selected)</span>
                          )}
                        </td>
                        {type === 'online' || type === 'offline' ? (
                          <>
                            <td colSpan={10}></td>
                          </>
                        ) : (
                          <>
                            <td colSpan={7}></td>
                            <td className="px-2 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <MoneyIcon className="w-4 h-4 text-emerald-500" />
                                <span>Total Bill: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(totalBill)}</span></span>
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <MoneyIcon className="w-4 h-4 text-blue-500" />
                                <span>Advance: <span className="text-green-600 dark:text-green-400 font-bold">{formatCurrency(totalAdvance)}</span></span>
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <MoneyIcon className="w-4 h-4 text-orange-500" />
                                <span>Due: <span className="text-orange-600 dark:text-orange-400 font-bold">{formatCurrency(totalDue)}</span></span>
                              </div>
                            </td>
                          </>
                        )}
                        <td 
                          className="sticky right-0 z-20 bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-700/50 dark:to-blue-900/20"
                          style={{ 
                            width: '64px', 
                            minWidth: '64px', 
                            maxWidth: '64px',
                            textAlign: 'center'
                          }}
                        ></td>
                      </tr>
                    </tfoot>
              </table>
            </div>
          </div>
            </div>
          );
        })()}

        {/* Portal-based More Menu Dropdown */}
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
                        <span className="text-blue-500">{moreMenuIcons['Export']}</span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    ))}
                  </>
                ) : (
                  moreMenuItems.map((item) => {
                    const icon = moreMenuIcons[item];
                    const iconColor = item.includes('Delete') || item.includes('Left')
                      ? 'text-red-500'
                      : item.includes('Suspend') || item.includes('Restore')
                      ? 'text-orange-500'
                      : item.includes('Activate') || item.includes('Renew')
                      ? 'text-green-500'
                      : item.includes('Export') || item.includes('Report')
                      ? 'text-blue-500'
                      : 'text-slate-500';

                    return (
                      <button
                        key={item}
                        onClick={() => handleMoreMenuAction(item)}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-colors flex items-center gap-3 group"
                      >
                        <span className={iconColor}>{icon}</span>
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

        {/* Portal-based Action Menu Dropdown */}
        {openActionMenu && actionMenuPosition && (
          createPortal(
            <div
              data-action-dropdown
              className="fixed bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-2 border-blue-200 dark:border-blue-800 rounded-xl shadow-2xl z-[9999] min-w-[192px] max-h-[320px] overflow-y-auto transition-all duration-200 ease-out"
              style={{
                top: `${actionMenuPosition.top}px`,
                left: `${actionMenuPosition.left}px`,
                opacity: 1,
                transform: actionMenuPosition.openUpward ? 'translateY(0)' : 'translateY(0)',
                animation: 'fadeInScale 0.15s ease-out',
              }}
            >
              <style>{`
                @keyframes fadeInScale {
                  from {
                    opacity: 0;
                    transform: ${actionMenuPosition.openUpward ? 'translateY(4px) scale(0.95)' : 'translateY(-4px) scale(0.95)'};
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                  }
                }
              `}</style>
              <div className="py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleView(openActionMenu);
                    setOpenActionMenu(null);
                    setActionMenuPosition(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-colors flex items-center gap-3 group"
                >
                  <svg className="w-4 h-4 text-blue-500 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>View Details</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const button = actionButtonRefs.current.get(openActionMenu);
                    if (button) {
                      handleQuickRenew(openActionMenu, e as any);
                    }
                    setOpenActionMenu(null);
                    setActionMenuPosition(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 dark:hover:from-green-900/20 dark:hover:to-emerald-900/20 transition-colors flex items-center gap-3 group"
                >
                  <RenewIcon className="w-4 h-4 text-green-500 group-hover:text-green-600" />
                  <span>Renew</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const customerId = openActionMenu;
                    setOpenActionMenu(null);
                    setActionMenuPosition(null);
                    if (customerId) navigate(`/dashboard/customers/edit/${customerId}`);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 transition-colors flex items-center gap-3 group"
                >
                  <svg className="w-4 h-4 text-purple-500 group-hover:text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit</span>
                </button>
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
  );
}
