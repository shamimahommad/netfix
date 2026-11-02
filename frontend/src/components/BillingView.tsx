import React, { useState, useEffect } from 'react';
import { Receipt, Search, CheckCircle2, Clock, DollarSign, Printer, X, Plus } from 'lucide-react';
import { api } from '../services/api';

export const BillingView: React.FC<{ onRefreshStats: () => void }> = ({ onRefreshStats }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [collectModalInv, setCollectModalInv] = useState<any | null>(null);
  const [receiptModalInv, setReceiptModalInv] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('CASH');

  useEffect(() => {
    loadInvoices();
  }, [statusFilter]);

  const loadInvoices = async () => {
    try {
      const data = await api.getInvoices(statusFilter);
      if (data && data.invoices) {
        setInvoices(data.invoices);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCollect = async () => {
    if (!collectModalInv) return;
    try {
      await api.collectPayment(collectModalInv.id, {
        amount: payAmount || collectModalInv.due_amount,
        paymentMethod: payMethod,
      });
      alert('Payment collected successfully!');
      setReceiptModalInv({ ...collectModalInv, paid_amount: payAmount || collectModalInv.due_amount, payment_method: payMethod });
      setCollectModalInv(null);
      loadInvoices();
      onRefreshStats();
    } catch (e: any) {
      alert(e.message || 'Collection failed');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Monthly Invoicing & Due Recovery Ledger
          </h2>
          <p className="text-xs text-slate-500">Generate bills, collect cash in field, and generate printable money receipts</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs">
            {['ALL', 'UNPAID', 'PAID'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  statusFilter === st ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={async () => {
              await api.generateMonthlyBills();
              alert('Monthly bills generated successfully!');
              loadInvoices();
              onRefreshStats();
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Monthly Bills</span>
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="app-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Invoice No</th>
                <th className="py-3 px-4 font-semibold">Subscriber & Mobile</th>
                <th className="py-3 px-4 font-semibold">Month</th>
                <th className="py-3 px-4 font-semibold">Payable</th>
                <th className="py-3 px-4 font-semibold">Paid</th>
                <th className="py-3 px-4 font-semibold">Due</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
              {invoices.map((inv) => {
                const isPaid = inv.status === 'PAID';
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-indigo-700 font-bold">{inv.invoice_no}</td>
                    <td className="py-3 px-4 font-sans">
                      <span className="font-bold text-slate-900 block">{inv.subscriber_name}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{inv.mobile} • {inv.customer_code}</span>
                    </td>
                    <td className="py-3 px-4">{inv.billing_month}</td>
                    <td className="py-3 px-4 text-slate-900 font-bold">৳{parseFloat(inv.payable_amount).toLocaleString()}</td>
                    <td className="py-3 px-4 text-emerald-700 font-bold">৳{parseFloat(inv.paid_amount).toLocaleString()}</td>
                    <td className="py-3 px-4 text-rose-600 font-bold">৳{parseFloat(inv.due_amount).toLocaleString()}</td>
                    <td className="py-3 px-4 font-sans">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-2">
                        {!isPaid && (
                          <button
                            onClick={() => {
                              setCollectModalInv(inv);
                              setPayAmount(parseFloat(inv.due_amount));
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition"
                          >
                            Collect
                          </button>
                        )}
                        <button
                          onClick={() => setReceiptModalInv(inv)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                          title="View & Print Money Receipt"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* COLLECT PAYMENT MODAL */}
      {collectModalInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 border border-slate-200 shadow-xl relative">
            <button 
              onClick={() => setCollectModalInv(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold text-slate-900 mb-1">Collect Due Payment</h3>
            <p className="text-xs text-slate-500 mb-4">{collectModalInv.subscriber_name} • Invoice: {collectModalInv.invoice_no}</p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-500 block mb-1">Total Outstanding Due</label>
                <div className="text-2xl font-black font-mono text-rose-600">৳{collectModalInv.due_amount}</div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Payment Received (৳)</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono text-base font-bold"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Payment Channel</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium"
                >
                  <option value="CASH">Cash in Hand (Collector)</option>
                  <option value="BKASH">bKash (MFS)</option>
                  <option value="NAGAD">Nagad (MFS)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setCollectModalInv(null)}
                  className="px-4 py-2 rounded-xl text-slate-500 font-medium hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCollect}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                >
                  Confirm & Update Balance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE OFFICIAL MONEY RECEIPT */}
      {receiptModalInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white text-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative font-sans text-xs border border-slate-200">
            <button 
              onClick={() => setReceiptModalInv(null)}
              className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center border-b pb-4 mb-4">
              <h2 className="text-base font-black text-indigo-700 tracking-tight">CloudNet Broadband ISP</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Official Money Receipt</p>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice No:</span>
                <span className="font-bold">{receiptModalInv.invoice_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold font-sans">{receiptModalInv.subscriber_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer Code:</span>
                <span>{receiptModalInv.customer_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Billing Month:</span>
                <span>{receiptModalInv.billing_month}</span>
              </div>
              <div className="flex justify-between border-t border-dashed pt-2 text-sm font-bold">
                <span>Amount Paid:</span>
                <span className="text-emerald-700">৳{receiptModalInv.paid_amount || receiptModalInv.payable_amount}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>Payment Mode:</span>
                <span className="font-semibold text-slate-800">{receiptModalInv.payment_method || 'CASH'}</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400">
              <p>Thank you for your timely payment!</p>
              <p>24/7 Helpline: 01711223344</p>
            </div>

            <div className="mt-4 flex gap-2">
              <button 
                onClick={() => window.print()}
                className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
