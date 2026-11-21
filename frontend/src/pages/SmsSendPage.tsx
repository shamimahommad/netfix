import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Search,
  MessageSquare,
  Smartphone,
  FileText,
  Clock,
  Sparkles,
  RefreshCw,
  Wallet,
  Users,
  Info,
} from 'lucide-react';
import { smsService } from '@/services/sms.service';
import { searchService, SearchCustomerResult } from '@/services/search.service';
import { useToastContext } from '@/contexts/ToastContext';
import { PageHeader, MetricCard } from '@/components/common';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_RECIPIENTS = 50;
const CHARS_PER_SMS_ENGLISH = 160;
const CHARS_PER_SMS_BANGLA = 70;

function isPrimarilyBangla(text: string): boolean {
  if (!text.trim()) return false;
  const banglaRange = /[\u0980-\u09FF\u09F0-\u09FF]/;
  let bangla = 0;
  let other = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    if (banglaRange.test(ch)) bangla++;
    else other++;
  }
  return bangla >= other;
}

function getCharsPerSms(message: string): number {
  return isPrimarilyBangla(message) ? CHARS_PER_SMS_BANGLA : CHARS_PER_SMS_ENGLISH;
}

function getSegmentCount(message: string): number {
  const charsPer = getCharsPerSms(message);
  const len = message.length;
  return len === 0 ? 0 : Math.ceil(len / charsPer);
}

const TEMPLATE_LABELS: Record<string, string> = {
  general_online_deposit: 'Online Deposit',
  general_cash_deposit: 'Cash Deposit',
  general_reseller_cash_deposit: 'Reseller Cash Deposit',
  ppp_create: 'PPP Create',
  ppp_renew: 'PPP Renew',
  hotspot_create: 'Hotspot Create',
  hotspot_renew: 'Hotspot Renew',
  alert_expire_1: 'Expire Alert 1',
  alert_expire_2: 'Expire Alert 2',
  alert_after_expire: 'After Expire',
};

type SmsTemplateOption = { value: 'custom'; label: string; body?: string } | { value: string; label: string; body: string };

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').trim();
  if (digits.length < 10) return '';
  return digits.startsWith('88') ? digits : `88${digits}`;
}

