import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Settings,
  RefreshCw,
  Search,
  Users,
  Wifi,
  DollarSign,
  Activity,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Tag,
  Building2,
  Home,
  Briefcase,
} from 'lucide-react';
import { PageHeader } from '@/components/common';
import { useToastContext } from '@/contexts/ToastContext';
import {
  btrcService,
  BtrcReportData,
  BtrcRow,
  BtrcSettings,
  BtrcSummary,
} from '@/services/btrc.service';
import BtrcSettingsModal from '@/components/reports/BtrcSettingsModal';
import BtrcBatchCategorizeModal from '@/components/reports/BtrcBatchCategorizeModal';
import * as XLSX from 'xlsx';

export default function BtrcReportPage() {
  const toast = useToastContext();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [searchText, setSearchText] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);

  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [reportData, setReportData] = useState<BtrcReportData | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBatchOpen, setIsBatchOpen] = useState<boolean>(false);

  // Row Selection for Bulk Categorization
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);

  const fetchReport = async (pageOverride?: number) => {
    setLoading(true);
    try {
      const data = await btrcService.getReport({
        year: selectedYear,
        month: selectedMonth,
        client_type: filterType,
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
  }, [selectedYear, selectedMonth, filterType, filterStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReport(1);
  };

  // Selection Handlers
  const handleSelectAll = () => {
    if (!reportData?.rows) return;
    if (selectedCustomerIds.length === reportData.rows.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(reportData.rows.map((r) => r.customer_id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Inline Quick Client Type Change
  const handleQuickClientTypeChange = async (
    customerId: number,
    newType: 'Home' | 'Corporate' | 'SME'
  ) => {
    try {
      await btrcService.bulkCategorize({
        customer_ids: [customerId],
        client_type: newType,
      });
      toast.success(`Client updated to ${newType}`);
      fetchReport();
    } catch (err) {
      toast.error('Failed to change client type.');
    }
  };

  // Inline Quick Connectivity Sharing Change
  const handleQuickConnectivityChange = async (
    customerId: number,
    newSharing: 'Shared' | 'Dedicated'
  ) => {
    try {
      await btrcService.bulkCategorize({
        customer_ids: [customerId],
        connectivity_type: newSharing,
      });
      toast.success(`Updated to ${newSharing}`);
      fetchReport();
    } catch (err) {
      toast.error('Failed to change connectivity type.');
    }
  };

  // Official 15-Column ISPbills / BTRC Excel Export
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const fullData = await btrcService.getReport({
        year: selectedYear,
        month: selectedMonth,
        client_type: filterType,
        status: filterStatus,
        search: searchText.trim() || undefined,
        export: 'all',
      });

      const rows = fullData.rows || [];

      // Format strictly matching SmartISP_BTRC_Report Excel schema
      const exportRows = rows.map((r) => ({
        client_type: r.client_type,
        connection_type: r.connection_type,
        client_username: r.client_username,
        bandwidth_distribution_point: r.bandwidth_distribution_point || 'NOC',
        connectivity_type: r.connectivity_type || 'Shared',
        activation_date: r.activation_date,
        bandwidth_allocation: r.bandwidth_allocation,
        allocated_ip: r.allocated_ip,
        division: r.division || '',
        district: r.district || '',
        thana: r.thana || '',
        address: r.address || '',
        client_mobile: r.client_mobile,
        client_email: r.client_email || '',
        selling_price_bdt_excluding_vat: r.selling_price_bdt_excluding_vat,
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportRows, {
        header: [
          'client_type',
          'connection_type',
          'client_username',
          'bandwidth_distribution_point',
          'connectivity_type',
          'activation_date',
          'bandwidth_allocation',
          'allocated_ip',
          'division',
          'district',
          'thana',
          'address',
          'client_mobile',
          'client_email',
          'selling_price_bdt_excluding_vat',
        ],
      });

      // Worksheet column widths
      ws['!cols'] = [
        { wch: 14 }, // client_type
        { wch: 16 }, // connection_type
        { wch: 16 }, // client_username
        { wch: 28 }, // bandwidth_distribution_point
        { wch: 18 }, // connectivity_type
        { wch: 16 }, // activation_date
        { wch: 22 }, // bandwidth_allocation
        { wch: 20 }, // allocated_ip
        { wch: 14 }, // division
        { wch: 14 }, // district
        { wch: 16 }, // thana
        { wch: 32 }, // address
        { wch: 16 }, // client_mobile
        { wch: 22 }, // client_email
        { wch: 30 }, // selling_price_bdt_excluding_vat
      ];

      // Sheet name MUST be 'Worksheet' matching official template
      XLSX.utils.book_append_sheet(wb, ws, 'Worksheet');

      const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(
        now.getMonth() + 1
      ).padStart(2, '0')}-${now.getFullYear()}`;
      const fileName = `SmartISP_BTRC_Report ${dateStr} (1).xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success(`Exported ${exportRows.length} customers to ${fileName}`);
    } catch (err: any) {
      toast.error('Failed to export BTRC Excel report.');
    } finally {
      setExporting(false);
    }
  };

  // CSV Export
  const handleExportCsv = async () => {
    try {
      const fullData = await btrcService.getReport({
        year: selectedYear,
        month: selectedMonth,
        client_type: filterType,
        status: filterStatus,
        search: searchText.trim() || undefined,
        export: 'all',
      });
      const rows = fullData.rows || [];
      const headers = [
        'client_type,connection_type,client_username,bandwidth_distribution_point,connectivity_type,activation_date,bandwidth_allocation,allocated_ip,division,district,thana,address,client_mobile,client_email,selling_price_bdt_excluding_vat',
      ];
      const csvLines = rows.map((r) =>
        [
          r.client_type,
          r.connection_type,
          `"${r.client_username}"`,
          `"${r.bandwidth_distribution_point || 'NOC'}"`,
          r.connectivity_type,
          r.activation_date,
          r.bandwidth_allocation,
          `"${r.allocated_ip}"`,
          `"${r.division || ''}"`,
          `"${r.district || ''}"`,
          `"${r.thana || ''}"`,
          `"${(r.address || '').replace(/"/g, '""')}"`,
          `"${r.client_mobile}"`,
          `"${r.client_email || ''}"`,
          r.selling_price_bdt_excluding_vat,
        ].join(',')
      );

      const blob = new Blob(['\uFEFF' + [headers, ...csvLines].join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `SmartISP_BTRC_Report_${selectedYear}_${selectedMonth}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV exported successfully.');
    } catch (err) {
      toast.error('Failed to export CSV.');
    }
  };

  const summary = reportData?.summary;
  const settings = reportData?.settings;
  const rows = reportData?.rows || [];
  const pagination = reportData?.pagination;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <PageHeader
        title="BTRC Monthly Return Report"
        subtitle="Standard 15-column BTRC compliance report matching ISPbills / SmartISP Excel format"
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
              <span>Report Settings</span>
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
              <span>Print</span>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Customers */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Customers
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {summary?.total_subscribers?.toLocaleString() ?? 0}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Active in Report
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-500">
            <span>Status: {filterStatus.toUpperCase()}</span>
            <span>Point: {settings?.distribution_point || 'NOC'}</span>
          </div>
        </div>

        {/* Home Customers */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Home Customers
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Home className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {summary?.home_count?.toLocaleString() ?? 0}
            </h3>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
              Residential
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-500">
            <span>Client Type: Home</span>
            <span>
              {summary?.total_subscribers
                ? Math.round((summary.home_count / summary.total_subscribers) * 100)
                : 0}
              % of total
            </span>
          </div>
        </div>

        {/* Corporate & SME Clients */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Corporate &amp; SME
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {(
                (summary?.corporate_count ?? 0) + (summary?.sme_count ?? 0)
              ).toLocaleString()}
            </h3>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[11px]">
            <span className="text-purple-600 dark:text-purple-400 font-semibold">
              Corporate: {summary?.corporate_count ?? 0}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              SME: {summary?.sme_count ?? 0}
            </span>
          </div>
        </div>

        {/* Total Bandwidth & Revenue */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Bandwidth Return
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Wifi className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {summary?.total_bandwidth_mbps?.toLocaleString() ?? 0}{' '}
              <span className="text-sm font-semibold text-slate-500">Mbps</span>
            </h3>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-500">
            <span>Ex-VAT: ৳{summary?.total_revenue_ex_vat?.toLocaleString() ?? 0}</span>
            <span className="font-semibold text-emerald-600">
              VAT: {settings?.vat_percentage ?? 5}%
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search username, IP, mobile, address..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 sm:w-64"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all"
              >
                Search
              </button>
            </form>

            {/* Client Type Filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Type:
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="Home">Home</option>
                <option value="Corporate">Corporate</option>
                <option value="SME">SME</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Status:
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active Only</option>
                <option value="all">All Status</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedCustomerIds.length > 0 && (
              <button
                onClick={() => setIsBatchOpen(true)}
                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Batch Edit ({selectedCustomerIds.length})</span>
              </button>
            )}

            <button
              onClick={() => fetchReport()}
              disabled={loading}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main 15-Column Data Table */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">
                <th className="py-3 px-3 text-center w-10">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    {rows.length > 0 && selectedCustomerIds.length === rows.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">client_type</th>
                <th className="py-3 px-3">connection_type</th>
                <th className="py-3 px-3">client_username</th>
                <th className="py-3 px-3">bandwidth_distribution_point</th>
                <th className="py-3 px-3">connectivity_type</th>
                <th className="py-3 px-3">activation_date</th>
                <th className="py-3 px-3 text-center">bandwidth_allocation</th>
                <th className="py-3 px-3">allocated_ip</th>
                <th className="py-3 px-3">division</th>
                <th className="py-3 px-3">district</th>
                <th className="py-3 px-3">thana</th>
                <th className="py-3 px-4">address</th>
                <th className="py-3 px-3">client_mobile</th>
                <th className="py-3 px-3">client_email</th>
                <th className="py-3 px-3 text-right">selling_price_bdt_excluding_vat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium whitespace-nowrap">
              {loading ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading BTRC customer records...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-500">
                    No customer records found matching current criteria.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isSelected = selectedCustomerIds.includes(r.customer_id);
                  return (
                    <tr
                      key={r.customer_id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectOne(r.customer_id)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* 1. client_type */}
                      <td className="py-2.5 px-3">
                        <select
                          value={r.client_type}
                          onChange={(e) =>
                            handleQuickClientTypeChange(r.customer_id, e.target.value as any)
                          }
                          className={`px-2 py-0.5 text-[11px] font-bold rounded border focus:outline-none cursor-pointer ${
                            r.client_type === 'Corporate'
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200'
                              : r.client_type === 'SME'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200'
                          }`}
                        >
                          <option value="Home">Home</option>
                          <option value="Corporate">Corporate</option>
                          <option value="SME">SME</option>
                        </select>
                      </td>

                      {/* 2. connection_type */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {r.connection_type}
                      </td>

                      {/* 3. client_username */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {r.client_username}
                      </td>

                      {/* 4. bandwidth_distribution_point */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {r.bandwidth_distribution_point}
                      </td>

                      {/* 5. connectivity_type */}
                      <td className="py-2.5 px-3">
                        <select
                          value={r.connectivity_type}
                          onChange={(e) =>
                            handleQuickConnectivityChange(r.customer_id, e.target.value as any)
                          }
                          className="px-1.5 py-0.5 text-[11px] font-semibold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                        >
                          <option value="Shared">Shared</option>
                          <option value="Dedicated">Dedicated</option>
                        </select>
                      </td>

                      {/* 6. activation_date */}
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {r.activation_date}
                      </td>

                      {/* 7. bandwidth_allocation */}
                      <td className="py-2.5 px-3 text-center font-mono font-black text-blue-600 dark:text-blue-400">
                        {r.bandwidth_allocation}
                      </td>

                      {/* 8. allocated_ip (PPPoE Username / IP) */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {r.allocated_ip}
                      </td>

                      {/* 9. division */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {r.division}
                      </td>

                      {/* 10. district */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {r.district}
                      </td>

                      {/* 11. thana */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {r.thana}
                      </td>

                      {/* 12. address */}
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {r.address || '—'}
                      </td>

                      {/* 13. client_mobile */}
                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-200">
                        {r.client_mobile}
                      </td>

                      {/* 14. client_email */}
                      <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                        {r.client_email || '—'}
                      </td>

                      {/* 15. selling_price_bdt_excluding_vat */}
                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {r.selling_price_bdt_excluding_vat}
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
          <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500">
              Page {pagination.page} of {pagination.total_pages} ({pagination.total} Total Records)
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

      {/* Modals */}
      <BtrcSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={settings || null}
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
