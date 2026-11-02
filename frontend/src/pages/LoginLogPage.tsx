import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resellerService, Reseller } from '@/services/reseller.service';
import { useToastContext } from '@/contexts/ToastContext';

const POLL_INTERVAL_MS = 15_000;

function BackIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

export interface LoginLogEntry {
  sl: number;
  logTime: string;
  ip: string;
  browser: string;
  os: string;
  method: string;
}

function formatLogTime(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    const year = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${day}-${mon}-${year} ${h}:${m}:${s}`;
  } catch {
    return iso;
  }
}

export default function LoginLogPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();
  const [user, setUser] = useState<Reseller | null>(null);
  const [log, setLog] = useState<LoginLogEntry[]>([]);
  const [loading, setLoading] = useState(!!userId);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [search, setSearch] = useState('');

  const fetchLog = useCallback(() => {
    if (!userId) return;
    resellerService
      .getLoginLog(userId)
      .then((res) => {
        const items = (res.items ?? []).map((r, i) => ({
          sl: i + 1,
          logTime: formatLogTime(r.logTime),
          ip: r.ip,
          browser: r.browser,
          os: r.os,
          method: r.method,
        }));
        setLog(items);
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([resellerService.getOne(userId), resellerService.getLoginLog(userId)])
      .then(([u, res]) => {
        if (cancelled) return;
        setUser(u);
        const items = (res.items ?? []).map((r, i) => ({
          sl: i + 1,
          logTime: formatLogTime(r.logTime),
          ip: r.ip,
          browser: r.browser,
          os: r.os,
          method: r.method,
        }));
        setLog(items);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err?.message || 'Failed to load');
          setUser(null);
          setLog([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, toast]);

  useEffect(() => {
    if (!userId) return;
    const t = setInterval(fetchLog, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [userId, fetchLog]);

  const filteredLog = useMemo(() => {
    if (!search.trim()) return log;
    const q = search.trim().toLowerCase();
    return log.filter(
      (r) =>
        r.ip.toLowerCase().includes(q) ||
        r.browser.toLowerCase().includes(q) ||
        r.os.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q) ||
        r.logTime.toLowerCase().includes(q),
    );
  }, [log, search]);

  const paginatedLog = useMemo(() => {
    return filteredLog.slice(0, entriesPerPage);
  }, [filteredLog, entriesPerPage]);

  if (userId && loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const userLabel = user?.email && !String(user.email).endsWith('@reseller.local')
    ? user.email
    : (user?.username || '—');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <button
          type="button"
          onClick={() => navigate('/dashboard/reseller')}
          className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-xl mb-4 transition-colors border border-slate-200 dark:border-slate-700"
        >
          <BackIcon /> Back to Reseller
        </button>

        {/* Main card — same sky/teal header as Plan Permission */}
        <div className="bg-white dark:bg-slate-800/95 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-50 to-teal-50/80 dark:from-sky-950/50 dark:to-teal-950/40 px-5 py-4 border-b border-sky-100/80 dark:border-slate-700/80">
            <h1 className="text-lg font-bold text-slate-800 dark:text-white">Login Log</h1>
          </div>

          <div className="p-5 space-y-4">
            {/* Selected user row (when opened from reseller user panel) — same compact row as Plan Permission */}
            {userId && (
              <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60">
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Selected user</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white">{userLabel}</div>
                </div>
              </div>
            )}

            {/* Control bar: Show N entries (left), Search (right) — same tight spacing */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">Show</span>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={entriesPerPage}
                  onChange={(e) => setEntriesPerPage(Math.max(5, Math.min(100, Number(e.target.value) || 10)))}
                  className="w-14 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-slate-900 dark:text-white text-center text-sm focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">entries</span>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="login-log-search" className="text-sm text-slate-600 dark:text-slate-400">Search:</label>
                <input
                  id="login-log-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by IP, browser, OS, method..."
                  className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 min-w-[180px]"
                />
              </div>
            </div>

            {/* Table — same styling as Plan Permission */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                      <th className="p-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 w-12">SL</th>
                      <th className="p-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Log Time</th>
                      <th className="p-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">IP</th>
                      <th className="p-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Browser</th>
                      <th className="p-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">OS</th>
                      <th className="p-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLog.map((row, idx) => (
                      <tr
                        key={`${row.logTime}-${row.ip}-${idx}`}
                        className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/20"
                      >
                        <td className="p-2.5 text-slate-700 dark:text-slate-300">{idx + 1}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{row.logTime}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{row.ip}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{row.browser}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{row.os}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{row.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginatedLog.length === 0 && (
                <div className="py-10 text-center text-slate-500 dark:text-slate-400 text-sm">No login records found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
