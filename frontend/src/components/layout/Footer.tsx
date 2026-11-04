import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t border-border/60 bg-card/40 backdrop-blur-sm px-4 lg:px-6 py-3 mt-auto shrink-0 transition-colors">
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <span className="font-bold text-text-primary">NetFix</span>
          <span>© {year} All rights reserved.</span>
          <span className="hidden sm:inline text-text-muted/50">·</span>
          <span className="hidden sm:inline">ISP Billing & Network Automation</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            RouterOS 7.x
          </span>
          <span className="text-text-muted/50">·</span>
          <span>EPON/GPON Sync</span>
          <span className="text-text-muted/50">·</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-text-muted" /> Enterprise SaaS
          </span>
        </div>
      </div>
    </footer>
  );
}
