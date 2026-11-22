import { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Calendar,
  CreditCard,
  Hash,
  ArrowRight,
  ShieldCheck,
  User,
} from 'lucide-react';
import { paymentsService } from '@/services/payments.service';
import { customersService } from '@/services/customers.service';
import { Customer } from '@/types/customer.types';
import { useToastContext } from '@/contexts/ToastContext';

interface AssignPaymentModalProps {
  isOpen: boolean;
  payment: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssignPaymentModal({
  isOpen,
  payment,
  onClose,
  onSuccess,
}: AssignPaymentModalProps) {
  const toast = useToastContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [months, setMonths] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const searchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedCustomer(null);
      setMonths(1);
      setNotes('');
      setErrorMsg(null);
    }
  }, [isOpen, payment]);

  if (!isOpen || !payment) return null;

  const trxId = payment.transaction_id || payment.id || payment.paymentIntentId || '';
  const trxRef = payment.transaction_ref || payment.ref || payment.bankTxn || payment.gatewayPaymentId || trxId;
  const amount = Number(payment.amount || payment.total || payment.credit || 0);
  const gateway = payment.method || payment.gateway || 'MFS';
  const rawRef = payment.raw_reference || payment.description || payment.merchantInvoiceNumber || '';

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setErrorMsg(null);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val.trim() || val.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await customersService.getCustomers({ search: val.trim() });
        const list = res?.data?.customers || res?.data || [];
        setSearchResults(Array.isArray(list) ? list.slice(0, 8) : []);
      } catch (err) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const calculateNewExpiry = (currentExp: string | null | undefined, m: number) => {
    const base = currentExp ? new Date(currentExp).getTime() : Date.now();
    const effectiveBase = base > Date.now() ? base : Date.now();
    const newDate = new Date(effectiveBase + m * 30 * 24 * 60 * 60 * 1000);
    return newDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleConfirmAssign = async () => {
    if (!selectedCustomer) {
      setErrorMsg('Please select a target customer to assign this payment.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await paymentsService.assignUnmatchedPayment({
        transaction_id: trxId || trxRef,
        customer_id: selectedCustomer.customerId || (selectedCustomer as any).id,
        months,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        toast.success(res.message || 'Payment successfully assigned and customer reconnected!');
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || 'Failed to assign payment.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to assign payment to customer.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Assign Payment to Customer
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reconcile unmatched transaction, credit subscription & unblock MikroTik
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

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Payment Summary Box */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-900/80 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                Unmatched Payment Received
              </span>
              <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                ৳{amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 text-slate-600 dark:text-slate-300">
              <div>
                <span className="text-slate-400 block text-[11px]">TrxID / Ref:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                  {trxRef}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Gateway / Method:</span>
                <span className="font-semibold uppercase text-slate-800 dark:text-slate-200 block">
                  {gateway}
                </span>
              </div>
            </div>

            {rawRef && (
              <div className="text-[11px] pt-1 border-t border-amber-200/60 dark:border-amber-900/40 text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-slate-300">Customer Entered Ref: </span>
                <span className="font-mono text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                  {rawRef}
                </span>
              </div>
            )}
          </div>

          {/* Customer Search Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Search Target Customer</span>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-[11px] font-normal"
                >
                  Change Customer
                </button>
              )}
            </label>

            {!selectedCustomer ? (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Type Customer Name, Code (e.g. 100001), Phone, or Username..."
                  className="w-full pl-9 pr-8 py-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-all"
                  autoFocus
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                {isSearching && (
                  <RefreshCw className="w-4 h-4 text-amber-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                )}

                {/* Autocomplete Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-20 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                    {searchResults.map((c: any) => {
                      const cid = c.customerId || c.id;
                      const code = c.customerCode || c.code || cid;
                      const name = c.fullName || c.name || 'Unknown';
                      const phone = c.phone || '—';
                      const pkg = c.service?.profileName || c.package_name || 'Broadband';

                      return (
                        <div
                          key={cid}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setSearchResults([]);
                          }}
                          className="p-3 hover:bg-amber-50/60 dark:hover:bg-slate-700/60 cursor-pointer transition-colors flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold flex items-center justify-center text-xs">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                {name}
                                <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                                  #{code}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Phone: {phone} • Package: {pkg}
                              </div>
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline">
                            Select
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Selected Customer Card Preview */
              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                      {(selectedCustomer.fullName || (selectedCustomer as any).name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        {selectedCustomer.fullName || (selectedCustomer as any).name}
                        <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/80 px-1.5 py-0.2 rounded font-bold">
                          #{selectedCustomer.customerCode || (selectedCustomer as any).code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Phone: {selectedCustomer.phone || '—'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Selected
                  </span>
                </div>

                {/* Expiry Projection */}
                <div className="pt-2 border-t border-blue-200/60 dark:border-blue-800/40 flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Current Expiry:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {selectedCustomer.service?.expiresAt
                        ? new Date(selectedCustomer.service.expiresAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Expired / None'}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-emerald-500" />
                  <div className="text-right">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold block text-[10px]">
                      New Expiry (+{months * 30} Days):
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                      {calculateNewExpiry(selectedCustomer.service?.expiresAt, months)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Renewal Duration Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Extension Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    months === m
                      ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 shadow-2xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {m} Month ({m * 30} Days)
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmAssign}
            disabled={!selectedCustomer || isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Reconnecting...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm & Reconnect Line</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
