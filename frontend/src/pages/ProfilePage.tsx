import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Key, Edit, CreditCard, X, Check, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { authService, MeResponse } from '@/services/auth.service';
import { PageHeader, StatusBadge } from '@/components/common';
import { useToastContext } from '@/contexts/ToastContext';

const getRoleLabel = (roleCode: string | undefined): string => {
  if (!roleCode) return 'User';
  const r = roleCode.toLowerCase();
  const labels: Record<string, string> = {
    saas_admin: 'SaaS Admin',
    admin: 'Admin',
    isp_admin: 'ISP Admin',
    manager: 'Manager',
    reseller: 'Reseller',
    sub_reseller: 'Sub Reseller',
    agent: 'Agent',
  };
  return labels[r] ?? roleCode.replace(/_/g, ' ');
};

const getUserTypeLabel = (userType: string | undefined): string => {
  if (!userType) return '—';
  const t = userType.toLowerCase();
  if (t === 'saas') return 'SaaS Administrator';
  if (t === 'isp') return 'ISP / Tenant';
  if (t === 'customer') return 'Customer Subscriber';
  return userType;
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const { user, setUser, balance, refreshMe, impersonated, impersonatedBy } = useAuthStore();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshMe();
      if (cancelled) return;
      try {
        const data = await authService.getMe();
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshMe]);

  const handleOpenEditModal = () => {
    if (!user) return;
    setEditForm({
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      email: user.email || '',
      phone: (user as any).phone || '',
    });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.firstName.trim()) {
      setEditError('First Name is required');
      return;
    }

    setIsSaving(true);
    setEditError(null);

    try {
      const res = await authService.updateProfile({
        first_name: editForm.firstName.trim(),
        last_name: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
      });

      if (res.user && user) {
        setUser({
          ...user,
          ...res.user,
        });
      }

      await refreshMe();
      toast.success('Profile updated successfully!');
      setIsEditModalOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update profile.';
      setEditError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="w-full flex items-center justify-center p-12">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
      </div>
    );
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || '—';
  const initials = fullName !== '—'
    ? `${user.first_name?.charAt(0) ?? ''}${user.last_name?.charAt(0) ?? ''}`.toUpperCase().slice(0, 2)
    : user.email?.charAt(0).toUpperCase() ?? 'U';
  const username = me?.username ?? null;
  const roleLabel = getRoleLabel(user.role_code);
  const userTypeLabel = getUserTypeLabel(user.user_type);

  return (
    <div className="w-full min-w-0 max-w-2xl space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<User className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="My Profile"
        subtitle="Manage your personal account credentials, permissions, and settings"
        onBack={() => navigate('/dashboard')}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-sm font-semibold shadow-sm transition-colors"
            >
              <Edit className="w-4 h-4 text-sky-600 dark:text-teal-400" /> Edit Profile
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/topup-balance')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-sm font-medium shadow-sm transition-colors"
            >
              <CreditCard className="w-4 h-4" /> Topup
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/change-password')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors"
            >
              <Key className="w-4 h-4" /> Change Password
            </button>
          </div>
        }
      />

      {impersonated && impersonatedBy && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm font-medium">
          You are currently viewing as this user. Exit impersonation via the user menu in the top bar.
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Banner with Avatar */}
        <div className="px-6 py-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-5 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {fullName}
                </h2>
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Edit Name & Profile"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {user.email || 'No email associated'}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge role={user.role_code || 'isp_admin'} />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenEditModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-xs sm:text-sm font-semibold transition-all shrink-0 self-start sm:self-auto"
          >
            <Edit className="w-4 h-4" /> Edit Name
          </button>
        </div>

        {/* Info Rows */}
        <div className="p-6 divide-y divide-slate-100 dark:divide-slate-800">
          <InfoRow 
            label="Full Name" 
            value={
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                <span>{fullName}</span>
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-normal"
                >
                  (Edit)
                </button>
              </div>
            } 
          />
          <InfoRow label="User ID" value={`#${user.user_id}`} />
          {username && <InfoRow label="Username" value={username} />}
          <InfoRow label="Email" value={user.email || '—'} />
          <InfoRow label="Phone" value={(user as any).phone || me?.phone || '—'} />
          <InfoRow label="Role Assigned" value={roleLabel} />
          <InfoRow label="Account Category" value={userTypeLabel} />
          {(user.user_type === 'isp' || user.user_type === 'tenant') && balance != null && (
            <InfoRow
              label="Account Balance"
              value={`৳${Number(balance).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              isHighlight
            />
          )}
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-sky-200/80 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-sky-500 to-teal-600 px-5 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-base flex items-center gap-2">
                <User className="w-5 h-5" />
                Edit Personal Profile
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    placeholder="First Name"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    placeholder="Last Name"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="admin@netfix.com"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+8801XXXXXXXXX"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 font-mono transition-all"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  Preview: <strong className="text-slate-800 dark:text-slate-200">{[editForm.firstName, editForm.lastName].filter(Boolean).join(' ') || '—'}</strong> ({roleLabel})
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !editForm.firstName.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-teal-600 hover:from-sky-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Profile</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, isHighlight }: { label: string; value: string; isHighlight?: boolean }) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400 font-medium">{label}</span>
      <span className={`font-semibold ${isHighlight ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-900 dark:text-slate-100'}`}>
        {value}
      </span>
    </div>
  );
}
