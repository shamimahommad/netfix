import { motion } from 'framer-motion';
import { Layers, Sparkles } from 'lucide-react';
import { useCustomerPortalProfile, PortalDesignMode } from '@/contexts/CustomerPortalContext';

interface DesignModeSwitcherProps {
  className?: string;
  variant?: 'segmented' | 'compact';
}

export function DesignModeSwitcher({ className = '', variant = 'segmented' }: DesignModeSwitcherProps) {
  const { designMode, setDesignMode } = useCustomerPortalProfile();

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => setDesignMode(designMode === 'crafted' ? 'classic' : 'crafted')}
        title={`Currently in ${designMode === 'crafted' ? 'Crafted (Unslop)' : 'Classic'} mode. Click to switch.`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
          designMode === 'crafted'
            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
        } ${className}`}
      >
        {designMode === 'crafted' ? (
          <>
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Crafted UI</span>
          </>
        ) : (
          <>
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Classic UI</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700/60 text-xs font-medium select-none ${className}`}
      role="group"
      aria-label="Portal Design Switcher"
    >
      <button
        type="button"
        onClick={() => setDesignMode('classic')}
        className={`relative z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors duration-150 ${
          designMode === 'classic'
            ? 'text-slate-900 dark:text-white font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>Classic</span>
        {designMode === 'classic' && (
          <motion.div
            layoutId="portal-design-mode-indicator"
            className="absolute inset-0 bg-white dark:bg-slate-900 rounded-lg shadow-sm -z-10"
            transition={{ type: 'spring', stiffness: 450, damping: 35 }}
          />
        )}
      </button>

      <button
        type="button"
        onClick={() => setDesignMode('crafted')}
        className={`relative z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors duration-150 ${
          designMode === 'crafted'
            ? 'text-blue-700 dark:text-blue-300 font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span>Crafted</span>
        {designMode === 'crafted' && (
          <motion.div
            layoutId="portal-design-mode-indicator"
            className="absolute inset-0 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-blue-500/20 -z-10"
            transition={{ type: 'spring', stiffness: 450, damping: 35 }}
          />
        )}
      </button>
    </div>
  );
}