export default function SmsSendPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [templateOptions, setTemplateOptions] = useState<SmsTemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');
  const [message, setMessage] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<SearchCustomerResult[]>([]);
  const [manualNumbers, setManualNumbers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchCustomerResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [refreshingBalance, setRefreshingBalance] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      setRefreshingBalance(true);
      const val = await smsService.getBalance();
      setBalance(val);
    } catch {
      setBalance(null);
    } finally {
      setRefreshingBalance(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    smsService
      .getTemplates()
      .then((t) => {
        const opts: SmsTemplateOption[] = [{ value: 'custom', label: 'Custom Message' }];
        for (const [key, val] of Object.entries(t)) {
          if (val?.enabled && val.body?.trim()) {
            opts.push({
              value: key,
              label: TEMPLATE_LABELS[key] || key,
              body: val.body,
            });
          }
        }
        setTemplateOptions(opts);
      })
      .catch(() => {});
  }, [fetchBalance]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      searchService
        .searchCustomers(searchQuery.trim())
        .then((res) => {
          setSearchResults(res?.data ?? []);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const isBangla = useMemo(() => isPrimarilyBangla(message), [message]);
  const charsPerSms = useMemo(() => getCharsPerSms(message), [message]);
  const segmentCount = useMemo(() => getSegmentCount(message), [message]);
  const messageLen = message.length;

  const toNumbers = useMemo(() => {
    const custPhones = selectedCustomers.map((c) => normalizePhone(c.phone)).filter(Boolean);
    const manPhones = manualNumbers.map(normalizePhone).filter(Boolean);
    return Array.from(new Set([...custPhones, ...manPhones])).slice(0, MAX_RECIPIENTS);
  }, [selectedCustomers, manualNumbers]);

  const canSend = toNumbers.length > 0 && message.trim().length > 0 && messageLen <= MAX_MESSAGE_LENGTH;

  const handleTemplateChange = useCallback(
    (value: string) => {
      setSelectedTemplate(value);
      const opt = templateOptions.find((o) => o.value === value);
      if (opt && 'body' in opt && opt.body) setMessage(opt.body);
    },
    [templateOptions]
  );

  const addCustomer = useCallback(
    (c: SearchCustomerResult) => {
      if (selectedCustomers.some((x) => x.customerId === c.customerId)) return;
      setSelectedCustomers((prev) => [...prev, c]);
      setSearchQuery('');
      setSearchResults([]);
      setSearchOpen(false);
    },
    [selectedCustomers]
  );

  const removeCustomer = useCallback((customerId: string) => {
    setSelectedCustomers((prev) => prev.filter((c) => c.customerId !== customerId));
  }, []);

  const addManualNumbers = useCallback((raw: string) => {
    const parts = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 10);
    if (parts.length === 0) return;
    setManualNumbers((prev) => Array.from(new Set([...prev, ...parts])));
    setSearchQuery('');
    setSearchOpen(false);
  }, []);

  const removeManualNumber = useCallback((num: string) => {
    setManualNumbers((prev) => prev.filter((n) => n !== num));
  }, []);

  const handleSend = async () => {
    if (!canSend || isSending) return;
    setIsSending(true);
    setLastResult(null);
    try {
      const result = await smsService.send({
        toNumbers,
        message: message.trim(),
      });
      setLastResult({ sent: result.sent, failed: result.failed, total: result.total });
      if (result.failed === 0) {
        toast.success(`SMS successfully delivered to ${result.sent} recipient(s).`);
        setMessage('');
        setSelectedCustomers([]);
        setManualNumbers([]);
        fetchBalance();
      } else if (result.sent === 0) {
        toast.error('All SMS dispatches failed. Please check your SMS Gateway credentials and phone numbers.');
      } else {
        toast.success(`Partially sent: ${result.sent} delivered, ${result.failed} failed.`);
        fetchBalance();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to send SMS';
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Standard NetFix Page Header */}
      <PageHeader
        icon={<MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Send SMS"
        subtitle="Compose and broadcast SMS notifications to customers. Supports automatic Bangla & English encoding."
        badge={
          balance !== null ? (
            <span className="flex items-center gap-1.5 font-medium">
              <Wallet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Balance: ৳{balance.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={fetchBalance}
              disabled={refreshingBalance}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
              title="Refresh Balance"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingBalance ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">Refresh Balance</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/sms/template')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Templates</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/sms/log')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>SMS Log</span>
            </button>
          </div>
        }
      />

      {/* Broadcast Result Feedback Metrics */}
      {lastResult && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Delivered Successfully"
            value={lastResult.sent}
            subtext="Messages delivered to gateway"
            variant="emerald"
            icon={<CheckCircle className="w-5 h-5" />}
          />
          <MetricCard
            title="Failed Dispatches"
            value={lastResult.failed}
            subtext={lastResult.failed > 0 ? 'Check gateway logs & balances' : 'Zero delivery errors'}
            variant={lastResult.failed > 0 ? 'rose' : 'slate'}
            icon={<AlertCircle className="w-5 h-5" />}
          />
          <MetricCard
            title="Total Processed"
            value={lastResult.total}
            subtext="Batch queue size"
            variant="blue"
            icon={<Users className="w-5 h-5" />}
          />
        </div>
      )}

      {/* Two-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Composer Form */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
            {/* Header info inside card */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Broadcast Composer</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Select template, pick recipients, and draft message</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Direct / Bulk
              </span>
            </div>

            {/* Template Select */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Predefined SMS Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                {templateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipients Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Recipients List
                </label>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {toNumbers.length} / {MAX_RECIPIENTS} Max
                </span>
              </div>

              <div className="relative">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search customer by name/username, or type 01XXXXXXXXX and press Enter..."
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (searchQuery.trim().length >= 10) {
                          addManualNumbers(searchQuery.trim());
                        }
                      }
                    }}
                  />
                  {searchQuery.trim().length >= 10 && (
                    <button
                      type="button"
                      onClick={() => addManualNumbers(searchQuery.trim())}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer"
                    >
                      + Add
                    </button>
                  )}
                  {searching && <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
                </div>

                {/* Floating Search Dropdown */}
                {searchOpen && (
                  <>
                    <div className="fixed inset-0 z-10" aria-hidden onClick={() => setSearchOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-2 z-20 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-1 divide-y divide-slate-100 dark:divide-slate-800/80">
                      {searchQuery.trim().length >= 10 && (
                        <button
                          type="button"
                          onClick={() => addManualNumbers(searchQuery.trim())}
                          className="w-full px-4 py-2.5 text-left bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-between text-sm cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">Direct Number:</span>
                            <span className="text-slate-900 dark:text-slate-100 font-mono font-bold">{searchQuery.trim()}</span>
                          </div>
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">+ Add Recipient</span>
                        </button>
                      )}
                      {searchResults.length === 0 && searchQuery.trim().length >= 2 && !searching && (
                        <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                          No registered customer found for "{searchQuery}". You can press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-semibold">Enter</kbd> to add as a direct number.
                        </div>
                      )}
                      {searchResults.map((c) => (
                        <button
                          key={c.customerId}
                          type="button"
                          onClick={() => addCustomer(c)}
                          className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between text-sm cursor-pointer"
                        >
                          <div className="min-w-0 pr-3">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{c.fullName || (c as any).name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                              {c.phone} {c.username ? `• @${c.username}` : ''}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 shrink-0">
                            + Add
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Selected Recipients Tag Cloud */}
              {(selectedCustomers.length > 0 || manualNumbers.length > 0) && (
                <div className="flex flex-wrap gap-2 pt-1.5">
                  {selectedCustomers.map((c) => (
                    <span
                      key={c.customerId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200/80 dark:border-blue-800/80 shadow-xs"
                    >
                      <span>{c.fullName || (c as any).name}</span>
                      <span className="text-blue-500 dark:text-blue-400 font-mono text-[11px]">({c.phone})</span>
                      <button
                        type="button"
                        onClick={() => removeCustomer(c.customerId)}
                        className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors ml-0.5 cursor-pointer"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  {manualNumbers.map((num) => (
                    <span
                      key={num}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs"
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-emerald-200/60 dark:bg-emerald-800/60 rounded-md">
                        Direct
                      </span>
                      <span className="font-mono text-[11px]">{num}</span>
                      <button
                        type="button"
                        onClick={() => removeManualNumber(num)}
                        className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors ml-0.5 cursor-pointer"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Message Body Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Message Content
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      isBangla
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {isBangla ? 'Bangla (70 chars/SMS)' : 'English (160 chars/SMS)'}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    {messageLen} / {MAX_MESSAGE_LENGTH}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                    {segmentCount} Part(s)
                  </span>
                </div>
              </div>

              <textarea
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                placeholder="Type your SMS message here in English or Bangla..."
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-y transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setMessage('');
                  setSelectedCustomers([]);
                  setManualNumbers([]);
                  setSelectedTemplate('custom');
                }}
                disabled={!message && selectedCustomers.length === 0 && manualNumbers.length === 0}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Clear All
              </button>

              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend || isSending}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm hover:shadow transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Broadcasting SMS...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Broadcast SMS ({toNumbers.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Mobile Preview & Rules */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Smartphone Simulator Preview Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Live Device Preview</h4>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Real-time
              </span>
            </div>

            {/* Mock Phone Frame */}
            <div className="rounded-3xl border-4 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-4 shadow-inner">
              {/* Speaker & Status Notch */}
              <div className="w-16 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-3" />

              {/* Sender Header inside phone */}
              <div className="text-center pb-2.5 mb-3 border-b border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">ISP Broadcast / SMS</p>
                <p className="text-[10px] text-slate-400">Today • Just now</p>
              </div>

              {/* Chat Bubble */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl rounded-tl-sm p-3.5 shadow-sm border border-slate-200/70 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 min-h-[90px] whitespace-pre-wrap break-words font-sans">
                {message.trim() ? (
                  message
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 italic">
                    Type a message or select a template to see your live SMS message preview here...
                  </span>
                )}
              </div>

              {/* Meta stats below bubble */}
              <div className="mt-3 pt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span>{segmentCount} Part(s)</span>
                <span>{messageLen} characters</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Recipients will receive this message with your configured Masking / Sender ID.
            </p>
          </div>

          {/* SMS Encoding & Billing Rules Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>SMS Characters & Parts Guide</span>
            </div>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <span>
                  <strong>English (GSM 7-bit):</strong> 1st SMS = up to 160 characters. Multipart SMS = 153 chars/segment.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Bangla (Unicode UCS-2):</strong> 1st SMS = up to 70 characters. Multipart SMS = 67 chars/segment.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>
                  <strong>Direct Numbers:</strong> Enter 11-digit BD mobile numbers (e.g. 01700000000). System normalizes automatically.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
