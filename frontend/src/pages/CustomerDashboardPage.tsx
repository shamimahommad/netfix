import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, User, Wifi, Calendar, DollarSign, FileText, BarChart3, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCustomerPortalProfile } from '@/contexts/CustomerPortalContext';
import {
  customerPortalService,
  CustomerDashboardData,
  CustomerPaymentHistoryItem,
} from '@/services/customer-portal.service';
import { PortalSkeleton } from '@/components/customer-portal';

function formatDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return '—';
  }
}

function formatTraffic(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;
  return `${bytes} B`;
}

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const itemUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export default function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { setProfile } = useCustomerPortalProfile();
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [payments, setPayments] = useState<CustomerPaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await customerPortalService.getDashboard();
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      const res = await customerPortalService.getPaymentHistory(1, 20);
      setPayments(res.data);
    } catch {
      setPayments([]);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadPayments();
  }, []);

  useEffect(() => {
    if (data?.customer) {
      setProfile({
        fullName: data.customer.fullName,
        customerCode: data.customer.customerCode,
        phone: data.customer.phone ?? null,
        email: data.customer.email ?? null,
      });
    }
  }, [data?.customer, setProfile]);

  if (loading && !data) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 lg:p-6 space-y-6"
      >
        <PortalSkeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <PortalSkeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <PortalSkeleton className="h-64 rounded-2xl" />
          <PortalSkeleton className="h-64 rounded-2xl" />
        </div>
      </motion.div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-slate-700 max-w-md w-full text-center"
        >
          <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/customer/login', { replace: true })}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-2xl shadow-lg shadow-blue-500/25 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.97]"
          >
            Back to login
          </button>
        </motion.div>
      </div>
    );
  }

  const d = data!;
  const monthName = new Date().toLocaleString('default', { month: 'long' });
  const usageChartData = [
    { name: 'Download', value: Math.max(0.01, Number(d.network?.downloadBytes ?? 0) / 1e9), fill: '#3b82f6' },
    { name: 'Upload', value: Math.max(0.01, Number(d.network?.uploadBytes ?? 0) / 1e9), fill: '#10b981' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 lg:p-6 space-y-6"
    >
      {/* Current Package – gradient card with floating badge */}
      <motion.section
        variants={itemUp}
        initial="initial"
        animate="animate"
        whileHover={{ y: -2, transition: { duration: 0.2 } }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 dark:from-blue-600 dark:via-blue-700 dark:to-indigo-700 p-6 shadow-xl shadow-blue-500/20 border border-blue-400/20"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <h2 className="text-sm font-semibold text-blue-100/90 uppercase tracking-wide mb-4">
            Current package
          </h2>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <motion.span
              whileHover={{ scale: 1.03 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/20 backdrop-blur-sm text-white font-semibold shadow-lg border border-white/20"
            >
              <Zap className="w-4 h-4" />
              {d.packageName || '—'} {d.planPrice != null ? `৳${d.planPrice}` : ''}
            </motion.span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <User className="w-5 h-5 text-white/90" />
              </div>
              <div>
                <p className="text-xs text-blue-100/70">Account Status</p>
                <p className="font-semibold text-emerald-300">{d.billingStatus || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center relative">
                <Wifi className="w-5 h-5 text-white/90" />
                {d.network?.onlineStatus && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 status-dot-online" />
                )}
              </div>
              <div>
                <p className="text-xs text-blue-100/70">Connection</p>
                <p className="font-semibold text-emerald-300">
                  {d.network?.onlineStatus ? 'ONLINE' : 'OFFLINE'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white/90" />
              </div>
              <div>
                <p className="text-xs text-blue-100/70">Expiry Date</p>
                <p className="font-semibold text-white">{formatDate(d.expiryDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white/90" />
              </div>
              <div>
                <p className="text-xs text-blue-100/70">Plan rate</p>
                <p className="font-semibold text-white">
                  ৳{d.planPrice != null ? d.planPrice.toFixed(1) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.div variants={stagger} initial="initial" animate="animate" className="grid lg:grid-cols-2 gap-6">
        {/* Payment History */}
        <motion.section
          variants={itemUp}
          whileHover={{ y: -2, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.1)' }}
          className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 overflow-hidden transition-all duration-300"
        >
          <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Payment History
            </h2>
            <Link
              to="/customer/payment-history"
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-4">
            {payments.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm py-8 text-center">No payments yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 text-left text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-3 font-semibold rounded-tl-xl">Pay Date</th>
                      <th className="px-4 py-3 font-semibold">Gateway</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold rounded-tr-xl">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.slice(0, 5).map((p) => (
                      <tr
                        key={p.paymentId}
                        className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors duration-200"
                      >
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatDate(p.paidAt)}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{String(p.gateway || '—').toUpperCase()}</td>
                        <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">{Number(p.amount ?? 0).toFixed(0)}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate max-w-[180px]">
                          {p.remarks?.trim() || 'Done by Customer'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.section>

        {/* Usage Chart */}
        <motion.section
          variants={itemUp}
          whileHover={{ y: -2, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.1)' }}
          className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 p-6 transition-all duration-300"
        >
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Usage of {monthName}
          </h2>
          {(d.network?.downloadBytes != null || d.network?.uploadBytes != null) ? (
            <div className="h-40 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageChartData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `${v.toFixed(2)} GB`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={70} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                    }}
                    formatter={(value: number | undefined) => [`${value != null ? value.toFixed(2) : '0'} GB`, 'Usage']}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={600}>
                    {usageChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <p className="text-slate-500 dark:text-slate-400 text-sm">No usage data for this month.</p>
            </div>
          )}
          {d.network && (d.network.downloadBytes != null || d.network.uploadBytes != null) && (
            <div className="flex gap-4 mt-4">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium">
                Download: {formatTraffic(d.network.downloadBytes ?? 0)}
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                Upload: {formatTraffic(d.network.uploadBytes ?? 0)}
              </span>
            </div>
          )}
        </motion.section>
      </motion.div>

      {/* Recent Tickets */}
      <motion.section
        variants={itemUp}
        initial="initial"
        animate="animate"
        whileHover={{ y: -2, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.1)' }}
        className="glass-card rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 overflow-hidden transition-all duration-300"
      >
        <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
            Recent Tickets
          </h2>
          <Link
            to="/customer/ticket"
            className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-200"
          >
            View all
          </Link>
        </div>
        <p className="p-6 text-slate-500 dark:text-slate-400 text-sm">No tickets yet.</p>
      </motion.section>

    </motion.div>
  );
}
