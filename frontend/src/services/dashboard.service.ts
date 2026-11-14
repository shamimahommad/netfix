import api from '@/lib/api';

export interface DashboardStats {
  totalCustomers: number;
  totalActive: number;
  todayJoin: number;
  homeCustomers: number;
  lastMonthJoin: number;
  thisMonthJoin: number;
  expiredCustomers: number;
  suspendedCustomers: number;
  leftCustomers: number;
  todayCollection: number;
  thisMonthCollection: number;
  lastMonthCollection: number;
  hotspotTotal: number;
  hotspotActive: number;
  hotspotExpired: number;
  onlinePaymentToday: number;
  onlinePaymentThisMonth: number;
  onlinePaymentLastMonth: number;
}

export interface RecentActivityItem {
  logId: string;
  customerId: string;
  actionType: string;
  actionTitle: string;
  actionDetails: string | null;
  performedByName: string;
  performedByRole: string | null;
  createdAt: string;
}

export interface DashboardCharts {
  activeUsers: number;
  onlineUsers: number;
  smsSentToday: number;
  smsSentThisMonth: number;
  smsAveragePerDay: number;
  smsAlert: number;
  smsRecharge: number;
  smsNewCustomer: number;
  smsOther: number;
  ticketPending: number;
  ticketSolved: number;
}

export interface SaaSDashboardOverview {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  expiredTenants: number;
  newTenantsThisMonth: number;
  totalSubscribers: number;
  activeSubscribers: number;
  suspendedSubscribers: number;
  expiredSubscribers: number;
  newSubscribersThisMonth: number;
  totalRouters: number;
  totalOlts: number;
  totalDevices: number;
  activeDevices: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  totalTransactions: number;
  totalWalletBalance: number;
}

export interface SaaSTenantItem {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  status: 'active' | 'suspended' | 'trial' | 'expired' | 'terminated';
  countryCode: string;
  businessEmail: string;
  businessPhone: string | null;
  createdAt: string;
  totalCustomers: number;
  totalRouters: number;
  totalOlts: number;
  maxCustomers: number;
  maxRouters: number;
  maxOlts: number;
  walletBalance: number;
}

export interface SaaSPlatformHealth {
  phpVersion: string;
  memoryUsage: string;
  serverTime: string;
  apiPort: number;
  dbStatus: string;
  telemetryStatus: string;
}

export interface SaaSDashboardResponse {
  success: boolean;
  overview: SaaSDashboardOverview;
  tenants: SaaSTenantItem[];
  recentLogs: Array<{
    logId: number;
    username: string;
    email: string;
    ip: string;
    browser: string;
    os: string;
    createdAt: string;
  }>;
  health: SaaSPlatformHealth;
}

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/dashboard/stats');
    return response.data;
  },

  async getSaaSStats(): Promise<SaaSDashboardResponse> {
    const response = await api.get<SaaSDashboardResponse>('/dashboard/saas');
    return response.data;
  },

  async getRecentActivity(limit = 15): Promise<RecentActivityItem[]> {
    const response = await api.get<{ data: RecentActivityItem[] }>('/dashboard/recent-activity', {
      params: { limit },
    });
    return response.data?.data ?? [];
  },

  async getCharts(): Promise<DashboardCharts> {
    const response = await api.get<DashboardCharts>('/dashboard/charts');
    return response.data;
  },
};
