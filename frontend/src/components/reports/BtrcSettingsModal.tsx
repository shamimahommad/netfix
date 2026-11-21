import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Save, Loader2, Info } from 'lucide-react';
import { BtrcSettings, btrcService } from '@/services/btrc.service';
import { useToastContext } from '@/contexts/ToastContext';

interface BtrcSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: BtrcSettings | null;
  onSaved: () => void;
}

export default function BtrcSettingsModal({
  isOpen,
  onClose,
  currentSettings,
  onSaved,
}: BtrcSettingsModalProps) {
  const toast = useToastContext();
  const [saving, setSaving] = useState(false);

  const [division, setDivision] = useState('Rajshahi');
  const [district, setDistrict] = useState('Bogura');
  const [thana, setThana] = useState('Shariakandi');
  const [distributionPoint, setDistributionPoint] = useState('NOC');
  const [vatPercentage, setVatPercentage] = useState('5.0');

  useEffect(() => {
    if (currentSettings) {
      setDivision(currentSettings.division || 'Rajshahi');
      setDistrict(currentSettings.district || 'Bogura');
      setThana(currentSettings.thana || 'Shariakandi');
      setDistributionPoint(currentSettings.distribution_point || 'NOC');
      setVatPercentage(String(currentSettings.vat_percentage ?? 5.0));
    }
  }, [currentSettings, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await btrcService.updateSettings({
        btrc_default_division: division.trim(),
        btrc_default_district: district.trim(),
        btrc_default_thana: thana.trim(),
        btrc_distribution_point: distributionPoint.trim() || 'NOC',
        btrc_vat_percentage: parseFloat(vatPercentage) || 5.0,
      });
      toast.success('BTRC settings saved successfully.');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                BTRC Report Default Parameters
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure default Division, District, Thana &amp; VAT for BTRC report
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
              These values populate the official 15-column BTRC Excel export. In Bangladesh, ISP Internet bill includes 5% VAT (e.g. 500 BDT bill excluding 5% VAT is calculated as 476 BDT).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Bandwidth Distribution Point *
              </label>
              <input
                type="text"
                required
                value={distributionPoint}
                onChange={(e) => setDistributionPoint(e.target.value)}
                placeholder="e.g. NOC"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                VAT Percentage (%) *
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={vatPercentage}
                onChange={(e) => setVatPercentage(e.target.value)}
                placeholder="e.g. 5.0"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Division *
              </label>
              <input
                type="text"
                required
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                placeholder="e.g. Rajshahi"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                District *
              </label>
              <input
                type="text"
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Bogura"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Thana *
              </label>
              <input
                type="text"
                required
                value={thana}
                onChange={(e) => setThana(e.target.value)}
                placeholder="e.g. Shariakandi"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
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
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-2 transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Parameters
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
