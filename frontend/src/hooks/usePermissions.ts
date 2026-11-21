import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';

export interface PermissionsState {
  // Customers
  canCreateCustomer: boolean;
  canEditCustomer: boolean;
  canDeleteCustomer: boolean;
  canExtendDate: boolean;
  canChangePackage: boolean;
  canChangeZone: boolean;
  canImportCustomers: boolean;

  // Billing & Payments
  canViewInvoice: boolean;
  canEditInvoice: boolean;
  canRecharge: boolean;
  canPartialRenew: boolean;
  canCollectPayment: boolean;

  // PPPoE
  pppoeManage: boolean;
  pppoeCreate: boolean;
  pppoeDisconnect: boolean;
  pppoeBindMac: boolean;
  pppoeStaticIp: boolean;

  // Reseller Hierarchy
  canManageSubTier: boolean;
  canAssignPackage: boolean;
  canTransferBalance: boolean;
  canManagePermissions: boolean;

  // System
  canExportData: boolean;
  canSendSms: boolean;

  // Privacy & Visibility
  hideCustomerPassword: boolean;
  hideDashboardSales: boolean;
  hideDashboardBalance: boolean;
  hideDownlineInvoices: boolean;

  // Role info
  isLevel0: boolean;
  isReseller: boolean;
  isSubReseller: boolean;
  isDealer: boolean;
  isAgent: boolean;
  hierarchyLevel: number;
  hasPermission: (permissionCode: string) => boolean;
}

export function usePermissions(): PermissionsState {
  const { user } = useAuthStore();

  return useMemo(() => {
    const role = (user?.role_code ?? user?.role ?? '').toLowerCase();
    const isSaas = user?.user_type === 'saas' || role === 'saas_admin';
    const isLevel0 = isSaas || ['admin', 'isp_admin', 'manager', 'tenant_admin', 'super_admin'].includes(role);

    const isReseller = role === 'reseller';
    const isSubReseller = role === 'sub_reseller';
    const isDealer = role === 'dealer';
    const isAgent = role === 'agent';

    let hierarchyLevel = 99;
    if (isLevel0) hierarchyLevel = 0;
    else if (isReseller) hierarchyLevel = 1;
    else if (isSubReseller) hierarchyLevel = 2;
    else if (isDealer) hierarchyLevel = 3;
    else if (isAgent) hierarchyLevel = 4;

    const userPerms = (user as any)?.permissions || {};

    const hasPermission = (code: string): boolean => {
      // Level 0 users have full action access, and visibility restrictions do not apply to them
      if (isLevel0) {
        if (code.startsWith('hide_')) {
          return false; // Admins don't have things hidden from them
        }
        return true;
      }

      // Check explicit assignment stored in user permissions
      if (typeof userPerms[code] === 'boolean') {
        return userPerms[code];
      }

      // Default permissions based on role if no explicit row
      if (isReseller || isSubReseller || isDealer) {
        return [
          'can_create_customer',
          'can_edit_customer',
          'can_view_invoice',
          'can_recharge',
          'can_manage_sub_tier',
          'can_assign_package',
          'can_transfer_balance',
          'can_export_data',
          'can_send_sms',
          'pppoe_manage',
          'pppoe_disconnect',
          'pppoe_bind_mac',
        ].includes(code);
      }
      if (isAgent) {
        return [
          'can_create_customer',
          'can_view_invoice',
          'can_recharge',
          'can_send_sms',
        ].includes(code);
      }
      return false;
    };

    return {
      // Customers
      canCreateCustomer: hasPermission('can_create_customer'),
      canEditCustomer: hasPermission('can_edit_customer'),
      canDeleteCustomer: hasPermission('can_delete_customer'),
      canExtendDate: hasPermission('can_extend_date'),
      canChangePackage: hasPermission('can_change_package'),
      canChangeZone: hasPermission('can_change_zone'),
      canImportCustomers: hasPermission('can_import_customers'),

      // Billing & Payments
      canViewInvoice: hasPermission('can_view_invoice'),
      canEditInvoice: hasPermission('can_edit_invoice'),
      canRecharge: hasPermission('can_recharge'),
      canPartialRenew: hasPermission('can_partial_renew'),
      canCollectPayment: hasPermission('can_collect_payment'),

      // PPPoE
      pppoeManage: hasPermission('pppoe_manage'),
      pppoeCreate: hasPermission('pppoe_create'),
      pppoeDisconnect: hasPermission('pppoe_disconnect'),
      pppoeBindMac: hasPermission('pppoe_bind_mac'),
      pppoeStaticIp: hasPermission('pppoe_static_ip'),

      // Reseller Hierarchy
      canManageSubTier: hasPermission('can_manage_sub_tier'),
      canAssignPackage: hasPermission('can_assign_package'),
      canTransferBalance: hasPermission('can_transfer_balance'),
      canManagePermissions: hasPermission('can_manage_permissions'),

      // System
      canExportData: hasPermission('can_export_data'),
      canSendSms: hasPermission('can_send_sms'),

      // Privacy & Visibility
      hideCustomerPassword: hasPermission('hide_customer_password'),
      hideDashboardSales: hasPermission('hide_dashboard_sales'),
      hideDashboardBalance: hasPermission('hide_dashboard_balance'),
      hideDownlineInvoices: hasPermission('hide_downline_invoices'),

      // Role info
      isLevel0,
      isReseller,
      isSubReseller,
      isDealer,
      isAgent,
      hierarchyLevel,
      hasPermission,
    };
  }, [user]);
}
