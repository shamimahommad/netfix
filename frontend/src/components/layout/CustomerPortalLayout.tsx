import { Outlet, useNavigate, NavLink } from 'react-router-dom';
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
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';
import { useCustomerPortalProfile } from '@/contexts/CustomerPortalContext';
import { authService } from '@/services/auth.service';
import { customerPortalService } from '@/services/customer-portal.service';
import Footer from './Footer';
import { useState, useEffect } from 'react';

const navItems = [
  { path: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/customer/pay-bill', label: 'Pay Bill', icon: CreditCard },
  { path: '/customer/payment-history', label: 'Payment History', icon: FileText },
  { path: '/customer/ticket', label: 'Ticket', icon: Ticket },
  { path: '/customer/report', label: 'Report', icon: BarChart3 },
];

export default function CustomerPortalLayout() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const { profile, setProfile } = useCustomerPortalProfile();
  const [copied, setCopied] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    customerPortalService.getDashboard().then((res) => {
      const c = res.data?.customer;
      const onlineStatus = res.data?.network?.onlineStatus ?? false;
      if (c) setProfile({
        fullName: c.fullName,
        customerCode: c.customerCode,
        phone: c.phone ?? null,
        email: c.email ?? null,
        onlineStatus,
      });
    }).catch(() => {});
  }, [setProfile]);

  const handleLogout = () => {
    authService.logout();
    logout();
    navigate('/customer/login', { replace: true });
  };

  const copyId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Header */}
      <div className={`flex items-center gap-3 p-5 border-b border-slate-200/60 dark:border-slate-600/60 ${sidebarCollapsed && !isMobile ? 'flex-col py-6' : ''}`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {(!sidebarCollapsed || isMobile) && (
            <span className="font-display font-bold text-slate-900 dark:text-slate-100 truncate">
              Customer Portal
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isMobile && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-700 dark:hover:text-slate-300 transition-all duration-200"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu className="w-5 h-5" />
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={toggleTheme}
            className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-amber-500 dark:hover:text-amber-400 transition-all duration-200"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </motion.button>
        </div>
      </div>

      {/* Profile card */}
      <div className={`p-4 border-b border-slate-200/60 dark:border-slate-600/60 ${sidebarCollapsed && !isMobile ? 'px-3' : ''}`}>
        <div className={`rounded-2xl p-4 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-600/50 ${sidebarCollapsed && !isMobile ? 'p-3 flex justify-center' : ''}`}>
          <div className={`flex items-center gap-3 ${sidebarCollapsed && !isMobile ? 'flex-col justify-center' : ''}`}>
            <div className="relative flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400/20 to-indigo-500/20 dark:from-blue-500/30 dark:to-indigo-600/30 flex items-center justify-center ring-2 ring-blue-200/60 dark:ring-blue-700/40">
              <User className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 shadow-sm ${profile?.onlineStatus ? 'bg-emerald-500 status-dot-online' : 'bg-slate-400'}`}
                title={profile?.onlineStatus ? 'Online' : 'Offline'}
              />
            </div>
            {(!sidebarCollapsed || isMobile) && (
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {profile?.fullName || user?.first_name || 'Customer'}
                </p>
                <span className={`inline-flex items-center gap-1.5 mt-1 text-xs font-medium ${profile?.onlineStatus ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profile?.onlineStatus ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {profile?.onlineStatus ? 'Online' : 'Offline'}
                </span>
              </div>
            )}
          </div>
          {(!sidebarCollapsed || isMobile) && (
            <div className="mt-4 pt-4 space-y-2 border-t border-slate-200/60 dark:border-slate-600/50">
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={user?.email || profile?.email || ''}>
                {user?.email || profile?.email || '—'}
              </p>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Username</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{profile?.customerCode || '—'}</span>
                <span className="text-slate-500 dark:text-slate-400">Mobile</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{profile?.phone || '—'}</span>
                <span className="text-slate-500 dark:text-slate-400">ID</span>
                <span className="flex items-center gap-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{profile?.customerCode || '—'}</span>
                  <button
                    type="button"
                    onClick={() => copyId(profile?.customerCode || '')}
                    className="p-0.5 rounded-md text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title="Copy ID"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto customer-portal-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => isMobile && setMobileOpen(false)}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  sidebarCollapsed && !isMobile ? 'justify-center px-3' : ''
                } ${
                  isActive
                    ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-blue-500"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-500/15 dark:bg-blue-500/25 text-blue-600 dark:text-blue-400' : 'bg-transparent group-hover:bg-slate-200/50 dark:group-hover:bg-slate-600/50'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  {(!sidebarCollapsed || isMobile) && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-200/60 dark:border-slate-600/60">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          type="button"
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 ${
            sidebarCollapsed && !isMobile ? 'justify-center px-3' : ''
          }`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {(!sidebarCollapsed || isMobile) && 'Logout'}
        </motion.button>
      </div>
    </>
  );

  return (
    <div className="min-h-0 flex-1 flex bg-slate-50 dark:bg-slate-900 transition-colors duration-300 customer-portal-app">
      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 88 : 280 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="hidden lg:flex flex-shrink-0 flex-col glass-card border-r border-slate-200/80 dark:border-slate-700/80 shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile menu button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-3 rounded-2xl glass-card shadow-lg border border-slate-200/80 dark:border-slate-600/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 transition-all"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </motion.button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] flex flex-col glass-card border-r border-slate-200/80 dark:border-slate-700/80 shadow-2xl z-50 overflow-hidden"
            >
              <div className="absolute top-4 right-4 z-10">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
              <div className="pt-14 overflow-y-auto flex-1">
                <SidebarContent isMobile />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 min-w-0 overflow-auto bg-gradient-to-br from-slate-50 via-slate-50/95 to-blue-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/95 customer-portal-scrollbar flex flex-col justify-between">
        <div className="pt-4 lg:pt-0 pl-4 lg:pl-0 pr-4 pb-4 pt-16 lg:pt-6 flex-1">
          <Outlet />
        </div>
        <Footer />
      </main>
    </div>
  );
}
