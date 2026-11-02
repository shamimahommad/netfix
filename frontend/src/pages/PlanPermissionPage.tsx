import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { resellerService, Reseller } from '@/services/reseller.service';
import { networkPackagesService } from '@/services/network-packages.service';
import { NetworkPackage, NetworkPackagesResponse } from '@/types/network.types';
import { useToastContext } from '@/contexts/ToastContext';

const formatCurrency = (n: number) =>
  `৳${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function SaveIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

export default function PlanPermissionPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();
  const [user, setUser] = useState<Reseller | null>(null);
  const [packages, setPackages] = useState<NetworkPackage[]>([]);
  const [commissionPercent, setCommissionPercent] = useState(0);
  const [sellPrices, setSellPrices] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
          toast.error(err?.message || 'Failed to load');
          setUser(null);
          setPackages([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when userId changes; toast ref would re-run and reset sellPrices after Calculate
  }, [userId]);

  const handleCalculate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    toast.success('Commission applied to all packages');
  };

  const handleSellPriceChange = (pkgId: string, value: number, maxPrice: number) => {
    const clamped = Math.max(0, Math.min(maxPrice, value));
    setSellPrices((prev) => ({ ...prev, [pkgId]: clamped }));
  };

  const toggleAll = (checked: boolean) => {
    if (checked)
      setSelectedIds(new Set(packages.map((p) => String(p?.id ?? '')).filter(Boolean)));
    else setSelectedIds(new Set());
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
        const popProfitPercent = Number(p.price) > 0
          ? Math.round((popProfit / Number(p.price)) * 10000) / 100
          : 0;
        return {
          packageId: id,
          sellPrice: Number(sell),
          popProfit: Number(popProfit),
          popProfitPercent: Math.min(100, Math.max(0, Number(popProfitPercent))),
          allowed: Boolean(selectedIds.has(id)),
        };
      });
      await resellerService.putPlanPermissions(userId, items);
      await Swal.fire({
        icon: 'success',
        title: 'Saved',
        text: 'Plan permissions saved successfully.',
        timer: 1500,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Save failed';
      toast.error(typeof msg === 'string' ? msg : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const allSelected = packages.length > 0 && selectedIds.size === packages.length;

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 flex items-center justify-center">
        <p className="text-slate-600 dark:text-slate-400">Invalid user</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const userName = user?.name?.trim() || '—';
  const userLabel = user?.email && !String(user.email).endsWith('@reseller.local')
    ? user.email
    : (user?.username || '—');
  const userBalance = user?.balance ?? 0;

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

        {/* Main card — sky/teal header like modals */}
        <div className="bg-white dark:bg-slate-800/95 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-50 to-teal-50/80 dark:from-sky-950/50 dark:to-teal-950/40 px-5 py-4 border-b border-sky-100/80 dark:border-slate-700/80">
            <h1 className="text-lg font-bold text-slate-800 dark:text-white">Package Plan Permission List</h1>
          </div>

          <div className="p-5 space-y-4">
            {/* Selected user info — one compact row */}
            <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60">
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Selected user</div>
                <div className="text-base font-bold text-slate-900 dark:text-white">{userName}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{userLabel}</div>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-600" />
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">User&apos;s current balance</div>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold ${
                userBalance < 0 ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
              }`}>
                  <WalletIcon />
                  {formatCurrency(userBalance)}
                </div>
              </div>
              <div className="ml-auto flex items-end gap-2">
                <div className="text-right">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Commission %</div>
                  <div className="flex items-center gap-2">
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
                      className="w-16 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-slate-900 dark:text-white text-center text-sm focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400"
                    />
                    <span className="text-slate-500 text-sm">%</span>
                    <button
                      type="button"
                      tabIndex={0}
                      disabled={packages.length === 0}
                      onClick={handleCalculate}
                      className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors cursor-pointer"
                    >
                      Calculate
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Alert */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200/80 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-sm">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Contact with support team for custom commission rate!</span>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                      <th className="p-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 w-11">
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => toggleAll(e.target.checked)}
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                          />
                          All
                        </label>
                      </th>
                      <th className="p-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Server</th>
                      <th className="p-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Protocol</th>
                      <th className="p-2.5 text-left font-semibold text-slate-700 dark:text-slate-300">Name</th>
                      <th className="p-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">Price</th>
                      <th className="p-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">SellPrice</th>
                      <th className="p-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">POP.Profit</th>
                      <th className="p-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">POP.Profit%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => {
                      const pkgId = String(pkg?.id ?? '');
                      const price = Number(pkg.price);
                      const sell = sellPrices[pkgId] ?? price;
                      const popProfit = Math.round((price - sell) * 100) / 100;
                      const popProfitPercent = price > 0 ? Math.round((popProfit / price) * 10000) / 100 : 0;
                      const isSelected = selectedIds.has(pkgId);
                      return (
                        <tr
                          key={pkgId}
                          className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/20"
                        >
                          <td className="p-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOne(pkgId)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                            />
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">{pkg.serverName || '—'}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">{pkg.protocol}</td>
                          <td className="p-2.5 font-medium text-slate-900 dark:text-white">{pkg.name}</td>
                          <td className="p-2.5 text-right text-slate-700 dark:text-slate-300">{pkg.price}</td>
                          <td className="p-2.5 text-right">
                            <input
                              type="number"
                              min={0}
                              max={price}
                              step={0.01}
                              value={sellPrices[pkgId] ?? sell}
                              onChange={(e) =>
                                handleSellPriceChange(pkgId, Number(e.target.value) || 0, price)
                              }
                              className="w-20 text-right rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400"
                            />
                          </td>
                          <td className="p-2.5 text-right font-medium text-slate-900 dark:text-white">
                            {popProfit.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-medium text-teal-600 dark:text-teal-400">
                            {popProfitPercent.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {packages.length === 0 && (
                <div className="py-10 px-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                  No package plans found. Create packages in <strong>Network → Packages</strong> first, then return here to set permissions and sell prices.
                </div>
              )}
            </div>

            {/* Save */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 shadow-lg shadow-sky-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Save
                  </>
                ) : (
                  <>
                    <SaveIcon /> Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
