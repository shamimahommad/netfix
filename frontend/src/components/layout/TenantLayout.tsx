import { useMemo } from 'react';
import AppLayout, { SidebarItem } from './AppLayout';
import TenantLayoutWrapper from './TenantLayoutWrapper';
import { useFeatureAvailability } from '@/hooks/useTenantSettings';
import { useAuthStore } from '@/stores/authStore';
import {
  DashboardIcon,
  CustomersIcon,
  BillingIcon,
  NetworkIcon,
  SettingsIcon,
  SMSIcon,
  AreaIcon,
  ResellerIcon,
  ReportIcon,
  SupportIcon,
  MapIcon,
  OnlineIcon,
  OfflineIcon,
  CardIcon,
  HotspotIcon,
} from '../icons/Icons';

/** Reseller menu label by role: Tenant Admin → Reseller, Reseller → Sub Reseller, Sub Reseller → Agent */
function getResellerMenuLabels(roleCode: string | undefined): { menu: string; list: string } {
  const r = (roleCode ?? '').toLowerCase();
  if (r === 'reseller') return { menu: 'Sub Reseller', list: 'Sub Reseller List' };
  if (r === 'sub_reseller') return { menu: 'Agent', list: 'Agent List' };
  return { menu: 'Reseller', list: 'Reseller List' };
}

/** Report → first submenu label by role: Admin = Reseller Wise Customers, Reseller = Sub Reseller Wise Customers, etc. */
function getResellerWiseReportLabel(roleCode: string | undefined): string {
  const r = (roleCode ?? '').toLowerCase();
  if (r === 'reseller') return 'Sub Reseller Wise Customers';
  if (r === 'sub_reseller') return 'Agent Wise Customers';
  if (r === 'agent') return 'My Customers';
  return 'Reseller Wise Customers'; // admin, manager, tenant_admin, isp_admin
}

/**
 * Strict check for ISP Admin / Company-level roles.
 * Returns true ONLY for: 'admin', 'manager', 'isp_admin', 'tenant_admin', 'saas_admin', 'super_admin' (or userType === 'saas').
 * Returns FALSE for: 'reseller', 'sub_reseller', 'dealer', 'agent', 'customer', or any lower tier / undefined role.
 */
function isIspAdminRole(roleCode: string | undefined, userType?: string): boolean {
  if (userType === 'saas') return true;
  const r = (roleCode ?? '').toLowerCase().trim();
  if (!r) return false;
  // Explicitly deny reseller and subordinate hierarchy roles
  if (['reseller', 'sub_reseller', 'dealer', 'agent', 'customer'].includes(r)) {
    return false;
  }
  return ['admin', 'manager', 'isp_admin', 'tenant_admin', 'saas_admin', 'super_admin'].includes(r);
}

