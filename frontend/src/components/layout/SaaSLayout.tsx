import AppLayout, { SidebarItem } from './AppLayout';
import { Package } from 'lucide-react';
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
    label: 'Packages',
    icon: <Package className="w-5 h-5 stroke-[1.8]" />,
    path: '/saas/packages',
  },
  {
    label: 'Billing',
    icon: <BillingIcon />,
    path: '/saas/billing',
  },
  {
    label: 'Customers',
    icon: <CustomersIcon />,
    path: '/saas/customers',
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
