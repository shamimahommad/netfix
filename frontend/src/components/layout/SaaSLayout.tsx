import AppLayout, { SidebarItem } from './AppLayout';
import {
  DashboardIcon,
  UsersIcon,
  CustomersIcon,
  BillingIcon,
  NetworkIcon,
  SettingsIcon,
} from '../icons/Icons';

const sidebarItems: SidebarItem[] = [
  {
    label: 'Dashboard',
    icon: <DashboardIcon />,
    path: '/saas/dashboard',
  },
  {
    label: 'Tenants',
    icon: <UsersIcon />,
    path: '/saas/tenants',
  },
  {
    label: 'Customers',
    icon: <CustomersIcon />,
    path: '/saas/customers',
  },
  {
    label: 'Billing',
    icon: <BillingIcon />,
    path: '/saas/billing',
  },
  {
    label: 'Network',
    icon: <NetworkIcon />,
    path: '/saas/network',
  },
  {
    label: 'Settings',
    icon: <SettingsIcon />,
    path: '/saas/settings',
  },
];

export default function SaaSLayout() {
  return <AppLayout sidebarItems={sidebarItems} userType="saas" />;
}
