import api from '@/lib/api';

export interface ActivityLogUser {
  id: number | null;
  username: string;
  name: string;
  role: string;
  avatar?: string | null;
}

export interface ActivityLogItem {
  id: number;
  logType: 'activity' | 'login' | 'client_task' | 'plan_update';
  action: string;
  module?: string | null;
  targetId?: string | null;
  targetType?: string | null;
  description: string;
  metadata?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  browser?: string | null;
  platform?: string | null;
  createdAt: string;
  user: ActivityLogUser;
}

export interface ActivityLogStats {
  allTotal: number;
  allToday: number;
  actTotal: number;
  actToday: number;
  loginTotal: number;
  loginToday: number;
  taskTotal: number;
  taskToday: number;
  planTotal: number;
  planToday: number;
}

export interface ActivityFilterUser {
  userId: number;
  username: string;
  name: string;
  role: string;
}

export interface ActivityLogFilters {
  users: ActivityFilterUser[];
  modules: string[];
  actions: string[];
}

export interface GetLogsParams {
  type?: 'all' | 'activity' | 'login' | 'client_task' | 'plan_update';
  user_id?: string | number;
  module?: string;
  action?: string;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ActivityLogsResponse {
  items: ActivityLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const activityLogsService = {
  async getStats(): Promise<ActivityLogStats> {
    const res = await api.get<{ success: boolean; data: ActivityLogStats }>('/activity-logs/stats');
    return res.data.data;
  },

  async getFilters(): Promise<ActivityLogFilters> {
    const res = await api.get<{ success: boolean; data: ActivityLogFilters }>('/activity-logs/filters');
    return res.data.data;
  },

  async getLogs(params: GetLogsParams = {}): Promise<ActivityLogsResponse> {
    const query = new URLSearchParams();
    if (params.type && params.type !== 'all') query.set('type', params.type);
    if (params.user_id) query.set('user_id', String(params.user_id));
    if (params.module) query.set('module', params.module);
    if (params.action) query.set('action', params.action);
    if (params.customer_id) query.set('customer_id', params.customer_id);
    if (params.date_from) query.set('date_from', params.date_from);
    if (params.date_to) query.set('date_to', params.date_to);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const url = qs ? `/activity-logs?${qs}` : '/activity-logs';
    const res = await api.get<{ success: boolean; data: ActivityLogsResponse }>(url);
    return res.data.data;
  },

  async getDetail(id: number | string): Promise<ActivityLogItem> {
    const res = await api.get<{ success: boolean; data: ActivityLogItem }>(`/activity-logs/detail/${id}`);
    return res.data.data;
  },
};
