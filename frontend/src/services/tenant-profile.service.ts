import api from '@/lib/api';
import {
  TenantProfileResponse,
  UpdateTenantFeaturesPayload,
  UpdateTenantFeaturesResponse,
  UpdatePaymentGatewaysPayload,
  UpdatePaymentGatewaysResponse,
  UpdateSmsGatewayPayload,
  UpdateSmsGatewayResponse,
  SmsProvidersResponse,
} from '@/types/tenant-profile.types';

export const tenantProfileService = {
  async getTenantProfile(tenantId: string): Promise<TenantProfileResponse> {
    const response = await api.get<TenantProfileResponse>(`/tenants/${tenantId}/profile`);
    return response.data;
  },

  async updateTenantFeatures(tenantId: string, payload: UpdateTenantFeaturesPayload): Promise<UpdateTenantFeaturesResponse> {
    const response = await api.put<UpdateTenantFeaturesResponse>(`/tenants/${tenantId}/features`, payload);
    return response.data;
  },

  async updatePaymentGateways(tenantId: string, payload: UpdatePaymentGatewaysPayload): Promise<UpdatePaymentGatewaysResponse> {
    const response = await api.put<UpdatePaymentGatewaysResponse>(`/tenants/${tenantId}/payment-gateways`, payload);
    return response.data;
  },

  async updateSmsGateway(tenantId: string, payload: UpdateSmsGatewayPayload): Promise<UpdateSmsGatewayResponse> {
    const response = await api.put<UpdateSmsGatewayResponse>(`/tenants/${tenantId}/sms-gateway`, payload);
    return response.data;
  },

  async getSmsProviders(): Promise<SmsProvidersResponse> {
    const response = await api.get<SmsProvidersResponse>('/tenants/sms-providers');
    return response.data;
  },

  async sendSmsTest(tenantId: string, mobileNumber: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(`/tenants/${tenantId}/sms-test`, {
      mobileNumber: mobileNumber.replace(/\D/g, ''),
    });
    return response.data;
  },

  async createBkashPayment(tenantId: string, amount: number, callbackURL: string): Promise<{ bkashURL: string; paymentID: string }> {
    const response = await api.post<{ bkashURL: string; paymentID: string }>(`/tenants/${tenantId}/bkash-create-payment`, {
      amount,
      callbackURL,
    });
    return response.data;
  },
};
