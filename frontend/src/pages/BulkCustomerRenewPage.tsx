import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Calendar,
  Users,
  Send,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { billingService } from '@/services/billing.service';
import { PageHeader } from '@/components/common';
import ModernCheckbox from '@/components/common/ModernCheckbox';
import { formatExpiryDisplay, isLifetimeExpiry } from '@/lib/formatExpiry';
import { useToastContext } from '@/contexts/ToastContext';
import { useAuthStore } from '@/stores/authStore';

type FilterType = 'expired' | 'expire-3-days' | 'expire-7-days' | 'active' | 'all';

interface RenewResultItem {
  customerId: string;
  success: boolean;
  message: string;
  expiryDate?: string;
  amount?: number;
}

export default function BulkCustomerRenewPage() {
  const toast = useToastContext();
  const user = useAuthStore((s) => s.user);
  const isAdmin = ['admin', 'manager', 'isp_admin', 'tenant_admin', 'saas_admin', 'super_admin'].includes(
    (user?.role_code || (user as any)?.role || '').toLowerCase()
  );

  const [activeTab, setActiveTab] = useState<FilterType>('expired');
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Selected Customer IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Renewal Configuration
  const [renewalMonths, setRenewalMonths] = useState<number>(1);
  const [sendSms, setSendSms] = useState<boolean>(true);
  const [renewAsReseller, setRenewAsReseller] = useState<boolean>(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Results State Modal/Banner
  const [lastResults, setLastResults] = useState<{
    total: number;
    successful: number;
    failed: number;
    items: RenewResultItem[];
  } | null>(null);

  // Fetch accounts based on active tab
  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await billingService.getBillingAccounts(activeTab as any, {
        limit: 1000,
      });
      if (res && res.success) {
        setCustomers(res.data || []);
      } else {
        setCustomers([]);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load accounts for renewal');
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, toast]);

  useEffect(() => {
    loadAccounts();
    setSelectedIds(new Set());
    setPage(1);
  }, [loadAccounts]);

  // Client-side search filtering
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c: any) => {
      const code = String(c.customer_code || c.customerCode || '').toLowerCase();
      const name = String(c.full_name || c.fullName || '').toLowerCase();
      const phone = String(c.phone || c.mobile || '').toLowerCase();
      const username = String(c.username || '').toLowerCase();
      const pkg = String(c.package_name || c.packageName || '').toLowerCase();
      return code.includes(q) || name.includes(q) || phone.includes(q) || username.includes(q) || pkg.includes(q);
    });
  }, [customers, search]);

  // Paginated records
  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredCustomers.slice(start, start + limit);
  }, [filteredCustomers, page, limit]);

  const totalPages = Math.ceil(filteredCustomers.length / limit) || 1;

  // Selection handlers
  const handleToggleSelect = (customerId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const isAllCurrentPageSelected =
    paginatedCustomers.length > 0 &&
    paginatedCustomers.every((c: any) => selectedIds.has(String(c.customer_id ?? c.customerId ?? '')));

  const handleSelectAllCurrentPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        paginatedCustomers.forEach((c: any) => {
          next.delete(String(c.customer_id ?? c.customerId ?? ''));
        });
      } else {
        paginatedCustomers.forEach((c: any) => {
          const id = String(c.customer_id ?? c.customerId ?? '');
          if (id) next.add(id);
        });
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const next = new Set<string>();
    filteredCustomers.forEach((c: any) => {
      const id = String(c.customer_id ?? c.customerId ?? '');
      if (id) next.add(id);
    });
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Calculate totals for selected customers
  const selectedCustomersList = useMemo(() => {
    return customers.filter((c: any) => selectedIds.has(String(c.customer_id ?? c.customerId ?? '')));
  }, [customers, selectedIds]);

  const totalRenewalAmount = useMemo(() => {
    return selectedCustomersList.reduce((sum, c: any) => {
      const price = parseFloat(String(c.bill_amount || c.package_price || 0)) || 0;
      return sum + price * renewalMonths;
    }, 0);
  }, [selectedCustomersList, renewalMonths]);

  // Helper to project new expiry date
  const getProjectedExpiry = (currentExpiry: string | null | undefined): string => {
    if (!currentExpiry || isLifetimeExpiry(currentExpiry)) return 'Lifetime';
    const now = new Date();
    const curr = new Date(currentExpiry);
    const base = curr > now ? curr : now;
    const projected = new Date(base);
    projected.setMonth(projected.getMonth() + renewalMonths);
    return projected.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Submit Bulk Renewal
  const handleExecuteBulkRenew = async () => {
    if (selectedIds.size === 0) {
      toast.warning('Please select at least one customer account to renew.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to renew ${selectedIds.size} customer account(s) for ${renewalMonths} month(s)?\nTotal Estimated Amount: ৳${totalRenewalAmount.toLocaleString()}`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setLastResults(null);

    try {
      const res = await billingService.bulkRenewServices({
        customer_ids: Array.from(selectedIds),
        billing_cycle: 'Monthly',
        no_of_month: renewalMonths,
        send_sms: sendSms,
        renew_as_reseller: renewAsReseller,
      });

      if (res && res.success) {
        toast.success(res.message || `Successfully renewed ${res.successful} accounts!`);
        setLastResults({
          total: res.total,
          successful: res.successful,
          failed: res.failed,
          items: res.results || [],
        });
        setSelectedIds(new Set());
        loadAccounts();
      } else {
        toast.error(res?.message || 'Bulk renewal completed with issues.');
        if (res && res.results) {
          setLastResults({
            total: res.total,
            successful: res.successful,
            failed: res.failed,
            items: res.results,
          });
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Bulk renewal failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Bulk Customer Renew"
        subtitle="Batch renew subscriptions, recalculate expiration dates, and unblock accounts in one click."
        actions={
          <button
            type="button"
            onClick={loadAccounts}
            disabled={isLoading || isSubmitting}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            Refresh Accounts
          </button>
        }
      />

      {/* Results Summary Notification (If completed recently) */}
      {lastResults && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  lastResults.failed === 0
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                }`}
              >
                {lastResults.failed === 0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  Batch Execution Completed: {lastResults.successful} of {lastResults.total} Succeeded
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lastResults.failed > 0
                    ? `${lastResults.failed} account(s) encountered errors during renewal.`
                    : 'All selected accounts were renewed and synchronized with MikroTik.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLastResults(null)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Dismiss
            </button>
          </div>

          {lastResults.failed > 0 && (
            <div className="bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 max-h-40 overflow-y-auto space-y-1">
              <p className="font-semibold mb-1">Failed Renewals:</p>
              {lastResults.items
                .filter((i) => !i.success)
                .map((i) => (
                  <div key={i.customerId} className="flex items-center justify-between gap-2">
                    <span>Account ID #{i.customerId}</span>
                    <span className="font-mono text-[11px] opacity-80">{i.message}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Target Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
        {[
          { key: 'expired', label: 'Expired Accounts', icon: AlertCircle, color: 'text-rose-600' },
          { key: 'expire-3-days', label: 'Expiring in 3 Days', icon: Clock, color: 'text-amber-600' },
          { key: 'expire-7-days', label: 'Expiring in 7 Days', icon: Calendar, color: 'text-blue-600' },
          { key: 'active', label: 'Active Accounts', icon: CheckCircle2, color: 'text-emerald-600' },
          { key: 'all', label: 'All Accounts', icon: Users, color: 'text-slate-600' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as FilterType)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : tab.color}`} />
              <span>{tab.label}</span>
              {activeTab === tab.key && !isLoading && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white">
                  {customers.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Renewal Batch Parameters & Action Card */}
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-800/90 dark:via-slate-800/70 dark:to-indigo-950/40 p-5 rounded-2xl border border-blue-200/60 dark:border-slate-700/80 shadow-xs flex flex-wrap items-center justify-between gap-5">
        <div className="flex flex-wrap items-center gap-6">
          {/* Renewal Period */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Renewal Validity
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 6].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRenewalMonths(m)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    renewalMonths === m
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                  }`}
                >
                  {m} {m === 1 ? 'Month' : 'Months'}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-1.5 pt-2 sm:pt-0">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={sendSms}
                onChange={(e) => setSendSms(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <span className="flex items-center gap-1">
                <Send className="w-3.5 h-3.5 text-blue-500" />
                Send SMS Notification to Customers
              </span>
            </label>

            {isAdmin && (
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={renewAsReseller}
                  onChange={(e) => setRenewAsReseller(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                  Renew as Reseller (Debit reseller's balance)
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Amount Summary & Execution Button */}
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900/70 px-5 py-3 rounded-xl border border-blue-200/70 dark:border-slate-700 shadow-xs shrink-0">
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Selected <strong className="text-slate-900 dark:text-white">{selectedIds.size}</strong> accounts
            </p>
            <p className="text-lg font-black text-blue-600 dark:text-blue-400 tracking-tight">
              ৳{totalRenewalAmount.toLocaleString()}
            </p>
          </div>

          <button
            type="button"
            onClick={handleExecuteBulkRenew}
            disabled={selectedIds.size === 0 || isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Renew Selected
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table Filter & Search Controls */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by code, customer name, mobile, or username..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              Clear Selection ({selectedIds.size})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Select All Matching ({filteredCustomers.length})
          </button>
        </div>
      </div>

      {/* Account Selection Table */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">
                  <ModernCheckbox
                    checked={isAllCurrentPageSelected}
                    onChange={handleSelectAllCurrentPage}
                    ariaLabel="Select all current page accounts"
                  />
                </th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Package & Monthly Price</th>
                <th className="py-3 px-4">Current Expiry</th>
                <th className="py-3 px-4">New Projected Expiry</th>
                <th className="py-3 px-4 text-right">Renewal Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading accounts...
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
                    No customer accounts found for this criteria.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c: any) => {
                  const id = String(c.customer_id ?? c.customerId ?? '');
                  const isSelected = selectedIds.has(id);
                  const monthlyPrice = parseFloat(String(c.bill_amount || c.package_price || 0)) || 0;
                  const chargeCost = monthlyPrice * renewalMonths;
                  const currentExp = c.expiry_date || c.expiryDate;
                  const projectedExp = getProjectedExpiry(currentExp);

                  return (
                    <tr
                      key={id}
                      onClick={() => handleToggleSelect(id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/80 dark:bg-blue-900/20'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-700/30'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <ModernCheckbox
                          checked={isSelected}
                          onChange={() => handleToggleSelect(id)}
                          ariaLabel={`Select customer ${id}`}
                        />
                      </td>

                      {/* Customer Details */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{c.full_name || c.fullName || 'Unnamed'}</span>
                          {c.is_online ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="font-mono bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                            {c.customer_code || c.customerCode}
                          </span>
                          <span>•</span>
                          <span>{c.phone || c.mobile}</span>
                          {c.username && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{c.username}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Package & Price */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {c.package_name || c.packageName || 'Standard Plan'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          ৳{monthlyPrice.toLocaleString()}/mo
                        </div>
                      </td>

                      {/* Current Expiry */}
                      <td className="py-3 px-4">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {formatExpiryDisplay(currentExp)}
                        </div>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold mt-0.5 ${
                            c.billing_status === 'Expired' || (currentExp && new Date(currentExp) < new Date())
                              ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                              : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {c.billing_status || 'Active'}
                        </span>
                      </td>

                      {/* Projected Expiry */}
                      <td className="py-3 px-4">
                        <div className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <span>{projectedExp}</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            (+{renewalMonths}mo)
                          </span>
                        </div>
                      </td>

                      {/* Renewal Cost */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                        ৳{chargeCost.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Summary */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <div>
              Showing <strong className="text-slate-800 dark:text-slate-200">{paginatedCustomers.length}</strong> of{' '}
              <strong className="text-slate-800 dark:text-slate-200">{filteredCustomers.length}</strong> accounts
            </div>
            <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-slate-700">
              <span>Show:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <span className="px-2">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 disabled:opacity-40 transition-all"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
