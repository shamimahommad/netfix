import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Phone,
  MapPin,
  Mail,
  Check,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { customerPortalService } from '@/services/customer-portal.service';
import { useCustomerPortalProfile } from '@/contexts/CustomerPortalContext';

interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerProfileModal({ isOpen, onClose }: CustomerProfileModalProps) {
  const { profile, setProfile } = useCustomerPortalProfile();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [email, setEmail] = useState(profile?.email || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync state whenever modal opens or profile changes
  useEffect(() => {
    if (isOpen && profile) {
      setFullName(profile.fullName || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setEmail(profile.email || '');
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddr = address.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError('Full name cannot be empty.');
      return;
    }

    if (!trimmedPhone) {
      setError('Mobile number cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const res = await customerPortalService.updateProfile({
        fullName: trimmedName,
        phone: trimmedPhone,
        address: trimmedAddr,
        email: trimmedEmail,
      });

      // Update global context profile immediately
      if (profile) {
        setProfile({
          ...profile,
          fullName: trimmedName,
          phone: trimmedPhone,
          address: trimmedAddr,
          email: trimmedEmail || null,
        });
      }

      setSuccess(res.message || 'Profile updated successfully!');
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Window (100% solid background, strictly opaque) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl shadow-slate-900/40 dark:shadow-black/70 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
                <User className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                  Customer Profile Settings
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                  Update your contact details, mobile number & address
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto customer-portal-scrollbar p-4 sm:p-6 space-y-3.5 sm:space-y-4">
            {/* Identity info card */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Subscriber ID</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{profile?.customerCode || '—'}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Line Status</span>
                <span className={`inline-flex items-center gap-1 font-bold ${profile?.onlineStatus ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profile?.onlineStatus ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {profile?.onlineStatus ? 'Active' : 'Offline'}
                </span>
              </div>
            </div>

            {/* Error & Success alerts */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-xs">
                <Check className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name (পূর্ণ নাম) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Md Saiful Islam"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Mobile Number (মোবাইল নম্বর) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 017XXXXXXXX"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Installation Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Installation Address (সংযোগের ঠিকানা)
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. House #14, Road #3, Sector #11, Uttara, Dhaka"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                />
              </div>
            </div>

            {/* Email (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address (ইমেইল - ঐচ্ছিক)
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. customer@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors disabled:opacity-50 text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-60 active:scale-95 text-center"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Save Changes (সংরক্ষণ করুন)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
