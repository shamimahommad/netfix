import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  badge?: string | number | ReactNode;
  backTo?: string;
  onBack?: () => void;
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  icon,
  badge,
  backTo,
  onBack,
  actions,
  className = '',
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm transition-all ${className}`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Optional Back button + Icon + Title & Subtitle */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {(backTo || onBack) && (
            <button
              type="button"
              onClick={handleBack}
              className="p-2 sm:p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
              title="Go back"
              aria-label="Go back"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}

          {icon && (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center shrink-0 shadow-sm">
              <span className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">
                {icon}
              </span>
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {title}
              </h1>
              {badge !== undefined && badge !== null && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs sm:text-sm font-normal text-slate-500 dark:text-slate-400 flex items-center gap-2 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions bar */}
        {actions && (
          <div className="flex items-center gap-2.5 flex-wrap shrink-0 self-stretch md:self-auto justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

