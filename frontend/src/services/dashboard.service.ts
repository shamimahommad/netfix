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

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/dashboard/stats');
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
