import { useState } from 'react';
import {
  Calendar,
  Clock,
  Download,
  Globe,
  Activity,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
} from 'lucide-react';
import { CustomerSessionSummary, CustomerDailyUsageItem } from '@/services/customer-portal.service';

interface SessionDateRangeFilterProps {
  preset: string;
  onSelectPreset: (preset: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onApplyCustom: () => void;
  summary: CustomerSessionSummary | any;
  loading?: boolean;
}

const PRESET_OPTIONS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom Date Range' },
];

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '0 B';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDateDisplay(dStr: string | null | undefined): string {
  if (!dStr) return '—';
  try {
    return new Date(dStr).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dStr;
  }
}

export function SessionDateRangeFilter({
  preset,
  onSelectPreset,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApplyCustom,
  summary,
  loading = false,
}: SessionDateRangeFilterProps) {
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(false);

  const dailyList: CustomerDailyUsageItem[] = summary?.dailyBreakdown || [];

  return (
    <div className="space-y-4 mb-5">
      {/* ────────────────── FILTER BAR WITH DROPDOWN MENU ────────────────── */}
      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Filter by Date:
            </span>
            {/* Dropdown Menu */}
            <div className="relative">
              <select
                value={preset}
                onChange={(e) => onSelectPreset(e.target.value)}
                className="px-3.5 py-1.5 pr-8 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer appearance-none transition-colors"
              >
                {PRESET_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Quick Preset Pills for Fast Desktop Switching */}
          <div className="hidden lg:flex items-center gap-1">
            {PRESET_OPTIONS.map((p) => {
              const active = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPreset(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Date Pickers (visible if custom selected) */}
        {preset === 'custom' && (
          <div className="mt-3.5 pt-3.5 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={onApplyCustom}
              disabled={loading || !startDate || !endDate}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Apply Filter</span>
            </button>
          </div>
        )}
      </div>

      {/* ────────────────── FILTERED METRICS SUMMARY CARDS ────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 animate-in fade-in duration-150">
          {/* 1. Range Data Consumed */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
                <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Data Used
              </span>
            </div>
            <p className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {summary.rangeTotal || formatBytes(summary.totalUsageBytes ?? (summary.totalUsageGb ? summary.totalUsageGb * 1e9 : 0))}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1 truncate">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                ↓ {summary.rangeDownload || formatBytes(summary.totalDownloadBytes)}
              </span>
              <span className="mx-1">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                ↑ {summary.rangeUpload || formatBytes(summary.totalUploadBytes)}
              </span>
            </p>
          </div>

          {/* 2. Range Online Time */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Time Online
              </span>
            </div>
            <p className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 truncate">
              {summary.rangeUptime || summary.totalUptimeFormatted || '0m'}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1 truncate">
              Avg session: {summary.averageSessionFormatted || '—'}
            </p>
          </div>

          {/* 3. Assigned IPs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
                <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Assigned IPs
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                {summary.assignedIps?.length ?? 0}
              </span>
            </div>
            <div className="min-h-[28px] flex flex-wrap gap-1 mt-1">
              {summary.assignedIps && summary.assignedIps.length > 0 ? (
                summary.assignedIps.slice(0, 3).map((ip: string) => (
                  <span
                    key={ip}
                    className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 truncate max-w-full"
                    title={ip}
                  >
                    {ip}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 font-mono">—</span>
              )}
              {(summary.assignedIps?.length || 0) > 3 && (
                <span className="text-[10px] text-slate-400 font-mono self-center">
                  +{summary.assignedIps.length - 3} more
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">Unique IPs assigned</p>
          </div>

          {/* 4. Sessions & Disconnects */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
                <Activity className="w-3.5 h-3.5 text-rose-500" />
                Sessions / Disconnects
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg sm:text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {summary.totalSessions ?? 0}
              </span>
              <span className="text-xs text-slate-400">sessions</span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-sm sm:text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                {summary.totalDisconnects ?? 0}
              </span>
              <span className="text-[11px] text-rose-500">disc</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">
              {summary.currentOnline ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Currently Connected
                </span>
              ) : (
                'Currently Disconnected'
              )}
            </p>
          </div>
        </div>
      )}

      {/* ────────────────── DAILY USAGE BREAKDOWN ACCORDION ────────────────── */}
      {dailyList.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <button
            type="button"
            onClick={() => setShowDailyBreakdown((prev) => !prev)}
            className="w-full px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 flex items-center justify-between transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Daily Usage Breakdown
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-mono font-semibold">
                {dailyList.length} days
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{showDailyBreakdown ? 'Hide details' : 'View day-by-day table'}</span>
              {showDailyBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showDailyBreakdown && (
            <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Total Data</th>
                    <th className="py-2.5 px-3">Download / Upload</th>
                    <th className="py-2.5 px-3">Time Online</th>
                    <th className="py-2.5 px-3">Assigned IP(s)</th>
                    <th className="py-2.5 px-3 text-right">Disconnects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {dailyList.map((d) => (
                    <tr key={d.date} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {formatDateDisplay(d.date)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400">
                        {formatBytes(d.totalBytes)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        <span className="text-blue-600 dark:text-blue-400">↓ {formatBytes(d.downloadBytes)}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-emerald-600 dark:text-emerald-400">↑ {formatBytes(d.uploadBytes)}</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                        {d.uptimeFormatted || '0m'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {d.assignedIps && d.assignedIps.length > 0 ? (
                            d.assignedIps.map((ip) => (
                              <span
                                key={ip}
                                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              >
                                {ip}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.disconnectCount > 0
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                          }`}
                        >
                          {d.disconnectCount}
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
    </div>
  );
}
