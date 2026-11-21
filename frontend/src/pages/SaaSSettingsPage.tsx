import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Settings, 
  RefreshCw, 
  Radio, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Copy, 
  Check, 
  Network, 
  Server, 
  Sliders, 
  ShieldCheck, 
  Activity, 
  Terminal,
  ArrowRight,
  Layers
} from 'lucide-react';
import { 
  oltCronService, 
  OltCronStatusResponse, 
  OltSyncSettings, 
  RunOltSyncResponse 
} from '@/services/oltCron.service';
import { useToastContext } from '@/contexts/ToastContext';
import { Link } from 'react-router-dom';

export const SaaSSettingsPage: React.FC = () => {
  const toast = useToastContext();
  const [data, setData] = useState<OltCronStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningSync, setIsRunningSync] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<RunOltSyncResponse['data'] | null>(null);

  // Form State
  const [enabled, setEnabled] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState(120);
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);
  const [customInterval, setCustomInterval] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  // Copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const res = await oltCronService.getStatus();
      setData(res);
      setEnabled(res.settings.autoSyncEnabled);
      setIntervalMinutes(res.settings.syncIntervalMinutes);
      setTimeoutSeconds(res.settings.syncTimeoutSeconds);

      const standardIntervals = [15, 30, 60, 120, 240, 360, 720, 1440];
      if (!standardIntervals.includes(res.settings.syncIntervalMinutes)) {
        setIsCustom(true);
        setCustomInterval(String(res.settings.syncIntervalMinutes));
      } else {
        setIsCustom(false);
      }
    } catch (err: any) {
      toast.error('Failed to load OLT cron settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveSettings = async () => {
    const finalInterval = isCustom ? Math.max(5, parseInt(customInterval) || 120) : intervalMinutes;
    setIsSaving(true);
    try {
      const res = await oltCronService.saveSettings({
        autoSyncEnabled: enabled,
        syncIntervalMinutes: finalInterval,
        syncTimeoutSeconds: timeoutSeconds,
      });
      if (res.success) {
        toast.success(res.message || 'OLT cron settings updated successfully');
        await fetchStatus();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunSyncNow = async () => {
    if (isRunningSync) return;
    setIsRunningSync(true);
    setLastSyncResult(null);
    try {
      toast.info('Triggering manual OLT hardware sync...');
      const res = await oltCronService.runSync(true);
      if (res.success) {
        toast.success(res.message || 'OLT hardware sync completed successfully');
        setLastSyncResult(res.data);
        await fetchStatus();
      } else {
        toast.error(res.message || 'OLT sync encountered issues');
        if (res.data) setLastSyncResult(res.data);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to run sync');
    } finally {
      setIsRunningSync(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                SaaS System & Cron Engine Settings
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Configure global automation intervals, OLT synchronization, and background workers
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Engine State</span>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-3 h-3 rounded-full ${data?.engineStatus === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-lg font-bold text-slate-900 dark:text-white capitalize">
              {data?.engineStatus || 'Loading'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">OLT Auto-Sync</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sync Interval</span>
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-2">
            {data?.settings.syncIntervalMinutes ?? 120} min
          </div>
          <span className="text-[11px] text-slate-400 mt-1">
            {((data?.settings.syncIntervalMinutes ?? 120) / 60).toFixed(1)} hours cycle
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total OLTs</span>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-2">
            {data?.metrics.totalOlts ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-1">
            {data?.metrics.activeOlts ?? 0} active
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Up To Date</span>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {data?.metrics.syncedInWindow ?? 0}
          </div>
          <span className="text-[11px] text-emerald-500/80 mt-1">Within window</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Due For Sync</span>
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-2">
            {data?.metrics.needsSync ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Pending sync</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total ONUs</span>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-2">
            {data?.metrics.totalOnus ?? 0}
          </div>
          <span className="text-[11px] text-emerald-500 mt-1">
            {data?.metrics.onlineOnus ?? 0} online
          </span>
        </div>
      </div>

      {/* Main OLT Hardware Synchronization Engine Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                OLT Hardware Automated Sync Schedule
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                SaaS-wide automated schedule for polling OLT optical power, PON port telemetry, and connected ONUs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunSyncNow}
              disabled={isRunningSync}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Play className={`w-4 h-4 fill-current ${isRunningSync ? 'animate-spin' : ''}`} />
              {isRunningSync ? 'Synchronizing Hardware...' : 'Run Sync Now'}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Auto-Sync Toggle */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  OLT Auto-Sync Cron
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enables periodic automated polling in the background
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Sync Interval Selector */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                Sync Interval (Frequency)
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                How frequently OLT hardware should be polled
              </p>
              
              {!isCustom ? (
                <div className="flex gap-2">
                  <select
                    value={intervalMinutes}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsCustom(true);
                        setCustomInterval(String(intervalMinutes));
                      } else {
                        setIntervalMinutes(parseInt(e.target.value));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={15}>Every 15 Minutes</option>
                    <option value={30}>Every 30 Minutes</option>
                    <option value={60}>Every 1 Hour (60 mins)</option>
                    <option value={120}>Every 2 Hours (120 mins - Recommended)</option>
                    <option value={240}>Every 4 Hours (240 mins)</option>
                    <option value={360}>Every 6 Hours (360 mins)</option>
                    <option value={720}>Every 12 Hours (720 mins)</option>
                    <option value={1440}>Every 24 Hours (Once a Day)</option>
                    <option value="custom">Custom Minutes...</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={10080}
                    value={customInterval}
                    onChange={(e) => setCustomInterval(e.target.value)}
                    placeholder="Enter minutes (e.g. 90)"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustom(false);
                      setIntervalMinutes(120);
                    }}
                    className="px-3 py-2 text-xs font-semibold bg-slate-200 dark:bg-slate-700 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                  >
                    Presets
                  </button>
                </div>
              )}
            </div>

            {/* Connection Timeout */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                Network Socket Timeout
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Max seconds before marking unresponsive OLT timed out
              </p>
              <select
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={15}>15 Seconds (Fast)</option>
                <option value={30}>30 Seconds (Default Standard)</option>
                <option value={60}>60 Seconds (For high latency wireless hops)</option>
              </select>
            </div>
          </div>

          {/* Save Button Row */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {isSaving ? 'Saving Settings...' : 'Save Configuration'}
            </button>
          </div>

          {/* Last Run Banner / Live Manual Run Feedback */}
          {lastSyncResult && (
            <div className={`p-5 rounded-2xl border ${lastSyncResult.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200' : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'} space-y-3 animate-in fade-in`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm">
                  {lastSyncResult.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  )}
                  <span>Latest Manual Sync: {lastSyncResult.status.toUpperCase()} (Run #{lastSyncResult.runId})</span>
                </div>
                <span className="text-xs font-mono opacity-80">{lastSyncResult.timestamp}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>Total OLTs: <strong>{lastSyncResult.totalOlts}</strong></div>
                <div>Synced: <strong className="text-emerald-600 dark:text-emerald-400">{lastSyncResult.syncedOlts}</strong></div>
                <div>Skipped: <strong>{lastSyncResult.skippedOlts}</strong></div>
                <div>Failed: <strong className={lastSyncResult.failedOlts > 0 ? 'text-red-600 font-bold' : ''}>{lastSyncResult.failedOlts}</strong></div>
                <div>Duration: <strong>{(lastSyncResult.durationMs / 1000).toFixed(2)}s</strong></div>
              </div>
              {lastSyncResult.errors?.length > 0 && (
                <div className="text-xs bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-red-700 dark:text-red-300 font-mono">
                  {lastSyncResult.errors.join(' | ')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Server Automation & Crontab Setup Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Crontab / Task Scheduler Box */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Server Cron Job Command (CLI)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add this to your server's crontab or Windows Task Scheduler to automate execution
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center text-xs text-slate-400 font-semibold mb-1">
                <span>Linux Crontab (`crontab -e`) — Suggested Every 15–30 Mins</span>
                <button
                  onClick={() => copyToClipboard(data?.cronCommands.linux || '*/15 * * * * php backend/cron/sync_olt.php', 'linux')}
                  className="text-blue-500 hover:text-blue-600 flex items-center gap-1 font-medium"
                >
                  {copiedKey === 'linux' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'linux' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="p-3 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800 select-all">
                {data?.cronCommands.linux || '*/15 * * * * php backend/cron/sync_olt.php >> /var/log/netfix_olt_sync.log 2>&1'}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs text-slate-400 font-semibold mb-1">
                <span>Windows Task Scheduler (CLI)</span>
                <button
                  onClick={() => copyToClipboard(data?.cronCommands.windows || 'php backend/cron/sync_olt.php', 'win')}
                  className="text-blue-500 hover:text-blue-600 flex items-center gap-1 font-medium"
                >
                  {copiedKey === 'win' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'win' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="p-3 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800 select-all">
                {data?.cronCommands.windows || 'php backend/cron/sync_olt.php'}
              </div>
            </div>
          </div>
        </div>

        {/* Other Platform Engines Quick Link Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Subscriber Auto-Cutoff Engine
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Automated expiry enforcement, MikroTik session drops, and grace period rules
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <div className="flex items-center justify-between">
                <span>Automated Cutoff Routine:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Active (Hourly Worker)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Target Action:</span>
                <span className="font-semibold">Disable Secret / Suspended Profile</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/dashboard/settings/auto-cutoff"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 rounded-xl text-sm font-semibold transition"
            >
              <span>Manage Auto-Cutoff Settings</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent OLT Sync Execution History */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Recent OLT Sync Execution History
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit log of automated cron runs and manual triggers
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Run ID</th>
                <th className="px-6 py-3.5">Trigger</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">OLTs Synced</th>
                <th className="px-6 py-3.5">ONUs Discovered</th>
                <th className="px-6 py-3.5">Duration</th>
                <th className="px-6 py-3.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {data?.history && data.history.length > 0 ? (
                data.history.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-6 py-3.5 font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                      #{run.id}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="capitalize px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                        {run.trigger_type}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        run.status === 'completed' 
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                          : run.status === 'running' 
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 animate-pulse'
                            : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                      }`}>
                        {run.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {run.status === 'failed' && <XCircle className="w-3.5 h-3.5" />}
                        {run.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{run.synced_olts}</span> / {run.total_olts} OLTs
                      {run.skipped_olts > 0 && <span className="text-slate-400 ml-1.5">({run.skipped_olts} skipped)</span>}
                      {run.failed_olts > 0 && <span className="text-red-500 font-bold ml-1.5">({run.failed_olts} failed)</span>}
                    </td>
                    <td className="px-6 py-3.5 text-xs">
                      <strong>{run.total_onus}</strong> <span className="text-slate-400 font-normal">({run.online_onus} online)</span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs">
                      {(run.duration_ms / 1000).toFixed(2)}s
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                      {run.started_at}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 text-sm">
                    No OLT sync runs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SaaSSettingsPage;
