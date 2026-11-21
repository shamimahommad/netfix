import api from '@/lib/api';

export interface CustomerLogHeader {
  customerId: string;
  customerCode: string;
  fullName: string;
  phone: string;
  alternatePhone?: string;
  pppoeUsername?: string;
  currentMac?: string;
  currentIp?: string;
  deviceVendor?: string;
  status: string;
  isOnline: boolean;
  packageName: string;
  packagePrice: number;
  balance: number;
}

export interface MacLogRow {
  mac: string;
  device: string;
  ip: string;
  firstSeen: string;
  lastSeen: string;
  hits: number;
  isCurrent: boolean;
}

export interface MacLogsData {
  currentMac: string | null;
  total: number;
  unique: number;
  rows: MacLogRow[];
}

export interface SmsLogRow {
  id: string;
  created_at: string;
  to: string;
  message: string;
  gateway: string;
  status: number; // 1: Delivered, 2: Sent, 3: Pending, 4: Failed
  statusLabel: string;
  count: number;
  generatedBy: string;
  response: string;
}

export interface SmsLogsData {
  totals: {
    total: number;
    delivered: number;
    pending: number;
    failed: number;
  };
  rows: SmsLogRow[];
}

export interface CallLogRow {
  id: string;
  created_at: string;
  voiceId?: string;
  type?: string;
  gateway?: string;
  status: number;
  statusLabel?: string;
  response?: string;
  retry?: number;
}

export interface CallLogsData {
  totals: {
    total: number;
    delivered: number;
    pending: number;
    failed: number;
  };
  rows: CallLogRow[];
}

export interface TaskLogRow {
  id: string;
  created_at: string;
  policy: string;
  ip: string;
  name: string;
  action: string;
  status: string;
}

export interface TaskLogsData {
  total: number;
  rows: TaskLogRow[];
}

export interface SessionLogRow {
  id: string;
  start: string;
  end: string;
  duration: string;
  durationSeconds: number;
  upload: string;
  download: string;
  total: string;
  totalBytes: number;
  ip: string;
  mac: string;
  reason: string;
  isOngoing: boolean;
}

export interface SessionLogsData {
  stats: {
    today: string;
    week: string;
    month: string;
    lastMonth: string;
  };
  rows: SessionLogRow[];
}

export interface RechargeLogRow {
  id: string;
  ref: string;
  type: string;
  debit: string;
  credit: string;
  balance: string;
  method: string;
  time: string;
  by: string;
  description: string;
}

export interface RechargeLogsData {
  stats: {
    totalRecharged: string;
    totalPaid: string;
    currentBalance: string;
    totalTransactions: number;
  };
  rows: RechargeLogRow[];
}

export type CustomerLogTabType = 'mac' | 'sms' | 'calls' | 'tasks' | 'sessions' | 'recharge';

export interface CustomerLogsResponse {
  success: boolean;
  customer: CustomerLogHeader;
  activeTab: CustomerLogTabType;
  data: MacLogsData | SmsLogsData | CallLogsData | TaskLogsData | SessionLogsData | RechargeLogsData;
}

export const customerLogsService = {
  getLogs: async (customerId: string, tab: CustomerLogTabType = 'mac'): Promise<CustomerLogsResponse> => {
    const res = await api.get<CustomerLogsResponse>(`/customers/logs/${customerId}`, {
      params: { tab },
    });
    return res.data;
  },
};
