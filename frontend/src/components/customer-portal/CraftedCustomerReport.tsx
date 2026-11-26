import { motion } from 'framer-motion';
import {
  Activity,
  Download,
  Upload,
  Router,
  Clock,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Layers,
} from 'lucide-react';
import {
  CustomerDashboardData,
  CustomerSessionLogItem,
  CustomerSessionSummary,
} from '@/services/customer-portal.service';
import { TableRowSkeleton, SessionDateRangeFilter } from '@/components/customer-portal';
import { useCustomerPortalProfile } from '@/contexts/CustomerPortalContext';

interface CraftedCustomerReportProps {
  dashboard: CustomerDashboardData | null;
  sessions: CustomerSessionLogItem[];
  summary: CustomerSessionSummary | null;
  page: number;
  totalPages: number;
  sessionLoading: boolean;
  onPageChange: (newPage: number) => void;
  liveTraffic: {
    download_bps: number;
    upload_bps: number;
    status?: 'online' | 'offline';
    timestamp?: string;
    router_name?: string;
  } | null;
  preset: string;
  onSelectPreset: (preset: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onApplyCustom: () => void;
}

function formatSpeed(bps: number): string {
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${Math.round(bps)} bps`;
}

function formatTraffic(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '0 B';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatSessionTime(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '0m';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function CraftedCustomerReport({
  dashboard,
  sessions,
  summary,
  page,
  totalPages,
  sessionLoading,
  onPageChange,
  liveTraffic,
  preset,
  onSelectPreset,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApplyCustom,
}: CraftedCustomerReportProps) {
  const { setDesignMode } = useCustomerPortalProfile();
  const username = dashboard?.network?.username ?? '—';
  const monthlyUsage = dashboard?.monthlyUsage;
  const download = monthlyUsage ? monthlyUsage.downloadBytes : (dashboard?.network?.downloadBytes ?? 0);
  const upload = monthlyUsage ? monthlyUsage.uploadBytes : (dashboard?.network?.uploadBytes ?? 0);
  const totalMonthBytes = monthlyUsage ? monthlyUsage.totalBytes : (Number(download) + Number(upload));
  const isOnline = liveTraffic?.status === 'online';

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ────────────────── HEADER ────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Connection Monitor
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <button
              type="button"
              onClick={() => setDesignMode('classic')}
              className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <Layers className="w-3 h-3" />
              Switch to Classic UI
            </button>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Bandwidth & Session Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            PPPoE Account: <span className="text-slate-800 dark:text-slate-200 font-semibold">{username}</span>
          </p>
        </div>

        {/* Polling Indicator */}
        <div className="flex items-center gap-2 self-start sm:self-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Polling 2.5s via MikroTik</span>
        </div>
      </div>

      {/* ────────────────── LIVE BANDWIDTH TELEMETRY ────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Download Speed */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-semibold">
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Live Download
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatSpeed(liveTraffic?.download_bps ?? 0)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-1 truncate">Realtime downstream</p>
        </div>

        {/* Upload Speed */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-semibold">
              <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Live Upload
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatSpeed(liveTraffic?.upload_bps ?? 0)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-1 truncate">Realtime upstream</p>
        </div>

        {/* Session Status & Gateway */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-semibold">
              <Router className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Session Status
            </span>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {isOnline ? 'Active' : 'Offline'}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {liveTraffic?.router_name || 'MikroTik Gateway'}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-1 truncate">Core router link</p>
        </div>

        {/* Monthly Total Volume */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-semibold">
              <BarChart3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Month Total
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatTraffic(totalMonthBytes)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-1 truncate">
            Down: {formatTraffic(download)} · Up: {formatTraffic(upload)}
          </p>
        </div>
      </div>

      {/* ────────────────── DATE RANGE FILTER & RANGE AGGREGATES ────────────────── */}
      <SessionDateRangeFilter
        preset={preset}
        onSelectPreset={onSelectPreset}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={onStartDateChange}
        onEndDateChange={onEndDateChange}
        onApplyCustom={onApplyCustom}
        summary={summary}
        loading={sessionLoading}
      />

      {/* ────────────────── SESSION DISCONNECTION & UPTIME LOG ────────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              PPPoE Connection & Disconnect Log
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Historical timeline of active sessions, session durations, and disconnect triggers
            </p>
          </div>

          {summary && (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
              <span>Total Sessions: <strong className="text-slate-800 dark:text-slate-200">{summary.totalSessions ?? sessions.length}</strong></span>
              {summary.totalDisconnects != null && (
                <>
                  <span>·</span>
                  <span>Disconnects: <strong className="text-rose-600 dark:text-rose-400">{summary.totalDisconnects}</strong></span>
                </>
              )}
            </div>
          )}
        </div>

        {sessionLoading ? (
          <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRowSkeleton key={i} cols={6} />
                ))}
              </tbody>
            </table>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-mono">
            No session logs found for this customer account.
          </div>
        ) : (
          <>
            {/* MOBILE VIEW (< sm): Clean native session telemetry cards */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {sessions.map((s, idx) => {
                const connDate = s.connection_date || s.connectedAt;
                const discDate = s.disconnection_date || s.disconnectedAt;
                const isActive = s.status === 'active' || (!discDate && s.status !== 'disconnected');
                const duration = s.session_time_formatted || formatSessionTime(s.session_time ?? s.durationSeconds);
                const downBytes = s.download ?? s.downloadBytes ?? 0;
                const upBytes = s.upload ?? s.uploadBytes ?? 0;
                const ip = s.assigned_ip || s.framedIp || '—';
                const reason = s.disconnect_reason || s.terminateCause || (isActive ? 'Active Session (Online Now)' : 'Session Terminated');

                return (
                  <div key={s.session_id || s.id || idx} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active Connection
                          </span>
                        ) : (
                          <span className="text-slate-500">Ended Session</span>
                        )}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate max-w-[160px]">
                        {reason}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Duration:
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {duration}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 font-sans">Data (Down / Up):</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        <span className="text-blue-600 dark:text-blue-400">↓ {formatTraffic(downBytes)}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-emerald-600 dark:text-emerald-400">↑ {formatTraffic(upBytes)}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-50 dark:border-slate-800/60 font-mono">
                      <span>IP: {ip}</span>
                      <span className="font-sans text-[10px] text-slate-500">
                        {formatDate(connDate)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP VIEW (>= sm): Structured wide table */}
            <div className="hidden sm:block overflow-x-auto customer-portal-scrollbar rounded-lg border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left text-xs font-mono min-w-[560px] whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-3.5 py-2">Connected At</th>
                    <th className="px-3.5 py-2">Disconnected At</th>
                    <th className="px-3.5 py-2">Duration</th>
                    <th className="px-3.5 py-2">Data (Down/Up)</th>
                    <th className="px-3.5 py-2">Assigned IP</th>
                    <th className="px-3.5 py-2 text-right">Termination Cause</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sessions.map((s, idx) => {
                    const connDate = s.connection_date || s.connectedAt;
                    const discDate = s.disconnection_date || s.disconnectedAt;
                    const isActive = s.status === 'active' || (!discDate && s.status !== 'disconnected');
                    const duration = s.session_time_formatted || formatSessionTime(s.session_time ?? s.durationSeconds);
                    const downBytes = s.download ?? s.downloadBytes ?? 0;
                    const upBytes = s.upload ?? s.uploadBytes ?? 0;
                    const ip = s.assigned_ip || s.framedIp || '—';
                    const reason = s.disconnect_reason || s.terminateCause || (isActive ? 'Active Session (Online Now)' : 'Session Terminated');

                    return (
                      <tr key={s.session_id || s.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 font-sans">{formatDate(connDate)}</td>
                        <td className="px-3.5 py-2.5 text-slate-500 font-sans">
                          {discDate ? formatDate(discDate) : (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              Current Active
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                          {duration}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400">
                          {formatTraffic(downBytes)} / {formatTraffic(upBytes)}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">{ip}</td>
                        <td className="px-3.5 py-2.5 text-right font-sans">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {reason}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-400 font-mono">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
