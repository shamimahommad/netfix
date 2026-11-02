import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, ChevronLeft, ChevronRight, ChevronsUpDown, RefreshCw } from 'lucide-react';
import { customersService, AreaWiseReportRow } from '@/services/customers.service';
import { useToastContext } from '@/contexts/ToastContext';
import { PageHeader, MetricCard } from '@/components/common';

const ROW_OPTIONS = [10, 25, 50] as const;

type SortKey = keyof AreaWiseReportRow;

const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right'; colorClass: string }[] = [
  { key: 'areaName', label: 'Area', align: 'left', colorClass: 'text-slate-800 dark:text-slate-100 font-medium' },
  { key: 'total', label: 'Total', align: 'right', colorClass: 'text-blue-600 dark:text-blue-400 font-bold' },
  { key: 'active', label: 'Active', align: 'right', colorClass: 'text-emerald-600 dark:text-emerald-400 font-semibold' },
  { key: 'expired', label: 'Expired', align: 'right', colorClass: 'text-amber-600 dark:text-amber-400' },
  { key: 'left', label: 'Left', align: 'right', colorClass: 'text-rose-600 dark:text-rose-400' },
  { key: 'pending', label: 'Pending', align: 'right', colorClass: 'text-sky-600 dark:text-sky-400' },
  { key: 'pppoe', label: 'PPPoE', align: 'right', colorClass: 'text-indigo-600 dark:text-indigo-400' },
  { key: 'hotspot', label: 'Hotspot', align: 'right', colorClass: 'text-orange-600 dark:text-orange-400' },
  { key: 'free', label: 'Free', align: 'right', colorClass: 'text-teal-600 dark:text-teal-400' },
  { key: 'vip', label: 'VIP', align: 'right', colorClass: 'text-purple-600 dark:text-purple-400' },
];

/** Build customer list URL for drill-down from Area Wise report. */
function getCustomerListUrl(areaName: string, columnKey: SortKey): string | null {
  const params = new URLSearchParams();
  params.set('area', areaName);
  if (columnKey === 'active') params.set('status', 'active');
  else if (columnKey === 'left') params.set('status', 'terminated');
  else if (columnKey === 'pending') params.set('status', 'pending_activation');
  const q = params.toString();
  return `/dashboard/customers/all${q ? `?${q}` : ''}`;
}

export default function AreaWiseCustomersPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [rows, setRows] = useState<AreaWiseReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRows([]);
    customersService
      .getAreaWiseReport()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err: any) => {
        if (!cancelled) {
          const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to load report';
          setError(msg);
          toast.error(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [toast]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => r.areaName.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'string' && typeof vb === 'string') {
        const c = va.localeCompare(vb);
        return sortAsc ? c : -c;
      }
      const na = Number(va) || 0;
      const nb = Number(vb) || 0;
      return sortAsc ? na - nb : nb - na;
    });
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const totalCustomers = rows.reduce((sum, r) => sum + r.total, 0);
  const totalActive = rows.reduce((sum, r) => sum + r.active, 0);
  const totalAreas = rows.length;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
    setPage(1);
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Area Wise Customers"
        subtitle="Customer distribution and account statuses grouped by service area"
        badge={`${totalAreas} Areas`}
        onBack={() => navigate('/dashboard/report')}
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Customers"
          value={totalCustomers.toLocaleString()}
          subtext="Across all service areas"
          variant="blue"
        />
        <MetricCard
          title="Active Subscribers"
          value={totalActive.toLocaleString()}
          subtext="Currently connected & active"
          variant="emerald"
        />
        <MetricCard
          title="Total Areas"
          value={totalAreas}
          subtext="Configured coverage zones"
          variant="purple"
        />
      </div>

      {/* Main Card: Controls & Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Show:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              {ROW_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} rows</option>
              ))}
            </select>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search area name..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                      <span>{col.label}</span>
                      <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="inline-flex items-center gap-2 text-sm">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      Loading area report...
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                    No service areas found
                  </td>
                </tr>
              ) : (
                paginated.map((row) => (
                  <tr
                    key={row.areaName}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {COLUMNS.map((col) => {
                      const val = row[col.key];
                      const drillUrl = getCustomerListUrl(row.areaName, col.key);
                      const isClickable = drillUrl && typeof val === 'number' && val > 0;

                      return (
                        <td
                          key={col.key}
                          className={`py-3 px-4 text-sm ${col.colorClass} ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                        >
                          {isClickable ? (
                            <button
                              type="button"
                              onClick={() => navigate(drillUrl)}
                              className="font-semibold underline decoration-dotted hover:opacity-80 transition-opacity"
                            >
                              {val}
                            </button>
                          ) : (
                            val
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!isLoading && sorted.length > 0 && (
          <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-3">
            <p>
              Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(currentPage * pageSize, sorted.length)}</span> of{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{sorted.length}</span> areas
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
