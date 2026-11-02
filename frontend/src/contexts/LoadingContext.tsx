import { createContext, useCallback, useContext, useState, useMemo, ReactNode } from 'react';

interface LoadingContextValue {
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider');
  return ctx;
}

export function useLoadingOptional(): LoadingContextValue | null {
  return useContext(LoadingContext);
}

interface LoadingProviderProps {
  children: ReactNode;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('Loading...');

  const showLoading = useCallback((msg?: string) => {
    setMessage(msg ?? 'Loading...');
    setCount((c) => c + 1);
  }, []);

  const hideLoading = useCallback(() => {
    setCount((c) => Math.max(0, c - 1));
  }, []);

  const value = useMemo(
    () => ({ showLoading, hideLoading, isLoading: count > 0 }),
    [showLoading, hideLoading, count],
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <GlobalLoadingOverlay visible={count > 0} message={message} />
    </LoadingContext.Provider>
  );
}

function GlobalLoadingOverlay({ visible, message }: { visible: boolean; message: string }) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 dark:bg-slate-950/50 backdrop-blur-[2px]"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-600/50 px-10 py-12 flex flex-col items-center gap-5 min-w-[280px]">
        {/* Gradient circle + spinner + accent dot */}
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <div className="h-8 w-8 rounded-full border-2 border-white/90 border-t-transparent animate-spin" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-70" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
          </span>
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{message}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Please wait a moment</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-blue-400/80 dark:bg-blue-500/70 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
