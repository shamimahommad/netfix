import React from 'react';
import { Activity, Bell, Search, UserCheck, Plus, Radio, Server } from 'lucide-react';

interface HeaderProps {
  currentRole: string;
  setCurrentRole: (role: string) => void;
  onOpenAddCustomer: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentRole, setCurrentRole, onOpenAddCustomer }) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Search Input */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Quick search subscriber, mobile, PPPoE username, box no..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
          />
        </div>
      </div>

      {/* Live Router Telemetry & Action Buttons */}
      <div className="flex items-center gap-3.5">
        {/* Live Router Telemetry Pill */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-slate-500 font-medium">Gateway:</span>
          <span className="text-slate-800 font-semibold font-mono">CCR2004</span>
          <span className="text-slate-300">|</span>
          <span className="text-emerald-600 font-bold font-mono">14ms</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 flex items-center gap-1 font-mono">
            <Activity className="w-3.5 h-3.5 text-indigo-500" /> 12% CPU
          </span>
        </div>

        {/* Role Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
          <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-[11px] text-slate-500 font-medium">Role:</span>
          <select
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value)}
            className="bg-transparent text-slate-800 font-semibold text-xs focus:outline-none cursor-pointer"
          >
            <option value="ISP_ADMIN">ISP Admin</option>
            <option value="SUPER_ADMIN">Super Admin (SaaS)</option>
            <option value="BILL_COLLECTOR">Bill Collector</option>
            <option value="RESELLER">Reseller</option>
          </select>
        </div>

        {/* Notifications */}
        <button className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 relative transition">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500"></span>
        </button>

        {/* Primary CTA: Add Customer */}
        <button
          onClick={onOpenAddCustomer}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-sm shadow-indigo-600/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Subscriber</span>
        </button>
      </div>
    </header>
  );
};
