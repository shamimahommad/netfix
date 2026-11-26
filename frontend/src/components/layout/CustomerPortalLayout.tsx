import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  CreditCard,
  FileText,
  Ticket,
  BarChart3,
  LogOut,
  User,
  Copy,
  Check,
  Moon,
  Sun,
  ChevronDown,
  Wifi,
  WifiOff,
  Sparkles,
  UserCog,
  // Future-ready icons (uncomment when adding features):
  // Film,
  // Tv,
  // Radio,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';
import { useCustomerPortalProfile } from '@/contexts/CustomerPortalContext';
import { authService } from '@/services/auth.service';
import { customerPortalService } from '@/services/customer-portal.service';
import { DesignModeSwitcher, CustomerProfileModal } from '@/components/customer-portal';
import { useState, useEffect, useRef } from 'react';

/* ─────────────────────────── NAV CONFIG ─────────────────────────── */
// Easy to extend: just add entries here for Movie Server, Live TV etc.
const navItems = [
  { path: '/customer/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/customer/pay-bill', label: 'Pay Bill', icon: CreditCard },
  { path: '/customer/payment-history', label: 'History', icon: FileText },
  { path: '/customer/ticket', label: 'Ticket', icon: Ticket },
  { path: '/customer/report', label: 'Report', icon: BarChart3 },
  // ── Future sections (just uncomment when backend is ready) ──
  // { path: '/customer/movies', label: 'Movies', icon: Film },
  // { path: '/customer/live-tv', label: 'Live TV', icon: Tv },
];

