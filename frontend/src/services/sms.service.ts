import api from '@/lib/api';

export interface SmsLogEntry {
  smsLogId: string;
  tenantId: string;
  providerName: string;
  toNumber: string;
  message: string;
  status: string;
  trxnId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface SmsLogQuery {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  status?: 'success' | 'failed';
}

export interface SmsLogResponse {
  data: SmsLogEntry[];
  total: number;
}

export interface SendSmsPayload {
  toNumbers: string[];
  message: string;
}

export interface SendSmsResult {
  sent: number;
  failed: number;
  total: number;
  results: { to: string; success: boolean; error?: string }[];
}

export type SmsTemplatesMap = Record<string, { enabled: boolean; body: string }>;

export const smsService = {
  async getTemplates(): Promise<SmsTemplatesMap> {
    const response = await api.get<SmsTemplatesMap>('/sms/templates');
    return response.data;
  },

  async saveTemplates(templates: SmsTemplatesMap): Promise<{ success: boolean }> {
    const response = await api.post<{ success: boolean }>('/sms/templates', { templates });
    return response.data;
  },

  async getLog(query: SmsLogQuery): Promise<SmsLogResponse> {
    const params: Record<string, string | number | undefined> = {};
    if (query.page != null) params.page = query.page;
    if (query.limit != null) params.limit = query.limit;
    if (query.dateFrom) params.dateFrom = query.dateFrom;
    if (query.dateTo) params.dateTo = query.dateTo;
    if (query.search) params.search = query.search;
    if (query.status) params.status = query.status;
    const response = await api.get<SmsLogResponse>('/sms/log', { params });
    return response.data;
  },

  async send(payload: SendSmsPayload): Promise<SendSmsResult> {
    const response = await api.post<SendSmsResult>('/sms/send', payload);
    return response.data;
  },

  async getBalance(): Promise<number | null> {
    const response = await api.get<{ balance: number | null }>('/sms/balance');
    return response.data.balance ?? null;
  },
};
