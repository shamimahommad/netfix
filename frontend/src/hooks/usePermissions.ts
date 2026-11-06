import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';

export interface PermissionsState {
  canCreateCustomer: boolean;
  canEditCustomer: boolean;
  canDeleteCustomer: boolean;
  canViewInvoice: boolean;
  canRecharge: boolean;
  canManageSubTier: boolean;
  canAssignPackage: boolean;
  canTransferBalance: boolean;
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
      if (isLevel0) return true;
      if (typeof userPerms[code] === 'boolean') {
        return userPerms[code];
      }
      // Defaults based on role
      if (isReseller || isSubReseller || isDealer) {
        return [
          'can_create_customer',
          'can_edit_customer',
          'can_view_invoice',
          'can_recharge',
          'can_manage_sub_tier',
          'can_assign_package',
          'can_transfer_balance',
        ].includes(code);
      }
      if (isAgent) {
        return ['can_create_customer', 'can_view_invoice', 'can_recharge'].includes(code);
      }
      return false;
    };

    return {
      canCreateCustomer: hasPermission('can_create_customer'),
      canEditCustomer: hasPermission('can_edit_customer'),
      canDeleteCustomer: hasPermission('can_delete_customer'),
      canViewInvoice: hasPermission('can_view_invoice'),
      canRecharge: hasPermission('can_recharge'),
      canManageSubTier: hasPermission('can_manage_sub_tier'),
      canAssignPackage: hasPermission('can_assign_package'),
      canTransferBalance: hasPermission('can_transfer_balance'),
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

