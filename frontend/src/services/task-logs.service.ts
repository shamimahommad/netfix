import api from '@/lib/api';

export type TaskLogActionType = 'billing' | 'mikrotik' | 'status' | 'profile' | 'sms' | 'system';

export interface TaskLog {
  logId: string;
  customerId: string;
  actionType: TaskLogActionType;
  actionTitle: string;
  actionDetails: string | null;
  performedByName: string;
  performedByRole: string | null;
  createdAt: string;
}

export interface TaskLogsResponse {
  success: boolean;
  data: TaskLog[];
}

export interface TaskLogsCheckResponse {
  success: boolean;
  tableExists: boolean;
  message?: string;
}

export const taskLogsService = {
  async getByCustomerId(customerId: string): Promise<TaskLog[]> {
    const response = await api.get<TaskLogsResponse>(`/task-logs/customers/${customerId}`);
    return response.data.data;
  },

  /** Check if task log table exists (when no logs appear after actions). */
  async check(): Promise<TaskLogsCheckResponse> {
    const response = await api.get<TaskLogsCheckResponse>('/task-logs/check');
    return response.data;
  },
};
