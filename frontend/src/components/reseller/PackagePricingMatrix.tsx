import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Save,
  Percent,
  TrendingUp,
  Package,
  Layers,
  Info,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import {
  resellerService,
  PricingMatrixPackage,
} from '@/services/reseller.service';
import { useToastContext } from '@/contexts/ToastContext';

interface PackagePricingMatrixProps {
  childUserId: string | number;
  childName?: string;
  childRole?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const PackagePricingMatrix: React.FC<PackagePricingMatrixProps> = ({
  childUserId,
  childName = 'Downline User',
  childRole = 'Reseller',
  onSuccess,
  onCancel,
}) => {
  const toast = useToastContext();
  const [packages, setPackages] = useState<PricingMatrixPackage[]>([]);
  const [commissions, setCommissions] = useState<Record<number, number>>({});
  const [allowedMap, setAllowedMap] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkCommission, setBulkCommission] = useState<number>(10);

  const formatCurrency = (n: number) =>
    `৳${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const loadMatrix = async () => {
    try {
      setLoading(true);
      const res = await resellerService.getPricingMatrix(childUserId);
      const list = res.packages || [];
      setPackages(list);

      const initialComms: Record<number, number> = {};
      const initialAllowed: Record<number, boolean> = {};

      list.forEach((p) => {
        initialComms[p.package_id] = p.commission_rate ?? 0;
        initialAllowed[p.package_id] = p.is_allowed ?? true;
      });

      setCommissions(initialComms);
      setAllowedMap(initialAllowed);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load pricing matrix');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (childUserId) {
      loadMatrix();
    }
  }, [childUserId]);

  // Compute calculated metrics per package
  const rows = useMemo(() => {
    return packages.map((pkg) => {
      const comm = commissions[pkg.package_id] ?? pkg.commission_rate ?? 0;
      const retail = pkg.retail_price;
      const parentFloor = pkg.parent_cost_floor;
      const childCost = Math.round((retail - (retail * (comm / 100))) * 100) / 100;
      const childProfit = Math.round((retail - childCost) * 100) / 100;
      const upstreamMargin = Math.round((childCost - parentFloor) * 100) / 100;
      const isAllowed = allowedMap[pkg.package_id] ?? true;

      // Strict price floor rule: Child cost CANNOT be lower than Parent cost floor
      const isFloorViolation = childCost < parentFloor;

      return {
        ...pkg,
        comm,
        childCost,
        childProfit,
        upstreamMargin,
        isAllowed,
        isFloorViolation,
      };
    });
  }, [packages, commissions, allowedMap]);

  // Check if any package has a price floor violation
  const hasFloorViolations = useMemo(() => {
    return rows.some((r) => r.isAllowed && r.isFloorViolation);
  }, [rows]);

  const handleApplyBulk = () => {
    const updated: Record<number, number> = {};
    packages.forEach((pkg) => {
      // Clamp to max allowed commission if greater
      const safeComm = Math.min(bulkCommission, pkg.max_allowed_commission);
      updated[pkg.package_id] = safeComm;
    });
    setCommissions(updated);
    toast.info(`Applied commission (clamped to each package's parent floor).`);
  };

