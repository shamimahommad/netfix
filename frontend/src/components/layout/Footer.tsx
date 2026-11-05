import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t border-slate-200/60 dark:border-slate-800/40 bg-transparent px-4 lg:px-6 py-2 mt-auto shrink-0 transition-colors">
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 dark:text-slate-200">NetFix</span>
          <span>© {year} All rights reserved.</span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">·</span>
          <span className="hidden sm:inline">ISP Billing & Network Automation</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            RouterOS 7.x
          </span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span>EPON/GPON Sync</span>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Enterprise SaaS
          </span>
        </div>
      </div>
    </footer>
  );
}
