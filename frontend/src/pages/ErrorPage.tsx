import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface ErrorPageProps {
  /** 404, 500, etc. */
  status?: number;
  /** Override title */
  title?: string;
  /** Override description */
  message?: string;
}

export default function ErrorPage({ status = 404, title, message }: ErrorPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const is404 = status === 404;
  const is403 = status === 403;
  const is500 = status === 500;

  const homePath = user?.user_type === 'saas' ? '/saas/dashboard' : user?.user_type === 'customer' ? '/customer/dashboard' : '/dashboard';
  const defaultTitle = is404 ? 'Page not found' : is403 ? 'Access denied' : is500 ? 'Server error' : 'Something went wrong';
  const defaultMessage = is404
    ? 'The page you’re looking for doesn’t exist or has been moved.'
    : is403
      ? "You don't have permission to view this page."
      : is500
        ? 'A server error occurred. Please try again later.'
        : 'An unexpected error occurred. Please try again.';

  const displayTitle = title ?? defaultTitle;
  const displayMessage = message ?? defaultMessage;

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(homePath, { replace: true });
    }
  };

  const handleGoHome = () => {
    navigate(homePath, { replace: true });
  };

  const handleGoLogin = () => {
    navigate('/login', { replace: true });
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${
        is404
          ? 'bg-gradient-to-br from-sky-50 via-teal-50/80 to-cyan-50 dark:from-slate-900 dark:via-teal-950/40 dark:to-sky-950/50'
          : 'bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900'
      }`}
    >
      {is404 && (
        <style>{`
          @keyframes err404-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @keyframes err404-fadeIn {
            from { opacity: 0; transform: scale(0.96); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes err404-shine {
            0%, 100% { background-position: 200% center; }
            50% { background-position: -200% center; }
          }
          .err404-float { animation: err404-float 4s ease-in-out infinite; }
          .err404-fadeIn { animation: err404-fadeIn 0.5s ease-out forwards; }
          .err404-glow { box-shadow: 0 0 40px -10px rgb(6 182 212 / 0.3), 0 0 80px -20px rgb(20 184 166 / 0.2); }
        `}</style>
      )}
      <div
        className={`max-w-lg w-full backdrop-blur rounded-2xl shadow-xl p-8 sm:p-10 text-center ${
          is404
            ? 'bg-white/80 dark:bg-slate-800/80 border border-sky-200/60 dark:border-teal-500/30 err404-fadeIn err404-glow'
            : 'bg-white dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60'
        }`}
      >
        <div
          className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${
            is404
              ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 err404-float'
              : is403
                ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                : is500
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
          }`}
        >
          {is404 ? (
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : is403 ? (
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ) : is500 ? (
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
        </div>
        <p
          className={`text-sm font-semibold uppercase tracking-wider mb-2 ${
            is404 ? 'text-sky-600 dark:text-sky-400' : is403 ? 'text-rose-600 dark:text-rose-400' : is500 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          Error {status}
        </p>
        <h1
          className={`text-2xl sm:text-3xl font-bold mb-3 ${
            is404 ? 'text-slate-800 dark:text-slate-100 bg-gradient-to-r from-sky-600 to-teal-600 dark:from-sky-400 dark:to-teal-400 bg-clip-text text-transparent' : 'text-slate-800 dark:text-slate-100'
          }`}
        >
          {displayTitle}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {displayMessage}
        </p>
        {!is404 && location.pathname && (
          <p className="text-xs text-slate-500 dark:text-slate-500 mb-4 font-mono truncate max-w-full px-2">
            {location.pathname}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleGoBack}
            className={`px-5 py-2.5 rounded-xl text-white font-medium transition-all duration-200 ${
              is404
                ? 'bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40'
                : 'bg-violet-600 hover:bg-violet-700'
            }`}
          >
            Go back
          </button>
          <button
            onClick={handleGoHome}
            className={`px-5 py-2.5 rounded-xl font-medium transition-colors ${
              is404
                ? 'border-2 border-sky-300 dark:border-sky-600 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/30'
                : 'border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
          >
            Dashboard
          </button>
          {!isAuthenticated && (
            <button
              onClick={handleGoLogin}
              className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-colors"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