/* ─────────────────────── PROFILE DROPDOWN ─────────────────────── */
function ProfileDropdown({
  profile,
  user,
  onLogout,
  onCopy,
  copied,
  onOpenEditProfile,
}: {
  profile: any;
  user: any;
  onLogout: () => void;
  onCopy: (t: string) => void;
  copied: boolean;
  onOpenEditProfile: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all duration-200 group"
      >
        {/* Avatar */}
        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 ring-2 ring-white/80 dark:ring-slate-800/80">
          <User className="w-4.5 h-4.5 text-white" />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
              profile?.onlineStatus ? 'bg-emerald-500 status-dot-online' : 'bg-slate-400'
            }`}
          />
        </div>
        <div className="hidden sm:block text-left min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
            {profile?.fullName || user?.first_name || 'Customer'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
            {profile?.customerCode || '—'}
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {/* Mobile overlay backdrop */}
            <div
              className="sm:hidden fixed inset-0 bg-black/40 z-[90] backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-80 max-w-none sm:max-w-[340px] rounded-2xl !bg-white dark:!bg-slate-900 border border-slate-200 dark:border-slate-800 ring-1 ring-slate-900/10 dark:ring-white/10 shadow-2xl shadow-slate-900/40 dark:shadow-black/90 z-[100] overflow-hidden text-slate-800 dark:text-slate-200"
            >
            {/* Profile info section */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-800/60 shrink-0">
                  <User className="w-5 h-5" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                      profile?.onlineStatus ? 'bg-emerald-500 status-dot-online' : 'bg-slate-400'
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">
                    {profile?.fullName || user?.first_name || 'Customer'}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      profile?.onlineStatus
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {profile?.onlineStatus ? (
                      <Wifi className="w-3 h-3" />
                    ) : (
                      <WifiOff className="w-3 h-3" />
                    )}
                    {profile?.onlineStatus ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>

              <div className="mt-3.5 space-y-2 text-xs">
                {(user?.email || profile?.email) && (
                  <p className="text-slate-500 dark:text-slate-400 truncate font-mono">
                    {user.email || profile.email}
                  </p>
                )}
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-sans">
                  <span className="text-slate-400">Username</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono truncate">
                    {profile?.customerCode || '—'}
                  </span>
                  <span className="text-slate-400">Mobile</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono truncate">
                    {profile?.phone || '—'}
                  </span>
                  <span className="text-slate-400">Address</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate" title={profile?.address || 'Not specified'}>
                    {profile?.address || 'Not specified'}
                  </span>
                  <span className="text-slate-400">ID</span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono truncate">
                      {profile?.customerCode || '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onCopy(profile?.customerCode || '')}
                      className="p-0.5 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      title="Copy ID"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </span>
                </div>
              </div>

              {/* Quick Profile Edit CTA */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenEditProfile();
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-xs border border-blue-200/60 dark:border-blue-800/60 transition-all active:scale-[0.98]"
                >
                  <UserCog className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>

            {/* Design switcher */}
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Design View</span>
              <DesignModeSwitcher variant="segmented" />
            </div>

            {/* Logout */}
            <div className="p-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────── MAIN LAYOUT ─────────────────────── */
export default function CustomerPortalLayout() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const { profile, setProfile, designMode } = useCustomerPortalProfile();
  const [copied, setCopied] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const isCrafted = designMode === 'crafted';

  useEffect(() => {
    customerPortalService
      .getDashboard()
      .then((res) => {
        const c = res.data?.customer;
        const comp = res.data?.company;
        const onlineStatus = res.data?.network?.onlineStatus ?? false;
        if (c)
          setProfile({
            fullName: c.fullName,
            customerCode: c.customerCode,
            phone: c.phone ?? null,
            email: c.email ?? null,
            address: c.address ?? null,
            onlineStatus,
            company: comp ?? null,
          });
      })
      .catch(() => {});
  }, [setProfile]);

  const handleLogout = async () => {
    await authService.logout();
    logout();
    window.location.replace('/customer/login');
  };

  const copyId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Current page title for mobile header
  const currentPage = navItems.find((item) => location.pathname.startsWith(item.path));

  return (
    <div className="min-h-0 flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300 customer-portal-app">
      {/* ═══════════ TOP NAVBAR (always visible) ═══════════ */}
      <header
        className={`sticky top-0 z-30 w-full transition-colors ${
          isCrafted
            ? 'bg-white/95 dark:bg-slate-950/95 border-b border-slate-200/90 dark:border-slate-800 backdrop-blur-md shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
            : 'glass-card border-b border-slate-200/80 dark:border-slate-700/80 shadow-sm shadow-slate-200/30 dark:shadow-black/10'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-2">
            {/* Left: Brand (Dynamic ISP Company Logo or Name) */}
            <div className="flex items-center gap-2.5 shrink-0 min-w-0">
              {profile?.company?.logoUrl ? (
                <div className="flex items-center gap-2 shrink-0">
                  <img
                    src={profile.company.logoUrl}
                    alt={profile.company.name || 'Company Logo'}
                    className="h-8 sm:h-9 max-h-9 w-auto max-w-[120px] sm:max-w-[160px] object-contain rounded-lg shrink-0"
                  />
                  <span className={`hidden md:inline-flex items-center shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap ${
                    isCrafted
                      ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                  }`}>
                    Self-Care
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0 min-w-0">
                  <div className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isCrafted
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                      : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                  }`}>
                    <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                    <span className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100 tracking-tight truncate max-w-[120px] sm:max-w-[180px] md:max-w-[220px] whitespace-nowrap">
                      {profile?.company?.name || 'Customer Portal'}
                    </span>
                    <span className={`hidden md:inline-flex items-center shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap ${
                      isCrafted
                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                    }`}>
                      Self-Care
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Center: Desktop nav tabs */}
            <nav className="hidden lg:flex items-center gap-1 shrink-0">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-sm font-medium shrink-0 whitespace-nowrap transition-all duration-150 ${
                        isActive
                          ? isCrafted
                            ? 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/80 font-semibold'
                            : 'text-blue-700 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-500/15'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? (isCrafted ? 'text-blue-600 dark:text-blue-400' : 'text-blue-600 dark:text-blue-400') : ''}`} />
                        <span className="whitespace-nowrap">{item.label}</span>
                        {isActive && (
                          <motion.span
                            layoutId="topnav-active-pill"
                            className={`absolute -bottom-[13px] left-1/2 -translate-x-1/2 h-0.5 rounded-full ${
                              isCrafted ? 'w-6 bg-blue-600 dark:bg-blue-400' : 'w-8 bg-blue-500'
                            }`}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Spacer to push actions to the right on all viewports */}
            <div className="lg:hidden flex-1 min-w-[8px]" />

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Design Mode Switcher (Desktop Header) */}
              <div className="hidden sm:flex items-center mr-0.5 shrink-0">
                <DesignModeSwitcher variant="segmented" />
              </div>

              {/* Connection status pill */}
              <span
                className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  profile?.onlineStatus
                    ? isCrafted
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 font-mono'
                      : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-700/40'
                    : 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/40'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    profile?.onlineStatus ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                <span className="whitespace-nowrap">{profile?.onlineStatus ? 'Online' : 'Offline'}</span>
              </span>

              {/* Theme toggle */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-amber-500 dark:hover:text-amber-400 shrink-0 transition-all duration-200"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
              </motion.button>

              {/* Profile dropdown */}
              <ProfileDropdown
                profile={profile}
                user={user}
                onLogout={handleLogout}
                onCopy={copyId}
                copied={copied}
                onOpenEditProfile={() => setIsProfileModalOpen(true)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main
        className={`flex-1 min-w-0 overflow-auto customer-portal-scrollbar flex flex-col transition-colors ${
          isCrafted
            ? 'bg-slate-50 dark:bg-slate-950'
            : 'bg-gradient-to-br from-slate-50 via-slate-50/95 to-blue-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/95'
        }`}
      >
        <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 lg:pb-6">
          <Outlet />
        </div>

        {/* Footer (desktop only — mobile has bottom nav covering it) */}
        <footer
          className={`hidden lg:block w-full px-4 lg:px-6 py-2.5 mt-auto shrink-0 transition-colors ${
            isCrafted
              ? 'border-t border-slate-200/90 dark:border-slate-800 bg-white/70 dark:bg-slate-950/70'
              : 'border-t border-slate-200/60 dark:border-slate-800/40 bg-transparent'
          }`}
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-200">
                {profile?.company?.name || 'Customer Self-Care'}
              </span>
              <span>© {new Date().getFullYear()} All rights reserved.</span>
              {profile?.company?.supportPhone && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span>
                    Support: <a href={`tel:${profile.company.supportPhone}`} className="text-blue-600 dark:text-blue-400 hover:underline">{profile.company.supportPhone}</a>
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className="text-slate-400">UI:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {isCrafted ? 'Crafted (Unslop)' : 'Classic'}
                </span>
              </div>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span
                className={`inline-flex items-center gap-1.5 font-medium ${
                  profile?.onlineStatus
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    profile?.onlineStatus ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                {profile?.onlineStatus ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </footer>
      </main>

      {/* ═══════════ MOBILE BOTTOM TAB BAR ═══════════ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
        {/* Gradient fade above the bar */}
        <div className="h-6 bg-gradient-to-t from-white/90 dark:from-slate-900/90 to-transparent pointer-events-none" />

        <div
          className={`transition-colors ${
            isCrafted
              ? 'bg-white/95 dark:bg-slate-950/95 border-t border-slate-200/90 dark:border-slate-800 backdrop-blur-md shadow-[0_-2px_10px_rgba(0,0,0,0.04)]'
              : 'glass-card border-t border-slate-200/80 dark:border-slate-700/80 shadow-[0_-4px_20px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_-6px_rgba(0,0,0,0.3)]'
          }`}
        >
          <div className="flex items-center justify-around px-1 sm:px-2 py-1 safe-area-pb">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `relative flex flex-col items-center gap-0.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-2xl transition-all duration-200 shrink-0 ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 dark:text-slate-500 active:text-slate-600'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="relative">
                        <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                        {isActive && (
                          <motion.span
                            layoutId="bottomnav-dot"
                            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                      </span>
                      <span className={`text-[10px] font-medium leading-none whitespace-nowrap ${isActive ? 'font-semibold' : ''}`}>
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Customer Profile Edit Modal */}
      <CustomerProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
}
