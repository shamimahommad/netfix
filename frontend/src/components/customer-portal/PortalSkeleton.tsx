import { motion } from 'framer-motion';

export function PortalSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-700/40 ${className}`} />
  );
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-700/50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <PortalSkeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

export function CardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"
    >
      <PortalSkeleton className="h-4 w-1/3 mb-4" />
      <PortalSkeleton className="h-8 w-2/3 mb-6" />
      <div className="flex gap-4">
        <PortalSkeleton className="h-12 flex-1" />
        <PortalSkeleton className="h-12 flex-1" />
      </div>
    </motion.div>
  );
}
