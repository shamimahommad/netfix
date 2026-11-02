import React, { useState, useEffect } from 'react';
import { Network, Plus, Wallet, ShieldCheck, Phone, MapPin, X, ArrowUpRight, TrendingUp, Users } from 'lucide-react';
import { api } from '../services/api';

export const ResellersView: React.FC = () => {
  const [resellers, setResellers] = useState<any[]>([]);
  const [topupReseller, setTopupReseller] = useState<any | null>(null);
  const [topupAmount, setTopupAmount] = useState<number>(5000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResellers();
  }, []);

  const loadResellers = async () => {
    setLoading(true);
    try {
      const data = await api.getResellers();
      if (data && data.resellers) {
        setResellers(data.resellers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTopup = async () => {
    if (!topupReseller) return;
    try {
      await api.topupReseller(topupReseller.id, topupAmount);
      alert(`Recharged ৳${topupAmount.toLocaleString()} to ${topupReseller.name}'s wallet!`);
      setTopupReseller(null);
      loadResellers();
    } catch (e: any) {
      alert(e.message || 'Topup failed');
    }
  };

  const totalWallet = resellers.reduce((acc, r) => acc + (parseFloat(r.balance) || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Reseller & Sub-ISP Partner Portals
          </h2>
          <p className="text-xs text-slate-500">
            Manage franchise partner accounts, prepaid balance wallets, commission tiers & allocated sub-zones
          </p>
        </div>

        <button
          onClick={() => alert('Onboard new partner franchise modal')}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Reseller / Sub-ISP</span>
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="app-card p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Total Active Resellers</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{resellers.length} Partners</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Network className="w-5 h-5" />
          </div>
        </div>

        <div className="app-card p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Prepaid Wallet Pool</span>
            <span className="text-2xl font-bold font-mono text-emerald-600 mt-1 block">
              ৳{totalWallet.toLocaleString()}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="app-card p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">Franchise Subscribers</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">348 Lines</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Reseller Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {resellers.map((r) => (
          <div key={r.id} className="app-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{r.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {r.area || 'Sub-Zone Franchise'}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ACTIVE
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-500">Wallet Balance:</span>
                <span className="text-xl font-bold text-emerald-600 font-mono">
                  ৳{parseFloat(r.balance).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Commission Margin:</span>
                <span className="font-semibold text-slate-800">{r.commission_rate}%</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Franchise Contact:</span>
                <span className="font-mono text-slate-700 font-medium">{r.mobile}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>MikroTik Sync:</span>
                <span className="text-indigo-600 font-medium">Automatic Secret Creation</span>
              </div>
            </div>

            <button
              onClick={() => {
                setTopupReseller(r);
                setTopupAmount(5000);
              }}
              className="w-full py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition flex items-center justify-center gap-1.5"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>+ Top-up Prepaid Wallet</span>
            </button>
          </div>
        ))}
      </div>

      {/* TOPUP MODAL */}
      {topupReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 border border-slate-200 shadow-xl relative space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Top-up Reseller Wallet</h3>
              <button 
                onClick={() => setTopupReseller(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-slate-500">
              Partner: <strong className="text-slate-800">{topupReseller.name}</strong> • Current Balance: <span className="font-mono font-bold text-emerald-600">৳{parseFloat(topupReseller.balance).toLocaleString()}</span>
            </p>

            <div>
              <label className="text-slate-600 font-medium block mb-1">Recharge Amount (৳)</label>
              <input
                type="number"
                value={topupAmount}
                onChange={(e) => setTopupAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-base font-bold focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            <div className="flex gap-2">
              {[2000, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTopupAmount(amt)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition ${
                    topupAmount === amt 
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  ৳{amt.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setTopupReseller(null)}
                className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleTopup}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
              >
                Confirm Topup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
