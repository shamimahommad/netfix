import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Users } from 'lucide-react';
import { resellerService } from '@/services/reseller.service';
import { useToastContext } from '@/contexts/ToastContext';
import { PageHeader, MetricCard, StatusBadge } from '@/components/common';

const ROW_OPTIONS = [10, 25, 50] as const;

type PackageRow = {
  id: string;
  server: string;
  protocol: string;
  name: string;
  mikrotik_profile: string;
  price: number;
  my_price: number;
  my_profit: number;
  count: number;
  validity: string;
  volume: string;
  status: string;
};

const COLUMNS: { key: keyof PackageRow; label: string; align?: 'left' | 'right'; colorClass?: string }[] = [
  { key: 'server', label: 'Server', align: 'left' },
  { key: 'protocol', label: 'Protocol', align: 'left' },
  { key: 'name', label: 'Name', align: 'left' },
  { key: 'mikrotik_profile', label: 'MikroTik Profile', align: 'left' },
  { key: 'price', label: 'Retail Price', align: 'right', colorClass: 'text-slate-900 dark:text-slate-100 font-semibold' },
  { key: 'my_price', label: 'My Cost', align: 'right', colorClass: 'text-blue-600 dark:text-blue-400 font-semibold' },
  { key: 'my_profit', label: 'Profit / User', align: 'right', colorClass: 'text-emerald-600 dark:text-emerald-400 font-semibold' },
  { key: 'count', label: 'Subscribers', align: 'right', colorClass: 'text-slate-700 dark:text-slate-300' },
  { key: 'validity', label: 'Validity', align: 'left' },
  { key: 'volume', label: 'Volume', align: 'left' },
  { key: 'status', label: 'Status', align: 'left' },
];

export default function MyPackagesPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [data, setData] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25, totalPages: 1 });

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await resellerService.getMyPackages({
        page,
        limit,
        search: search.trim() || undefined,
      });
      setData(res.data);
      setMeta({
        total: res.meta.total,
        page: res.meta.page,
        limit: res.meta.limit,
        totalPages: res.meta.totalPages,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to load packages';
      setError(msg);
      toast.error(msg);
      setData([]);
      setMeta({ total: 0, page: 1, limit, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, toast]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setPage(1);
  };

  const totalPackages = meta.total;
  const totalSubscribers = data.reduce((acc, r) => acc + (Number(r.count) || 0), 0);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="My Packages"
        subtitle="Bandwidth plans authorized for your reseller account with custom buy/sell pricing"
        badge={`${totalPackages} Plans`}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          title="Assigned Plans"
          value={totalPackages.toLocaleString()}
          subtext="Available packages in your portfolio"
          variant="blue"
          icon={<Package className="w-5 h-5" />}
        />
        <MetricCard
          title="Subscribers (This Page)"
          value={totalSubscribers.toLocaleString()}
          subtext="Total active customers across listed plans"
          variant="emerald"
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Show</span>
            <select
              value={limit}
              onChange={handleLimitChange}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {ROW_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} rows</option>
              ))}
            </select>
          </div>
          <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search packages..."
                className="w-48 sm:w-60 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {error && (
            <div className="m-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-medium">
              {error}
            </div>
          )}
          {loading ? (
            <div className="p-16 text-center">
              <div className="inline-flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading packages…</p>
              </div>
            </div>
          ) : (
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">SL</th>
                  {COLUMNS.map(({ key, label, align = 'left' }) => (
                    <th
                      key={key}
                      className={`px-4 py-3 whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {data.length === 0 && !error ? (
                  <tr>
                    <td colSpan={1 + COLUMNS.length} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                      No packages found.
                    </td>
                  </tr>
                ) : (
                  data.map((row, i) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {(meta.page - 1) * meta.limit + i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                        {row.server || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 capitalize">
                        {row.protocol}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {row.mikrotik_profile}
                      </td>
                      <td className={`px-4 py-3 text-right ${COLUMNS.find(c => c.key === 'price')?.colorClass ?? ''}`}>
                        ৳{Number(row.price || 0).toLocaleString()}
                      </td>
                      <td className={`px-4 py-3 text-right ${COLUMNS.find(c => c.key === 'my_price')?.colorClass ?? ''}`}>
                        ৳{Number(row.my_price || 0).toLocaleString()}
                      </td>
                      <td className={`px-4 py-3 text-right ${COLUMNS.find(c => c.key === 'my_profit')?.colorClass ?? ''}`}>
                        ৳{Number(row.my_profit || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                        {row.count}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                        {row.validity}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                        {row.volume}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && data.length > 0 && (
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{(meta.page - 1) * meta.limit + 1}</span>
              {' – '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(meta.page * meta.limit, meta.total)}</span>
              {' of '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{meta.total.toLocaleString()}</span>
              {' entries'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span className="sr-only">Previous</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="min-w-[90px] text-center text-xs font-medium text-slate-700 dark:text-slate-300">
                Page {meta.page} of {meta.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={meta.page >= meta.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span className="sr-only">Next</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
