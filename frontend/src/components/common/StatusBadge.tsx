interface StatusBadgeProps {
  status: string | null | undefined;
  type?: 'status' | 'billing' | 'role' | 'network';
  className?: string;
}

export default function StatusBadge({ status, type = 'status', className = '' }: StatusBadgeProps) {
  if (!status) return null;

  const s = String(status).toLowerCase().trim();

  // Role badges
  if (type === 'role') {
    const roleMap: Record<string, { label: string; class: string }> = {
      admin: {
        label: 'Admin',
        class: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      },
      manager: {
        label: 'Manager',
        class: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      },
      reseller: {
        label: 'Reseller',
        class: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      },
      sub_reseller: {
        label: 'Sub Reseller',
        class: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      },
      agent: {
        label: 'Agent',
        class: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      },
    };

    const config = roleMap[s] || { label: status, class: 'bg-slate-100 text-slate-700 border-slate-200' };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.class} ${className}`}
      >
        {config.label}
      </span>
    );
  }

  // Active / Paid / Online / Success
  if (['active', 'paid', 'online', 'success', 'connected'].includes(s)) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  // Due / Pending / Maintenance / Expire In Days
  if (['due', 'pending', 'maintenance', 'warning'].includes(s) || s.includes('expire')) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  // Suspended / Expired / Offline / Failed / Error / Cancelled / Terminated
  if (['suspended', 'expired', 'offline', 'failed', 'error', 'cancelled', 'terminated', 'decommissioned'].includes(s)) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  // Inactive / Left / Disabled / Default
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 ${className}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

