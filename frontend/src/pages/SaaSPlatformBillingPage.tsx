import { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Receipt,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  Calendar,
  CreditCard,
  Search,
  Filter,
  DollarSign,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Send,
  HelpCircle,
} from 'lucide-react';
import {
  saasBillingService,
  SaaSPlatformBillingOverview,
  ISPSubscriptionItem,
  SaaSInvoiceItem,
} from '@/services/saas-billing.service';
import { useToastContext } from '@/contexts/ToastContext';
import PageHeader from '@/components/common/PageHeader';

type FilterTab = 'all' | 'paid' | 'due' | 'trial' | 'suspended';

export default function SaaSPlatformBillingPage() {
  const toast = useToastContext();

  const [data, setData] = useState<SaaSPlatformBillingOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Record Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<ISPSubscriptionItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('bkash');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Extend Trial Modal
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [trialDays, setTrialDays] = useState<number>(14);
  const [isSubmittingTrial, setIsSubmittingTrial] = useState(false);

  // Generate Invoice Modal
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState<number>(0);
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>('');
  const [invoiceNotes, setInvoiceNotes] = useState<string>('');
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);

  const loadBillingData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await saasBillingService.getBillingOverview();
      if (res && res.success) {
        setData(res);
      }
    } catch (err: any) {
      console.error('Failed to load billing overview:', err);
      const msg = err.response?.data?.message || 'Service temporarily unavailable. Please try again later.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, []);

  const metrics = data?.metrics || {
    mrr: 0,
    totalCollected: 0,
    totalDue: 0,
    totalTenants: 0,
    paidCount: 0,
    dueCount: 0,
    trialCount: 0,
  };

  const subscriptions = data?.ispSubscriptions || [];
  const invoices = data?.invoices || [];

  // Filtered Subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((item) => {
      // Tab filter
      if (activeTab === 'paid' && item.billingStatus !== 'paid') return false;
      if (activeTab === 'due' && item.billingStatus !== 'due') return false;
      if (activeTab === 'trial' && !item.isTrial) return false;
      if (activeTab === 'suspended' && item.tenantStatus !== 'suspended') return false;

      // Text search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.tenantName?.toLowerCase().includes(q) ||
        item.tenantCode?.toLowerCase().includes(q) ||
        item.businessEmail?.toLowerCase().includes(q) ||
        item.package?.name?.toLowerCase().includes(q)
      );
    });
  }, [subscriptions, activeTab, searchQuery]);

  // Handle Open Record Payment
  const handleOpenPayment = (sub: ISPSubscriptionItem) => {
    setSelectedTenant(sub);
    setPaymentAmount(sub.balanceDue > 0 ? sub.balanceDue : sub.package?.price || 3500);
    setPaymentMethod('bkash');
    setTransactionRef('');
    setPaymentNotes(`Monthly subscription renewal for ${sub.tenantName}`);
    setIsPaymentModalOpen(true);
  };

  // Submit Payment
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant || paymentAmount <= 0) {
      toast.error('Invalid payment amount');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await saasBillingService.recordPayment({
        tenantId: selectedTenant.tenantId,
        amount: paymentAmount,
        paymentMethod,
        transactionRef: transactionRef.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      toast.success(`Payment of ৳${paymentAmount.toLocaleString()} recorded for ${selectedTenant.tenantName}`);
      setIsPaymentModalOpen(false);
      loadBillingData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Handle Open Extend Trial
  const handleOpenTrial = (sub: ISPSubscriptionItem) => {
    setSelectedTenant(sub);
    setTrialDays(14);
    setIsTrialModalOpen(true);
  };

  // Submit Extend Trial
  const handleConfirmTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    setIsSubmittingTrial(true);
    try {
      await saasBillingService.extendTrial(selectedTenant.tenantId, trialDays);
      toast.success(`Free trial for ${selectedTenant.tenantName} extended by ${trialDays} days`);
      setIsTrialModalOpen(false);
      loadBillingData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to extend trial');
    } finally {
      setIsSubmittingTrial(false);
    }
  };

  // Handle Open Generate Invoice
  const handleOpenInvoice = (sub?: ISPSubscriptionItem) => {
    if (sub) {
      setSelectedTenant(sub);
      setInvoiceAmount(sub.package?.price || 3500);
    } else {
      setSelectedTenant(subscriptions[0] || null);
      setInvoiceAmount(subscriptions[0]?.package?.price || 3500);
    }
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 10);
    setInvoiceDueDate(defaultDue.toISOString().split('T')[0]);
    setInvoiceNotes('Platform subscription licensing and support fee');
    setIsInvoiceModalOpen(true);
  };

  // Submit Invoice
  const handleConfirmInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant || invoiceAmount <= 0) {
      toast.error('Please select an ISP and valid invoice amount');
      return;
    }

    setIsSubmittingInvoice(true);
    try {
      const res = await saasBillingService.generateInvoice({
        tenantId: selectedTenant.tenantId,
        amount: invoiceAmount,
        dueDate: invoiceDueDate,
        notes: invoiceNotes.trim() || undefined,
      });
      toast.success(`Invoice ${res.invoiceNo} generated for ${selectedTenant.tenantName}`);
      setIsInvoiceModalOpen(false);
      loadBillingData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate invoice');
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6 pb-12">
      {/* Page Header conforming to NetFix GEMINI.md design standards */}
      <PageHeader
        icon={<Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Platform Subscriptions & Billing"
        subtitle="Manage SaaS revenue, track paid ISPs, outstanding dues, free trials, and subscription invoices"
        badge="SaaS Super Admin"
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => loadBillingData(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold transition-all shadow-2xs active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => handleOpenInvoice()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Generate Invoice</span>
            </button>
          </div>
        }
      />

      {/* Error alert banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between text-rose-700 dark:text-rose-300 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadBillingData()}
            className="px-3 py-1 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded-lg text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Financial & Billing KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  <CreditCard className="w-3.5 h-3.5" />
                </span>
                Monthly Recurring Revenue
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
                MRR
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              ৳{isLoading ? '...' : metrics.mrr.toLocaleString()}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            Active recurring ISP contracts
          </p>
        </div>

        {/* Total Collected (Paid) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
                Total Collected (Paid)
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                {metrics.paidCount} Paid
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              ৳{isLoading ? '...' : metrics.totalCollected.toLocaleString()}
            </div>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Verified platform collections
          </p>
        </div>

        {/* Total Outstanding Due */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                </span>
                Outstanding Balance Due
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400">
                {metrics.dueCount} Pending
              </span>
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              ৳{isLoading ? '...' : metrics.totalDue.toLocaleString()}
            </div>
          </div>
          <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-2 font-medium">
            Awaiting ISP subscription clearance
          </p>
        </div>

        {/* Free Trial Accounts */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5">
                <span className="p-1 rounded-lg bg-cyan-50 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                Free Trial Accounts
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-400">
                Evaluating
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {isLoading ? '...' : metrics.trialCount} ISPs
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            Trial period active (No bill due)
          </p>
        </div>
      </div>

      {/* Main ISP Subscription Directory Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Table Header with Filter Tabs & Search */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                ISP Subscription & Billing Ledger
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live payment reconciliation: Paid status, due balances, and trial validity tracking
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tenant or plan..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 font-medium"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 flex-wrap">
            {[
              { id: 'all', label: 'All Tenants', count: subscriptions.length },
              { id: 'paid', label: '✅ Paid / Active', count: metrics.paidCount },
              { id: 'due', label: '⚠️ Has Dues', count: metrics.dueCount },
              { id: 'trial', label: '🎁 Free Trial', count: metrics.trialCount },
              { id: 'suspended', label: '⛔ Suspended', count: subscriptions.filter((s) => s.tenantStatus === 'suspended').length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as FilterTab)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold">Loading subscription records...</p>
            </div>
          ) : filteredSubscriptions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Building2 className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No subscriptions matched your query</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">ISP Tenant</th>
                  <th className="px-4 py-3">Assigned SaaS Plan</th>
                  <th className="px-4 py-3">Subscription Status</th>
                  <th className="px-4 py-3">Balance Due</th>
                  <th className="px-4 py-3">Total Paid</th>
                  <th className="px-4 py-3">Last Payment</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 bg-white dark:bg-slate-900">
                {filteredSubscriptions.map((sub) => {
                  const isPaid = sub.billingStatus === 'paid';
                  const isDue = sub.billingStatus === 'due';
                  const isTrial = sub.isTrial;

                  return (
                    <tr key={sub.tenantId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Tenant Identity */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{sub.tenantName}</div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {sub.tenantCode} · {sub.businessEmail}
                        </div>
                      </td>

                      {/* Package */}
                      <td className="px-4 py-3">
                        {sub.package ? (
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100 block">
                              {sub.package.name}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              ৳{sub.package.price.toLocaleString()}/mo · {sub.package.limits.maxCustomers} subs
                            </span>
                          </div>
                        ) : (
                          <span className="text-amber-500 font-medium">No Plan Assigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {isTrial ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                            <Sparkles className="w-3 h-3 text-cyan-500" />
                            Free Trial ({sub.trialDaysLeft} days left)
                          </span>
                        ) : isDue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <AlertCircle className="w-3 h-3 text-rose-500" />
                            Due (Unpaid)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Active (Paid)
                          </span>
                        )}
                      </td>

                      {/* Balance Due */}
                      <td className="px-4 py-3">
                        {sub.balanceDue > 0 ? (
                          <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                            ৳{sub.balanceDue.toLocaleString()}
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            ৳0.00
                          </span>
                        )}
                      </td>

                      {/* Total Paid */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        ৳{sub.totalPaid.toLocaleString()}
                      </td>

                      {/* Last Payment */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {sub.lastPaymentDate ? sub.lastPaymentDate.split(' ')[0] : 'Never'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {sub.balanceDue > 0 ? (
                            <button
                              onClick={() => handleOpenPayment(sub)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all active:scale-95 shadow-2xs"
                              title="Clear outstanding balance"
                            >
                              Record Payment
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenPayment(sub)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] transition-colors"
                            >
                              Renew
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenTrial(sub)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-600 hover:text-white text-[11px] font-semibold transition-colors"
                            title="Extend free evaluation trial"
                          >
                            Trial
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Subscription Invoices History Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Platform Subscription Invoices History
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Historical ledger of generated invoices, payment dates, and payment methods
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Total {invoices.length} Invoices
          </span>
        </div>

        <div className="overflow-x-auto">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">
              No platform invoices generated yet
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Invoice No</th>
                  <th className="px-4 py-3">ISP Tenant</th>
                  <th className="px-4 py-3">Plan Description</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Paid Amount</th>
                  <th className="px-4 py-3">Balance Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Paid Date / Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 bg-white dark:bg-slate-900">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {inv.invoiceNo}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">{inv.tenantName}</span>
                      <span className="font-mono text-[10px] text-slate-400">{inv.tenantCode}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                      {inv.packageName}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      ৳{inv.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ৳{inv.paidAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold">
                      {inv.balanceDue > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400">৳{inv.balanceDue.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-400">৳0.00</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}
                      >
                        {inv.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{inv.dueDate}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {inv.paidAt ? (
                        <div>
                          <span className="text-emerald-600 block">{inv.paidAt.split(' ')[0]}</span>
                          <span className="text-[10px] text-slate-400 uppercase">{inv.paymentMethod || 'Online'}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Unsettled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL 1: Record Subscription Payment */}
      {isPaymentModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Record Subscription Payment
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Record collection for <strong>{selectedTenant.tenantName}</strong> ({selectedTenant.tenantCode})
              </p>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Collection Amount (BDT) *
                </label>
                <input
                  type="number"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-slate-100"
                />
                {selectedTenant.balanceDue > 0 && (
                  <p className="text-[11px] text-rose-500 font-medium mt-1">
                    Current outstanding due: ৳{selectedTenant.balanceDue.toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-medium"
                >
                  <option value="bkash">bKash Merchant</option>
                  <option value="nagad">Nagad Online</option>
                  <option value="bank_transfer">Bank Wire / Deposit</option>
                  <option value="cash">Direct Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Transaction Reference / TrxID
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="e.g. TRX-BKASH-892102"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Notes
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Payment remarks"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingPayment ? 'Processing...' : 'Confirm & Mark Paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Extend Free Trial */}
      {isTrialModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-500" />
                Grant or Extend Free Trial
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Set evaluation period for <strong>{selectedTenant.tenantName}</strong>
              </p>
            </div>

            <form onSubmit={handleConfirmTrial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Trial Extension Period
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setTrialDays(days)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        trialDays === days
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      +{days} Days
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Or Custom Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTrialModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTrial}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingTrial ? 'Applying...' : 'Extend Free Trial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Generate Invoice */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600" />
                Generate Subscription Invoice
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Issue a platform subscription bill to an ISP
              </p>
            </div>

            <form onSubmit={handleConfirmInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target ISP Tenant *
                </label>
                <select
                  value={selectedTenant?.tenantId || ''}
                  onChange={(e) => {
                    const found = subscriptions.find((s) => s.tenantId === e.target.value);
                    if (found) {
                      setSelectedTenant(found);
                      setInvoiceAmount(found.package?.price || 3500);
                    }
                  }}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-medium"
                >
                  {subscriptions.map((s) => (
                    <option key={s.tenantId} value={s.tenantId}>
                      {s.tenantName} ({s.tenantCode}) — Plan: {s.package?.name || 'Standard'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Invoice Amount (BDT) *
                </label>
                <input
                  type="number"
                  required
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(Number(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Payment Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Invoice Notes / Remarks
                </label>
                <input
                  type="text"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="Platform subscription fee"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvoice}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingInvoice ? 'Generating...' : 'Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

