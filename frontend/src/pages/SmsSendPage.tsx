import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Loader2, CheckCircle, AlertCircle, X, Search, MessageSquare } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchCustomerResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  useEffect(() => {
    smsService.getTemplates().then((t) => {
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
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      searchService.searchCustomers(searchQuery.trim()).then((res) => {
        setSearchResults(res?.data ?? []);
      }).catch(() => setSearchResults([])).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const charsPerSms = useMemo(() => getCharsPerSms(message), [message]);
  const segmentCount = useMemo(() => getSegmentCount(message), [message]);
  const messageLen = message.length;

  const toNumbers = useMemo(() => {
    const phones = selectedCustomers.map((c) => normalizePhone(c.phone)).filter(Boolean);
    return Array.from(new Set(phones)).slice(0, MAX_RECIPIENTS);
  }, [selectedCustomers]);

  const canSend = toNumbers.length > 0 && message.trim().length > 0 && messageLen <= MAX_MESSAGE_LENGTH;

  const handleTemplateChange = useCallback((value: string) => {
    setSelectedTemplate(value);
    const opt = templateOptions.find((o) => o.value === value);
    if (opt && 'body' in opt && opt.body) setMessage(opt.body);
  }, [templateOptions]);

  const addCustomer = useCallback((c: SearchCustomerResult) => {
    if (selectedCustomers.some((x) => x.customerId === c.customerId)) return;
    setSelectedCustomers((prev) => [...prev, c]);
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
  }, [selectedCustomers]);

  const removeCustomer = useCallback((customerId: string) => {
    setSelectedCustomers((prev) => prev.filter((c) => c.customerId !== customerId));
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
        toast.success(`SMS sent to ${result.sent} recipient(s).`);
        setMessage('');
        setSelectedCustomers([]);
      } else if (result.sent === 0) {
        toast.error('All SMS failed. Check gateway config and numbers.');
      } else {
        toast.success(`Sent: ${result.sent}, Failed: ${result.failed}.`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to send SMS';
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-4xl space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Send SMS"
        subtitle="Compose and broadcast SMS messages. Supports Bangla (70 chars) & English (160 chars)."
        onBack={() => navigate('/dashboard')}
        actions={
          <button
            type="button"
            onClick={() => navigate('/dashboard/sms/log')}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-sm font-medium shadow-sm transition-colors"
          >
            View SMS Log
          </button>
        }
      />

      {lastResult && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Delivered"
            value={lastResult.sent}
            subtext="Delivered successfully"
            variant="emerald"
          />
          <MetricCard
            title="Failed"
            value={lastResult.failed}
            subtext="Check gateway logs"
            variant={lastResult.failed > 0 ? 'rose' : 'slate'}
          />
          <MetricCard
            title="Total Recipients"
            value={lastResult.total}
            subtext="Processed in batch"
            variant="blue"
          />
        </div>
      )}

      {/* Main Composer Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm space-y-5">
        {/* Template Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
            SMS Template
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          >
            {templateOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Recipients Multi-Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
            Recipients ({toNumbers.length}/{MAX_RECIPIENTS})
          </label>
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search customers by name, phone or username to add..."
                className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400"
              />
              {searching && <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
            </div>

            {searchOpen && searchResults.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" aria-hidden onClick={() => setSearchOpen(false)} />
                <div className="absolute left-0 right-0 top-full mt-1.5 z-20 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl py-1">
                  {searchResults.map((c) => (
                    <button
                      key={c.customerId}
                      type="button"
                      onClick={() => addCustomer(c)}
                      className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-between text-sm"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{c.fullName || c.name}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-xs ml-2 font-mono">({c.phone})</span>
                      </div>
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Add</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Selected Customer Tags */}
          {selectedCustomers.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {selectedCustomers.map((c) => (
                <span
                  key={c.customerId}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-100 dark:border-blue-800"
                >
                  <span>{c.fullName || c.name}</span>
                  <span className="text-blue-500 font-mono text-[11px]">{c.phone}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomer(c.customerId)}
                    className="hover:text-rose-600 dark:hover:text-rose-400 transition-colors ml-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Message Body */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Message Content
            </label>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
              <span>{isPrimarilyBangla(message) ? 'Bangla (70 chars/SMS)' : 'English (160 chars/SMS)'}</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">{messageLen}/{MAX_MESSAGE_LENGTH}</span>
              <span>•</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{segmentCount} Part(s)</span>
            </div>
          </div>
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder="Type your message here..."
            className="w-full px-3.5 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-y"
          />
        </div>

        {/* Action Button */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || isSending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition-all"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Broadcasting SMS...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send SMS ({toNumbers.length})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