export default function TenantLayout() {
  const { isMapEnabled, isMonitoringEnabled, isSmsEnabled } = useFeatureAvailability();
  const { user } = useAuthStore();
  const resellerLabels = getResellerMenuLabels(user?.role_code);

  const sidebarItems: SidebarItem[] = useMemo(() => {
    const items: SidebarItem[] = [];
    const canSeeAdminTabs = isIspAdminRole(user?.role_code || (user as any)?.role, user?.user_type);

    if (user?.user_type === 'saas') {
      items.push({
        label: '← Exit to SaaS Admin',
        icon: <DashboardIcon />,
        path: '/saas/dashboard',
      });
    }

    items.push(
      {
        label: 'Dashboard',
        icon: <DashboardIcon />,
        submenu: [
          { label: 'Overview', path: '/dashboard' },
          { label: 'PPPoE Logs', path: '/dashboard/pppoe-logs' },
        ],
      },
      {
        label: 'Customers',
        icon: <CustomersIcon />,
        submenu: [
          { label: 'All Customers', path: '/dashboard/customers/all' },
          { label: 'Add Customer', path: '/dashboard/customers/add' },
          { label: 'Online Customers', path: '/dashboard/customers/online' },
          { label: 'Offline Customers', path: '/dashboard/customers/offline' },
          { label: 'Suspended Customers', path: '/dashboard/customers/suspended' },
          { label: 'Expiring Soon', path: '/dashboard/customers/expiring-soon' },
        ],
      },
      {
        label: 'Billing',
        icon: <BillingIcon />,
        submenu: [
          { label: 'All Accounts', path: '/dashboard/billing/all' },
          { label: 'Active Accounts', path: '/dashboard/billing/active' },
          { label: 'New Customers', path: '/dashboard/billing/new-customers' },
          { label: 'Expire In 3 Days', path: '/dashboard/billing/expire-3-days' },
          { label: 'Expire In 7 Days', path: '/dashboard/billing/expire-7-days' },
          { label: 'Expired Accounts', path: '/dashboard/billing/expired' },
          { label: 'Suspend Accounts', path: '/dashboard/billing/suspended' },
          { label: 'Left Customers', path: '/dashboard/billing/left' },
        ],
      },
      {
        label: 'My Packages',
        icon: <CardIcon />,
        path: '/dashboard/my-packages',
      },
    );

    // Only show SMS menu if enabled and not agent
    const isAgent = (user?.role_code ?? '').toLowerCase() === 'agent';
    if (isSmsEnabled && !isAgent) {
      items.push({
        label: 'SMS',
        icon: <SMSIcon />,
        submenu: [
          { label: 'Send SMS', path: '/dashboard/sms/send' },
          { label: 'SMS Template', path: '/dashboard/sms/template' },
          { label: 'SMS Log', path: '/dashboard/sms/log' },
        ],
      });
    }

    items.push(
      {
        label: 'Service Area',
        icon: <AreaIcon />,
        submenu: [
          { label: 'Area', path: '/dashboard/service-area/areas' },
          { label: 'Sub Area', path: '/dashboard/service-area/sub-areas' },
        ],
      },
      {
        label: 'Hotspot',
        icon: <HotspotIcon />,
        submenu: [
          { label: 'Card Search', path: '/dashboard/hotspot/card-search', icon: <CardIcon /> },
          { label: 'Card Generator', path: '/dashboard/hotspot/card-generator', icon: <CardIcon /> },
          { label: 'Card Print', path: '/dashboard/hotspot/card-print', icon: <CardIcon /> },
          { label: 'Online Customers', path: '/dashboard/hotspot/online', icon: <OnlineIcon /> },
          { label: 'Offline Customers', path: '/dashboard/hotspot/offline', icon: <OfflineIcon /> },
        ],
      },
    );
    // Reseller menu: not shown for agent
    if (!isAgent) {
      items.push({
        label: resellerLabels.menu,
        icon: <ResellerIcon />,
        submenu: [
          { label: resellerLabels.list, path: '/dashboard/reseller' },
        ],
      });
    }
    items.push(
      {
        label: 'Topup Balance',
        icon: <CardIcon />,
        path: '/dashboard/topup-balance',
      },
      {
        label: 'Report',
        icon: <ReportIcon />,
        submenu: [
          { label: getResellerWiseReportLabel(user?.role_code), path: '/dashboard/report/reseller-wise-customers' },
          { label: 'Area Wise Customers', path: '/dashboard/report/area-wise-customers' },
          ...(canSeeAdminTabs
            ? [{ label: 'Server Wise Customers', path: '/dashboard/report/server-wise-customers' }]
            : []),
          { label: 'Financial Statement / Ledger', path: '/dashboard/report/ledger' },
          { label: 'Reconciliation Audit', path: '/dashboard/report/reconciliation' },
          { label: 'Online Transactions', path: '/dashboard/report/online-transactions' },
          { label: 'Merchant Payments', path: '/dashboard/report/merchant-payments' },
          { label: 'Customer Payments', path: '/dashboard/report/customer-payments' },
          { label: 'Recharge History', path: '/dashboard/report/recharge-history' },
          { label: 'Invoices', path: '/dashboard/report/invoices' },
        ],
      },
    );

    // Only show Map menu if enabled
    if (isMapEnabled) {
      items.push({
        label: 'Map',
        icon: <MapIcon />,
        path: '/dashboard/map',
      });
    }

    items.push({
      label: 'Support',
      icon: <SupportIcon />,
      submenu: [
        { label: 'Open Support Ticket', path: '/dashboard/support/ticket' },
        { label: 'Support Numbers', path: '/dashboard/support/numbers' },
        { label: 'Package Change', path: '/dashboard/support/package-change' },
        { label: 'Activity Log', path: '/dashboard/support/activity-log' },
      ],
    });

    // Network menu: ONLY for ISP Admin / company roles (hidden for reseller and lower tiers)
    if (canSeeAdminTabs) {
      const networkSubmenu: SidebarItem['submenu'] = [
        { label: 'Mikrotik', path: '/dashboard/network/mikrotik' },
        { label: 'OLT', path: '/dashboard/network/olt' },
        { label: 'Packages', path: '/dashboard/network/packages' },
      ];
      if (isMonitoringEnabled) {
        networkSubmenu.push(
          { label: 'Monitoring', path: '/dashboard/network/monitoring' },
          { label: 'Live Traffic', path: '/dashboard/network/monitoring/live-traffic' },
        );
      }
      items.push({
        label: 'Network',
        icon: <NetworkIcon />,
        submenu: networkSubmenu,
      });
    }

    // Settings menu: ONLY for ISP Admin / company roles (hidden for reseller and lower tiers)
    if (canSeeAdminTabs) {
      items.push({
        label: 'Settings',
        icon: <SettingsIcon />,
        submenu: [
          { label: 'Company Profile', path: '/dashboard/settings/company-profile' },
          { label: 'Import', path: '/dashboard/settings/import' },
        ],
      });
    }

    return items;
  }, [isMapEnabled, isMonitoringEnabled, isSmsEnabled, resellerLabels.menu, resellerLabels.list, user?.role_code, (user as any)?.role, user?.user_type]);

  const userType = user?.user_type || 'isp';

  return (
    <AppLayout sidebarItems={sidebarItems} userType={userType}>
      <TenantLayoutWrapper />
    </AppLayout>
  );
}
