import api from '@/lib/api';

export interface SaaSCustomerItem {
  customerId: string;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  customerCode: string;
  customerType: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: string;
  billingStatus: string;
  installationAddress: string;
  username: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  isOnline: boolean;
  packageName: string;
  packagePrice: number;
  expiryDate: string | null;
  createdAt: string;
}

export interface SaaSCustomersResponse {
  success: boolean;
  customers: SaaSCustomerItem[];
  total: number;
  page: number;
  limit: number;
  metrics: {
    totalCustomers: number;
    activeCustomers: number;
    suspendedCustomers: number;
    expiredCustomers: number;
    newThisMonth: number;
  };
}

export interface SaaSNetworkDeviceItem {
  networkDeviceId: string;
  deviceId: string;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  deviceCode: string;
  deviceName: string;
  deviceType: 'router' | 'switch' | 'olt' | 'access_point' | 'firewall' | 'other';
  vendor: string;
  status: string;
  managementIp: string;
  managementPort: number;
  winboxPort: number | null;
  webPort: number | null;
  apiUsername: string;
  isProduction: boolean;
  customPingInterval: number;
  snmpCommunity: string;
  snmpPort: number;
  ponType: string;
  totalPonPorts: number;
  subscriberCount: number;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface SaaSNetworkResponse {
  success: boolean;
  devices: SaaSNetworkDeviceItem[];
  metrics: {
    totalDevices: number;
    totalRouters: number;
    totalOlts: number;
    activeDevices: number;
    offlineDevices: number;
  };
  diagnostics?: {
    overall: 'healthy' | 'degraded';
    timestamp: string;
    responseTimeMs: number;
    checks: Record<string, any>;
  };
}

export const saasService = {
  async getGlobalCustomers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    tenant_id?: string;
    status?: string;
  }): Promise<SaaSCustomersResponse> {
    const response = await api.get<SaaSCustomersResponse>('/saas/customers', { params });
    return response.data;
  },

  async getNetworkInfrastructure(params?: {
    tenant_id?: string;
    type?: string;
    status?: string;
    search?: string;
  }): Promise<SaaSNetworkResponse> {
    const response = await api.get<SaaSNetworkResponse>('/saas/network', { params });
    return response.data;
  },
};
