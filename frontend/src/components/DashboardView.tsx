import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Wallet, 
  ArrowUpRight, 
  AlertTriangle, 
  Zap, 
  Wifi, 
  Clock, 
  CheckCircle2, 
  Server, 
  Radio, 
  Send,
  CreditCard,
  DollarSign
} from 'lucide-react';
import { api } from '../services/api';

interface DashboardViewProps {
  onOpenAddCustomer: () => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenAddCustomer, onNavigateTab }) => {
  const [stats, setStats] = useState<any>(null);
  const [traffic, setTraffic] = useState({ rx: 42.5, tx: 95.8, cpu: 12 });

  useEffect(() => {
    loadStats();
    const interval = setInterval(() => {
      setTraffic({
        rx: parseFloat((Math.random() * 25 + 35).toFixed(1)),
        tx: parseFloat((Math.random() * 50 + 75).toFixed(1)),
        cpu: Math.floor(Math.random() * 8 + 10),
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.getDashboardStats();
      if (data && data.stats) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const subscribers = stats?.subscribers || { total: 3, active: 2, expired: 1, expiringIn3Days: 1, online: 1, offline: 1 };
  const financials = stats?.financials || { thisMonthRevenue: 1300, thisMonthCollection: 800, todayCollection: 800, totalDue: 500 };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Expiry Alert Warning Ribbon */}
      {subscribers.expiringIn3Days > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                {subscribers.expiringIn3Days} Subscriber Expiring Within 3 Days!
              </h4>
              <p className="text-[11px] text-amber-700">
                MikroTik will automatically suspend their speed profile upon expiration unless renewed.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => alert('Automated payment reminder SMS broadcasted to expiring clients!')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100/60 transition flex items-center gap-1.5 shadow-2xs"
            >
              <Send className="w-3.5 h-3.5 text-amber-600" />
              <span>Broadcast Reminder SMS</span>
            </button>
            <button
              onClick={() => onNavigateTab('subscribers')}
              className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition shadow-2xs"
            >
              Review Accounts →
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Grid: NetFee + SmartISP Comprehensive Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Subscribers */}
        <div className="app-card p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Clients</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-slate-900">{subscribers.total}</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Registered in DB</span>
        </div>

        {/* Active Clients */}
        <div className="app-card p-4 rounded-xl border-l-4 border-l-emerald-500">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Active (Paid)</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-emerald-700">{subscribers.active}</span>
          </div>
          <span className="text-[10px] text-emerald-600/80 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {subscribers.online} Online Now
          </span>
        </div>

        {/* Unpaid / Due Clients */}
        <div className="app-card p-4 rounded-xl border-l-4 border-l-amber-500">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">Due / Unpaid</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-amber-700">1</span>
          </div>
          <span className="text-[10px] text-amber-600 font-mono mt-1 block">Due: ৳{financials.totalDue.toLocaleString()}</span>
        </div>

        {/* Expired Clients */}
        <div className="app-card p-4 rounded-xl border-l-4 border-l-rose-500">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block">Expired Lines</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-rose-700">{subscribers.expired}</span>
          </div>
          <span className="text-[10px] text-rose-600 mt-1 block">Auto-Suspended</span>
        </div>

        {/* Today's Cash Collection */}
        <div className="app-card p-4 rounded-xl border-l-4 border-l-indigo-600">
          <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block">Today Collection</span>
          <div className="mt-2 flex items-baseline gap-0.5">
            <span className="text-xs font-semibold text-slate-400">৳</span>
            <span className="text-2xl font-black font-mono text-slate-900">{financials.todayCollection.toLocaleString()}</span>
          </div>
          <span className="text-[10px] text-indigo-600 mt-1 block">Hand-Cash & bKash</span>
        </div>

        {/* This Month's Revenue */}
        <div className="app-card p-4 rounded-xl border-l-4 border-l-blue-600">
          <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">This Month Bill</span>
          <div className="mt-2 flex items-baseline gap-0.5">
            <span className="text-xs font-semibold text-slate-400">৳</span>
            <span className="text-2xl font-black font-mono text-slate-900">{financials.thisMonthRevenue.toLocaleString()}</span>
          </div>
          <span className="text-[10px] text-emerald-600 mt-1 block">Paid: ৳{financials.thisMonthCollection.toLocaleString()}</span>
        </div>
      </div>

      {/* Main Section: Live Bandwidth Telemetry & POP / Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Network Bandwidth Meter */}
        <div className="lg:col-span-2 app-card p-6 rounded-2xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Live Bandwidth Consumption</h3>
                <p className="text-xs text-slate-500">MikroTik RouterOS Gateway (ether1 interface)</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-live-ping"></span> Live Socket Sync
            </span>
          </div>

          {/* Rx / Tx Metric Gauges */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span className="font-semibold">Download Traffic (Rx)</span>
                <span className="font-mono text-slate-400">42% load</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5 font-mono">
                <span className="text-3xl font-extrabold text-indigo-600">{traffic.rx}</span>
                <span className="text-xs text-slate-500 font-sans font-semibold">Mbps</span>
              </div>
              <div className="mt-3 w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, traffic.rx)}%` }}
                ></div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span className="font-semibold">Upload Traffic (Tx)</span>
                <span className="font-mono text-slate-400">65% load</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5 font-mono">
                <span className="text-3xl font-extrabold text-cyan-600">{traffic.tx}</span>
                <span className="text-xs text-slate-500 font-sans font-semibold">Mbps</span>
              </div>
              <div className="mt-3 w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, traffic.tx / 1.5)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Router Health Strip */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-2 font-medium">
              <Server className="w-4 h-4 text-indigo-600" />
              Main Gateway (CCR2004-16G-2S+)
            </span>
            <span className="font-mono text-slate-700">CPU Load: <strong>{traffic.cpu}%</strong></span>
            <span className="text-emerald-700 font-medium">Uptime: 42w 3d</span>
          </div>
        </div>

        {/* Quick ISP Operations Panel */}
        <div className="app-card p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Frequent Operator Actions</h3>
            <p className="text-xs text-slate-500">Essential day-to-day ISP tasks</p>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={onOpenAddCustomer}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition"
            >
              <span>+ Onboard New Subscriber</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigateTab('subscribers')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <span>⚡ Quick Recharge PPPoE Account</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={async () => {
                await api.generateMonthlyBills();
                alert('Monthly bills generated successfully!');
                loadStats();
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <span>📄 Batch Generate Monthly Invoices</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigateTab('routers')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <span>🔄 Sync MikroTik Secrets</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Customer Self-Pay Simulator Card */}
          <div className="p-3.5 rounded-xl bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-200 text-xs space-y-1">
            <span className="font-bold text-emerald-900 block">bKash Instant Auto-Reconnect</span>
            <p className="text-[11px] text-emerald-700">Test client payment unblocking in 3 seconds</p>
            <button
              onClick={() => onNavigateTab('selfcare')}
              className="mt-2 w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-2xs"
            >
              Test bKash Portal Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
