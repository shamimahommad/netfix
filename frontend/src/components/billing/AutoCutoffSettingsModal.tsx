import React, { useState, useEffect } from 'react';
import { X, Sliders, ShieldAlert, Clock, Bell, Network, FileText, CheckCircle2 } from 'lucide-react';
import { AutoCutoffSettings, billingCronService } from '@/services/billingCron.service';
import { useToastContext } from '@/contexts/ToastContext';

interface AutoCutoffSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: AutoCutoffSettings;
  onSaved: (updated: AutoCutoffSettings) => void;
}

export const AutoCutoffSettingsModal: React.FC<AutoCutoffSettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSaved,
}) => {
  const toast = useToastContext();
  const [formData, setFormData] = useState<AutoCutoffSettings>(currentSettings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(currentSettings);
    }
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await billingCronService.saveSettings(formData);
      if (res.success) {
        toast.success(res.message || 'Auto-cutoff engine settings saved successfully');
        onSaved(res.data);
        onClose();
      } else {
        toast.error(res.message || 'Failed to save settings');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Auto-Cutoff & Billing Engine Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure automatic expiry detection, MikroTik policy, and grace periods
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Switch: Auto Cutoff */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20">
            <div className="space-y-0.5 pr-4">
              <label className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Enable Automated Cutoff Engine
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automatically disconnect expired subscribers every 10 minutes via background cron
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoCutoffEnabled}
                onChange={(e) => setFormData({ ...formData, autoCutoffEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Grace Period */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Grace Period (Days Before Disconnection)
            </label>
            <select
              value={formData.gracePeriodDays}
              onChange={(e) => setFormData({ ...formData, gracePeriodDays: parseInt(e.target.value, 10) })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            >
              <option value={0}>0 Days (Cutoff immediately upon expiry)</option>
              <option value={1}>1 Day (Allow 24h grace buffer)</option>
              <option value={2}>2 Days</option>
              <option value={3}>3 Days</option>
              <option value={5}>5 Days</option>
              <option value={7}>7 Days</option>
            </select>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Subscribers will remain connected until their expiration date + grace period has passed.
            </p>
          </div>

          {/* MikroTik Cutoff Action */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-slate-500" />
              MikroTik Router Action Policy
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`relative flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                  formData.cutoffAction === 'disable_secret'
                    ? 'border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Disable PPPoE Secret</span>
                  <input
                    type="radio"
                    name="cutoffAction"
                    value="disable_secret"
                    checked={formData.cutoffAction === 'disable_secret'}
                    onChange={() => setFormData({ ...formData, cutoffAction: 'disable_secret' })}
                    className="text-blue-600"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sets secret to disabled (<code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">disabled=yes</code>) and terminates active PPPoE session instantly.
                </p>
              </label>

              <label
                className={`relative flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                  formData.cutoffAction === 'suspended_profile'
                    ? 'border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Switch to Suspended Pool</span>
                  <input
                    type="radio"
                    name="cutoffAction"
                    value="suspended_profile"
                    checked={formData.cutoffAction === 'suspended_profile'}
                    onChange={() => setFormData({ ...formData, cutoffAction: 'suspended_profile' })}
                    className="text-blue-600"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Switches user to an isolated suspended profile/IP pool (for walled garden captive portal redirect).
                </p>
              </label>
            </div>

            {formData.cutoffAction === 'suspended_profile' && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  MikroTik Suspended Profile Name:
                </label>
                <input
                  type="text"
                  value={formData.suspendedProfileName || ''}
                  onChange={(e) => setFormData({ ...formData, suspendedProfileName: e.target.value })}
                  placeholder="e.g. SUSPENDED or EXPIRED"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* SMS Notification */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="space-y-0.5 pr-4">
              <label className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                Send Auto-Cutoff SMS Alert
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sends an automated SMS to the customer when their line is disconnected due to expiry
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.sendCutoffSms}
                onChange={(e) => setFormData({ ...formData, sendCutoffSms: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Invoicing Section */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  Auto-Generate Monthly Invoices
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Automatically generate subscription invoices at the beginning of billing cycle
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoInvoiceEnabled}
                  onChange={(e) => setFormData({ ...formData, autoInvoiceEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {formData.autoInvoiceEnabled && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-400">Invoice Due Days:</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={formData.invoiceDueDays}
                  onChange={(e) => setFormData({ ...formData, invoiceDueDays: parseInt(e.target.value, 10) || 5 })}
                  className="w-20 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-right text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoCutoffSettingsModal;
