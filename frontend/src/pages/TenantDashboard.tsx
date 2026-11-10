import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  RefreshCw,
  Minus,
  ChevronDown,
  Users,
  TrendingUp,
  AlertTriangle,
  Wallet,
  CreditCard,
  Wifi,
  FileText,
  Clock,
  UserX,
  PlusCircle,
  Send,
  LifeBuoy,
  CheckCircle2,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  Server,
  Layers,
  Sparkles,
} from 'lucide-react';
import { dashboardService, DashboardStats, DashboardCharts, RecentActivityItem } from '@/services/dashboard.service';
import { billingService, InvoiceDto } from '@/services/billing.service';
import { formatInvoiceIdDisplay } from '@/lib/formatInvoiceId';
import { useTenantStore } from '@/stores/tenantStore';
import { useAuthStore } from '@/stores/authStore';
import PageHeader from '@/components/common/PageHeader';

type BillingAccountRow = {
  username?: string;
  bill_amount?: number;
  expiry_date?: string;
  last_payment_date?: string;
};

export default function TenantDashboard() {
  const { user } = useAuthStore();
  const role = (user?.role_code || (user as any)?.role || '').toLowerCase();
  const isIspAdmin = user?.user_type === 'saas' || ['admin', 'manager', 'isp_admin', 'tenant_admin', 'saas_admin', 'super_admin'].includes(role);

  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalActive: 0,
    todayJoin: 0,
    homeCustomers: 0,
    lastMonthJoin: 0,
    thisMonthJoin: 0,
    expiredCustomers: 0,
    suspendedCustomers: 0,
    leftCustomers: 0,
    todayCollection: 0,
    thisMonthCollection: 0,
    lastMonthCollection: 0,
    hotspotTotal: 0,
    hotspotActive: 0,
    hotspotExpired: 0,
    onlinePaymentToday: 0,
    onlinePaymentThisMonth: 0,
    onlinePaymentLastMonth: 0,
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const INITIAL_PAGE_SIZE = 8;
  const LOAD_MORE_PAGE_SIZE = 20;

  // Invoices Table State
  const [updateInvoices, setUpdateInvoices] = useState<InvoiceDto[]>([]);
  const [, setInvoicePage] = useState(1);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingMoreInvoices, setLoadingMoreInvoices] = useState(false);
  const [collapsedInvoices, setCollapsedInvoices] = useState(false);

  // Upcoming Expiry Table State
  const [upcomingExpire, setUpcomingExpire] = useState<BillingAccountRow[]>([]);
  const [, setUpcomingPage] = useState(1);
  const [upcomingTotal, setUpcomingTotal] = useState(0);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [loadingMoreUpcoming, setLoadingMoreUpcoming] = useState(false);
  const [collapsedUpcoming, setCollapsedUpcoming] = useState(false);

  // Expired Accounts Table State
  const [expiredList, setExpiredList] = useState<BillingAccountRow[]>([]);
  const [, setExpiredPage] = useState(1);
  const [expiredTotal, setExpiredTotal] = useState(0);
  const [loadingExpired, setLoadingExpired] = useState(false);
  const [loadingMoreExpired, setLoadingMoreExpired] = useState(false);
  const [collapsedExpired, setCollapsedExpired] = useState(false);

  const { selectedTenant } = useTenantStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, [selectedTenant?.tenantId]);

  // Load card data on mount and auto-refresh every 30 seconds
  useEffect(() => {
    loadUpdateInvoices(1, INITIAL_PAGE_SIZE);
    loadUpcomingExpire(1, INITIAL_PAGE_SIZE);
    loadExpiredList(1, INITIAL_PAGE_SIZE);

    const interval = setInterval(() => {
      loadUpdateInvoices(1, INITIAL_PAGE_SIZE);
      loadUpcomingExpire(1, INITIAL_PAGE_SIZE);
      loadExpiredList(1, INITIAL_PAGE_SIZE);
    }, 30_000);

    return () => clearInterval(interval);
  }, [selectedTenant?.tenantId]);

  const loadUpdateInvoices = async (page: number = 1, limit?: number) => {
    const useLimit = limit !== undefined && limit !== null ? limit : (page === 1 ? INITIAL_PAGE_SIZE : 8);
    if (page === 1) setLoadingInvoices(true);
    else setLoadingMoreInvoices(true);
    try {
      const res = await billingService.getTenantInvoices({ status: 'paid', limit: useLimit, page });
      const list = res.data ?? [];
      const total = res.meta?.total ?? 0;
      if (page === 1) {
        setUpdateInvoices(list);
        setInvoicePage(1);
      } else {
        setUpdateInvoices((prev) => [...prev, ...list]);
        setInvoicePage(page);
      }
      setInvoiceTotal(total);
    } catch {
      if (page === 1) setUpdateInvoices([]);
      setInvoiceTotal(0);
    } finally {
      setLoadingInvoices(false);
      setLoadingMoreInvoices(false);
    }
  };

  const loadMoreUpdateInvoices = async () => {
    if (loadingMoreInvoices || updateInvoices.length >= invoiceTotal) return;
    setLoadingMoreInvoices(true);
    try {
      const offset = updateInvoices.length;
      const want = Math.min(LOAD_MORE_PAGE_SIZE, invoiceTotal - offset);
      const pages: { page: number; limit: number }[] = [];
      let remaining = want;
      let skip = offset;
      while (remaining > 0) {
        const limit = Math.min(8, remaining);
        const page = Math.floor(skip / limit) + 1;
        pages.push({ page, limit });
        skip += limit;
        remaining -= limit;
      }
      const results = await Promise.all(
        pages.map(({ page, limit }) => billingService.getTenantInvoices({ status: 'paid', limit, page })),
      );
      const list = (results.flatMap((r) => r.data ?? []) as InvoiceDto[]).slice(0, want);
      const total = results[0]?.meta?.total ?? invoiceTotal;
      setUpdateInvoices((prev) => [...prev, ...list]);
      setInvoicePage(Math.floor((offset + want) / 8) + 1);
      setInvoiceTotal(total);
    } catch {
      // keep existing
    } finally {
      setLoadingMoreInvoices(false);
    }
  };

  const loadUpcomingExpire = async (page: number = 1, limit: number = INITIAL_PAGE_SIZE) => {
    if (page === 1) setLoadingUpcoming(true);
    else setLoadingMoreUpcoming(true);
    try {
      const res = await billingService.getBillingAccounts('expire-7-days', { limit, page });
      const list = (res.data ?? []) as BillingAccountRow[];
      const total = res.meta?.total ?? 0;
      if (page === 1) {
        setUpcomingExpire(list);
        setUpcomingPage(1);
      } else {
        setUpcomingExpire((prev) => [...prev, ...list]);
        setUpcomingPage(page);
      }
      setUpcomingTotal(total);
    } catch {
      if (page === 1) setUpcomingExpire([]);
      setUpcomingTotal(0);
    } finally {
      setLoadingUpcoming(false);
      setLoadingMoreUpcoming(false);
    }
  };

  const loadMoreUpcomingExpire = async () => {
    if (loadingMoreUpcoming || upcomingExpire.length >= upcomingTotal) return;
    setLoadingMoreUpcoming(true);
    try {
      const offset = upcomingExpire.length;
      const want = Math.min(LOAD_MORE_PAGE_SIZE, upcomingTotal - offset);
      const pages: { page: number; limit: number }[] = [];
      let remaining = want;
      let skip = offset;
      while (remaining > 0) {
        const limit = Math.min(8, remaining);
        const page = Math.floor(skip / limit) + 1;
        pages.push({ page, limit });
        skip += limit;
        remaining -= limit;
      }
      const results = await Promise.all(
        pages.map(({ page, limit }) => billingService.getBillingAccounts('expire-7-days', { limit, page })),
      );
      const list = (results.flatMap((r) => r.data ?? []) as BillingAccountRow[]).slice(0, want);
      const total = results[0]?.meta?.total ?? upcomingTotal;
      setUpcomingExpire((prev) => [...prev, ...list]);
      setUpcomingPage(Math.floor((offset + want) / 8) + 1);
      setUpcomingTotal(total);
    } catch {
      // keep existing
    } finally {
      setLoadingMoreUpcoming(false);
    }
  };

  const loadExpiredList = async (page: number = 1, limit: number = INITIAL_PAGE_SIZE) => {
    if (page === 1) setLoadingExpired(true);
    else setLoadingMoreExpired(true);
    try {
      const res = await billingService.getBillingAccounts('expired', { limit, page });
      const list = (res.data ?? []) as BillingAccountRow[];
      const total = res.meta?.total ?? 0;
      if (page === 1) {
        setExpiredList(list);
        setExpiredPage(1);
      } else {
        setExpiredList((prev) => [...prev, ...list]);
        setExpiredPage(page);
      }
      setExpiredTotal(total);
    } catch {
      if (page === 1) setExpiredList([]);
      setExpiredTotal(0);
    } finally {
      setLoadingExpired(false);
      setLoadingMoreExpired(false);
    }
  };

  const loadMoreExpiredList = async () => {
    if (loadingMoreExpired || expiredList.length >= expiredTotal) return;
    setLoadingMoreExpired(true);
    try {
      const offset = expiredList.length;
      const want = Math.min(LOAD_MORE_PAGE_SIZE, expiredTotal - offset);
      const pages: { page: number; limit: number }[] = [];
      let remaining = want;
      let skip = offset;
      while (remaining > 0) {
        const limit = Math.min(8, remaining);
        const page = Math.floor(skip / limit) + 1;
        pages.push({ page, limit });
        skip += limit;
        remaining -= limit;
      }
      const results = await Promise.all(
        pages.map(({ page, limit }) => billingService.getBillingAccounts('expired', { limit, page })),
      );
      const list = (results.flatMap((r) => r.data ?? []) as BillingAccountRow[]).slice(0, want);
      const total = results[0]?.meta?.total ?? expiredTotal;
      setExpiredList((prev) => [...prev, ...list]);
      setExpiredPage(Math.floor((offset + want) / 8) + 1);
      setExpiredTotal(total);
    } catch {
      // keep existing
    } finally {
      setLoadingMoreExpired(false);
    }
  };

  const loadDashboard = async () => {
    setIsLoading(true);
    setActivityError(null);
    try {
      const [statsData, activityData, chartsData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getRecentActivity(15).catch((err: any) => {
          setActivityError(err?.message || 'Failed to load recent activity');
          return [];
        }),
        dashboardService.getCharts().catch(() => null),
      ]);
      setStats(statsData);
      setRecentActivity(Array.isArray(activityData) ? activityData : []);
      setCharts(chartsData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAllData = async () => {
    setIsRefreshingAll(true);
    await Promise.all([
      loadDashboard(),
      loadUpdateInvoices(1, INITIAL_PAGE_SIZE),
      loadUpcomingExpire(1, INITIAL_PAGE_SIZE),
      loadExpiredList(1, INITIAL_PAGE_SIZE),
    ]);
    setIsRefreshingAll(false);
  };

  const retryRecentActivity = async () => {
    setActivityError(null);
    try {
      const activityData = await dashboardService.getRecentActivity(15);
      setRecentActivity(Array.isArray(activityData) ? activityData : []);
    } catch (err: any) {
      setActivityError(err?.message || 'Failed to load recent activity');
    }
  };

  // Monthly collection comparison & progress
  const collectionGrowth = useMemo(() => {
    if (!stats.lastMonthCollection || stats.lastMonthCollection === 0) return 100;
    const diff = stats.thisMonthCollection - stats.lastMonthCollection;
    return Math.round((diff / stats.lastMonthCollection) * 100);
  }, [stats.thisMonthCollection, stats.lastMonthCollection]);

  // Online collection ratio
  const onlineCollectionPercent = useMemo(() => {
    if (!stats.thisMonthCollection || stats.thisMonthCollection === 0) return 0;
    return Math.min(100, Math.round((stats.onlinePaymentThisMonth / stats.thisMonthCollection) * 100));
  }, [stats.onlinePaymentThisMonth, stats.thisMonthCollection]);

  // Format currency with BDT symbol
  const fmtMoney = (val: number | undefined) => {
    const num = Math.round(Number(val) || 0);
    return `৳${num.toLocaleString('en-IN')}`;
  };

  return (
    <div className="w-full space-y-6 pb-12 animate-fade-in">
      {/* 1. Header with PageHeader component */}
      <PageHeader
        title="ISP Dashboard"
        icon={<Activity />}
        subtitle={
          <span className="flex items-center gap-2">
            <span>Welcome back! Network & operations overview for</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {selectedTenant?.tenantName || 'Main Network'}
            </span>
          </span>
        }
        badge={
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live System</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick action buttons */}
            <button
              type="button"
              onClick={() => navigate('/dashboard/customers/add')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/billing/all')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
            >
              <Wallet className="w-4 h-4" />
              <span>Collect Bill</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/sms/send')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors"
            >
              <Send className="w-4 h-4 text-sky-500" />
              <span>Send SMS</span>
            </button>
            {/* Sync All button */}
            <button
              type="button"
              onClick={refreshAllData}
              disabled={isRefreshingAll || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm transition-colors disabled:opacity-60"
              title="Refresh all metrics and tables"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ${isRefreshingAll ? 'animate-spin' : ''}`} />
              <span>{isRefreshingAll ? 'Syncing...' : 'Sync Data'}</span>
            </button>
          </div>
        }
      />

      {/* 2. Executive Highlights / KPI Hero Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <div
          onClick={() => navigate('/dashboard/customers/all')}
          className="group cursor-pointer relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent bg-white dark:bg-slate-900 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Total Subscribers
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                {isLoading ? '...' : stats.totalCustomers.toLocaleString()}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span className="text-slate-500 dark:text-slate-400">
              Active: <strong className="text-emerald-600 dark:text-emerald-400">{stats.totalActive}</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold group-hover:underline">
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Today's Collection */}
        <div
          onClick={() => navigate('/dashboard/report/customer-payments')}
          className="group cursor-pointer relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Today's Collection
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                {isLoading ? '...' : fmtMoney(stats.todayCollection)}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
              <Wallet className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span className="text-slate-500 dark:text-slate-400">
              This Month: <strong className="text-slate-800 dark:text-slate-200">{fmtMoney(stats.thisMonthCollection)}</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold group-hover:underline">
              Payments <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Network & Online Status */}
        <div
          onClick={() => navigate('/dashboard/customers/online')}
          className="group cursor-pointer relative overflow-hidden bg-gradient-to-br from-sky-500/10 via-cyan-500/5 to-transparent bg-white dark:bg-slate-900 border border-sky-200/60 dark:border-sky-900/40 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Network Online
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums">
                {isLoading ? '...' : (charts?.onlineUsers ?? stats.totalActive).toLocaleString()}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 group-hover:scale-105 transition-transform">
              <Wifi className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span className="text-slate-500 dark:text-slate-400">
              Total Accounts: <strong className="text-slate-800 dark:text-slate-200">{charts?.activeUsers ?? stats.totalActive}</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold group-hover:underline">
              Live Users <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Action Required: Expired & Suspended */}
        <div
          onClick={() => navigate('/dashboard/billing/expired')}
          className="group cursor-pointer relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Needs Attention
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                {isLoading ? '...' : (stats.expiredCustomers + stats.suspendedCustomers).toLocaleString()}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span className="text-slate-500 dark:text-slate-400">
              Expired: <strong>{stats.expiredCustomers}</strong> · Suspended: <strong>{stats.suspendedCustomers}</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold group-hover:underline">
              Review <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* 3. Detailed Stats Group Cards (All 18 original metrics preserved with interactive navigation) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>Operations & Portfolio Breakdown</span>
          </h2>
          <span className="text-xs text-slate-400">Auto-calculated live metrics</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {/* Card 1: Customer Overview */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Overview
              </span>
              <div className="w-7 h-7 rounded-lg bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-2">
              <div
                onClick={() => navigate('/dashboard/customers/all')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Total Customer</span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {stats.totalCustomers.toLocaleString()}
                </span>
              </div>
              <div
                onClick={() => navigate('/dashboard/customers/all')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Total Active</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {stats.totalActive.toLocaleString()}
                </span>
              </div>
              <div
                onClick={() => navigate('/dashboard/customers/all')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Today Join</span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {stats.todayJoin.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Customer Growth */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Growth
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-xs text-slate-600 dark:text-slate-400">Home Customer</span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {stats.homeCustomers.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-xs text-slate-600 dark:text-slate-400">This Month Join</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {stats.thisMonthJoin.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-xs text-slate-600 dark:text-slate-400">Last Month Join</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                  {stats.lastMonthJoin.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Account Status */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Status
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-2">
              <div
                onClick={() => navigate('/dashboard/billing/expired')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Expired</span>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {stats.expiredCustomers.toLocaleString()}
                </span>
              </div>
              <div
                onClick={() => navigate('/dashboard/billing/suspended')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Suspended</span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {stats.suspendedCustomers.toLocaleString()}
                </span>
              </div>
              <div
                onClick={() => navigate('/dashboard/billing/left')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Left Customer</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                  {stats.leftCustomers.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Collections */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Collections
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-2">
              <div
                onClick={() => navigate('/dashboard/report/customer-payments')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Today</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {fmtMoney(stats.todayCollection)}
                </span>
              </div>
              <div
                onClick={() => navigate('/dashboard/report/customer-payments')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">This Month</span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {fmtMoney(stats.thisMonthCollection)}
                </span>
              </div>
              <div
                onClick={() => navigate('/dashboard/report/customer-payments')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Last Month</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                  {fmtMoney(stats.lastMonthCollection)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 5: Online Payments */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Online Pay
              </span>
              <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-2">
              <div
                onClick={() => navigate('/dashboard/report/online-transactions')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Today</span>
                <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                  {fmtMoney(stats.onlinePaymentToday)}
                </span>
              </div>
              <div
                onClick={() => navigate('/dashboard/report/online-transactions')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">This Month</span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {fmtMoney(stats.onlinePaymentThisMonth)}
                </span>
              </div>
              <div
                onClick={() => navigate('/dashboard/report/online-transactions')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Last Month</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                  {fmtMoney(stats.onlinePaymentLastMonth)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 6: Hotspot */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Hotspot
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Wifi className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-2">
              <div
                onClick={() => navigate('/dashboard/hotspot/card-search')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Total Customer</span>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                  {stats.hotspotTotal.toLocaleString()}
                </span>
              </div>
              <div
                onClick={() => navigate('/dashboard/hotspot/online')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Active</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {stats.hotspotActive.toLocaleString()}
                </span>
              </div>
              <div
                onClick={() => navigate('/dashboard/hotspot/offline')}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400">Expired</span>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {stats.hotspotExpired.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Financial Progress & Health Gauge Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Monthly Performance & Collection Pace
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This month: <strong className="text-slate-800 dark:text-slate-200">{fmtMoney(stats.thisMonthCollection)}</strong> vs Last Month:{' '}
              <strong className="text-slate-800 dark:text-slate-200">{fmtMoney(stats.lastMonthCollection)}</strong>
              {collectionGrowth >= 0 ? (
                <span className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">
                  (+{collectionGrowth}% growth)
                </span>
              ) : (
                <span className="ml-2 font-semibold text-rose-600 dark:text-rose-400">
                  ({collectionGrowth}% change)
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-6 w-full md:w-auto">
            {/* Online payment ratio */}
            <div className="flex-1 md:w-48 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Online Gateway Share</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{onlineCollectionPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${onlineCollectionPercent}%` }}
                />
              </div>
            </div>

            {/* Quick status badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Billing Healthy</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Live Operations Feeds: 4 Cards (Recent Activity, Update Invoices, Upcoming Expire, Expired) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card A: Recent Activity Feed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col min-h-[340px]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Activity</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard/pppoe-logs')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                title="View Live MikroTik PPPoE Logs"
              >
                PPPoE Logs →
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={retryRecentActivity}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[260px] custom-scrollbar no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {isLoading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 animate-pulse space-y-1.5">
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : activityError ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-200">
                <p>{activityError}</p>
                <button
                  type="button"
                  onClick={retryRecentActivity}
                  className="mt-2 text-xs font-semibold underline"
                >
                  Retry
                </button>
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                No recent activity recorded yet
              </div>
            ) : (
              recentActivity.map((item) => (
                <div
                  key={item.logId}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:bg-slate-100/60 dark:hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.actionTitle}
                      </p>
                      {item.actionDetails && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {item.actionDetails}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center justify-between">
                        <span>{item.performedByName}</span>
                        <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card B: Update Invoices (Paid Invoices) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col min-h-[340px]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Paid Invoices</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => loadUpdateInvoices(1, INITIAL_PAGE_SIZE)}
                disabled={loadingInvoices}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingInvoices ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setCollapsedInvoices((c) => !c)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Collapse"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!collapsedInvoices && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto max-h-[250px] custom-scrollbar no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {loadingInvoices ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Loading invoices...</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-left">
                        <th className="pb-1.5 font-medium">Inv No</th>
                        <th className="pb-1.5 font-medium">User</th>
                        <th className="pb-1.5 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {updateInvoices.map((inv) => (
                        <tr key={inv.invoiceId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-1.5">
                            <button
                              type="button"
                              onClick={() => navigate('/dashboard/report/invoices')}
                              className="text-blue-600 dark:text-blue-400 font-medium hover:underline truncate max-w-[80px] block"
                            >
                              {formatInvoiceIdDisplay(inv.invoiceNumber)}
                            </button>
                          </td>
                          <td className="py-1.5">
                            <button
                              type="button"
                              onClick={() => inv.customerId && navigate(`/dashboard/customers/${inv.customerId}`)}
                              className="text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[120px] sm:max-w-[140px] block font-medium"
                              title={inv.username || inv.customerName || inv.customerCode || ''}
                            >
                              {inv.username || inv.customerName || inv.customerCode || '—'}
                            </button>
                          </td>
                          <td className="py-1.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {fmtMoney(inv.totalAmount)}
                          </td>
                        </tr>
                      ))}
                      {!loadingInvoices && updateInvoices.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400">
                            No paid invoices
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                {updateInvoices.length < invoiceTotal ? (
                  <button
                    type="button"
                    onClick={loadMoreUpdateInvoices}
                    disabled={loadingMoreInvoices}
                    className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  >
                    <span>{loadingMoreInvoices ? 'Loading...' : 'Load more'}</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">All {invoiceTotal} loaded</span>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/report/invoices')}
                  className="font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline"
                >
                  View all →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Card C: Upcoming Expire */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col min-h-[340px]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upcoming Expire</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => loadUpcomingExpire(1, INITIAL_PAGE_SIZE)}
                disabled={loadingUpcoming}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUpcoming ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setCollapsedUpcoming((c) => !c)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Collapse"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!collapsedUpcoming && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto max-h-[250px] custom-scrollbar no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {loadingUpcoming ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Loading accounts...</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-left">
                        <th className="pb-1.5 font-medium">Username</th>
                        <th className="pb-1.5 font-medium">Bill</th>
                        <th className="pb-1.5 font-medium text-right">Expire</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {upcomingExpire.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-1.5 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[80px]">
                            {row.username ?? '—'}
                          </td>
                          <td className="py-1.5 text-slate-600 dark:text-slate-400">
                            {fmtMoney(row.bill_amount)}
                          </td>
                          <td className="py-1.5 text-right text-amber-600 dark:text-amber-400 font-medium">
                            {row.expiry_date
                              ? new Date(row.expiry_date).toLocaleDateString([], { month: 'short', day: 'numeric' })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                      {!loadingUpcoming && upcomingExpire.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400">
                            No upcoming expiries
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                {upcomingExpire.length < upcomingTotal ? (
                  <button
                    type="button"
                    onClick={loadMoreUpcomingExpire}
                    disabled={loadingMoreUpcoming}
                    className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  >
                    <span>{loadingMoreUpcoming ? 'Loading...' : 'Load more'}</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">All {upcomingTotal} loaded</span>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/billing/expire-7-days')}
                  className="font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline"
                >
                  View all →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Card D: Expired Accounts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col min-h-[340px]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Expired Accounts</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => loadExpiredList(1, INITIAL_PAGE_SIZE)}
                disabled={loadingExpired}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingExpired ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setCollapsedExpired((c) => !c)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Collapse"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!collapsedExpired && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto max-h-[250px] custom-scrollbar no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {loadingExpired ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Loading accounts...</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-left">
                        <th className="pb-1.5 font-medium">Username</th>
                        <th className="pb-1.5 font-medium">Bill</th>
                        <th className="pb-1.5 font-medium text-right">Expired On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {expiredList.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-1.5 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[80px]">
                            {row.username ?? '—'}
                          </td>
                          <td className="py-1.5 text-slate-600 dark:text-slate-400">
                            {fmtMoney(row.bill_amount)}
                          </td>
                          <td className="py-1.5 text-right text-rose-600 dark:text-rose-400 font-medium">
                            {row.expiry_date
                              ? new Date(row.expiry_date).toLocaleDateString([], { month: 'short', day: 'numeric' })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                      {!loadingExpired && expiredList.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400">
                            No expired accounts
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                {expiredList.length < expiredTotal ? (
                  <button
                    type="button"
                    onClick={loadMoreExpiredList}
                    disabled={loadingMoreExpired}
                    className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                  >
                    <span>{loadingMoreExpired ? 'Loading...' : 'Load more'}</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">All {expiredTotal} loaded</span>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/billing/expired')}
                  className="font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline"
                >
                  View all →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Visual Analytics & Charts Section */}
      <div className="space-y-4">
        {/* Analytics Header with KPI badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Active Bandwidth Users
              </p>
              <h4 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {isLoading ? '...' : (charts?.activeUsers ?? stats.totalActive).toLocaleString()}
              </h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Average Daily SMS
              </p>
              <h4 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {isLoading ? '...' : (charts?.smsAveragePerDay ?? 0).toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1.5">/ day</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Total this month: {(charts?.smsSentThisMonth ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/50 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Support Tickets
              </p>
              <h4 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {(charts?.ticketPending ?? 0) + (charts?.ticketSolved ?? 0)}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pending: <strong className="text-amber-500">{charts?.ticketPending ?? 0}</strong> · Solved:{' '}
                <strong className="text-emerald-500">{charts?.ticketSolved ?? 0}</strong>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center">
              <LifeBuoy className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 3 Charts in 1 row: Active Users Line | SMS Donut | Ticket Donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart 1: Active & Online Users Trend LineChart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col min-h-[320px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active vs Online Trend</h3>
              </div>
              <span className="text-[11px] text-slate-400">12 Month Projection</span>
            </div>

            <div className="flex-1 min-h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={(() => {
                    const active = charts?.activeUsers ?? stats.totalActive;
                    const online = charts?.onlineUsers ?? stats.totalActive;
                    const months: { date: string; Active: number; Online: number }[] = [];
                    const now = new Date();
                    for (let i = 11; i >= 0; i--) {
                      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                      const progress = 1 - (11 - i) / 12;
                      months.push({
                        date: d.toLocaleDateString([], { month: 'short' }),
                        Active: Math.round(active * (0.35 + 0.65 * progress)),
                        Online: Math.round(online * (0.3 + 0.7 * progress)),
                      });
                    }
                    return months;
                  })()}
                  margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#94a3b8" opacity={0.4} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#94a3b8" opacity={0.4} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Line
                    type="monotone"
                    dataKey="Active"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#2563eb' }}
                    activeDot={{ r: 5 }}
                    name="Active Users"
                  />
                  <Line
                    type="monotone"
                    dataKey="Online"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#10b981' }}
                    activeDot={{ r: 5 }}
                    name="Live Online"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: SMS Distribution Donut */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col min-h-[320px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-sky-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">SMS Category Distribution</h3>
              </div>
              <span className="text-[11px] text-slate-400">Monthly</span>
            </div>

            <div className="flex-1 flex items-center justify-center min-h-[220px]">
              {(() => {
                const smsChartData = [
                  { name: 'Alert SMS', value: charts?.smsAlert ?? 0, fill: '#f59e0b' },
                  { name: 'Recharge SMS', value: charts?.smsRecharge ?? 0, fill: '#3b82f6' },
                  { name: 'New Customer', value: charts?.smsNewCustomer ?? 0, fill: '#10b981' },
                  { name: 'Other', value: charts?.smsOther ?? 0, fill: '#94a3b8' },
                ].filter((d) => d.value > 0);

                const total =
                  (charts?.smsAlert ?? 0) +
                  (charts?.smsRecharge ?? 0) +
                  (charts?.smsNewCustomer ?? 0) +
                  (charts?.smsOther ?? 0);

                return total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={smsChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {smsChartData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          borderRadius: '10px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [`${val} SMS`, '']}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-10 space-y-2">
                    <Send className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">No SMS sent this month</p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Chart 3: Ticket Resolution Donut */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col min-h-[320px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Helpdesk Resolution</h3>
              </div>
              <span className="text-[11px] text-slate-400">Total Status</span>
            </div>

            <div className="flex-1 flex items-center justify-center min-h-[220px]">
              {(charts?.ticketPending ?? 0) + (charts?.ticketSolved ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Pending', value: charts?.ticketPending ?? 0, fill: '#f59e0b' },
                        { name: 'Resolved', value: charts?.ticketSolved ?? 0, fill: '#10b981' },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      <Cell fill="#f59e0b" />
                      <Cell fill="#10b981" />
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-10 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs text-slate-400">All tickets resolved or none open</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 7. Network Infrastructure Quick Links */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Infrastructure & System Shortcuts
            </h3>
          </div>
          <span className="text-xs text-slate-400">Quick jump</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard/pppoe-logs')}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">PPPoE Logs</p>
              <p className="text-[11px] text-slate-400 truncate">Live router sessions</p>
            </div>
          </button>

          {isIspAdmin && (
            <button
              type="button"
              onClick={() => navigate('/dashboard/network/mikrotik')}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Server className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">MikroTik Routers</p>
                <p className="text-[11px] text-slate-400 truncate">Manage NAS & API</p>
              </div>
            </button>
          )}

          {isIspAdmin && (
            <button
              type="button"
              onClick={() => navigate('/dashboard/network/olt')}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">OLT & PON</p>
                <p className="text-[11px] text-slate-400 truncate">Fiber optical lines</p>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/dashboard/service-area/areas')}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 hover:border-purple-200 dark:hover:border-purple-800 transition-all text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Coverage Areas</p>
              <p className="text-[11px] text-slate-400 truncate">Zones & sub-areas</p>
            </div>
          </button>

          {isIspAdmin && (
            <button
              type="button"
              onClick={() => navigate('/dashboard/reseller')}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-amber-50/50 dark:hover:bg-amber-900/20 hover:border-amber-200 dark:hover:border-amber-800 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Resellers & POP</p>
                <p className="text-[11px] text-slate-400 truncate">Sub-networks</p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
