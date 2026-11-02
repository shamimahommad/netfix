import { ReactNode } from 'react';

export type MetricVariant = 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple' | 'slate' | 'cyan';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  variant?: MetricVariant;
  onClick?: () => void;
  className?: string;
}

const VARIANT_STYLES: Record<MetricVariant, {
  iconBg: string;
  iconColor: string;
  badge?: string;
}> = {
  blue: {
    iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-100 dark:border-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  emerald: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-100 dark:border-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  rose: {
    iconBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-100 dark:border-rose-900/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  indigo: {
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-100 dark:border-indigo-900/40',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  purple: {
    iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-100 dark:border-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  cyan: {
    iconBg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-100 dark:border-cyan-900/40',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
  },
  slate: {
    iconBg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    iconColor: 'text-slate-600 dark:text-slate-400',
  },
};

export default function MetricCard({
  title,
  value,
  subtext,
  icon,
  variant = 'blue',
  onClick,
  className = '',
}: MetricCardProps) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.blue;

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
            {title}
          </p>
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 truncate">
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              {subtext}
            </p>
          )}
        </div>

        {icon && (
          <div
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border shrink-0 ${styles.iconBg} ${styles.iconColor}`}
          >
            <span className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">
              {icon}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

