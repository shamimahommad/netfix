import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Network, 
  MapPin, 
  Radio, 
  TicketCheck, 
  Wifi, 
  MessageSquare, 
  Settings, 
  ChevronDown, 
  ChevronRight,
  ShieldCheck,
  Server,
  Zap,
  Clock,
  AlertTriangle,
  Receipt,
  Layers,
  LogOut,
  Smartphone
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  subscriberCounts?: {
    total: number;
    active: number;
    expired: number;
    due: number;
    expiring3Days: number;
  };
  tenantInfo?: any;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  subscriberCounts = { total: 3, active: 2, expired: 1, due: 1, expiring3Days: 1 },
  tenantInfo
}) => {
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    subscribers: true,
    billing: false,
    network: false,
  });

  const toggleSubmenu = (menu: string) => {
    setOpenSubmenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  return (
    <aside className="w-64 bg-[#0a0f1d] text-slate-300 border-r border-slate-800/80 flex flex-col h-screen select-none shrink-0">
      {/* Brand & Organization */}
      <div className="p-4 border-b border-slate-800/80 bg-[#0d1426]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Radio className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5 truncate">
              <span>{tenantInfo?.name ? tenantInfo.name.split(' ')[0] : 'NetFix'}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">NOC</span>
            </h1>
            <p className="text-[11px] text-slate-400 truncate">{tenantInfo?.name || 'Enterprise ISP Platform'}</p>
          </div>
        </div>

        {/* Live System Indicator */}
        <div className="mt-3 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            MikroTik CCR2004
          </span>
          <span className="font-mono text-emerald-400 font-semibold">Online</span>
        </div>
      </div>

      {/* Navigation Menus with Subcategories */}
      <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto text-xs">
        {/* 1. Dashboard */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${
            activeTab === 'dashboard'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 text-indigo-400" />
          <span>Executive Overview</span>
        </button>

        {/* 2. Subscribers Section with Submenus */}
        <div>
          <button
            onClick={() => toggleSubmenu('subscribers')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition ${
              activeTab.startsWith('subscribers') ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Subscriber Hub</span>
            </div>
            {openSubmenus.subscribers ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {openSubmenus.subscribers && (
            <div className="ml-7 pl-2 border-l border-slate-800 space-y-0.5 mt-1">
              <button
                onClick={() => setActiveTab('subscribers')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg transition flex items-center justify-between ${
                  activeTab === 'subscribers' ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>All Subscribers</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">{subscriberCounts.total}</span>
              </button>

              <button
                onClick={() => setActiveTab('subscribers_active')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg transition flex items-center justify-between ${
                  activeTab === 'subscribers_active' ? 'text-emerald-400 font-semibold bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Active (Paid Lines)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400">{subscriberCounts.active}</span>
              </button>

              <button
                onClick={() => setActiveTab('subscribers_due')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg transition flex items-center justify-between ${
                  activeTab === 'subscribers_due' ? 'text-amber-400 font-semibold bg-amber-500/10' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Due / Unpaid Lines</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-400">{subscriberCounts.due}</span>
              </button>

              <button
                onClick={() => setActiveTab('subscribers_expired')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg transition flex items-center justify-between ${
                  activeTab === 'subscribers_expired' ? 'text-rose-400 font-semibold bg-rose-500/10' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Expired (Overdue)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950/60 text-rose-400">{subscriberCounts.expired}</span>
              </button>

              <button
                onClick={() => setActiveTab('subscribers_warning')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg transition flex items-center justify-between ${
                  activeTab === 'subscribers_warning' ? 'text-amber-400 font-semibold bg-amber-500/10' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Expiring in 3/7 Days</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400">⚡ {subscriberCounts.expiring3Days}</span>
              </button>

              <button
                onClick={() => setActiveTab('subscribers')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition"
              >
                <span>New Joins Today</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. Billing & Financial Operations */}
        <div>
          <button
            onClick={() => toggleSubmenu('billing')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition"
          >
            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Billing & Cashflow</span>
            </div>
            {openSubmenus.billing ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {openSubmenus.billing && (
            <div className="ml-7 pl-2 border-l border-slate-800 space-y-0.5 mt-1">
              <button
                onClick={() => setActiveTab('billing')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg transition ${
                  activeTab === 'billing' ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Monthly Bill Sheet
              </button>
              <button
                onClick={() => setActiveTab('billing')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition"
              >
                Daily Cash Collection
              </button>
              <button
                onClick={() => setActiveTab('billing')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition"
              >
                Due Recovery List
              </button>
              <button
                onClick={() => setActiveTab('billing')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition"
              >
                Collector Hand-Cash Ledger
              </button>
            </div>
          )}
        </div>

        {/* 4. MikroTik Central */}
        <button
          onClick={() => setActiveTab('routers')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${
            activeTab === 'routers'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <Server className="w-4 h-4 text-indigo-400" />
          <span>MikroTik RouterOS</span>
        </button>

        {/* 5. Packages & Bandwidth Profiles */}
        <button
          onClick={() => setActiveTab('packages')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${
            activeTab === 'packages'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-400" />
          <span>Bandwidth Profiles</span>
        </button>

        {/* 6. Coverage & Optical (Area / Sub-Zone / TJ Box / OLT) */}
        <button
          onClick={() => setActiveTab('coverage')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${
            activeTab === 'coverage'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <MapPin className="w-4 h-4 text-amber-400" />
          <span>Areas & FTTH Network</span>
        </button>

        {/* 7. Resellers & Sub-ISPs */}
        <button
          onClick={() => setActiveTab('resellers')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${
            activeTab === 'resellers'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <Network className="w-4 h-4 text-blue-400" />
          <span>Resellers & Wallets</span>
        </button>

        {/* 8. Hotspot Voucher Engine */}
        <button
          onClick={() => setActiveTab('hotspot')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${
            activeTab === 'hotspot'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <Wifi className="w-4 h-4 text-pink-400" />
          <span>Hotspot Cards & PIN</span>
        </button>

        {/* 9. Support & Complaints CRM */}
        <button
          onClick={() => setActiveTab('tickets')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${
            activeTab === 'tickets'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
          }`}
        >
          <TicketCheck className="w-4 h-4 text-rose-400" />
          <span>Helpdesk & Tickets</span>
        </button>

        {/* 10. Customer Self-Pay Simulator */}
        <button
          onClick={() => setActiveTab('selfcare')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${
            activeTab === 'selfcare'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-semibold'
              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
          }`}
        >
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>Client Self-Pay (bKash)</span>
        </button>
      </nav>

      {/* Footer Profile */}
      <div className="p-3.5 border-t border-slate-800/80 bg-[#0d1426]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center font-bold text-xs text-white">
              SA
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-tight">Shuvo Ahmed</p>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-indigo-400" /> ISP Administrator
              </p>
            </div>
          </div>
          <button title="Sign Out" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
