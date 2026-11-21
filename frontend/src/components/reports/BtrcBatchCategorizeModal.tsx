import React, { useState } from 'react';
import { X, Tag, Loader2, CheckCircle2 } from 'lucide-react';
import { btrcService } from '@/services/btrc.service';
import { useToastContext } from '@/contexts/ToastContext';

interface BtrcBatchCategorizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void;
}

export default function BtrcBatchCategorizeModal({
  isOpen,
  onClose,
  selectedIds,
  onSuccess,
}: BtrcBatchCategorizeModalProps) {
  const toast = useToastContext();
  const [saving, setSaving] = useState(false);
  const [clientType, setClientType] = useState<'Home' | 'Corporate' | 'SME'>('Home');
  const [connectivityType, setConnectivityType] = useState<'Shared' | 'Dedicated'>('Shared');
  const [connectionType, setConnectionType] = useState<'Wired' | 'Wireless'>('Wired');
  const [distributionPoint, setDistributionPoint] = useState('');
  const [thana, setThana] = useState('');
  const [district, setDistrict] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIds.length) {
      toast.error('No customers selected.');
      return;
    }

    setSaving(true);
    try {
      const res = await btrcService.bulkCategorize({
        customer_ids: selectedIds,
        client_type: clientType,
        connectivity_type: connectivityType,
        connection_type: connectionType,
        distribution_point: distributionPoint.trim() || undefined,
        thana: thana.trim() || undefined,
        district: district.trim() || undefined,
      });
      toast.success(res.message || 'Customers updated successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update customer categories.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Batch Categorize ({selectedIds.length} Clients)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Assign BTRC client type and connectivity parameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Client Type (client_type) *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setClientType('Home')}
                className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                  clientType === 'Home'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20 font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                🏠 Home
              </button>
              <button
                type="button"
                onClick={() => setClientType('Corporate')}
                className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                  clientType === 'Corporate'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20 font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                🏢 Corporate
              </button>
              <button
                type="button"
                onClick={() => setClientType('SME')}
                className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                  clientType === 'SME'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20 font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                🏬 SME
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Connectivity Type
              </label>
              <select
                value={connectivityType}
                onChange={(e) => setConnectivityType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Shared">Shared</option>
                <option value="Dedicated">Dedicated</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Connection Type
              </label>
              <select
                value={connectionType}
                onChange={(e) => setConnectionType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Wired">Wired</option>
                <option value="Wireless">Wireless</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Thana (Optional)
              </label>
              <input
                type="text"
                value={thana}
                onChange={(e) => setThana(e.target.value)}
                placeholder="Leave blank to keep"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                District (Optional)
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Leave blank to keep"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Apply Category ({selectedIds.length})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
