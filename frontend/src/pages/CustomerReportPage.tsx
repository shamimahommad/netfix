import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Activity,
  Clock,
  Router,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  customerPortalService,
  CustomerDashboardData,
  CustomerSessionLogItem,
  CustomerSessionSummary,
} from '@/services/customer-portal.service';
import { TableRowSkeleton, CraftedCustomerReport, SessionDateRangeFilter } from '@/components/customer-portal';
import { useCustomerPortalProfile } from '@/contexts/CustomerPortalContext';

function formatSpeed(bps: number): string {
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${Math.round(bps)} bps`;
}

function formatTraffic(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return '0 MB';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;
  return `${bytes} B`;
}

function formatSessionTime(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '0m';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  if (d === 0 && h === 0) parts.push(`${s}s`);

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
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function CustomerReportPage() {
  const { designMode } = useCustomerPortalProfile();
  const [dashboard, setDashboard] = useState<CustomerDashboardData | null>(null);
  const [sessions, setSessions] = useState<CustomerSessionLogItem[]>([]);
  const [summary, setSummary] = useState<CustomerSessionSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [preset, setPreset] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [liveTraffic, setLiveTraffic] = useState<{
    download_bps: number;
    upload_bps: number;
    status?: 'online' | 'offline';
    timestamp?: string;
    router_name?: string;
  } | null>(null);
  const liveTrafficIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveTraffic = () => {
    customerPortalService
      .getLiveTraffic()
      .then((res) => setLiveTraffic(res.data))
      .catch(() => setLiveTraffic({ download_bps: 0, upload_bps: 0, status: 'offline' }));
  };

  useEffect(() => {
    fetchLiveTraffic();
    liveTrafficIntervalRef.current = setInterval(fetchLiveTraffic, 2500);
    return () => {
      if (liveTrafficIntervalRef.current) clearInterval(liveTrafficIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    customerPortalService
      .getDashboard()
      .then((res) => setDashboard(res.data))
      .catch(() => setDashboard(null));
  }, []);

  const loadSessions = (p = page, pr = preset, s = startDate, e = endDate) => {
    setSessionLoading(true);
    customerPortalService
      .getSessionLog(p, 15, {
        preset: pr,
        startDate: s,
        endDate: e,
      })
      .then((res) => {
        setSessions(res.data || []);
        setSummary(res.summary || null);
        setTotalPages(res.meta?.totalPages ?? 1);
      })
      .catch(() => {
        setSessions([]);
        setSummary(null);
      })
      .finally(() => setSessionLoading(false));
  };

  useEffect(() => {
    loadSessions(page, preset, startDate, endDate);
  }, [page, preset]);

  const handleSelectPreset = (newPreset: string) => {
    setPreset(newPreset);
    setPage(1);
    if (newPreset !== 'custom') {
      loadSessions(1, newPreset, '', '');
    }
  };

  const handleApplyCustom = () => {
    setPage(1);
    loadSessions(1, 'custom', startDate, endDate);
  };

  const username = dashboard?.network?.username ?? '—';
  const download = dashboard?.network?.downloadBytes ?? 0;
  const upload = dashboard?.network?.uploadBytes ?? 0;

  const usageChartData = [
    { name: 'Download', value: Math.max(0.01, Number(download) / 1e9), fill: '#3b82f6' },
    { name: 'Upload', value: Math.max(0.01, Number(upload) / 1e9), fill: '#10b981' },
  ];

  if (designMode === 'crafted') {
    return (
      <CraftedCustomerReport
        dashboard={dashboard}
        sessions={sessions}
        summary={summary}
        page={page}
        totalPages={totalPages}
        sessionLoading={sessionLoading}
        onPageChange={setPage}
        liveTraffic={liveTraffic}
        preset={preset}
        onSelectPreset={handleSelectPreset}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApplyCustom={handleApplyCustom}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          Bandwidth & Connection Telemetry
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
          Realtime line monitor and disconnection history for PPPoE account{' '}
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{username}</span>
        </p>
      </div>

      {/* ────────────────── REALTIME LINE SPEED MONITOR ────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Live Bandwidth Telemetry
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Polling every 2.5s via MikroTik API
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/25 border border-blue-200/50 dark:border-blue-700/40 text-blue-700 dark:text-blue-300">
            <Download className="w-5 h-5 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80 truncate">Download</p>
              <p className="text-base sm:text-lg font-display font-bold truncate">{formatSpeed(liveTraffic?.download_bps ?? 0)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200/50 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300">
            <Upload className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80 truncate">Upload</p>
              <p className="text-base sm:text-lg font-display font-bold truncate">{formatSpeed(liveTraffic?.upload_bps ?? 0)}</p>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 p-3.5 sm:p-4 rounded-2xl text-xs font-bold uppercase border ${
              liveTraffic?.status === 'online'
                ? 'bg-emerald-50 border-emerald-300/40 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${liveTraffic?.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className="truncate">{liveTraffic?.status === 'online' ? 'Session Active' : 'Offline'}</span>
          </div>

          <div className="flex items-center gap-2 p-3.5 sm:p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs">
            <Router className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Gateway</p>
              <p className="font-semibold truncate">{liveTraffic?.router_name || 'Core Router'}</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ────────────────── DISCONNECTION & SESSION SUMMARY ────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">Total Disconnects</p>
          <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mt-1">
            {summary?.totalDisconnects ?? 0}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Events recorded</p>
        </div>

        <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">Avg Session Time</p>
          <p className="text-xl sm:text-2xl font-display font-bold text-blue-600 dark:text-blue-400 mt-1 truncate">
            {summary?.averageSessionFormatted || '—'}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Uptime per session</p>
        </div>

        <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">Current Session</p>
          <p className="text-xl sm:text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
            {dashboard?.router?.uptimeFormatted || '0m'}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Active uptime</p>
        </div>

        <div className="glass-card rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-700/80">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">Last Disconnect</p>
          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 truncate" title={summary?.lastDisconnectedAt || 'None'}>
            {summary?.lastDisconnectedAt ? formatDate(summary.lastDisconnectedAt) : 'None recently'}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {dashboard?.router?.lastDisconnectReason || 'Normal operation'}
          </p>
        </div>
      </div>

      {/* ────────────────── DOWNLOAD / UPLOAD CHART ────────────────── */}
      <motion.section
        whileHover={{ y: -1 }}
        className="glass-card rounded-3xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm"
      >
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-2 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Monthly Traffic Consumption
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Total usage for current monthly billing cycle
        </p>

        <div className="h-44 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usageChartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `${v.toFixed(1)} GB`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={75} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#fff',
                }}
                formatter={(value: any) => [`${Number(value).toFixed(2)} GB`, 'Usage']}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={600}>
                {usageChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            Download: {formatTraffic(download)}
          </span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            Upload: {formatTraffic(upload)}
          </span>
        </div>
      </motion.section>

      {/* ────────────────── DATE RANGE FILTER & RANGE AGGREGATES ────────────────── */}
      <SessionDateRangeFilter
        preset={preset}
        onSelectPreset={handleSelectPreset}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApplyCustom={handleApplyCustom}
        summary={summary}
        loading={sessionLoading}
      />

      {/* ────────────────── DISCONNECTION & SESSION LOGS ("kobe kobe koto time por por disconnect hoyece") ────────────────── */}
      <motion.section
        whileHover={{ y: -1 }}
        className="glass-card rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Connection & Disconnection Session Log
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tracks when connected, when disconnected, session uptime duration & reason
            </p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Page {page} of {totalPages}
          </span>
        </div>

        {sessionLoading ? (
          <div className="p-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 text-left text-slate-500">
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Connection Time</th>
                  <th className="px-4 py-3 font-semibold">Disconnection Time</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Traffic (Down / Up)</th>
                  <th className="px-4 py-3 font-semibold">Disconnect Reason</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRowSkeleton key={i} cols={6} />
                ))}
              </tbody>
            </table>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
            No session history logs recorded yet. Active connections are polled periodically from your MikroTik server.
          </div>
        ) : (
          <>
            {/* MOBILE VIEW (< sm): Clean native session telemetry cards */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {sessions.map((s, i) => {
                const isActive = s.status === 'active' || s.session_id === 'active_live';
                return (
                  <div key={s.session_id || i} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active Now
                          </span>
                        ) : (
                          <span className="text-slate-500">Ended Session</span>
                        )}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {s.disconnect_reason || 'Normal Termination'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Duration:
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {s.session_time_formatted || formatSessionTime(s.session_time)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 font-sans">Traffic (Down / Up):</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        <span className="text-blue-600 dark:text-blue-400">↓ {formatTraffic(s.download)}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-emerald-600 dark:text-emerald-400">↑ {formatTraffic(s.upload)}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-50 dark:border-slate-800/60 font-sans">
                      <span>{formatDate(s.connection_date)}</span>
                      <span>{s.disconnection_date ? `End: ${formatDate(s.disconnection_date)}` : 'Still Connected'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP VIEW (>= sm): Structured table */}
            <div className="hidden sm:block overflow-x-auto customer-portal-scrollbar">
              <table className="w-full text-left text-xs min-w-[560px]">
                <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Connected At</th>
                    <th className="px-4 py-3">Disconnected At</th>
                    <th className="px-4 py-3">Session Duration</th>
                    <th className="px-4 py-3">Traffic (Down / Up)</th>
                    <th className="px-4 py-3">Reason / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {sessions.map((s, i) => {
                    const isActive = s.status === 'active' || s.session_id === 'active_live';
                    return (
                      <tr
                        key={s.session_id || i}
                        className={`transition-colors ${
                          isActive
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/60'
                            : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="px-4 py-3">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active Now
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              Ended
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {formatDate(s.connection_date)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {s.disconnection_date ? formatDate(s.disconnection_date) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Still Connected</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {s.session_time_formatted || formatSessionTime(s.session_time)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">↓ {formatTraffic(s.download)}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">↑ {formatTraffic(s.upload)}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={s.disconnect_reason || ''}>
                          {s.disconnect_reason || 'Normal Termination'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
                <span className="text-slate-500 font-medium">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </motion.section>
    </motion.div>
  );
}
