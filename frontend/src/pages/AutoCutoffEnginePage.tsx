import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Settings, 
  RefreshCw, 
  ShieldAlert, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Network, 
  Cpu, 
  History, 
  Bell, 
  Radio
} from 'lucide-react';
import { 
  billingCronService, 
  BillingCronStatusResponse, 
  AutoCutoffSettings,
  RunCutoffResponse
} from '@/services/billingCron.service';
import AutoCutoffSettingsModal from '@/components/billing/AutoCutoffSettingsModal';
import { useToastContext } from '@/contexts/ToastContext';

export const AutoCutoffEnginePage: React.FC = () => {
  const toast = useToastContext();
  const [data, setData] = useState<BillingCronStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningCutoff, setIsRunningCutoff] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lastManualResult, setLastManualResult] = useState<RunCutoffResponse['data'] | null>(null);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const res = await billingCronService.getStatus();
      setData(res);
    } catch (err: any) {
      toast.error('Failed to load auto-cutoff status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRunCutoff = async () => {
    if (isRunningCutoff) return;
    setIsRunningCutoff(true);
    setLastManualResult(null);
    try {
      const res = await billingCronService.runCutoff();
      if (res.success) {
        toast.success(res.message || 'Cutoff routine finished');
        setLastManualResult(res.data);
        fetchStatus();
      } else {
        toast.error(res.message || 'Cutoff routine completed with errors');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to trigger cutoff');
    } finally {
      setIsRunningCutoff(false);
    }
  };

  const handleSettingsSaved = (updated: AutoCutoffSettings) => {
    if (data) {
      setData({ ...data, settings: updated });
    }
    fetchStatus();
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatCutoffTime = (timeStr?: string) => {
    if (!timeStr) return '10:00 AM';
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/10">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Auto-Cutoff Management
                </h1>
                {data?.settings?.autoCutoffEnabled ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Active (Daily at {formatCutoffTime(data.settings.cutoffTime)})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Auto-Cutoff Disabled
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Automated subscriber expiry management, MikroTik session cutoff & grace period control
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={fetchStatus}
              disabled={isLoading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              Engine Policy Settings
            </button>

            <button
              type="button"
              onClick={handleRunCutoff}
              disabled={isRunningCutoff}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isRunningCutoff ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running Cutoff...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Run Auto-Cutoff Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Subscribers */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm transition-all hover:border-blue-300 dark:hover:border-blue-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Subscribers
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {data?.metrics?.totalActive ?? '—'}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Healthy live subscriptions
            </p>
          </div>
        </div>

        {/* Expiring Soon (3 Days) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm transition-all hover:border-amber-300 dark:hover:border-amber-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Expiring in 3 Days
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {data?.metrics?.expiringIn3Days ?? '—'}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Renewal reminder candidates
            </p>
          </div>
        </div>

        {/* Expired / Ready for Cutoff */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm transition-all hover:border-rose-300 dark:hover:border-rose-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ready for Cutoff
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400">
              {data?.metrics?.expiredReadyForCutoff ?? '—'}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Past expiration + grace buffer
            </p>
          </div>
        </div>

        {/* Total Suspended */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm transition-all hover:border-slate-400">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Suspended Accounts
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <Network className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-200">
              {data?.metrics?.totalSuspended ?? '—'}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Lines currently disabled in MikroTik
            </p>
          </div>
        </div>
      </div>

      {/* Manual Execution Banner */}
      {lastManualResult && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-5 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                  Manual Cutoff Completed in {lastManualResult.durationMs}ms
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Processed {lastManualResult.expiredProcessed} expired subscriber(s) — {lastManualResult.mikrotikDisabled} MikroTik secrets disabled / dropped.
                </p>
              </div>
            </div>
            <button
              onClick={() => setLastManualResult(null)}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              Dismiss
            </button>
          </div>

          {lastManualResult.affectedSubscribers && lastManualResult.affectedSubscribers.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
                    <th className="py-2 pr-4 font-semibold">Customer</th>
                    <th className="py-2 px-4 font-semibold">PPPoE User</th>
                    <th className="py-2 px-4 font-semibold">Expired At</th>
                    <th className="py-2 pl-4 font-semibold">Router Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50 text-emerald-950 dark:text-emerald-100">
                  {lastManualResult.affectedSubscribers.map((sub) => (
                    <tr key={sub.customerId}>
                      <td className="py-2 pr-4 font-medium">{sub.name} ({sub.customerCode})</td>
                      <td className="py-2 px-4 font-mono">{sub.pppoeUsername || '—'}</td>
                      <td className="py-2 px-4">{formatDate(sub.expiresAt)}</td>
                      <td className="py-2 pl-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100">
                          {sub.routerStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Middle Grid: Engine Policy Summary + Last Run Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Policy Summary Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Current Engine Configuration
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Edit Policy
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
              <p className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Daily Cutoff Time
              </p>
              <p className="text-sm font-extrabold text-blue-950 dark:text-blue-100 mt-1">
                {formatCutoffTime(data?.settings?.cutoffTime)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <p className="text-slate-400 dark:text-slate-500 font-medium">Cutoff Mode</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 capitalize">
                {data?.settings?.autoCutoffEnabled ? 'Automated' : 'Disabled'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <p className="text-slate-400 dark:text-slate-500 font-medium">Grace Period</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                {data?.settings?.gracePeriodDays ?? 0} {data?.settings?.gracePeriodDays === 1 ? 'Day' : 'Days'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <p className="text-slate-400 dark:text-slate-500 font-medium">MikroTik Action</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                {data?.settings?.cutoffAction === 'suspended_profile' 
                  ? `Pool (${data?.settings?.suspendedProfileName || 'SUSPENDED'})` 
                  : 'Disable Secret + Drop Session'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 col-span-2 sm:col-span-1">
              <p className="text-slate-400 dark:text-slate-500 font-medium">Cutoff SMS Alert</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                {data?.settings?.sendCutoffSms ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
        </div>

        {/* Last Execution Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Last Cutoff Execution
              </h2>
            </div>
            {data?.lastRun && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                data.lastRun.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
              }`}>
                {data.lastRun.status.toUpperCase()}
              </span>
            )}
          </div>

          {data?.lastRun ? (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <p className="text-slate-400 dark:text-slate-500 font-medium">Trigger Type</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 capitalize">
                  {data.lastRun.triggerType}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <p className="text-slate-400 dark:text-slate-500 font-medium">Duration</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                  {data.lastRun.durationMs} ms
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <p className="text-slate-400 dark:text-slate-500 font-medium">Expired Processed</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                  {data.lastRun.expiredProcessed} accounts
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <p className="text-slate-400 dark:text-slate-500 font-medium">MikroTik Actions</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                  {data.lastRun.mikrotikDisabled} cutoffs
                </p>
              </div>

              <div className="col-span-2 pt-1 text-slate-500 dark:text-slate-400 text-xs">
                Executed at: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(data.lastRun.startedAt)}</span>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
              No previous runs recorded in database. Click "Run Auto-Cutoff Now" to trigger the first run.
            </div>
          )}
        </div>
      </div>

      {/* Execution History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Execution History & Audit Log
            </h2>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Showing last {data?.history?.length ?? 0} runs
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Run ID</th>
                <th className="py-3 px-4">Started At</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Processed</th>
                <th className="py-3 px-4">MikroTik Disabled</th>
                <th className="py-3 px-4">Errors</th>
                <th className="py-3 px-4">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {data?.history && data.history.length > 0 ? (
                data.history.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-white">#{row.id}</td>
                    <td className="py-3 px-4">{formatDate(row.started_at)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.trigger_type === 'scheduled'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                      }`}>
                        {row.trigger_type === 'scheduled' ? 'Automated' : 'Manual'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : row.status === 'running'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 animate-pulse'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                      }`}>
                        {row.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {row.status === 'failed' && <XCircle className="w-2.5 h-2.5" />}
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold">{row.expired_processed}</td>
                    <td className="py-3 px-4 font-semibold text-rose-600 dark:text-rose-400">{row.mikrotik_disabled}</td>
                    <td className="py-3 px-4">
                      {row.error_count > 0 ? (
                        <span className="font-bold text-rose-600">{row.error_count}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">{row.duration_ms}ms</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    No run history available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Modal */}
      {data && (
        <AutoCutoffSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentSettings={data.settings}
          onSaved={handleSettingsSaved}
        />
      )}
    </div>
  );
};

export default AutoCutoffEnginePage;
