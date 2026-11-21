import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  ShieldCheck,
  Settings,
  RefreshCw,
  Search,
  Filter,
  Users,
  Wifi,
  DollarSign,
  Activity,
  Layers,
  Building2,
  Home,
  Briefcase,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Tag,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { PageHeader, MetricCard } from '@/components/common';
import { useToastContext } from '@/contexts/ToastContext';
import {
  btrcService,
  BtrcReportData,
  BtrcSubscriber,
  BtrcProfile,
} from '@/services/btrc.service';
import BtrcSettingsModal from '@/components/reports/BtrcSettingsModal';
import BtrcBatchCategorizeModal from '@/components/reports/BtrcBatchCategorizeModal';
import * as XLSX from 'xlsx';

export default function BtrcReportPage() {
  const toast = useToastContext();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);

  const [activeTab, setActiveTab] = useState<'summary' | 'subscribers'>('summary');
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [reportData, setReportData] = useState<BtrcReportData | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBatchOpen, setIsBatchOpen] = useState<boolean>(false);

  // Selection for bulk categorization
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);

  const fetchReport = async (pageOverride?: number) => {
    setLoading(true);
    try {
      const data = await btrcService.getReport({
        year: selectedYear,
        month: selectedMonth,
        category: filterCategory,
        status: filterStatus,
        search: searchText.trim() || undefined,
        page: pageOverride ?? page,
        limit,
      });
      setReportData(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load BTRC report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(1);
    setSelectedCustomerIds([]);
  }, [selectedYear, selectedMonth, filterCategory, filterStatus]);

  // Handle Search Debounce or Enter
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReport(1);
  };

  // Selection Helpers
  const handleSelectAll = () => {
    if (!reportData?.subscribers) return;
    if (selectedCustomerIds.length === reportData.subscribers.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(reportData.subscribers.map((s) => s.customer_id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Inline Quick Category Switcher
  const handleQuickCategoryChange = async (
    customerId: number,
    newCategory: 'home' | 'corporate' | 'sme'
  ) => {
    try {
      await btrcService.bulkCategorize({
        customer_ids: [customerId],
        btrc_category: newCategory,
      });
      toast.success(`Updated customer to ${newCategory.toUpperCase()}`);
      fetchReport();
    } catch (err: any) {
      toast.error('Failed to change customer category.');
    }
  };

  // Excel Export Handler (Official BTRC Multi-Sheet XLSX)
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      // 1. Fetch full unpaginated roster for export
      const fullData = await btrcService.getReport({
        year: selectedYear,
        month: selectedMonth,
        category: filterCategory,
        status: filterStatus,
        search: searchText.trim() || undefined,
        export: 'all',
      });

      const profile = fullData.btrc_profile;
      const cats = fullData.category_summaries;
      const totals = fullData.grand_totals;
      const slabs = fullData.bandwidth_slabs;
      const subs = fullData.subscribers;

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // ==========================================
      // SHEET 1: BTRC_Monthly_Return_Summary
      // ==========================================
      const summaryRows: any[][] = [
        ['BANGLADESH TELECOMMUNICATION REGULATORY COMMISSION (BTRC)'],
        ['IEB Bhaban, Ramna, Dhaka-1000, Bangladesh'],
        ['MONTHLY RETURN REPORT FOR INTERNET SERVICE PROVIDERS (ISPs)'],
        [`Reporting Period: ${profile.reporting_month} ${profile.reporting_year}`],
        [],
        ['1. OPERATOR & LICENSE INFORMATION'],
        ['Operator / Company Name:', profile.operator_name],
        ['BTRC License Number:', profile.license_no],
        ['License Category:', profile.license_category],
        ['Total Purchased Bandwidth (IIG/NTTN):', `${profile.purchased_bandwidth_mbps} Mbps`],
        ['Authorized Contact Person:', profile.contact_person],
        ['Designation:', profile.contact_designation],
        ['Contact Phone / Mobile:', profile.contact_phone],
        ['Contact Email Address:', profile.contact_email],
        ['Registered Office Address:', profile.address],
        [],
        ['2. SUBSCRIBER & ALLOCATED BANDWIDTH RETURN (CATEGORY-WISE)'],
        [
          'Client Category',
          'Prev Month Active',
          'New Connected This Month',
          'Disconnected / Left',
          'Current Active Subscribers',
          'Total Allocated Bandwidth (Mbps)',
          'Average Bandwidth / User (Mbps)',
          'Total Billed Amount (BDT)',
        ],
        [
          'Home (Residential)',
          cats.home.prev_month_active,
          cats.home.new_connections,
          cats.home.disconnected,
          cats.home.active_subscribers,
          cats.home.total_bandwidth_mbps,
          cats.home.avg_bandwidth_mbps,
          cats.home.total_revenue_bdt,
        ],
        [
          'Corporate (Enterprise)',
          cats.corporate.prev_month_active,
          cats.corporate.new_connections,
          cats.corporate.disconnected,
          cats.corporate.active_subscribers,
          cats.corporate.total_bandwidth_mbps,
          cats.corporate.avg_bandwidth_mbps,
          cats.corporate.total_revenue_bdt,
        ],
        [
          'SME (Small & Medium Enterprise)',
          cats.sme.prev_month_active,
          cats.sme.new_connections,
          cats.sme.disconnected,
          cats.sme.active_subscribers,
          cats.sme.total_bandwidth_mbps,
          cats.sme.avg_bandwidth_mbps,
          cats.sme.total_revenue_bdt,
        ],
        [
          'TOTAL / GRAND SUM',
          totals.prev_month_active,
          totals.new_connections,
          totals.disconnected,
          totals.active_subscribers,
          totals.total_bandwidth_mbps,
          totals.avg_bandwidth_mbps,
          totals.total_revenue_bdt,
        ],
        [],
        ['3. BANDWIDTH SLAB / SPEED TIER BREAKDOWN (SUBSCRIBER DISTRIBUTION)'],
        [
          'Speed Bracket',
          'Home Subscribers',
          'Corporate Subscribers',
          'SME Subscribers',
          'Total Subscribers',
          'Total Allocated Bandwidth (Mbps)',
        ],
      ];

      slabs.forEach((sl) => {
        summaryRows.push([
          sl.label,
          sl.home,
          sl.corporate,
          sl.sme,
          sl.total,
          sl.total_mbps,
        ]);
      });

      summaryRows.push([]);
      summaryRows.push(['4. UPSTREAM BANDWIDTH UTILIZATION']);
      summaryRows.push([
        'Purchased Bandwidth (Mbps)',
        'Allocated to End-Users (Mbps)',
        'Utilization Ratio (%)',
      ]);
      const utilRate =
        profile.purchased_bandwidth_mbps > 0
          ? ((totals.total_bandwidth_mbps / profile.purchased_bandwidth_mbps) * 100).toFixed(2) + '%'
          : 'N/A';
      summaryRows.push([
        profile.purchased_bandwidth_mbps,
        totals.total_bandwidth_mbps,
        utilRate,
      ]);

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

      // Auto-fit column widths for summary sheet
      wsSummary['!cols'] = [
        { wch: 32 },
        { wch: 22 },
        { wch: 24 },
        { wch: 20 },
        { wch: 24 },
        { wch: 28 },
        { wch: 26 },
        { wch: 24 },
      ];

      XLSX.utils.book_append_sheet(wb, wsSummary, 'BTRC_Monthly_Summary');

      // ==========================================
      // SHEET 2: BTRC_Subscriber_Details (KYC)
      // ==========================================
      const subHeaders = [
        'SL No',
        'Operator Name',
        'Client ID',
        'Name of Client',
        'Type of Client',
        'Type of Connection',
        'Type of Connectivity',
        'Bandwidth Allocation (Mbps)',
        'Upload Bandwidth (Mbps)',
        'Allocated IP',
        'Client Phone',
        'National ID (NID)',
        'Installation Address',
        'Thana / Upazila',
        'District',
        'Activation Date',
        'Selling Bandwidth Price (BDT)',
        'Status',
        'Billing Status',
        'Package Name',
      ];

      const subRows = subs.map((s, idx) => [
        idx + 1,
        s.operator_name,
        s.client_id,
        s.client_name,
        s.client_type,
        s.connection_type,
        s.connectivity_media,
        s.bandwidth_mbps,
        s.upload_mbps,
        s.allocated_ip,
        s.phone,
        s.national_id,
        s.installation_address,
        s.thana,
        s.district,
        s.activation_date,
        s.monthly_bill,
        s.status,
        s.billing_status,
        s.package_name,
      ]);

      const wsDetails = XLSX.utils.aoa_to_sheet([subHeaders, ...subRows]);

      wsDetails['!cols'] = [
        { wch: 8 },  // SL No
        { wch: 20 }, // Operator
        { wch: 14 }, // Client ID
        { wch: 26 }, // Name
        { wch: 14 }, // Type of Client
        { wch: 18 }, // Type of Connection
        { wch: 22 }, // Type of Connectivity
        { wch: 24 }, // Bandwidth Mbps
        { wch: 22 }, // Upload Mbps
        { wch: 18 }, // IP
        { wch: 16 }, // Phone
        { wch: 20 }, // NID
        { wch: 34 }, // Address
        { wch: 16 }, // Thana
        { wch: 16 }, // District
        { wch: 16 }, // Activation Date
        { wch: 24 }, // Selling Price
        { wch: 12 }, // Status
        { wch: 14 }, // Billing Status
        { wch: 18 }, // Package
      ];

      XLSX.utils.book_append_sheet(wb, wsDetails, 'Subscriber_Details');

      // Generate filename and trigger download
      const fileName = `BTRC_Monthly_Return_${profile.operator_name.replace(/[^a-zA-Z0-9]/g, '_')}_${profile.reporting_month}_${profile.reporting_year}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success(`Exported ${subs.length} subscribers in official BTRC Excel format.`);
    } catch (err: any) {
      toast.error('Failed to export BTRC Excel report.');
    } finally {
      setExporting(false);
    }
  };

  // CSV Export (Single Flat File)
  const handleExportCsv = async () => {
    try {
      const fullData = await btrcService.getReport({
        year: selectedYear,
        month: selectedMonth,
        category: filterCategory,
        status: filterStatus,
        search: searchText.trim() || undefined,
        export: 'all',
      });
      const subs = fullData.subscribers;
      const headers = [
        'SL,Operator Name,Client ID,Name of Client,Type of Client,Type of Connection,Type of Connectivity,Bandwidth Allocation (Mbps),Upload Bandwidth (Mbps),Allocated IP,Client Phone,National ID,Installation Address,Thana,District,Activation Date,Selling Price (BDT),Status',
      ];
      const rows = subs.map((s, i) =>
        [
          i + 1,
          `"${s.operator_name.replace(/"/g, '""')}"`,
          `"${s.client_id}"`,
          `"${s.client_name.replace(/"/g, '""')}"`,
          `"${s.client_type}"`,
          `"${s.connection_type}"`,
          `"${s.connectivity_media}"`,
          s.bandwidth_mbps,
          s.upload_mbps,
          `"${s.allocated_ip}"`,
          `"${s.phone}"`,
          `"${s.national_id}"`,
          `"${s.installation_address.replace(/"/g, '""')}"`,
          `"${s.thana}"`,
          `"${s.district}"`,
          `"${s.activation_date}"`,
          s.monthly_bill,
          `"${s.status}"`,
        ].join(',')
      );

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        `BTRC_Return_Subscribers_${selectedYear}_${selectedMonth}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV exported successfully.');
    } catch (err) {
      toast.error('Failed to export CSV.');
    }
  };

  const profile = reportData?.btrc_profile;
  const cats = reportData?.category_summaries;
  const totals = reportData?.grand_totals;
  const slabs = reportData?.bandwidth_slabs || [];
  const subs = reportData?.subscribers || [];
  const pagination = reportData?.pagination;

  // Bandwidth in Gbps display
  const totalBwGbps = totals ? (totals.total_bandwidth_mbps / 1024).toFixed(2) : '0';
  const purchasedBw = profile?.purchased_bandwidth_mbps || 0;
  const utilizationPct =
    purchasedBw > 0 && totals
      ? Math.min(100, Math.round((totals.total_bandwidth_mbps / purchasedBw) * 100))
      : 0;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <PageHeader
        title="BTRC Monthly Return Report"
        subtitle="Official regulatory monthly compliance statement with Home, Corporate & SME subscriber analytics and bandwidth return"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Reports', path: '/dashboard/report/reseller-wise-customers' },
          { label: 'BTRC Monthly Return' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Settings className="w-3.5 h-3.5 text-blue-500" />
              <span>License Setup</span>
            </button>
            <button
              onClick={handleExportCsv}
              disabled={loading || exporting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Form</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={loading || exporting}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-md flex items-center gap-2 transition-all"
            >
              {exporting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              <span>Export BTRC Excel (.xlsx)</span>
            </button>
          </div>
        }
      />

      {/* Top Filter Bar */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Month Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Month:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[
                  'January',
                  'February',
                  'March',
                  'April',
                  'May',
                  'June',
                  'July',
                  'August',
                  'September',
                  'October',
                  'November',
                  'December',
                ].map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Year:
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Status:
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Subscribers</option>
                <option value="active">Active Only</option>
                <option value="expired">Expired / Due</option>
                <option value="left">Left / Terminated</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Category:
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="home">Home (Residential)</option>
                <option value="corporate">Corporate (Enterprise)</option>
                <option value="sme">SME (Small Business)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchReport()}
              disabled={loading}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh Report Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Subscribers */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Subscribers
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {totals?.active_subscribers?.toLocaleString() ?? 0}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              / {totals?.total_subscribers?.toLocaleString() ?? 0} Total
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[11px]">
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              Home: {cats?.home?.active_subscribers ?? 0}
            </span>
            <span className="text-purple-600 dark:text-purple-400 font-semibold">
              Corp: {cats?.corporate?.active_subscribers ?? 0}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              SME: {cats?.sme?.active_subscribers ?? 0}
            </span>
          </div>
        </div>

        {/* Distributed Bandwidth */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Distributed Bandwidth
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Wifi className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {totals?.total_bandwidth_mbps?.toLocaleString(undefined, {
                maximumFractionDigits: 1,
              }) ?? 0}{' '}
              <span className="text-sm font-semibold text-slate-500">Mbps</span>
            </h3>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>≈ {totalBwGbps} Gbps Total</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              Avg: {totals?.avg_bandwidth_mbps ?? 0} Mbps/user
            </span>
          </div>
        </div>

        {/* Upstream Bandwidth Utilization */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              IIG / NTTN Upstream Usage
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {utilizationPct}%
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Allocated
            </span>
          </div>
          <div className="mt-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                utilizationPct > 90
                  ? 'bg-rose-500'
                  : utilizationPct > 70
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${utilizationPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Purchased: {purchasedBw} Mbps</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Margin: {Math.max(0, purchasedBw - (totals?.total_bandwidth_mbps || 0)).toFixed(0)} Mbps
            </span>
          </div>
        </div>

        {/* Total Monthly Billed */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Monthly Billing
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              ৳
              {totals?.total_revenue_bdt?.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              }) ?? 0}
            </h3>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Period: {profile?.reporting_period}</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Govt VAT declared
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'summary'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>BTRC Official Return Summary</span>
          </button>
          <button
            onClick={() => setActiveTab('subscribers')}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'subscribers'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Subscriber KYC & Regulatory Roster</span>
            <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {pagination?.total ?? 0}
            </span>
          </button>
        </div>

        {activeTab === 'subscribers' && selectedCustomerIds.length > 0 && (
          <div className="flex items-center gap-2 pb-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {selectedCustomerIds.length} selected
            </span>
            <button
              onClick={() => setIsBatchOpen(true)}
              className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Assign Category</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: BTRC OFFICIAL SUMMARY TABLE */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Operator License Info Card */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-white/10 text-blue-200 border border-white/20">
                  {profile?.license_category} ISP Licensee
                </span>
                <h2 className="text-xl font-black mt-2">{profile?.operator_name}</h2>
                <p className="text-xs text-blue-200/90 mt-1">
                  License No: <span className="font-mono font-bold">{profile?.license_no}</span> | Period:{' '}
                  <span className="font-bold">{profile?.reporting_period}</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-blue-100/80">
                  <span>Contact: <strong>{profile?.contact_person}</strong> ({profile?.contact_designation})</span>
                  <span>Phone: <strong>{profile?.contact_phone}</strong></span>
                  <span>Email: <strong>{profile?.contact_email}</strong></span>
                  <span>Address: {profile?.address}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table 1: Category Summary (Home, Corporate, SME) */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>1. Client Category & Bandwidth Return (BTRC Monthly Return Matrix)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  BTRC Prescribed Return: Previous Month Active, New Connected, Disconnected & Current Active Subscribers
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Client Category</th>
                    <th className="py-3.5 px-4 text-center">Prev Month Active</th>
                    <th className="py-3.5 px-4 text-center text-emerald-600 dark:text-emerald-400">
                      New Connections
                    </th>
                    <th className="py-3.5 px-4 text-center text-rose-600 dark:text-rose-400">
                      Disconnected / Left
                    </th>
                    <th className="py-3.5 px-4 text-center font-black text-slate-900 dark:text-white bg-blue-50/50 dark:bg-blue-950/20">
                      Current Active Subscribers
                    </th>
                    <th className="py-3.5 px-4 text-right">Allocated Bandwidth</th>
                    <th className="py-3.5 px-4 text-right">Avg Bandwidth (Mbps)</th>
                    <th className="py-3.5 px-4 text-right">Total Billed / Revenue (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {/* Home */}
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Home className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span>Home (Residential)</span>
                        <div className="text-[10px] text-slate-400 font-normal">Residential Broadband</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">{cats?.home?.prev_month_active ?? 0}</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                      +{cats?.home?.new_connections ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-center text-rose-600 dark:text-rose-400">
                      -{cats?.home?.disconnected ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900 dark:text-white bg-blue-50/30 dark:bg-blue-950/10">
                      {cats?.home?.active_subscribers?.toLocaleString() ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                      {cats?.home?.total_bandwidth_mbps?.toLocaleString() ?? 0} Mbps
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {cats?.home?.avg_bandwidth_mbps ?? 0} Mbps
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ৳{cats?.home?.total_revenue_bdt?.toLocaleString() ?? 0}
                    </td>
                  </tr>

                  {/* Corporate */}
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span>Corporate (Enterprise)</span>
                        <div className="text-[10px] text-slate-400 font-normal">Dedicated / Enterprise</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">{cats?.corporate?.prev_month_active ?? 0}</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                      +{cats?.corporate?.new_connections ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-center text-rose-600 dark:text-rose-400">
                      -{cats?.corporate?.disconnected ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900 dark:text-white bg-blue-50/30 dark:bg-blue-950/10">
                      {cats?.corporate?.active_subscribers?.toLocaleString() ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                      {cats?.corporate?.total_bandwidth_mbps?.toLocaleString() ?? 0} Mbps
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {cats?.corporate?.avg_bandwidth_mbps ?? 0} Mbps
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ৳{cats?.corporate?.total_revenue_bdt?.toLocaleString() ?? 0}
                    </td>
                  </tr>

                  {/* SME */}
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Briefcase className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span>SME (Small & Medium Enterprise)</span>
                        <div className="text-[10px] text-slate-400 font-normal">Small & Medium Enterprise</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">{cats?.sme?.prev_month_active ?? 0}</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                      +{cats?.sme?.new_connections ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-center text-rose-600 dark:text-rose-400">
                      -{cats?.sme?.disconnected ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900 dark:text-white bg-blue-50/30 dark:bg-blue-950/10">
                      {cats?.sme?.active_subscribers?.toLocaleString() ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {cats?.sme?.total_bandwidth_mbps?.toLocaleString() ?? 0} Mbps
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      {cats?.sme?.avg_bandwidth_mbps ?? 0} Mbps
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ৳{cats?.sme?.total_revenue_bdt?.toLocaleString() ?? 0}
                    </td>
                  </tr>
                </tbody>

                {/* Grand Total Row */}
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-xs">
                    <td className="py-4 px-4 uppercase tracking-wider">Grand Total</td>
                    <td className="py-4 px-4 text-center">{totals?.prev_month_active ?? 0}</td>
                    <td className="py-4 px-4 text-center text-emerald-600 dark:text-emerald-400 font-black">
                      +{totals?.new_connections ?? 0}
                    </td>
                    <td className="py-4 px-4 text-center text-rose-600 dark:text-rose-400">
                      -{totals?.disconnected ?? 0}
                    </td>
                    <td className="py-4 px-4 text-center text-base bg-blue-100/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                      {totals?.active_subscribers?.toLocaleString() ?? 0}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-sm text-blue-700 dark:text-blue-300">
                      {totals?.total_bandwidth_mbps?.toLocaleString() ?? 0} Mbps
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-xs">
                      {totals?.avg_bandwidth_mbps ?? 0} Mbps
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                      ৳{totals?.total_revenue_bdt?.toLocaleString() ?? 0}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Table 2: Bandwidth Slabs Distribution (BTRC Standard Speed Slabs) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>2. Bandwidth Slab Distribution (Subscriber Tier Matrix)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Subscriber distribution categorized by BTRC speed tier brackets
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px]">
                      <th className="py-3 px-4">Speed Slab</th>
                      <th className="py-3 px-3 text-center">Home</th>
                      <th className="py-3 px-3 text-center">Corporate</th>
                      <th className="py-3 px-3 text-center">SME</th>
                      <th className="py-3 px-3 text-center font-bold text-slate-900 dark:text-white">Total Users</th>
                      <th className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">Total Bandwidth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {slabs.map((sl) => (
                      <tr key={sl.label} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{sl.label}</td>
                        <td className="py-3 px-3 text-center text-blue-600 dark:text-blue-400">{sl.home}</td>
                        <td className="py-3 px-3 text-center text-purple-600 dark:text-purple-400">{sl.corporate}</td>
                        <td className="py-3 px-3 text-center text-emerald-600 dark:text-emerald-400">{sl.sme}</td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900 dark:text-white">{sl.total}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {sl.total_mbps?.toLocaleString() ?? 0} Mbps
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Connectivity Media Summary */}
            <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>3. Connectivity Media Distribution</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Breakdown by physical delivery medium (FTTH / UTP / Wireless)
              </p>

              <div className="space-y-3 pt-2">
                {reportData?.media_distribution?.map((m) => (
                  <div
                    key={m.label}
                    className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/50 rounded-xl"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                      <span>{m.label}</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{m.count} Users</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Total Speed: {m.bandwidth_mbps} Mbps</span>
                      <span>
                        {totals?.active_subscribers
                          ? Math.round((m.count / totals.active_subscribers) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                💡 <strong>Tip:</strong> You can quickly adjust any subscriber&#39;s classification (Home, Corporate, SME) inline or in bulk from the &quot;Subscriber KYC &amp; Roster&quot; tab.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUBSCRIBER KYC & ROSTER TABLE */}
      {activeTab === 'subscribers' && (
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm space-y-4 p-5">
          {/* Sub Header & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md w-full">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search by Client ID, Name, Phone, IP, NID..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm"
              >
                Search
              </button>
            </form>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Showing {subs.length} of {pagination?.total ?? 0} Subscribers
              </span>
            </div>
          </div>

          {/* Roster Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 text-center w-10">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {subs.length > 0 && selectedCustomerIds.length === subs.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-2 text-center">SL</th>
                  <th className="py-3 px-3">Client ID</th>
                  <th className="py-3 px-4">Name of Client</th>
                  <th className="py-3 px-3">BTRC Category</th>
                  <th className="py-3 px-3">Protocol</th>
                  <th className="py-3 px-3">Media</th>
                  <th className="py-3 px-3 text-right">Bandwidth</th>
                  <th className="py-3 px-3">Allocated IP</th>
                  <th className="py-3 px-3">Client Phone</th>
                  <th className="py-3 px-3">National ID (NID)</th>
                  <th className="py-3 px-4">Address / Thana</th>
                  <th className="py-3 px-3 text-right">Monthly Fee</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      Loading BTRC subscriber records...
                    </td>
                  </tr>
                ) : subs.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-slate-500">
                      No subscriber records match the criteria.
                    </td>
                  </tr>
                ) : (
                  subs.map((s) => {
                    const isSelected = selectedCustomerIds.includes(s.customer_id);
                    return (
                      <tr
                        key={s.customer_id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                          isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectOne(s.customer_id)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-400">{s.sl}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {s.client_id}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                          {s.client_name}
                        </td>
                        <td className="py-2.5 px-3">
                          {/* Inline Category Switcher Dropdown */}
                          <select
                            value={s.btrc_category}
                            onChange={(e) =>
                              handleQuickCategoryChange(s.customer_id, e.target.value as any)
                            }
                            className={`px-2 py-1 text-[11px] font-bold rounded-md border focus:outline-none cursor-pointer ${
                              s.btrc_category === 'corporate'
                                ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                : s.btrc_category === 'sme'
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                            }`}
                          >
                            <option value="home">Home</option>
                            <option value="corporate">Corporate</option>
                            <option value="sme">SME</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] uppercase">
                          {s.connection_type}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-slate-300">
                          {s.connectivity_media}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {s.bandwidth_mbps} Mbps
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {s.allocated_ip}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-200">
                          {s.phone}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {s.national_id}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          <span>{s.installation_address}</span>
                          <span className="text-slate-400 text-[10px] block">
                            {s.thana}, {s.district}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ৳{s.monthly_bill}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              s.status.toLowerCase() === 'active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.total_pages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    fetchReport(page - 1);
                  }}
                  disabled={pagination.page <= 1 || loading}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={() => {
                    setPage((p) => Math.min(pagination.total_pages, p + 1));
                    fetchReport(page + 1);
                  }}
                  disabled={pagination.page >= pagination.total_pages || loading}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <BtrcSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentProfile={profile || null}
        onSaved={() => fetchReport()}
      />

      <BtrcBatchCategorizeModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        selectedIds={selectedCustomerIds}
        onSuccess={() => {
          setSelectedCustomerIds([]);
          fetchReport();
        }}
      />
    </div>
  );
}
