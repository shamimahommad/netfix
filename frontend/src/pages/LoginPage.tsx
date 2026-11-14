import { useState, FormEvent, useEffect, useMemo } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Router,
  Receipt,
  Network,
  Users,
  Activity,
  Building2,
  ChevronRight,
  AlertCircle,
  X,
  Search,
  Zap,
  HelpCircle,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { authService, AuthError } from '@/services/auth.service';
import { sanitizeErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { tenantsService } from '@/services/tenants.service';
import { Tenant } from '@/types/tenant.types';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser, user, isAuthenticated } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tenant selection state
  const [showTenants, setShowTenants] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantSearch, setTenantSearch] = useState('');

  // UI helpers
  const [demoFilled, setDemoFilled] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  // Clear stale persisted auth state if access token is missing
  useEffect(() => {
    if (!token && (isAuthenticated || user)) {
      setUser(null);
    }
  }, [token, isAuthenticated, user, setUser]);

  // Load remembered email and tenants on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('netfix_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    if (!isAuthenticated) {
      loadTenants();
    }
  }, [isAuthenticated]);

  const loadTenants = async () => {
    setIsLoadingTenants(true);
    try {
      const response = await tenantsService.getTenants();
      setTenants(response.data || []);
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        console.error('Failed to load tenants:', err);
      }
      setTenants([]);
    } finally {
      setIsLoadingTenants(false);
    }
  };

  const filteredTenants = useMemo(() => {
    if (!tenantSearch.trim()) return tenants;
    const q = tenantSearch.toLowerCase().trim();
    return tenants.filter(
      (t) =>
        t.tenantName.toLowerCase().includes(q) ||
        t.tenantCode.toLowerCase().includes(q) ||
        t.businessEmail.toLowerCase().includes(q)
    );
  }, [tenants, tenantSearch]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (rememberMe) {
        localStorage.setItem('netfix_remembered_email', email.trim());
      } else {
        localStorage.removeItem('netfix_remembered_email');
      }

      const response = await authService.login({ email: email.trim(), password });
      const userObj = response?.user || (response as any)?.data?.user;

      if (!userObj) {
        setError(
          (response as any)?.message ||
          'Authentication failed. Invalid response from server.'
        );
        return;
      }

      if (selectedTenant && userObj.tenant_id !== selectedTenant.tenantId) {
        setError('This account does not belong to the selected tenant.');
        setSelectedTenant(null);
        return;
      }

      setUser(userObj);
      if (userObj.user_type === 'saas') {
        navigate('/saas/dashboard', { replace: true });
      } else if (userObj.user_type === 'isp') {
        navigate('/dashboard', { replace: true });
      } else if (userObj.user_type === 'customer' || userObj.role_code === 'customer') {
        navigate('/customer/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      const authError = err as AuthError;
      const msg = authError?.message || (err?.response?.data?.message) || 'Invalid email or password. Please try again.';
      setError(sanitizeErrorMessage(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTenantLogin = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowTenants(false);
    setError(null);
    setEmail(tenant.businessEmail);
    setPassword('Star@1122');
  };

  const fillDemo = (role: 'saas' | 'isp') => {
    setError(null);
    if (role === 'saas') {
      setEmail('admin@ispsaas.com');
      setPassword('Star@1122');
      setSelectedTenant(null);
      setDemoFilled('SaaS Superadmin');
    } else {
      setEmail('admin@netfix.com');
      setPassword('Star@1122');
      setDemoFilled('ISP Admin');
    }
    setTimeout(() => setDemoFilled(null), 3000);
  };

  if (token && isAuthenticated && user) {
    const target =
      user.user_type === 'saas'
        ? '/saas/dashboard'
        : user.user_type === 'isp'
        ? '/dashboard'
        : '/customer/dashboard';
    return <Navigate to={target} replace />;
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-x-hidden select-none">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-[28rem] sm:w-[42rem] h-[28rem] sm:h-[42rem] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-[28rem] sm:w-[42rem] h-[28rem] sm:h-[42rem] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#33415510_1px,transparent_1px),linear-gradient(to_bottom,#33415510_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/login" className="flex items-center gap-3 group focus:outline-none">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-white font-sans">
                Net<span className="text-emerald-400">Fix</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                SaaS OS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">ISP Billing & Network Automation</p>
          </div>
        </Link>

        {/* Top Actions: Customer Portal Link */}
        <div className="flex items-center gap-3">
          <Link
            to="/customer/login"
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 text-xs sm:text-sm font-medium text-slate-200 transition-all shadow-sm"
          >
            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            <span>Customer Portal</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center">
          
          {/* Left Column (Desktop Showcase) */}
          <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-center space-y-8 pr-4">
            {/* Tagline Pill */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider self-start"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Next-Gen ISP Infrastructure & Billing
            </motion.div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="space-y-4"
            >
              <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-white leading-[1.15]">
                Manage subscribers, routers & auto-billing in{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                  one unified cloud.
                </span>
              </h1>
              <p className="text-base xl:text-lg text-slate-400 max-w-xl leading-relaxed">
                Automated MikroTik RouterOS 7.x sync, real-time EPON/GPON OLT telemetry, instant bKash/Nagad billing, and resilient multi-tenant data isolation.
              </p>
            </motion.div>

            {/* Feature Capabilities Grid (Replacing mock telemetry card) */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {[
                {
                  icon: Router,
                  color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30',
                  title: 'MikroTik RouterOS 7.x',
                  desc: 'Auto PPPoE secret sync, speed limit queues, and instant expire lock.',
                },
                {
                  icon: Receipt,
                  color: 'from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/30',
                  title: 'Automated Billing & MFS',
                  desc: 'Monthly invoice cycles, SMS reminders & bKash / Nagad online auto-recharge.',
                },
                {
                  icon: Network,
                  color: 'from-indigo-500/20 to-purple-500/10 text-indigo-400 border-indigo-500/30',
                  title: 'EPON & GPON OLT Sync',
                  desc: 'Real-time PON optical metrics, ONU auto-discovery, and power alarms.',
                },
                {
                  icon: Users,
                  color: 'from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30',
                  title: 'Resellers & Multi-Tenant',
                  desc: 'Complete sub-reseller commissions, isolated tenant spaces & custom RBAC.',
                },
              ].map((feat, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${feat.color} border flex items-center justify-center mb-3`}>
                    <feat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">{feat.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Platform Badges */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-slate-400">
              <span className="px-3 py-1.5 rounded-full bg-slate-900/70 border border-slate-800 text-slate-300 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Enterprise Multi-Tenant
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-900/70 border border-slate-800 text-slate-300 font-medium flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400" /> High Availability
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-900/70 border border-slate-800 text-slate-300 font-medium flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" /> 24/7 Automation
              </span>
            </div>
          </div>

          {/* Right Column (Mobile-First Login Container) */}
          <div className="w-full lg:col-span-6 xl:col-span-5 max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-slate-800/90 shadow-2xl shadow-black/80 p-6 sm:p-8 relative overflow-hidden"
            >
              {/* Glowing Top Accent Border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

              {!showTenants ? (
                <>
                  {/* Card Header */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Staff & Administrator</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowHelpModal(true)}
                        className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                        title="Login Help"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white mt-3 tracking-tight">
                      Sign in
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Enter your credentials to access your ISP dashboard.
                    </p>
                  </div>

                  {/* 1-Tap Quick Demo Credentials */}
                  <div className="mb-5 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-amber-400" /> Quick Demo Fill:
                      </span>
                      {demoFilled && (
                        <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 animate-pulse">
                          <CheckCircle2 className="w-3 h-3" /> Filled {demoFilled}!
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => fillDemo('saas')}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-200 transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        <span>👑</span>
                        <span>SaaS Admin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fillDemo('isp')}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-200 transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        <span>⚡</span>
                        <span>ISP Admin</span>
                      </button>
                    </div>
                  </div>

                  {/* Error Notification Alert */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-5 overflow-hidden"
                      >
                        <div className="p-3.5 rounded-2xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs sm:text-sm flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <div className="flex-1 font-medium">{error}</div>
                          <button
                            type="button"
                            onClick={() => setError(null)}
                            className="text-red-400 hover:text-red-200 shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Selected Tenant Active Banner */}
                  {selectedTenant && (
                    <div className="mb-5 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                          {selectedTenant.tenantName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            Tenant: {selectedTenant.tenantName}
                          </p>
                          <p className="text-[10px] text-emerald-400 font-mono truncate">
                            ID #{selectedTenant.tenantCode}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTenant(null);
                          setEmail('');
                        }}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  )}

                  {/* Login Form */}
                  <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-4.5">
                    {/* Email / Username Input */}
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5"
                      >
                        Email / Username / Mobile
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="email"
                          type="text"
                          autoComplete="username"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="admin@netfix.com or username"
                          disabled={isLoading}
                          className="w-full h-12 pl-10 pr-10 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500 transition-all"
                        />
                        {email && (
                          <button
                            type="button"
                            onClick={() => setEmail('')}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Password Input */}
                    <div>
                      <label
                        htmlFor="password"
                        className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          disabled={isLoading}
                          className="w-full h-12 pl-10 pr-11 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500 transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none"
                          tabIndex={-1}
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Remember Me & Help Trigger */}
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                        />
                        <span className="text-xs text-slate-400 hover:text-slate-300 font-medium">
                          Remember this device
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() => setShowHelpModal(true)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                      >
                        Need help?
                      </button>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-base shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Authenticating...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In to Dashboard</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Multi-Tenant Switcher Trigger (if tenants loaded) */}
                  {tenants.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setShowTenants(true);
                          setError(null);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Sign in to specific Tenant / ISP ({tenants.length}) →</span>
                      </button>
                    </div>
                  )}

                  {/* Customer Portal Callout Box */}
                  <div className="mt-6 pt-5 border-t border-slate-800/80">
                    <Link
                      to="/customer/login"
                      className="group p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-cyan-500/40 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                          <Globe className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                            Broadband Customer?
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Pay bills, check validity & view usage
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  </div>
                </>
              ) : (
                /* Multi-Tenant Selection Mode */
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowTenants(false);
                        setError(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>Back to Login</span>
                    </button>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {tenants.length} Tenants Available
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-white">Select Organization</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Choose an ISP tenant to authenticate as SaaS or Tenant Admin
                    </p>
                  </div>

                  {/* Tenant Search Bar */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={tenantSearch}
                      onChange={(e) => setTenantSearch(e.target.value)}
                      placeholder="Search by ISP name or code..."
                      className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Tenants List */}
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {isLoadingTenants ? (
                      <div className="py-8 text-center">
                        <svg className="animate-spin h-6 w-6 text-emerald-500 mx-auto" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="text-xs text-slate-400 mt-2">Loading tenants...</p>
                      </div>
                    ) : filteredTenants.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No tenants match your search.
                      </div>
                    ) : (
                      filteredTenants.map((t) => (
                        <button
                          key={t.tenantId}
                          type="button"
                          onClick={() => handleTenantLogin(t)}
                          className="w-full p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition-all flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
                              {t.tenantName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                                {t.tenantName}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-mono truncate">
                                ID #{t.tenantCode} · {t.businessEmail}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                t.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {t.status}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Mobile Footer Meta */}
            <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-3">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> 256-bit SSL Protected
              </span>
              <span>·</span>
              <span>Multi-Tenant RBAC</span>
            </div>
          </div>
        </div>
      </main>

      {/* Desktop & Mobile Bottom Footer */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-900">
        <div>
          © 2026 <span className="text-slate-300 font-semibold">NetFix</span> Technologies. All rights reserved.
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-slate-400">RouterOS v7.x Ready</span>
          <span>·</span>
          <span className="text-slate-400">EPON/GPON Sync</span>
          <span>·</span>
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="text-emerald-400 hover:underline"
          >
            System Help
          </button>
        </div>
      </footer>

      {/* Login Help & Support Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-white text-base">NetFix Access Guide</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-4 text-xs text-slate-300">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <h4 className="font-bold text-emerald-400 mb-1">Standard Admin Accounts:</h4>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">SaaS SuperAdmin:</span>
                      <span className="text-slate-200">admin@ispsaas.com / password123</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">ISP Tenant Admin:</span>
                      <span className="text-slate-200">admin@netfix.com / password123</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-white">Forgot Password or Blocked?</h4>
                  <p className="text-slate-400 leading-relaxed">
                    If your account is locked or you forgot your credentials, contact your ISP Super-Administrator or reset the password hash via the backend database console.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 text-cyan-300">
                  <strong>Looking for your broadband bill?</strong> Use the{' '}
                  <Link to="/customer/login" className="underline font-bold text-white">
                    Customer Portal
                  </Link>{' '}
                  with your Customer ID or registered mobile number.
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}