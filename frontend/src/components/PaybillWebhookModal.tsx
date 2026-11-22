import { useState } from 'react';
import {
  X,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Building2,
  Share2,
  Globe,
  Radio,
  FileCode2,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Tenant } from '@/types/tenant.types';
import { useToastContext } from '@/contexts/ToastContext';
import api from '@/lib/api';

interface PaybillWebhookModalProps {
  isOpen: boolean;
  tenant: Tenant | null;
  onClose: () => void;
}

export default function PaybillWebhookModal({ isOpen, tenant, onClose }: PaybillWebhookModalProps) {
  const toast = useToastContext();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'paybill' | 'webhook'>('paybill');

  // Test Simulator state
  const [testCustomerId, setTestCustomerId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  if (!isOpen || !tenant) return null;

  const origin = window.location.origin;
  const tenantCode = tenant.tenantCode || String(tenant.tenantId);

  // Paybill URLs
  const inquiryUrl = `${origin}/api/paybill/inquiry?isp=${tenantCode}`;
  const paymentUrl = `${origin}/api/paybill/payment?isp=${tenantCode}`;

  // General Gateway Webhook URL
  const webhookUrl = `${origin}/api/payment/webhook?isp_id=${tenantCode}`;

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const copyAllDetails = () => {
    const fullText = `================================================
NETFIX MFS PAY BILL & WEBHOOK INTEGRATION
================================================
ISP / Tenant Name:   ${tenant.tenantName}
Biller Code / ID:    ${tenantCode}
Domain / Origin:     ${origin}

[1] MFS PAY BILL (bKash, Nagad, Rocket, Upay)
------------------------------------------------
1. Bill Inquiry API URL (GET/POST):
   ${inquiryUrl}
   Parameter: bill_account_number or customer_id
   
2. Bill Payment API URL (POST):
   ${paymentUrl}
   Parameters: bill_account_number, amount, trx_id

[2] ONLINE PAYMENT GATEWAYS (IPN / Webhook)
------------------------------------------------
1. Dedicated Webhook URL:
   ${webhookUrl}
   Supported: bKash Tokenized, Nagad, SSLCommerz, ShurjoPay

Features:
- Instant Customer Subscription Renewal (+30 Days)
- Automatic Real-time MikroTik Router Unblock
- Multi-tier Reseller Margin Split Settlement
- Immutable Accounting Ledger
================================================`;
    navigator.clipboard.writeText(fullText);
    toast.success('All integration details copied! Ready to share with bKash/Nagad.');
  };

  const handleTestInquiry = async () => {
    if (!testCustomerId.trim()) {
      toast.error('Please enter a Customer ID or Username to test');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await api.get(`/paybill/inquiry?isp=${tenantCode}&q=${encodeURIComponent(testCustomerId.trim())}`);
      setTestResult(res.data);
      toast.success('Inquiry test successful!');
    } catch (err: any) {
      const errData = err.response?.data;
      setTestError(errData?.message || err.message || 'Failed to fetch customer bill details');
      if (errData) {
        setTestResult(errData);
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Pay Bill & Webhook Setup
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                  #{tenantCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {tenant.tenantName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200/80 dark:border-slate-700/80 px-5 pt-3 bg-white dark:bg-slate-800 gap-2">
          <button
            onClick={() => setActiveTab('paybill')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'paybill'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Radio className="w-4 h-4" />
            MFS Pay Bill (bKash / Nagad / Rocket)
          </button>
          <button
            onClick={() => setActiveTab('webhook')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'webhook'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Globe className="w-4 h-4" />
            Gateway Webhook (IPN)
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'paybill' ? (
            <>
              {/* Info banner */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Turnkey MFS Biller Engine:</span> Provide these 2 URLs to bKash or Nagad Biller Solution team for this ISP. When subscribers enter their ID, details will appear instantly in the MFS App.
                </div>
              </div>

              {/* 1. Biller Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Biller Code / Institution ID
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-800 dark:text-slate-200 font-bold">
                    {tenantCode}
                  </div>
                  <button
                    onClick={() => copyToClipboard(tenantCode, 'biller_id', 'Biller Code')}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    {copiedKey === 'biller_id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'biller_id' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Bill Inquiry URL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>1. Bill Inquiry URL (বিল যাচাই API)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono font-bold">GET / POST</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inquiryUrl}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-800 dark:text-slate-200 select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(inquiryUrl, 'inquiry_url', 'Bill Inquiry URL')}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
                  >
                    {copiedKey === 'inquiry_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'inquiry_url' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  bKash/Nagad calls this endpoint with <code className="text-blue-600 dark:text-blue-400">bill_account_number</code> to fetch customer name, package, and due amount.
                </p>
              </div>

              {/* 3. Bill Payment URL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>2. Bill Payment URL (পেমেন্ট গ্রহণ API)</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-mono font-bold">POST</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={paymentUrl}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-800 dark:text-slate-200 select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(paymentUrl, 'payment_url', 'Bill Payment URL')}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
                  >
                    {copiedKey === 'payment_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'payment_url' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  bKash/Nagad calls this endpoint upon customer PIN confirmation to instantly credit, renew, and reconnect.
                </p>
              </div>

              {/* Live Test Simulator */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileCode2 className="w-4 h-4 text-purple-600" />
                    Live Bill Inquiry Simulator
                  </span>
                  <span className="text-[10px] text-slate-400">Test with any Customer ID or Phone</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={testCustomerId}
                    onChange={(e) => setTestCustomerId(e.target.value)}
                    placeholder="Enter Customer Code (e.g. 100001) or Phone..."
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleTestInquiry()}
                  />
                  <button
                    type="button"
                    onClick={handleTestInquiry}
                    disabled={isTesting}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>Test Inquiry</span>
                  </button>
                </div>

                {/* Test Output */}
                {testResult && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Live JSON Response:</span>
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        testResult.status === '0000'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}>
                        Status: {testResult.status} ({testResult.status === '0000' ? 'Success' : 'Error'})
                      </span>
                    </div>
                    <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </div>
                )}
                {testError && !testResult && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{testError}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Gateway Webhook Tab */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
                <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Merchant Gateway Webhook (IPN):</span> Use this dedicated URL in merchant portals (bKash Tokenized, Nagad, SSLCommerz, ShurjoPay, AamarPay) for automated instant payment callbacks and IPN reconciliation.
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Payment Webhook URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-800 dark:text-slate-200 select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(webhookUrl, 'webhook_url', 'Webhook URL')}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
                  >
                    {copiedKey === 'webhook_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'webhook_url' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <div className="font-bold text-slate-800 dark:text-slate-200">How to configure in Gateway Merchant Dashboards:</div>
                <ul className="list-disc pl-4 space-y-1 text-slate-500 dark:text-slate-400 text-[11px]">
                  <li><strong>bKash Merchant Portal:</strong> Set as Callback / Webhook URL in App settings.</li>
                  <li><strong>SSLCommerz:</strong> Enter in IPN (Instant Payment Notification) URL field.</li>
                  <li><strong>ShurjoPay:</strong> Enter in Return / Notification Webhook URL field.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between">
          <button
            onClick={copyAllDetails}
            className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Copy All Integration Details</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
