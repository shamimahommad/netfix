import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Globe,
  CreditCard,
  FileText,
  Ticket,
  Wifi,
  CheckCircle2,
  AlertCircle,
  X,
  Zap,
  HelpCircle,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { authService, AuthError } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';

export default function CustomerLoginPage() {
  const navigate = useNavigate();
  const { setUser, user, isAuthenticated } = useAuthStore();

  const [login, setLogin] = useState('');
  const [phone, setPhone] = useState('');
  const [showPhone, setShowPhone] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoFilled, setDemoFilled] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) return;
    if (isAuthenticated && user) {
      if (user.role_code === 'customer' || user.user_type === 'customer') {
        navigate('/customer/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Load remembered customer login on mount
  useEffect(() => {
    const savedLogin = localStorage.getItem('netfix_customer_login');
    if (savedLogin) {
      setLogin(savedLogin);
      setRememberMe(true);
    }
  }, []);

  if (isAuthenticated && user) {
    return null;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (rememberMe) {
        localStorage.setItem('netfix_customer_login', login.trim());
      } else {
        localStorage.removeItem('netfix_customer_login');
      }

      const response = await authService.customerLogin(login.trim(), phone.trim());
      const userObj = response?.user || (response as any)?.data?.user;

      if (!userObj) {
        setError((response as any)?.message || 'Customer authentication failed. Please try again.');
        return;
      }

      setUser(userObj);
      if (userObj.role_code === 'customer' || userObj.user_type === 'customer') {
        navigate('/customer/dashboard', { replace: true });
      } else {
        setError('This portal is for broadband customers only. Please use the Staff Login.');
      }
    } catch (err: any) {
      const authError = err as AuthError & { message?: string | string[] };
      const msg = authError?.message || (err?.response?.data?.message) || 'Invalid Customer ID or registered mobile number.';
      setError(Array.isArray(msg) ? msg[0] : (msg as string));
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoCustomer = () => {
    setError(null);
    setLogin('100001');
    setPhone('01774581701');
    setDemoFilled(true);
    setTimeout(() => setDemoFilled(false), 2500);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-x-hidden select-none">
      {/* Ambient Cyber Mesh Glows */}
      <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-[28rem] sm:w-[42rem] h-[28rem] sm:h-[42rem] bg-cyan-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-[28rem] sm:w-[42rem] h-[28rem] sm:h-[42rem] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#33415510_1px,transparent_1px),linear-gradient(to_bottom,#33415510_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/customer/login" className="flex items-center gap-3 group focus:outline-none">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Wifi className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-white font-sans">
                Net<span className="text-cyan-400">Fix</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Self-Care
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Customer Self-Service Portal</p>
          </div>
        </Link>

        {/* Top Header Right Actions */}
        <div className="flex items-center gap-3">
          <Link
            to="/topup"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-cyan-300 transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
            <span>Instant Pay</span>
          </Link>

          <Link
            to="/login"
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs sm:text-sm font-medium text-slate-200 transition-all shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span>Staff Login</span>
          </Link>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center">
          
          {/* Left Column (Customer Self-Care Feature Showcase - Desktop) */}
          <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-center space-y-8 pr-4">
            {/* Tagline Pill */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider self-start"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Broadband Subscriber Self-Service
            </motion.div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="space-y-4"
            >
              <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-white leading-[1.15]">
                Pay bills, check validity & monitor broadband in{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400">
                  one simple portal.
                </span>
              </h1>
              <p className="text-base xl:text-lg text-slate-400 max-w-xl leading-relaxed">
                Instant recharge via bKash, Nagad & Rocket, live line speed metrics, automated invoices, and 24/7 direct ticket support.
              </p>
            </motion.div>

            {/* 4 Feature Cards */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {[
                {
                  icon: CreditCard,
                  color: 'from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/30',
                  title: 'Instant Online Bill Pay',
                  desc: 'Recharge using bKash, Nagad, Rocket or card. Automatic zero-wait renewal.',
                },
                {
                  icon: Wifi,
                  color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30',
                  title: 'Package & Validity Info',
                  desc: 'Check live connection status, remaining validity days, and bandwidth speed.',
                },
                {
                  icon: Ticket,
                  color: 'from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30',
                  title: 'Direct Ticket Support',
                  desc: 'Submit support requests directly to your ISP technical desk for quick resolution.',
                },
                {
                  icon: FileText,
                  color: 'from-indigo-500/20 to-purple-500/10 text-indigo-400 border-indigo-500/30',
                  title: 'Invoices & Billing Receipts',
                  desc: 'View full payment history, download official PDF invoices and transaction records.',
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

            {/* Quick Pay Link Banner */}
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
                  ⚡
                </span>
                <div>
                  <p className="font-bold text-white">Need to pay your bill without logging in?</p>
                  <p className="text-slate-400">Use our instant public topup portal with your Customer ID.</p>
                </div>
              </div>
              <Link
                to="/topup"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold transition-colors shrink-0"
              >
                <span>Quick Pay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Right Column (Mobile-First Customer Login Form) */}
          <div className="w-full lg:col-span-6 xl:col-span-5 max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-slate-800/90 shadow-2xl shadow-black/80 p-6 sm:p-8 relative overflow-hidden"
            >
              {/* Glowing Top Accent Border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />

              {/* Card Header */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Subscriber Portal</span>
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
                  Customer Sign In
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Enter your Customer ID / Email and your registered Mobile number.
                </p>
              </div>

              {/* 1-Tap Quick Demo Credentials */}
              <div className="mb-5 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-cyan-400" /> Quick Demo Fill:
                  </span>
                  {demoFilled && (
                    <span className="text-[10px] font-semibold text-cyan-400 flex items-center gap-1 animate-pulse">
                      <CheckCircle2 className="w-3 h-3" /> Filled Demo Customer!
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={fillDemoCustomer}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-200 transition-all text-center flex items-center justify-center gap-2"
                >
                  <span>👤</span>
                  <span>Demo Subscriber (ID: 100001 / Phone: 01774581701)</span>
                </button>
              </div>

              {/* Error Alert */}
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

              {/* Customer Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-4.5">
                {/* Customer ID / Email Field */}
                <div>
                  <label
                    htmlFor="customer-login"
                    className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5"
                  >
                    Customer ID / PPPoE Username / Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="customer-login"
                      type="text"
                      autoComplete="username"
                      required
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      placeholder="e.g. 100001, AimTurn, or you@example.com"
                      disabled={isLoading}
                      className="w-full h-12 pl-10 pr-10 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60 focus:border-cyan-500 transition-all"
                    />
                    {login && (
                      <button
                        type="button"
                        onClick={() => setLogin('')}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Phone Number (used as password) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="customer-phone"
                      className="block text-xs sm:text-sm font-semibold text-slate-300"
                    >
                      Registered Mobile Number or Password
                    </label>
                    <span className="text-[11px] text-cyan-400 font-medium">Mobile or PPPoE Password</span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      id="customer-phone"
                      type={showPhone ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="017xxxxxxxx or password"
                      disabled={isLoading}
                      className="w-full h-12 pl-10 pr-11 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60 focus:border-cyan-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPhone(!showPhone)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none"
                      tabIndex={-1}
                      title={showPhone ? 'Hide number' : 'Show number'}
                    >
                      {showPhone ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                    />
                    <span className="text-xs text-slate-400 hover:text-slate-300 font-medium">
                      Remember Customer ID
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    Need help?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-base shadow-lg shadow-cyan-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
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
                      <span>Sign In to Self-Care</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Staff / Admin Login Callout */}
              <div className="mt-6 pt-5 border-t border-slate-800/80">
                <Link
                  to="/login"
                  className="group p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-emerald-500/40 flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                        ISP Manager or Staff?
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Access billing, MikroTik routers & tenant admin
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                </Link>
              </div>
            </motion.div>

            {/* Mobile Footer Meta */}
            <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-3">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> 256-bit SSL Protected
              </span>
              <span>·</span>
              <span>Instant bKash/Nagad Auto Gateway</span>
            </div>
          </div>
        </div>
      </main>

      {/* Desktop & Mobile Bottom Footer */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-900">
        <div>
          © 2026 <span className="text-slate-300 font-semibold">NetFix</span> Customer Self-Care. All rights reserved.
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <Link to="/topup" className="text-slate-400 hover:text-cyan-400 transition-colors">
            Quick Pay
          </Link>
          <span>·</span>
          <Link to="/login" className="text-slate-400 hover:text-emerald-400 transition-colors">
            Staff Portal
          </Link>
          <span>·</span>
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="text-cyan-400 hover:underline"
          >
            Customer Support
          </button>
        </div>
      </footer>

      {/* Customer Login Help Modal */}
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
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-white text-base">Subscriber Access Guide</h3>
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
                  <h4 className="font-bold text-cyan-400 mb-1">How to Sign In:</h4>
                  <ul className="space-y-1.5 text-slate-300 list-disc list-inside text-[11px] leading-relaxed">
                    <li>
                      <strong>Customer ID:</strong> Your assigned ISP customer code (e.g. <code>100001</code>) or your registered email address.
                    </li>
                    <li>
                      <strong>Password:</strong> Your active 11-digit mobile phone number registered with your ISP line (e.g. <code>01774581701</code>).
                    </li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <h4 className="font-bold text-white mb-1">Testing Demo Subscriber:</h4>
                  <p className="text-slate-400 text-[11px]">
                    Customer ID: <code className="text-cyan-400 font-mono">100001</code>
                    <br />
                    Mobile: <code className="text-cyan-400 font-mono">01774581701</code>
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-[11px]">
                  <strong>Need instant recharge without login?</strong> You can pay directly via bKash/Nagad on the{' '}
                  <Link to="/topup" className="underline font-bold text-white">
                    Instant Topup
                  </Link>{' '}
                  page.
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