  const handleSaveAll = async () => {
    if (hasFloorViolations) {
      toast.error('Cannot save: One or more packages violate the parent cost price floor.');
      return;
    }

    try {
      setSaving(true);
      for (const row of rows) {
        await resellerService.assignPackage({
          child_user_id: childUserId,
          package_id: row.package_id,
          commission_rate: row.comm,
          cost_price: row.childCost,
          is_allowed: row.isAllowed,
        });
      }
      toast.success('Cascading pricing matrix saved successfully.');
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save pricing matrix');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400">
        <RotateCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
        <p className="text-sm font-medium">Loading pricing matrix and parent price floors...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/60 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {childName}
            </span>
            <span className="text-xs uppercase px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
              {childRole}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure wholesale prices and commission rates. Enforces strict floor rule: Child Cost Price ≥ Parent Cost Floor.
          </p>
        </div>

        {/* Quick Bulk Commission Bar */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Bulk Commission:</span>
          <div className="relative w-20">
            <input
              type="number"
              min="0"
              max="100"
              value={bulkCommission}
              onChange={(e) => setBulkCommission(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-full px-2 py-1 pr-6 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold"
            />
            <Percent className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={handleApplyBulk}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Violation Alert Banner */}
      {hasFloorViolations && (
        <div className="p-4 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900/80 flex items-start gap-3 text-rose-800 dark:text-rose-200">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold">Price Floor Rule Violation Detected</h4>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
              One or more packages have a calculated buy cost lower than the parent tier's cost floor.
              Lower tiers cannot be sold below parent purchase costs. Adjust commission rates to proceed.
            </p>
          </div>
        </div>
      )}

      {/* Pricing Matrix Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Package</th>
                <th className="py-3 px-3 text-right">Retail Price</th>
                <th className="py-3 px-3 text-right text-blue-600 dark:text-blue-400">Parent Cost Floor</th>
                <th className="py-3 px-4 text-center">Child Commission %</th>
                <th className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">Child Buy Cost</th>
                <th className="py-3 px-3 text-right text-amber-600 dark:text-amber-400">Upstream Margin</th>
                <th className="py-3 px-3 text-center">Floor Compliance</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => (
                <tr
                  key={row.package_id}
                  className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                    row.isFloorViolation ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                  }`}
                >
                  {/* Package Name */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                      {row.package_name}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Max Comm: {row.max_allowed_commission}%
                    </div>
                  </td>

                  {/* Retail Price */}
                  <td className="py-3.5 px-3 text-right font-medium text-slate-700 dark:text-slate-200">
                    {formatCurrency(row.retail_price)}
                  </td>

                  {/* Parent Cost Floor */}
                  <td className="py-3.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(row.parent_cost_floor)}
                  </td>

                  {/* Commission Input */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex items-center gap-1.5 justify-center">
                      <input
                        type="number"
                        min="0"
                        max={row.max_allowed_commission}
                        step="0.5"
                        value={row.comm}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCommissions((prev) => ({
                            ...prev,
                            [row.package_id]: val,
                          }));
                        }}
                        className={`w-20 px-2 py-1 text-center text-xs font-bold rounded border ${
                          row.isFloorViolation
                            ? 'border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                        } outline-none focus:ring-2 focus:ring-blue-500/20`}
                      />
                      <span className="text-slate-400 font-semibold">%</span>
                    </div>
                  </td>

                  {/* Child Cost Price */}
                  <td className="py-3.5 px-3 text-right">
                    <span
                      className={`font-extrabold text-sm ${
                        row.isFloorViolation
                          ? 'text-rose-600 dark:text-rose-400 underline decoration-wavy'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatCurrency(row.childCost)}
                    </span>
                    <div className="text-[10px] text-slate-400">
                      Margin: {formatCurrency(row.childProfit)}
                    </div>
                  </td>

                  {/* Upstream Margin (Parent's profit) */}
                  <td className="py-3.5 px-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                    +{formatCurrency(row.upstreamMargin)}
                  </td>

                  {/* Floor Compliance Indicator */}
                  <td className="py-3.5 px-3 text-center">
                    {row.isFloorViolation ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <AlertTriangle className="w-3 h-3" /> Below Floor
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> Valid
                      </span>
                    )}
                  </td>

                  {/* Allowed Toggle */}
                  <td className="py-3.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        setAllowedMap((prev) => ({
                          ...prev,
                          [row.package_id]: !row.isAllowed,
                        }))
                      }
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        row.isAllowed
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {row.isAllowed ? 'Allowed' : 'Disabled'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span>Prices are validated on the backend inside ACID transactions. Never trusts client calculations.</span>
          </div>

          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || hasFloorViolations}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white shadow-sm transition-colors"
            >
              {saving ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" /> Saving Matrix...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Save Pricing Matrix
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

