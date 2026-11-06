import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  ShieldCheck,
  Save,
  Wallet,
  Percent,
  Search,
  CheckCircle2,
  XCircle,
  Server,
  Package,
  Layers,
  Sparkles,
  RotateCw,
  TrendingUp,
  Sliders,
  DollarSign,
  Info,
  Check,
} from 'lucide-react';
import { PageHeader } from '@/components/common';
import { resellerService, Reseller } from '@/services/reseller.service';
import { networkPackagesService } from '@/services/network-packages.service';
import { NetworkPackage, NetworkPackagesResponse } from '@/types/network.types';
import { useToastContext } from '@/contexts/ToastContext';

const formatCurrency = (n: number) =>
  `৳${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function PlanPermissionPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();

  const [user, setUser] = useState<Reseller | null>(null);
  const [packages, setPackages] = useState<NetworkPackage[]>([]);
  const [commissionPercent, setCommissionPercent] = useState<number>(0);
  const [sellPrices, setSellPrices] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'allowed' | 'restricted'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      resellerService.getOne(userId),
      networkPackagesService.list({ limit: 500 }),
      resellerService.getPlanPermissions(userId).catch(() => ({ items: [] })),
    ])
      .then(([u, pkgRes, permRes]) => {
        if (cancelled) return;
        setUser(u);

        const res = pkgRes as NetworkPackagesResponse & { data?: NetworkPackage[] };
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(pkgRes) ? (pkgRes as NetworkPackage[]) : [];
        setPackages(list);

        const items = permRes?.items ?? [];
        const permMap = new Map(
          items.map((i) => [
            i.packageId,
            { sellPrice: i.sellPrice, popProfit: i.popProfit ?? 0, popProfitPercent: i.popProfitPercent ?? 0, allowed: i.allowed },
          ]),
        );

        const initial: Record<string, number> = {};
        const selected = new Set<string>();

        list.forEach((p) => {
          const id = String(p?.id ?? '');
          if (!id) return;
          const saved = permMap.get(id);
          if (saved) {
            initial[id] = saved.sellPrice;
            if (saved.allowed) selected.add(id);
          } else {
            initial[id] = Number(p.price);
            selected.add(id);
          }
        });

        setSellPrices(initial);
        setSelectedIds(selected);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err?.message || 'Failed to load reseller plans');
          setUser(null);
          setPackages([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Bulk commission calculation
  const handleCalculate = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const pct = Math.max(0, Math.min(100, Number(commissionPercent) || 0));
    if (pct !== commissionPercent) setCommissionPercent(pct);

    const next: Record<string, number> = {};
    for (let i = 0; i < packages.length; i++) {
      const p = packages[i];
      const id = String(p?.id ?? '');
      if (!id) continue;
      const price = Number(p?.price);
      if (!Number.isFinite(price)) continue;
      const popProfit = Math.round(price * (pct / 100) * 100) / 100;
      const sellPrice = Math.round((price - popProfit) * 100) / 100;
      next[id] = sellPrice;
    }
    setSellPrices((prev) => ({ ...prev, ...next }));
    toast.success(`Applied ${pct}% commission to all packages`);
  };

  const handleSellPriceChange = (pkgId: string, value: number, maxPrice: number) => {
    const clamped = Math.max(0, Math.min(maxPrice, value));
    setSellPrices((prev) => ({ ...prev, [pkgId]: clamped }));
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(packages.map((p) => String(p?.id ?? '')).filter(Boolean)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleOne = (pkgId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pkgId)) next.delete(pkgId);
      else next.add(pkgId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!userId) return;
    const pct = Math.max(0, Math.min(100, commissionPercent));
    if (pct !== commissionPercent) setCommissionPercent(pct);
    setSaving(true);

    try {
      const items = packages.map((p) => {
        const id = String(p?.id ?? '');
        const sellPrice = sellPrices[id] ?? Number(p.price);
        const sell = Math.max(0, Math.min(Number(p.price), sellPrice));
        const popProfit = Math.round((Number(p.price) - sell) * 100) / 100;
        const popProfitPercent =
          Number(p.price) > 0 ? Math.round((popProfit / Number(p.price)) * 10000) / 100 : 0;
        return {
          packageId: id,
          sellPrice: Number(sell),
          popProfit: Number(popProfit),
          popProfitPercent: Math.min(100, Math.max(0, Number(popProfitPercent))),
          allowed: Boolean(selectedIds.has(id)),
        };
      });

      await resellerService.putPlanPermissions(userId, items);
      
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      await Swal.fire({
        icon: 'success',
        title: 'Permissions Saved',
        text: 'Package permissions and wholesale prices updated successfully.',
        timer: 1600,
        timerProgressBar: true,
        showConfirmButton: false,
        background: isDark ? '#1e293b' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        customClass: {
          popup: 'rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-2xl p-6',
          title: 'text-xl font-bold text-slate-900 dark:text-white pt-2',
          htmlContainer: 'text-sm text-slate-600 dark:text-slate-300 mt-1',
          timerProgressBar: 'bg-gradient-to-r from-blue-500 to-emerald-500',
        },
      });
      toast.success('Package permissions saved successfully');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Save failed';
      toast.error(typeof msg === 'string' ? msg : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Filtered packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const pkgId = String(pkg?.id ?? '');
      const isAllowed = selectedIds.has(pkgId);

      if (filterMode === 'allowed' && !isAllowed) return false;
      if (filterMode === 'restricted' && !isAllowed) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = pkg.name?.toLowerCase().includes(q);
        const serverMatch = pkg.serverName?.toLowerCase().includes(q);
        const protoMatch = pkg.protocol?.toLowerCase().includes(q);
        const codeMatch = pkg.packageCode?.toLowerCase().includes(q);
        return nameMatch || serverMatch || protoMatch || codeMatch;
      }
      return true;
    });
  }, [packages, selectedIds, filterMode, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = packages.length;
    const allowed = selectedIds.size;
    let totalMargin = 0;
    let allowedCount = 0;

    packages.forEach((p) => {
      const id = String(p?.id ?? '');
      if (selectedIds.has(id)) {
        const price = Number(p.price) || 0;
        const sell = sellPrices[id] ?? price;
        const profit = price - sell;
        if (price > 0) {
          totalMargin += (profit / price) * 100;
          allowedCount++;
        }
      }
    });

    const avgMargin = allowedCount > 0 ? (totalMargin / allowedCount).toFixed(1) : '0.0';
    return { total, allowed, avgMargin };
  }, [packages, selectedIds, sellPrices]);

  const allSelected = packages.length > 0 && selectedIds.size === packages.length;

  if (!userId) {
    return (
      <div className="w-full min-h-[400px] flex items-center justify-center p-6 text-slate-500">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
          <p className="font-semibold">Invalid or missing reseller ID</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full min-h-[450px] flex flex-col items-center justify-center p-6 text-slate-400">
        <RotateCw className="w-10 h-10 animate-spin text-blue-500 mb-3" />
        <p className="text-sm font-medium">Loading reseller plan permissions...</p>
      </div>
    );
  }

  const userName = user?.name?.trim() || 'Reseller';
  const userIdentifier =
    user?.email && !String(user.email).endsWith('@reseller.local')
      ? user.email
      : user?.username || '—';
  const userBalance = user?.balance ?? 0;
  const userRole = user?.role || 'reseller';

  return (
    <div className="w-full min-w-0 space-y-6 pb-20 relative">
      
      {/* Standard NetFix PageHeader */}
      <PageHeader
        backTo="/dashboard/reseller"
        icon={<ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Package Plan Permissions"
        subtitle={`Configure package assignments, custom sell prices, and POP profit margins for ${userName}`}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {selectedIds.size} of {packages.length} Plans Allowed
          </span>
        }
        actions={
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {saving ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Permissions
              </>
            )}
          </button>
        }
      />

      {/* Reseller Profile & Bulk Commission Control Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Left: User Overview */}
          <div className="lg:col-span-7 flex flex-wrap items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-blue-700 flex items-center justify-center text-white text-xl font-bold shadow-md shadow-blue-500/20 shrink-0">
              {userName.split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'RS'}
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {userName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                  {userRole}
                </span>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>
                  Username: <strong className="font-mono text-slate-800 dark:text-slate-200">{userIdentifier}</strong>
                </span>
                {user?.serverName && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Server className="w-3.5 h-3.5 text-slate-400" />
                      POP: <strong className="text-slate-800 dark:text-slate-200">{user.serverName}</strong>
                    </span>
                  </>
                )}
                {user?.phone && (
                  <>
                    <span>•</span>
                    <span>Phone: <strong className="text-slate-800 dark:text-slate-200">{user.phone}</strong></span>
                  </>
                )}
              </div>
            </div>

            {/* Wallet Balance Badge */}
            <div className="shrink-0 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 text-right">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                Current Wallet
              </div>
              <div className={`text-base font-bold font-mono inline-flex items-center gap-1.5 ${
                userBalance < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                <Wallet className="w-4 h-4" />
                {formatCurrency(userBalance)}
              </div>
            </div>
          </div>

          {/* Right: Bulk Commission Calculator */}
          <div className="lg:col-span-5 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-slate-900/80 dark:to-slate-900/40 border border-blue-100 dark:border-slate-700/80 rounded-2xl p-4 sm:p-4.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                <Percent className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Uniform Commission</span>
              </div>
              <span className="text-[11px] text-slate-400">Apply to all packages</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={commissionPercent}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    setCommissionPercent(Math.max(0, Math.min(100, v)));
                  }}
                  className="w-full pl-3 pr-8 py-2 text-sm font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="0"
                />
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                  %
                </span>
              </div>
              
              <button
                type="button"
                disabled={packages.length === 0}
                onClick={handleCalculate}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                Calculate
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Calculates sell price as <code className="font-mono text-slate-700 dark:text-slate-300">Price - (Price × Commission%)</code>
            </p>
          </div>

        </div>
      </div>

      {/* Overview Stat Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>Total Packages</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {stats.total}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Available network plans</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>Allowed Plans</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {stats.allowed}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {stats.total > 0 ? `${Math.round((stats.allowed / stats.total) * 100)}% of total` : '0%'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>Restricted Plans</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {stats.total - stats.allowed}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Hidden from reseller</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>Average Margin</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
            {stats.avgMargin}%
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">POP profit margin rate</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-xs overflow-hidden">
        
        {/* Table Controls Header: Search & Filter Tabs */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by package name, server, or protocol..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Filter Pills & Select All */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  filterMode === 'all'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All ({packages.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('allowed')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  filterMode === 'allowed'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Allowed ({selectedIds.size})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('restricted')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  filterMode === 'restricted'
                    ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Restricted ({packages.length - selectedIds.size})
              </button>
            </div>

            <button
              type="button"
              onClick={() => toggleAll(!allSelected)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
            >
              {allSelected ? <XCircle className="w-3.5 h-3.5 text-rose-500" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>

        </div>

        {/* Tip / Notice Callout */}
        <div className="px-5 py-2.5 bg-blue-50/60 dark:bg-blue-950/20 border-b border-blue-100/60 dark:border-blue-900/30 flex items-center justify-between gap-3 text-xs text-blue-700 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span>
              <strong>Sell Price</strong> is the wholesale cost billed to the reseller. The difference between Retail and Sell Price is allocated as <strong>POP Profit</strong>.
            </span>
          </div>
          <span className="hidden sm:inline font-mono text-[11px] text-blue-500">
            Auto-calculated: POP.Profit = Retail - Sell
          </span>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Package Plan</th>
                <th className="py-3 px-4">Server / POP</th>
                <th className="py-3 px-4">Protocol</th>
                <th className="py-3 px-4 text-right">Retail (MRP)</th>
                <th className="py-3 px-4 text-right">Reseller Sell Price</th>
                <th className="py-3 px-4 text-right">POP Profit</th>
                <th className="py-3 px-4 text-center">Profit %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredPackages.map((pkg) => {
                const pkgId = String(pkg?.id ?? '');
                const price = Number(pkg.price) || 0;
                const sell = sellPrices[pkgId] ?? price;
                const popProfit = Math.round((price - sell) * 100) / 100;
                const popProfitPercent = price > 0 ? Math.round((popProfit / price) * 10000) / 100 : 0;
                const isSelected = selectedIds.has(pkgId);

                return (
                  <tr
                    key={pkgId}
                    className={`transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/30 ${
                      !isSelected ? 'opacity-60 bg-slate-50/30 dark:bg-slate-900/20' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(pkgId)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>

                    {/* Package Name */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {pkg.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {pkg.packageCode || `ID: ${pkgId}`}
                      </div>
                    </td>

                    {/* Server */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <Server className="w-3 h-3 text-slate-400" />
                        {pkg.serverName || 'All Routers'}
                      </span>
                    </td>

                    {/* Protocol */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
                        pkg.protocol?.toLowerCase() === 'pppoe'
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {pkg.protocol || 'PPPoE'}
                      </span>
                    </td>

                    {/* Retail MRP Price */}
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(price)}
                    </td>

                    {/* Reseller Sell Price Input */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center relative">
                        <span className="absolute left-2.5 text-xs text-slate-400 font-semibold pointer-events-none">
                          ৳
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={price}
                          step={0.01}
                          value={sellPrices[pkgId] ?? sell}
                          onChange={(e) =>
                            handleSellPriceChange(pkgId, Number(e.target.value) || 0, price)
                          }
                          className="w-24 pl-6 pr-2 py-1 text-right text-xs sm:text-sm font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    </td>

                    {/* POP Profit */}
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span className={popProfit > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}>
                        {formatCurrency(popProfit)}
                      </span>
                    </td>

                    {/* POP Profit % */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                        popProfitPercent > 0
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {popProfitPercent.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {filteredPackages.length === 0 && (
          <div className="py-12 px-4 text-center text-slate-500 dark:text-slate-400 text-sm">
            <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">No package plans match your search or filter</p>
            <p className="text-xs text-slate-400 mt-0.5">Try clearing the search query or switching to All packages.</p>
          </div>
        )}

        {/* Table Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <strong>{filteredPackages.length}</strong> of <strong>{packages.length}</strong> total packages
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard/reseller')}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" /> Saving Permissions...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Permissions
                </>
              )}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
