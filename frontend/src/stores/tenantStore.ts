import { create } from 'zustand';
import { Tenant } from '@/types/tenant.types';

interface TenantState {
  selectedTenant: Tenant | null;
  setSelectedTenant: (tenant: Tenant | null) => void;
  clearSelectedTenant: () => void;
  getTenantId: () => string | null;
}

export const useTenantStore = create<TenantState>((set, get) => ({
  selectedTenant: null,
  setSelectedTenant: (tenant: Tenant | null) => set({ selectedTenant: tenant }),
  clearSelectedTenant: () => set({ selectedTenant: null }),
  getTenantId: () => {
    const tenant = get().selectedTenant;
    return tenant ? tenant.tenantId : null;
  },
}));
