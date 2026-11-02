import React, { useState, useEffect } from 'react';
import { Wifi, Plus, Printer, QrCode, Tag, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

export const HotspotView: React.FC = () => {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [quantity, setQuantity] = useState(8);
  const [price, setPrice] = useState(20);
  const [timeLimit, setTimeLimit] = useState('4 Hours');
  const [dataLimit, setDataLimit] = useState('2 GB');

  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    try {
      const data = await api.getHotspotVouchers();
      if (data && data.vouchers) {
        setVouchers(data.vouchers);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerate = async () => {
    try {
      await api.generateHotspotBatch({
        quantity,
        packageId: 'pkg-01',
        price,
        timeLimit,
        dataLimit,
      });
      alert(`Generated ${quantity} hotspot vouchers!`);
      setShowGenerateModal(false);
      loadVouchers();
    } catch (e: any) {
      alert(e.message || 'Generation failed');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Prepaid Hotspot Cards & Scratch Vouchers
          </h2>
          <p className="text-xs text-slate-500">Batch-generate, print & sell WiFi internet vouchers with QR Code and PIN</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Cards</span>
          </button>

          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Batch</span>
          </button>
        </div>
      </div>

      {/* Cards Grid Preview (Printable) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-3">
        {vouchers.map((v) => (
          <div key={v.id} className="bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-sm space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-xs text-indigo-700 flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5" /> CloudNet WiFi
              </span>
              <span className="font-black text-sm text-slate-900">৳{v.price}</span>
            </div>

            <div className="text-center py-2 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-medium">VOUCHER CODE</span>
              <span className="font-mono text-xl font-black text-indigo-600 tracking-widest block">{v.voucher_code}</span>
              <div className="inline-block px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-mono text-xs font-bold">
                PIN: {v.pin}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>{v.time_limit}</span>
              <span>•</span>
              <span>{v.data_limit}</span>
              <span>•</span>
              <span className="text-emerald-700 font-bold">{v.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* GENERATE BATCH MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 border border-slate-200 shadow-xl relative space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900">Generate Hotspot Batch</h3>

            <div>
              <label className="text-slate-600 block mb-1 font-medium">Quantity of Cards</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 block mb-1 font-medium">Price per Card (৳)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1 font-medium">Time Limit</label>
                <input
                  type="text"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 rounded-xl text-slate-500 font-medium hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                Generate Vouchers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
