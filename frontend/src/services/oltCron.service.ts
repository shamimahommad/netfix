import api from '@/lib/api';

export interface OltSyncSettings {
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  syncTimeoutSeconds: number;
}

export interface OltCronMetrics {
  totalOlts: number;
  activeOlts: number;
  syncedInWindow: number;
  needsSync: number;
  totalOnus: number;
  onlineOnus: number;
}

export interface OltCronLastRun {
  id: number;
  tenant_id: number | null;
  trigger_type: 'scheduled' | 'manual' | 'api';
  status: 'running' | 'completed' | 'failed';
  total_olts: number;
  synced_olts: number;
  failed_olts: number;
  skipped_olts: number;
  total_onus: number;
  online_onus: number;
  offline_onus: number;
  duration_ms: number;
  error_summary: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface OltCronHistoryItem {
  id: number;
  tenant_id: number | null;
  trigger_type: string;
  status: string;
  total_olts: number;
  synced_olts: number;
  failed_olts: number;
  skipped_olts: number;
  total_onus: number;
  online_onus: number;
  offline_onus: number;
  duration_ms: number;
  error_summary: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface OltCronStatusResponse {
  engineStatus: 'active' | 'paused';
  serverTime: string;
  settings: OltSyncSettings;
  metrics: OltCronMetrics;
  lastRun: OltCronLastRun | null;
  history: OltCronHistoryItem[];
  cronCommands: {
    linux: string;
    windows: string;
    webUrl: string;
  };
}

export interface RunOltSyncResponse {
  success: boolean;
  message: string;
  data: {
    runId: number;
    status: string;
    triggerType: string;
    totalOlts: number;
    syncedOlts: number;
    failedOlts: number;
    skippedOlts: number;
    totalOnus: number;
    onlineOnus: number;
    offlineOnus: number;
    durationMs: number;
    errors: string[];
    details: Array<{
      oltId: number;
      name: string;
      ip: string;
      status: 'synced' | 'skipped' | 'failed';
      totalOnus?: number;
      onlineOnus?: number;
      error?: string;
      reason?: string;
    }>;
    timestamp: string;
  };
}

export const oltCronService = {
  async getStatus(): Promise<OltCronStatusResponse> {
    const res = await api.get<{ success: boolean; data: OltCronStatusResponse }>('/saas/cron/olt/status');
    return res.data.data;
  },

  async saveSettings(settings: Partial<OltSyncSettings>): Promise<{ success: boolean; message: string; data: OltSyncSettings }> {
    const res = await api.post<{ success: boolean; message: string; data: OltSyncSettings }>('/saas/cron/olt/settings', settings);
    return res.data;
  },

  async runSync(force: boolean = true): Promise<RunOltSyncResponse> {
    const res = await api.post<RunOltSyncResponse>('/saas/cron/olt/run', { force });
    return res.data;
  },
};

export default oltCronService;
