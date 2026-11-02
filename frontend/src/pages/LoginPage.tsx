import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService, AuthError } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';
import { tenantsService } from '@/services/tenants.service';
import { Tenant } from '@/types/tenant.types';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser, user, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTenants, setShowTenants] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.user_type === 'saas') {
        navigate('/saas/dashboard', { replace: true });
      } else if (user.user_type === 'isp') {
        navigate('/dashboard', { replace: true });
      } else if (user.user_type === 'customer' || user.role_code === 'customer') {
        navigate('/customer/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (!isAuthenticated) {
      loadTenants();
    }
  }, [isAuthenticated]);

  if (isAuthenticated && user) {
    return null;
  }

  const loadTenants = async () => {
    setIsLoadingTenants(true);
    try {
      const response = await tenantsService.getTenants();
      setTenants(response.data);
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        console.error('Failed to load tenants:', err);
      }
      setTenants([]);
    } finally {
      setIsLoadingTenants(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await authService.login({ email, password });
      if (selectedTenant && response.user.tenant_id !== selectedTenant.tenantId) {
        setError('This account does not belong to the selected tenant.');
        setSelectedTenant(null);
        return;
      }
      setUser(response.user);
      if (response.user.user_type === 'saas') {
        navigate('/saas/dashboard', { replace: true });
      } else if (response.user.user_type === 'isp') {
        navigate('/dashboard', { replace: true });
      } else if (response.user.user_type === 'customer' || response.user.role_code === 'customer') {
        navigate('/customer/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTenantLogin = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowTenants(false);
    setError(null);
    setEmail(tenant.businessEmail);
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left panel - brand */}
      <div className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 xl:p-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(34,197,94,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#33415512_1px,transparent_1px),linear-gradient(to_bottom,#33415512_1px,transparent_1px)] bg-[size:3rem_3rem]" />
        <div className="relative">
          <span className="text-emerald-400 font-semibold text-sm tracking-wider uppercase">ISP SaaS</span>
          <h1 className="mt-4 text-4xl xl:text-5xl font-bold text-white tracking-tight">
            Billing & network management for modern ISPs
          </h1>
          <p className="mt-6 text-lg text-slate-400 max-w-md leading-relaxed">
            Sign in to manage customers, billing, and network from one place.
          </p>
        </div>
        <div className="relative flex flex-col gap-6">
          {[
            { label: 'Unified billing & invoicing', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
            { label: 'PPPoE & hotspot ready', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
            { label: 'Multi-tenant ready', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
              </div>
              <span className="text-slate-300 font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-12 bg-white dark:bg-slate-900">
        <div className="w-full max-w-md">
          {!showTenants ? (
            <>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="lg:hidden mb-10"
              >
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm tracking-wider uppercase">ISP SaaS</span>
                <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Sign in</h1>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
              >
              <div className="mb-8 hidden lg:block">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h2>
                <p className="mt-1 text-slate-500 dark:text-slate-400">Sign in to your account to continue</p>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Email / Username / Phone
                  </label>
                  <input
                    id="email"
                    type="text"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"
                    placeholder="you@example.com / johndoe / 017xxxxxxxx"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>

              <p className="mt-6 text-center">
                <Link
                  to="/customer/login"
                  className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                >
                  Customer login →
                </Link>
              </p>

              {tenants.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTenants(true);
                      setError(null);
                      setEmail('');
                      setPassword('');
                    }}
                    className="w-full text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                  >
                    Login as Tenant (SaaS Admin) →
                  </button>
                </div>
              )}

              {selectedTenant && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Logging in as: {selectedTenant.tenantName}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Use tenant admin credentials</p>
                  <button
                    type="button"
                    onClick={() => { setSelectedTenant(null); setEmail(''); }}
                    className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Change tenant
                  </button>
                </div>
              )}

              <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
                Enterprise billing & network management
              </p>
            </motion.div>
          </>
          ) : (
            /* Tenant selection */
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <button
                onClick={() => { setShowTenants(false); setError(null); }}
                className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to login
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Select tenant</h2>
                <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">Choose a tenant to login as (SaaS Admin)</p>
              </div>
              {error && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
              {isLoadingTenants ? (
                <div className="flex justify-center py-12">
                  <svg className="animate-spin h-10 w-10 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : tenants.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 dark:text-slate-400 font-medium">No tenants available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.tenantId}
                      onClick={() => handleTenantLogin(tenant)}
                      className="p-5 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-left transition-all group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm">
                          {tenant.tenantName.charAt(0).toUpperCase()}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          tenant.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' :
                          tenant.status === 'trial' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' :
                          'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {tenant.status}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                        {tenant.tenantName}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{tenant.tenantCode} · {tenant.businessEmail}</p>
                      <span className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        Login <svg className="w-4 h-4 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
