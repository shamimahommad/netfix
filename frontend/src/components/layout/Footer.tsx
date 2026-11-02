export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full py-3 sm:py-4 bg-transparent text-center shrink-0">
      <p className="text-sm sm:text-base text-slate-300 dark:text-slate-400">
        {year} © ISP Billing By{' '}
        <span className="text-blue-400 dark:text-blue-400 font-medium">AimTurn</span>
      </p>
    </footer>
  );
}
