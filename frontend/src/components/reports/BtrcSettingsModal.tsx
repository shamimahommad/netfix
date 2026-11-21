import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Save, Loader2, Info } from 'lucide-react';
import { BtrcProfile, btrcService } from '@/services/btrc.service';
import { useToastContext } from '@/contexts/ToastContext';

interface BtrcSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: BtrcProfile | null;
  onSaved: () => void;
}

export default function BtrcSettingsModal({
  isOpen,
  onClose,
  currentProfile,
  onSaved,
}: BtrcSettingsModalProps) {
  const toast = useToastContext();
  const [saving, setSaving] = useState(false);

  const [licenseNo, setLicenseNo] = useState('');
  const [licenseCategory, setLicenseCategory] = useState('Nationwide');
  const [purchasedBandwidth, setPurchasedBandwidth] = useState('2000');
  const [contactPerson, setContactPerson] = useState('');
  const [contactDesignation, setContactDesignation] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [defaultThana, setDefaultThana] = useState('Sariyakandi');
  const [defaultDistrict, setDefaultDistrict] = useState('Bogura');

  useEffect(() => {
    if (currentProfile) {
      setLicenseNo(currentProfile.license_no || '');
      setLicenseCategory(currentProfile.license_category || 'Nationwide');
      setPurchasedBandwidth(String(currentProfile.purchased_bandwidth_mbps || 2000));
      setContactPerson(currentProfile.contact_person || '');
      setContactDesignation(currentProfile.contact_designation || '');
      setContactPhone(currentProfile.contact_phone || '');
      setContactEmail(currentProfile.contact_email || '');
      setDefaultThana(currentProfile.default_thana || 'Sariyakandi');
      setDefaultDistrict(currentProfile.default_district || 'Bogura');
    }
  }, [currentProfile, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await btrcService.updateSettings({
        btrc_license_no: licenseNo,
        btrc_license_category: licenseCategory,
        btrc_purchased_bandwidth_mbps: parseFloat(purchasedBandwidth) || 0,
        btrc_contact_person: contactPerson,
        btrc_contact_designation: contactDesignation,
        btrc_contact_phone: contactPhone,
        btrc_contact_email: contactEmail,
        btrc_default_thana: defaultThana,
        btrc_default_district: defaultDistrict,
      });
      toast.success('BTRC License & Profile settings saved successfully.');
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                BTRC License & Upstream Profile
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Regulatory ISP license parameters and monthly return configuration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
              These parameters populate the official BTRC Monthly Return Excel cover page and summary headers. Please ensure the BTRC License Number and purchased upstream bandwidth (IIG / NTTN) are entered accurately.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                BTRC License Number *
              </label>
              <input
                type="text"
                required
                value={licenseNo}
                onChange={(e) => setLicenseNo(e.target.value)}
                placeholder="e.g. BTRC/LL/ISP-Nationwide/..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                License Category *
              </label>
              <select
                value={licenseCategory}
                onChange={(e) => setLicenseCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Nationwide">Nationwide ISP</option>
                <option value="Divisional">Divisional ISP</option>
                <option value="District">District ISP</option>
                <option value="Upazila">Upazila / Thana ISP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Purchased Upstream Bandwidth (Mbps) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={purchasedBandwidth}
                onChange={(e) => setPurchasedBandwidth(e.target.value)}
                placeholder="e.g. 2000"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Total purchased bandwidth from upstream IIG / NTTN providers
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Authorized Contact Person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Md. Shamim"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Designation
              </label>
              <input
                type="text"
                value={contactDesignation}
                onChange={(e) => setContactDesignation(e.target.value)}
                placeholder="e.g. Managing Director / Head of NOC"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Phone / Mobile
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="e.g. 01700000000"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@isp.net"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Thana / Upazila
              </label>
              <input
                type="text"
                value={defaultThana}
                onChange={(e) => setDefaultThana(e.target.value)}
                placeholder="e.g. Sariyakandi"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default District
              </label>
              <input
                type="text"
                value={defaultDistrict}
                onChange={(e) => setDefaultDistrict(e.target.value)}
                placeholder="e.g. Bogura"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-2 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Profile Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
