import api from '@/lib/api';

export interface AutoCutoffSettings {
  autoCutoffEnabled: boolean;
  gracePeriodDays: number;
  cutoffTime: string; // e.g. '10:00'
  cutoffAction: 'disable_secret' | 'suspended_profile';
  suspendedProfileName?: string;
  sendCutoffSms: boolean;
  autoInvoiceEnabled: boolean;
  invoiceDueDays: number;
}

export interface BillingCronMetrics {
  totalActive: number;
  expiringIn3Days: number;
  expiredReadyForCutoff: number;
  totalSuspended: number;
}

export interface BillingCronLastRun {
  id: number;
  triggerType: 'scheduled' | 'manual' | 'api';
  status: 'running' | 'completed' | 'failed';
  expiredProcessed: number;
  mikrotikDisabled: number;
  errorCount: number;
  durationMs: number;
  startedAt: string;
  completedAt: string | null;
}

export interface BillingCronHistoryItem {
  id: string;
  tenant_id: string | null;
  trigger_type: string;
  status: string;
  expired_processed: number;
  mikrotik_disabled: number;
  error_count: number;
  duration_ms: number;
  started_at: string;
  completed_at: string | null;
}

export interface BillingCronStatusResponse {
  engineStatus: string;
  serverTime: string;
  settings: AutoCutoffSettings;
  metrics: BillingCronMetrics;
  lastRun: BillingCronLastRun | null;
  history: BillingCronHistoryItem[];
}

export interface RunCutoffResponse {
  success: boolean;
  message: string;
  data: {
    runId: number;
    triggerType: string;
    status: string;
    expiredProcessed: number;
    mikrotikDisabled: number;
    errorCount: number;
    durationMs: number;
    affectedSubscribers: Array<{
      customerId: number;
      customerCode: string;
      name: string;
      pppoeUsername: string;
      expiresAt: string;
      routerStatus: string;
    }>;
    timestamp: string;
  };
}

export const billingCronService = {
  async getStatus(): Promise<BillingCronStatusResponse> {
    const res = await api.get<{ success: boolean; data: BillingCronStatusResponse }>('/billing/cutoff/status');
    return res.data.data;
  },

  async runCutoff(): Promise<RunCutoffResponse> {
    const res = await api.post<RunCutoffResponse>('/billing/cutoff/run');
    return res.data;
  },

  async saveSettings(settings: Partial<AutoCutoffSettings>): Promise<{ success: boolean; message: string; data: AutoCutoffSettings }> {
    const res = await api.post<{ success: boolean; message: string; data: AutoCutoffSettings }>('/billing/cutoff/settings', settings);
    return res.data;
  },
};

export default billingCronService;
