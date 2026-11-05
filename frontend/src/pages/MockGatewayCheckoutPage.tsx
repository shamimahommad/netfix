import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, Loader2, CheckCircle2, Lock, CreditCard, Wallet } from 'lucide-react';
import { api } from '@/lib/api';

export default function MockGatewayCheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const intentId = searchParams.get('intent_id') || '';
  const tenantId = searchParams.get('tenant_id') || '2';
  const gateway = (searchParams.get('gateway') || 'bkash').toLowerCase();
  const amount = searchParams.get('amount') || '10.00';
  const ref = searchParams.get('ref') || `TXN-${gateway.toUpperCase()}-SIM`;
  const paymentID = searchParams.get('paymentID') || ref;
  const callbackUrl = searchParams.get('callback') || `/saas/tenants/${tenantId}/payment-callback`;

  const [simAccount, setSimAccount] = useState('01770000000');
  const [simPin, setSimPin] = useState('12345');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBkash = gateway === 'bkash';
  const isSurjo = gateway === 'surjopay';
  const isSsl = gateway === 'ssl' || gateway === 'sslcommerz';

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const { data } = await api.post('/payments/simulator/confirm', {
        intent_id: intentId,
        tenant_id: tenantId,
        gateway,
        paymentID,
        amount: parseFloat(amount),
      });

      if (data?.success) {
        // Build success redirect
        const sep = callbackUrl.includes('?') ? '&' : '?';
        const finalUrl = `${callbackUrl}${sep}status=success&paymentID=${encodeURIComponent(paymentID)}&trx_id=${encodeURIComponent(data.trxID || paymentID)}&gateway=${gateway}&amount=${amount}`;
        window.location.href = finalUrl;
      } else {
        setError(data?.message || 'Payment simulation failed');
        setIsProcessing(false);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Payment failed');
      setIsProcessing(false);
    }
  };

  const handleCancelPayment = () => {
    const sep = callbackUrl.includes('?') ? '&' : '?';
    window.location.href = `${callbackUrl}${sep}status=cancel&paymentID=${encodeURIComponent(paymentID)}&gateway=${gateway}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-purple-500 selection:text-white">
      {/* Simulation Sandbox Badge */}
      <div className="mb-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
        NetFix Sandbox Simulator • {gateway.toUpperCase()} Gateway
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Gateway Header */}
        <div
          className={`p-6 text-white text-center relative overflow-hidden ${
            isBkash
              ? 'bg-gradient-to-r from-pink-600 to-rose-600'
              : isSurjo
              ? 'bg-gradient-to-r from-amber-600 to-orange-600'
              : 'bg-gradient-to-r from-blue-700 to-indigo-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-2 font-bold text-lg tracking-wide">
            {isSsl ? <CreditCard className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
            <span>
              {isBkash
                ? 'bKash Tokenized Checkout'
                : isSurjo
                ? 'SurjoPay PGW Bangladesh'
                : 'SSLCommerz Secure Checkout'}
            </span>
          </div>
          <p className="text-xs text-white/80">Sandbox Payment Processing Environment</p>
          <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
            <span>Amount to Pay</span>
            <span className="text-xl font-extrabold text-white">৳ {amount}</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Order Reference:</span>
              <span className="text-slate-200 font-mono font-medium">{ref}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Merchant:</span>
              <span className="text-slate-200 font-medium">NetFix ISP Solutions</span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {isBkash ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  bKash Account Number
                </label>
                <input
                  type="text"
                  value={simAccount}
                  onChange={(e) => setSimAccount(e.target.value)}
                  placeholder="017xxxxxxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:border-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  bKash PIN (Sandbox Demo: 12345)
                </label>
                <input
                  type="password"
                  value={simPin}
                  onChange={(e) => setSimPin(e.target.value)}
                  placeholder="•••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:border-pink-500 outline-none"
                />
              </div>
            </div>
          ) : isSurjo ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  SurjoPay Mobile / Card Number
                </label>
                <input
                  type="text"
                  value={simAccount}
                  onChange={(e) => setSimAccount(e.target.value)}
                  placeholder="017xxxxxxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:border-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Verification OTP (Demo: 123456)
                </label>
                <input
                  type="password"
                  value={simPin}
                  onChange={(e) => setSimPin(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:border-amber-500 outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Card Number</label>
                <input
                  type="text"
                  value="4111 2222 3333 4444"
                  readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-400 text-sm font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Expiry</label>
                  <input
                    type="text"
                    value="12/28"
                    readOnly
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-400 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">CVV</label>
                  <input
                    type="password"
                    value="123"
                    readOnly
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-400 text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-3 space-y-2.5">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmPayment}
              className={`w-full py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                isBkash
                  ? 'bg-pink-600 hover:bg-pink-700 shadow-pink-600/30'
                  : isSurjo
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authorizing Payment & Reconnecting Line...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Confirm & Pay ৳ {amount}</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleCancelPayment}
              className="w-full py-2.5 rounded-xl font-semibold text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              Cancel Payment
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800/80 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>256-bit TLS Encrypted Transaction • Powered by NetFix Billing Engine</span>
        </div>
      </motion.div>
    </div>
  );
}
