import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Mail, Phone } from 'lucide-react';
import { authService, AuthError } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';

export default function CustomerLoginPage() {
  const navigate = useNavigate();
  const { setUser, user, isAuthenticated } = useAuthStore();
  const [login, setLogin] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role_code === 'customer' || user.user_type === 'customer') {
        navigate('/customer/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  if (isAuthenticated && user) {
    return null;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await authService.customerLogin(login.trim(), phone.trim());
      setUser(response.user);
      if (response.user.role_code === 'customer' || response.user.user_type === 'customer') {
        navigate('/customer/dashboard', { replace: true });
      } else {
        setError('This login is for customer accounts only. Use the main login for staff.');
      }
    } catch (err) {
      const authError = err as AuthError & { message?: string | string[] };
      const msg = authError?.message;
      setError(
        Array.isArray(msg) ? msg[0] : (msg as string) || 'Invalid email/ID or phone.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="customer-portal-app min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 dark:from-blue-600 dark:via-blue-700 dark:to-indigo-700 px-4 py-12">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-y-1/2" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <motion.div
          initial={{ scale: 0.98 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="glass-card rounded-3xl shadow-2xl p-8 border border-white/20 dark:border-slate-600"
        >
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mb-1">
            Customer Portal
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
            Sign in with your Email or Customer ID; enter your Phone/Mobile number as password.
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50 text-sm text-red-800 dark:text-red-300"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email or Customer ID
              </label>
              <input
                id="login"
                type="text"
                autoComplete="username"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="you@example.com or 000001"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-all disabled:opacity-50"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone / Mobile number (password)
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01712345678"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-all disabled:opacity-50"
                disabled={isLoading}
              />
            </div>
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              {isLoading ? 'Signing in…' : 'Sign in'}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            <a href="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Staff login
            </a>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
