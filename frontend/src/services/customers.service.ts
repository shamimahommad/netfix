import api from '@/lib/api';
import {
  CustomersResponse,
  CustomersFilters,
  CustomerDetailResponse,
  CustomerServicesResponse,
  CustomerNetworkAccountsResponse,
  CustomerBillingSummaryResponse,
  CustomerStatusHistoryResponse,
  CreateCustomerPayload,
  CreateCustomerResponse,
} from '@/types/customer.types';
import { CreateClientPayload, CreateClientResponse } from '@/types/client-onboarding.types';

export interface ResellerWiseReportRow {
  resellerId: string | null;
  resellerName: string;
  total: number;
  active: number;
  expired: number;
  left: number;
  pending: number;
  pppoe: number;
  hotspot: number;
  free: number;
  vip: number;
}

export interface AreaWiseReportRow {
  areaName: string;
  total: number;
  active: number;
  expired: number;
  left: number;
  pending: number;
  pppoe: number;
  hotspot: number;
  free: number;
  vip: number;
}

export interface ServerWiseReportRow {
  serverId: string | null;
  serverName: string;
  total: number;
  active: number;
  expired: number;
  left: number;
  pending: number;
  pppoe: number;
  hotspot: number;
  free: number;
  vip: number;
}

export const customersService = {
  async getCustomers(filters: CustomersFilters & { type?: string } = {}): Promise<CustomersResponse> {
    const params = new URLSearchParams();
    
    if (filters.status) {
      params.append('status', filters.status);
    }
    if (filters.search) {
      params.append('search', filters.search);
    }
    if (filters.ownerId) {
      params.append('ownerId', filters.ownerId);
    }
    if (filters.area) {
      params.append('area', filters.area);
    }
    if (filters.serverId) {
      params.append('serverId', filters.serverId);
    }
    if (filters.page) {
      params.append('page', filters.page.toString());
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }
    if (filters.type) {
      params.append('type', filters.type);
    }

    const queryString = params.toString();
    const url = `/customers${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get<CustomersResponse>(url);
    return response.data;
  },

  async getCustomerDetail(customerId: string): Promise<CustomerDetailResponse> {
    const response = await api.get<CustomerDetailResponse>(`/customers/${customerId}`);
    return response.data;
  },

  async getCustomerServices(customerId: string): Promise<CustomerServicesResponse> {
    const response = await api.get<CustomerServicesResponse>(`/customers/${customerId}/services`);
    return response.data;
  },

  async getCustomerNetworkAccounts(customerId: string): Promise<CustomerNetworkAccountsResponse> {
    const response = await api.get<CustomerNetworkAccountsResponse>(`/customers/${customerId}/network-accounts`);
    return response.data;
  },

  async getCustomerBillingSummary(customerId: string): Promise<CustomerBillingSummaryResponse> {
    const response = await api.get<CustomerBillingSummaryResponse>(`/customers/${customerId}/billing-summary`);
    return response.data;
  },

  async getCustomerStatusHistory(customerId: string): Promise<CustomerStatusHistoryResponse> {
    const response = await api.get<CustomerStatusHistoryResponse>(`/customers/${customerId}/status-history`);
    return response.data;
  },

  async createCustomer(payload: CreateCustomerPayload): Promise<CreateCustomerResponse> {
    const response = await api.post<CreateCustomerResponse>('/customers', payload);
    return response.data;
  },

  async onboardClient(payload: CreateClientPayload): Promise<CreateClientResponse> {
    const response = await api.post<CreateClientResponse>('/customers/onboard', payload);
    return response.data;
  },

  async getNextCustomerCode(): Promise<{ customerCode: string }> {
    const response = await api.get<{ customerCode: string }>('/customers/next-code');
    return response.data;
  },

  async reserveCustomerCode(sessionToken?: string): Promise<{
    success: boolean;
    customer_code: string;
    lease_token: string;
    expires_in: number;
    reused?: boolean;
  }> {
    const response = await api.post<{
      success: boolean;
      customer_code: string;
      lease_token: string;
      expires_in: number;
      reused?: boolean;
    }>('/customers/reserve-id', {
      session_token: sessionToken,
    });
    return response.data;
  },

  async releaseCustomerCode(customerCode: string, leaseToken: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>('/customers/release-id', {
      customer_code: customerCode,
      lease_token: leaseToken,
    });
    return response.data;
  },

  /** Customers with latitude/longitude for map display (includes username, expDate, status for marker color) */
  async getCustomersForMap(): Promise<
    {
      customerId: string;
      fullName: string;
      phone: string | null;
      username: string | null;
      expDate: string | null;
      status: 'online' | 'offline' | 'expired' | 'suspended';
      latitude: number;
      longitude: number;
    }[]
  > {
    const response = await api.get<
      {
        customerId: string;
        fullName: string;
        phone: string | null;
        username: string | null;
        expDate: string | null;
        status: 'online' | 'offline' | 'expired' | 'suspended';
        latitude: number;
        longitude: number;
      }[]
    >('/customers/map');
    return Array.isArray(response.data) ? response.data : [];
  },

  async getResellerWiseReport(): Promise<ResellerWiseReportRow[]> {
    const response = await api.get<ResellerWiseReportRow[]>('/customers/reports/reseller-wise');
    return Array.isArray(response.data) ? response.data : [];
  },

  async getAreaWiseReport(): Promise<AreaWiseReportRow[]> {
    const response = await api.get<AreaWiseReportRow[]>('/customers/reports/area-wise');
    return Array.isArray(response.data) ? response.data : [];
  },

  async getServerWiseReport(): Promise<ServerWiseReportRow[]> {
    const response = await api.get<ServerWiseReportRow[]>('/customers/reports/server-wise');
    return Array.isArray(response.data) ? response.data : [];
  },

  async updateCustomer(customerId: string, payload: Partial<{
    fullName?: string;
    email?: string;
    phone?: string;
    alternatePhone?: string;
    nationalId?: string;
    billingAddress?: string;
    installationAddress?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    countryCode?: string;
    internalNotes?: string;
    status?: 'pending_activation' | 'active' | 'suspended' | 'terminated' | 'cancelled';
    customerType?: 'individual' | 'business';
    billingCycle?: 'monthly' | 'custom';
    serverId?: string;
    planId?: string;
    expiryDate?: string;
    serviceStatus?: 'active' | 'expired';
    metadata?: Record<string, any>;
    ownerId?: string;
  }>): Promise<CustomerDetailResponse> {
    const response = await api.patch<CustomerDetailResponse>(`/customers/${customerId}`, payload);
    return response.data;
  },

  async getCustomerRouter(customerId: string): Promise<{ success: boolean; data: any }> {
    const response = await api.get<{ success: boolean; data: any }>(`/customers/${customerId}/router`);
    return response.data;
  },

  async saveCustomerRouter(customerId: string, payload: {
    routerIp: string;
    routerModel?: string;
    routerPort?: string;
    routerUsername?: string;
    routerPassword?: string;
  }): Promise<{ success: boolean; data: any }> {
    const response = await api.post<{ success: boolean; data: any }>(`/customers/${customerId}/router`, payload);
    return response.data;
  },

  async bindMac(customerId: string): Promise<{ success: boolean; data: any }> {
    const response = await api.post<{ success: boolean; data: any }>(`/customers/${customerId}/bind-mac`);
    return response.data;
  },

  async getMacStatus(customerId: string): Promise<{ success: boolean; data: { hasCallerId: boolean; callerId: string | null } }> {
    const response = await api.get<any>(`/customers/${customerId}/mac-status`);
    const res = response.data;
    const inner = (res && res.data) ? res.data : res;
    return {
      success: res?.success ?? true,
      data: {
        hasCallerId: Boolean(inner?.hasCallerId),
        callerId: inner?.callerId || null
      }
    };
  },

  async syncSession(customerId: string): Promise<{ success: boolean; data: any; message?: string }> {
    const response = await api.post<{ success: boolean; data: any; message?: string }>(`/customers/${customerId}/sync`);
    return response.data;
  },

  async provisionToMikrotik(customerId: string): Promise<{ success: boolean; data: any; message?: string }> {
    const response = await api.post<{ success: boolean; data: any; message?: string }>(`/customers/${customerId}/provision`);
    return response.data;
  },

  async disconnectSession(customerId: string): Promise<{ success: boolean; data: any }> {
    const response = await api.post<{ success: boolean; data: any }>(`/customers/${customerId}/disconnect`);
    return response.data;
  },

  async toggleSuspendRestore(customerId: string): Promise<{ success: boolean; message: string; action: 'suspended' | 'restored' }> {
    const response = await api.post<{ success: boolean; message: string; action: 'suspended' | 'restored' }>(`/customers/${customerId}/suspend-restore`);
    return response.data;
  },

  async markLeft(customerId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(`/customers/${customerId}/mark-left`);
    return response.data;
  },

  async deleteCustomer(customerId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/customers/${customerId}`);
    return response.data;
  },

  async activateFromLeft(customerId: string): Promise<{ success: boolean; message: string; profileApplied?: string }> {
    const response = await api.post<{ success: boolean; message: string; profileApplied?: string }>(`/customers/${customerId}/activate`);
    return response.data;
  },

  async pingCustomer(customerId: string): Promise<{
    success: boolean;
    address?: string;
    uptime?: string;
    lines: string[];
    bandwidthLines: string[];
    error?: string;
  }> {
    const response = await api.post<any>(`/customers/${customerId}/ping`);
    const res = response.data;
    const inner = (res && res.data && Array.isArray(res.data.lines)) ? res.data : res;
    return {
      success: Boolean(res?.success ?? inner?.success),
      address: inner?.address || '',
      uptime: inner?.uptime || '',
      lines: Array.isArray(inner?.lines) ? inner.lines : [],
      bandwidthLines: Array.isArray(inner?.bandwidthLines) ? inner.bandwidthLines : [],
      error: inner?.error || res?.error || '',
    };
  },

  async getUsageStatistics(customerId: string, startDate?: string, endDate?: string): Promise<{ success: boolean; data: any }> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    const response = await api.get<{ success: boolean; data: any }>(`/customers/${customerId}/usage${queryString ? `?${queryString}` : ''}`);
    return response.data;
  },
};
