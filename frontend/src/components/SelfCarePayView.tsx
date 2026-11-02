import React, { useState } from 'react';
import { Smartphone, CheckCircle, ArrowRight, ShieldCheck, Zap, Lock, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

export const SelfCarePayView: React.FC<{ onRefreshStats: () => void }> = ({ onRefreshStats }) => {
  const [customer, setCustomer] = useState<any>({
    name: 'Monir Hossain',
    customerCode: 'C-100203',
    pppoeUsername: 'monir_mk',
    status: 'EXPIRED',
    plan: '10 Mbps Basic (10M/10M)',
    dueAmount: 500,
    invoiceId: 'inv-02',
    area: 'Uttara Sector 7',
    expiryDate: '2026-10-20',
  });
  const [paymentStep, setPaymentStep] = useState<'DETAILS' | 'BKASH_MODAL' | 'SUCCESS'>('DETAILS');
  const [bkashPin, setBkashPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSimulateBkash = async () => {
    setLoading(true);
    try {
      await api.simulateBkashPayment(customer.invoiceId);
      setPaymentStep('SUCCESS');
      onRefreshStats();
    } catch (e: any) {
      alert(e.message || 'Payment simulation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Subscriber Self-Care & Instant bKash Reconnect
          </h2>
          <p className="text-xs text-slate-500">
            Automated customer billing portal with instant zero-operator MikroTik RouterOS unblock upon MFS payment
          </p>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          MikroTik Socket Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Mobile Mockup / Device Frame */}
        <div className="md:col-span-2 app-card rounded-2xl p-6 space-y-5">
          {paymentStep === 'DETAILS' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-base text-slate-900">{customer.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    ID: {customer.customerCode} • PPPoE: <strong className="text-slate-800">{customer.pppoeUsername}</strong>
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  EXPIRED • LINE LOCKED
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subscribed Package:</span>
                  <span className="font-semibold text-slate-900">{customer.plan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Coverage Sub-Zone:</span>
                  <span className="text-slate-700">{customer.area}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Billing Period Overdue Since:</span>
                  <span className="font-mono text-rose-600 font-medium">{customer.expiryDate}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                  <span className="text-slate-700 font-semibold">Total Payable Due:</span>
                  <span className="font-bold text-xl text-rose-600 font-mono">৳{customer.dueAmount}.00</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold">Instant Automated Reconnection:</strong>
                  <p className="text-indigo-700 mt-0.5">
                    Upon payment confirmation, the system connects via Port 8728 to your gateway router, sets <code className="font-mono text-[11px] bg-indigo-100 px-1 rounded">disabled=no</code>, and restores high-speed internet in under 3 seconds.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPaymentStep('BKASH_MODAL')}
                className="w-full py-3.5 rounded-xl bg-[#E2136E] hover:bg-[#c90f5f] text-white font-bold text-sm shadow-md shadow-[#E2136E]/20 transition flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <span>Pay ৳{customer.dueAmount}.00 with bKash</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* bKash Payment Simulation Modal */}
          {paymentStep === 'BKASH_MODAL' && (
            <div className="p-5 rounded-2xl bg-[#E2136E] text-white space-y-4 animate-in fade-in shadow-lg">
              <div className="flex items-center justify-between border-b border-white/20 pb-3">
                <span className="font-bold text-base tracking-wide">bKash Payment Gateway</span>
                <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-lg font-medium">Merchant: CloudNet ISP</span>
              </div>

              <div className="text-center py-2">
                <span className="text-xs text-pink-100">Payable Amount</span>
                <div className="text-3xl font-extrabold font-mono mt-0.5">৳{customer.dueAmount}.00</div>
              </div>

              <div className="bg-white text-slate-900 rounded-xl p-4 space-y-3 text-xs shadow-xs">
                <div>
                  <label className="text-slate-600 font-medium block mb-1">Enter 5-digit bKash PIN</label>
                  <input
                    type="password"
                    maxLength={5}
                    value={bkashPin}
                    onChange={(e) => setBkashPin(e.target.value)}
                    placeholder="•••••"
                    className="w-full text-center tracking-widest text-2xl font-mono font-bold border border-slate-300 rounded-xl py-2 focus:outline-none focus:border-[#E2136E]"
                  />
                  <p className="text-[11px] text-slate-400 text-center mt-1">Enter any 5 digits for instant sandbox test</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setPaymentStep('DETAILS')}
                    className="w-1/2 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSimulateBkash}
                    disabled={loading}
                    className="w-1/2 py-2.5 rounded-xl bg-[#E2136E] hover:bg-[#c90f5f] text-white font-bold disabled:opacity-50 transition"
                  >
                    {loading ? 'Verifying with Router...' : 'Confirm Payment'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payment Success & Reconnection Notice */}
          {paymentStep === 'SUCCESS' && (
            <div className="text-center py-6 space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Payment Verified & Line Active!</h3>
                <p className="text-xs text-emerald-700 font-medium mt-1">
                  MikroTik PPPoE secret enabled and bandwidth unthrottled in 1.4s!
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 max-w-sm mx-auto text-left space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">TrxID:</span>
                  <span className="text-slate-900 font-bold">TRX_BKASH_994821</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="text-emerald-700 font-bold">ACTIVE (30 Days Added)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gateway:</span>
                  <span className="text-indigo-600 font-semibold">CCR2004 (Port 8728)</span>
                </div>
              </div>

              <button
                onClick={() => setPaymentStep('DETAILS')}
                className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Reset Demo Simulator
              </button>
            </div>
          )}
        </div>

        {/* Feature Explainer */}
        <div className="app-card rounded-2xl p-6 space-y-4 text-xs text-slate-600">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600" />
            Zero-Touch Automation Architecture
          </h3>

          <div className="space-y-3 text-slate-600 leading-relaxed">
            <p>
              <strong>1. Automated SMS Warning:</strong> System alerts user 3 days prior to expiration with personalized tokenized bill link.
            </p>
            <p>
              <strong>2. Walled Garden:</strong> Overdue users get redirected to this self-care payment gateway via MikroTik IP Firewall NAT rules.
            </p>
            <p>
              <strong>3. Instant Webhook Execution:</strong> When bKash confirms payment, Core PHP invokes:
            </p>
            <div className="p-2.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto">
              /ppp/secret/set [find name=monir_mk] disabled=no
            </div>
            <p>
              <strong>4. Instant Restoration:</strong> Subscriber resumes connection in less than 3 seconds with zero Lineman or Admin manual effort!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
