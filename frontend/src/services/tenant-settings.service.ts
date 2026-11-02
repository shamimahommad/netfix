import api from '@/lib/api';
import { TenantSettings, PaymentGatewaySettings, SmsGatewaySettings } from '@/types/tenant-profile.types';

export interface TenantSettingsResponse {
  success: boolean;
  data: {
    settings: TenantSettings | null;
    paymentGateways: PaymentGatewaySettings[];
    smsGateways: SmsGatewaySettings[];
  };
}

export const tenantSettingsService = {
  /**
   * Get tenant settings for the currently logged-in tenant
   * This endpoint should be accessible by tenant users (not just SaaS admin)
   */
  async getMyTenantSettings(): Promise<TenantSettingsResponse> {
    const response = await api.get<TenantSettingsResponse>('/tenants/my/settings');
    return response.data;
  },
};
