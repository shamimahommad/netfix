import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, ChevronLeft, ChevronRight, Download, Upload, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { customerPortalService, CustomerDashboardData } from '@/services/customer-portal.service';
import { TableRowSkeleton } from '@/components/customer-portal';

function formatSpeed(bps: number): string {
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${Math.round(bps)} bps`;
}

function formatTraffic(bytes: number | null): string {
  if (bytes == null) return '0 KB';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;
  return `${bytes} B`;
}

function formatSessionTime(seconds: number): string {
  if (seconds == null || seconds < 0) return '00:00:00';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d} day${d !== 1 ? 's' : ''} ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString();
  } catch {
    return '—';
  }
}

export default function CustomerReportPage() {
  const [dashboard, setDashboard] = useState<CustomerDashboardData | null>(null);
  const [sessions, setSessions] = useState<Array<{
    session_id: string;
    username: string;
    connection_date: string;
    disconnection_date: string | null;
    upload: number;
    download: number;
    session_time: number;
  }>>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [liveTraffic, setLiveTraffic] = useState<{
    download_bps: number;
    upload_bps: number;
    status?: 'online' | 'offline';
    timestamp?: string;
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
    customerPortalService.getDashboard()
      .then((res) => setDashboard(res.data))
      .catch(() => setDashboard(null));
  }, []);

  useEffect(() => {
    setSessionLoading(true);
    customerPortalService
      .getSessionLog(page, 15)
      .then((res) => {
        setSessions(res.data || []);
        setTotalPages(res.meta?.totalPages ?? 1);
      })
      .catch(() => setSessions([]))
      .finally(() => setSessionLoading(false));
  }, [page]);

  const username = dashboard?.network?.username ?? '—';
  const download = dashboard?.network?.downloadBytes ?? 0;
  const upload = dashboard?.network?.uploadBytes ?? 0;

  const usageChartData = [
    { name: 'Download', value: Math.max(0.01, Number(download) / 1e9), fill: '#3b82f6' },
    { name: 'Upload', value: Math.max(0.01, Number(upload) / 1e9), fill: '#10b981' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 lg:p-6 space-y-6"
    >
      <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        Report
      </h1>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 p-6 transition-all duration-300"
      >
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          Realtime Bandwidth Monitor
        </h2>
        <div className="flex flex-wrap gap-6 items-center">
          <span className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-300 text-base font-semibold">
            <Download className="w-5 h-5" />
            ↓ {formatSpeed(liveTraffic?.download_bps ?? 0)}
          </span>
          <span className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300 text-base font-semibold">
            <Upload className="w-5 h-5" />
            ↑ {formatSpeed(liveTraffic?.upload_bps ?? 0)}
          </span>
          <span
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium ${
              liveTraffic?.status === 'online'
                ? 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${liveTraffic?.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {liveTraffic?.status === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Updates every 2.5 seconds</p>
      </motion.section>

      <motion.section
        whileHover={{ y: -2 }}
        className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 p-6 transition-all duration-300"
      >
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Real Time Download-Upload Graph
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
          Username: <span className="font-medium text-slate-800 dark:text-slate-200">{username}</span>
        </p>
        <div className="h-48 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usageChartData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `${v.toFixed(2)} GB`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={70} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                }}
                formatter={(value: number | undefined) => [`${value != null ? value.toFixed(2) : '0'} GB`, 'Usage']}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={600}>
                {usageChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-4 mt-4">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium">
            <Download className="w-4 h-4" />
            Download: {formatTraffic(download)}
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
            <Upload className="w-4 h-4" />
            Upload: {formatTraffic(upload)}
          </span>
        </div>
      </motion.section>

      <motion.section
        whileHover={{ y: -2 }}
        className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 overflow-hidden transition-all duration-300"
      >
        <h2 className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-700/60 font-semibold text-slate-900 dark:text-slate-100">
          Session Log
        </h2>
        {sessionLoading ? (
          <div className="p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 text-left text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">Connection Date</th>
                  <th className="px-4 py-3 font-semibold">Disconnection Date</th>
                  <th className="px-4 py-3 font-semibold">Upload</th>
                  <th className="px-4 py-3 font-semibold">Download</th>
                  <th className="px-4 py-3 font-semibold">Session time</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRowSkeleton key={i} cols={5} />
                ))}
              </tbody>
            </table>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No session log yet. Data is recorded when you connect via PPPoE.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 text-left text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 font-semibold">Connection Date</th>
                    <th className="px-4 py-3 font-semibold">Disconnection Date</th>
                    <th className="px-4 py-3 font-semibold">Upload</th>
                    <th className="px-4 py-3 font-semibold">Download</th>
                    <th className="px-4 py-3 font-semibold">Session time</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <motion.tr
                      key={s.session_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors duration-200"
                    >
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {formatDate(s.connection_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {formatDate(s.disconnection_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {formatTraffic(s.upload)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {formatTraffic(s.download)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                        {formatSessionTime(s.session_time)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-white dark:hover:bg-slate-800 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </motion.button>
              <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                Page {page} of {totalPages}
              </span>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-white dark:hover:bg-slate-800 transition-all"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          </>
        )}
      </motion.section>
    </motion.div>
  );
}
