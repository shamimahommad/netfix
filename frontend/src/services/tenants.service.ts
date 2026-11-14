import api from '@/lib/api';
import { TenantsResponse, CreateTenantPayload, CreateTenantResponse, UpdateTenantPayload, UpdateTenantLimitsPayload, Tenant } from '@/types/tenant.types';

export const tenantsService = {
  async getTenants(): Promise<TenantsResponse> {
    const response = await api.get<TenantsResponse>('/tenants');
    return response.data;
  },

  async getTenant(id: string): Promise<{ success: boolean; data: Tenant }> {
    const response = await api.get<{ success: boolean; data: Tenant }>(`/tenants/${id}`);
    return response.data;
  },

  async createTenant(payload: CreateTenantPayload): Promise<CreateTenantResponse> {
    const response = await api.post<CreateTenantResponse>('/tenants', payload);
    return response.data;
  },

  async updateTenant(id: string, payload: UpdateTenantPayload): Promise<{ success: boolean; data: Tenant }> {
    const response = await api.put<{ success: boolean; data: Tenant }>(`/tenants/${id}`, payload);
    return response.data;
  },

  async updateTenantLimits(id: string, payload: UpdateTenantLimitsPayload): Promise<{ success: boolean; data: Tenant }> {
    const response = await api.patch<{ success: boolean; data: Tenant }>(`/tenants/${id}/limits`, payload);
    return response.data;
  },

  async deleteTenant(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/tenants/${id}`);
    return response.data;
  },

  async getNextTenantCode(): Promise<{ success: boolean; nextCode: string }> {
    const response = await api.get<{ success: boolean; nextCode: string }>('/tenants/next-code');
    return response.data;
  },

  async lookupTenant(codeOrId: string): Promise<{ success: boolean; data: any }> {
    const response = await api.get<{ success: boolean; data: any }>(`/tenants/lookup/${encodeURIComponent(codeOrId)}`);
    return response.data;
  },
};
