import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Tenant } from '@/types/tenant.types';

interface TenantState {
  selectedTenant: Tenant | null;
  setSelectedTenant: (tenant: Tenant | null) => void;
  clearSelectedTenant: () => void;
  getTenantId: () => string | null;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      selectedTenant: null,
      setSelectedTenant: (tenant: Tenant | null) => set({ selectedTenant: tenant }),
      clearSelectedTenant: () => set({ selectedTenant: null }),
      getTenantId: () => {
        const tenant = get().selectedTenant;
        return tenant ? (tenant.tenantId || (tenant as any).id || (tenant as any).tenant_id || null) : null;
      },
    }),
    {
      name: 'netfix_selected_tenant',
    }
  )
);
