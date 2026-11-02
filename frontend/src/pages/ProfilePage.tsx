import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Key, Edit, CreditCard } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { authService, MeResponse } from '@/services/auth.service';
import { PageHeader, StatusBadge } from '@/components/common';

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
  const { user, balance, refreshMe, impersonated, impersonatedBy } = useAuthStore();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
        <div className="px-6 py-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
              {fullName}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {user.email || 'No email associated'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge role={user.role_code || 'isp_admin'} />
            </div>
          </div>
        </div>

        {/* Info Rows */}
        <div className="p-6 divide-y divide-slate-100 dark:divide-slate-800">
          <InfoRow label="User ID" value={`#${user.user_id}`} />
          {username && <InfoRow label="Username" value={username} />}
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
