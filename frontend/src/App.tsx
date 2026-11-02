import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { SubscribersView } from './components/SubscribersView';
import { CoverageView } from './components/CoverageView';
import { RoutersView } from './components/RoutersView';
import { BillingView } from './components/BillingView';
import { HotspotView } from './components/HotspotView';
import { ResellersView } from './components/ResellersView';
import { SelfCarePayView } from './components/SelfCarePayView';
import { api } from './services/api';
import { Layers, Plus, TicketCheck, CheckCircle2, Clock, ShieldAlert, Wifi, Zap } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentRole, setCurrentRole] = useState('ISP_ADMIN');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [statsKey, setStatsKey] = useState(0);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [tenantInfo, setTenantInfo] = useState<any>({
    name: 'NetFix Broadband',
    brand_color: '#4f46e5',
    currency: '৳',
  });

  // Auto-login demo admin if no token & load tenant branding
  useEffect(() => {
    const initAuth = async () => {
      try {
        const tData = await api.getTenantInfo();
        if (tData && tData.tenant) {
          setTenantInfo(tData.tenant);
          document.title = `${tData.tenant.name} — NOC Portal`;
        }
      } catch (e) {
        console.log('Default tenant info used');
      }

      try {
        await api.login('admin@cloudnet.bd', 'password123');
      } catch (e) {
        console.log('Using default headers/token');
      }
      loadGlobalStats();
    };
    initAuth();
  }, []);

  const loadGlobalStats = async () => {
    try {
      const data = await api.getDashboardStats();
      if (data && data.stats) {
        setDashboardStats(data.stats);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const refreshStats = () => {
    setStatsKey((prev) => prev + 1);
    loadGlobalStats();
  };

  // Derive subscriber counts for Sidebar badges
  const sidebarCounts = {
    total: dashboardStats?.subscribers?.total ?? 3,
    active: dashboardStats?.subscribers?.active ?? 2,
    expired: dashboardStats?.subscribers?.expired ?? 1,
    due: (dashboardStats?.financials?.totalDue > 0 ? 1 : 0),
    expiring3Days: dashboardStats?.subscribers?.expiringIn3Days ?? 1,
  };

  // Determine if active tab is any subscriber view
  const isSubscriberTab = activeTab.startsWith('subscribers');
  let initialSubscriberFilter = 'ALL';
  if (activeTab === 'subscribers_active') initialSubscriberFilter = 'ACTIVE';
  else if (activeTab === 'subscribers_due') initialSubscriberFilter = 'DUE';
  else if (activeTab === 'subscribers_expired') initialSubscriberFilter = 'EXPIRED';
  else if (activeTab === 'subscribers_warning') initialSubscriberFilter = 'EXPIRING';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc] text-slate-800 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        subscriberCounts={sidebarCounts}
        tenantInfo={tenantInfo}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#f8fafc]">
        {/* Top Header */}
        <Header 
          currentRole={currentRole} 
          setCurrentRole={setCurrentRole} 
          onOpenAddCustomer={() => {
            setActiveTab('subscribers');
            setShowAddCustomerModal(true);
          }}
        />

        {/* Dynamic View Panel */}
        <main className="flex-1 overflow-y-auto bg-[#f8fafc]">
          {activeTab === 'dashboard' && (
            <DashboardView 
              key={statsKey}
              onOpenAddCustomer={() => {
                setActiveTab('subscribers');
                setShowAddCustomerModal(true);
              }}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {isSubscriberTab && (
            <SubscribersView 
              key={`${activeTab}-${statsKey}`}
              onRefreshStats={refreshStats}
              showAddModal={showAddCustomerModal}
              setShowAddModal={setShowAddCustomerModal}
              initialStatusFilter={initialSubscriberFilter}
            />
          )}

          {activeTab === 'coverage' && <CoverageView />}

          {activeTab === 'routers' && <RoutersView />}

          {activeTab === 'packages' && (
            <div className="p-6 max-w-7xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    Bandwidth Profiles & MikroTik Queues
                  </h2>
                  <p className="text-xs text-slate-500">
                    Define speed tiers, rate-limits (rx/tx), burst thresholds, and automated PPPoE profile provisioning
                  </p>
                </div>
                <button
                  onClick={() => alert('New Bandwidth Package Modal')}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Package</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  { name: '10 Mbps Basic Line', speed: '10M/10M', price: 500, users: 1, desc: 'Single-room browsing & YouTube 1080p', burst: '15M/15M 10s', queue: 'default-encryption' },
                  { name: '20 Mbps Home Standard', speed: '20M/20M', price: 800, users: 1, desc: 'Multi-device Netflix 4K & Zoom calls', burst: '30M/30M 15s', queue: 'default-encryption' },
                  { name: '35 Mbps Pro Gamer / SOHO', speed: '35M/35M', price: 1200, users: 1, desc: 'Low-latency routing, BDIX cache & heavy gaming', burst: '50M/50M 20s', queue: 'default-encryption' },
                ].map((pkg, idx) => (
                  <div key={idx} className="app-card p-6 rounded-2xl space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{pkg.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{pkg.desc}</p>
                      </div>
                      <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                        {pkg.speed}
                      </span>
                    </div>

                    <div className="text-3xl font-black font-mono text-slate-900">
                      ৳{pkg.price} <span className="text-xs text-slate-500 font-normal">/ month</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>MikroTik Burst:</span>
                        <span className="font-mono font-medium text-slate-800">{pkg.burst}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Queue Profile:</span>
                        <span className="font-mono text-indigo-600">{pkg.queue}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">
                        <strong className="text-slate-900">{pkg.users}</strong> Active Lines
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        SYNCHRONIZED
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'billing' && <BillingView onRefreshStats={refreshStats} />}

          {activeTab === 'resellers' && <ResellersView />}

          {activeTab === 'hotspot' && <HotspotView />}

          {activeTab === 'tickets' && (
            <div className="p-6 max-w-7xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    Customer Support CRM & Dispatch Desk
                  </h2>
                  <p className="text-xs text-slate-500">
                    Track fiber cut complaints, optical loss issues, slow speed reports & field lineman tickets
                  </p>
                </div>
                <button
                  onClick={() => alert('New Support Ticket Modal')}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Open New Ticket</span>
                </button>
              </div>

              <div className="space-y-4">
                {[
                  {
                    id: 'TKT-10842',
                    category: 'SLOW_SPEED',
                    subscriber: 'Tanvir Rahman (C-100202)',
                    mobile: '01811223344',
                    area: 'Uttara Sector 7 • TJ-07-02',
                    issue: 'Subscriber reports evening bandwidth dropping from 35Mbps to 8Mbps during 8PM-10PM peak window.',
                    lineman: 'Sumon Mia (Lineman)',
                    priority: 'HIGH',
                    status: 'OPEN',
                    created: 'Today at 07:15 PM'
                  },
                  {
                    id: 'TKT-10839',
                    category: 'FIBER_CUT',
                    subscriber: 'Monir Hossain (C-100203)',
                    mobile: '01733445566',
                    area: 'Uttara Sector 7 • TJ-07-02',
                    issue: 'ONU LOS red light blinking after municipal road construction. Core splice required.',
                    lineman: 'Kamal Hossain (Fiber Tech)',
                    priority: 'CRITICAL',
                    status: 'IN_PROGRESS',
                    created: 'Yesterday'
                  }
                ].map((ticket) => (
                  <div key={ticket.id} className="app-card rounded-2xl p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {ticket.id}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {ticket.category}
                        </span>
                        <span className="font-semibold text-slate-900 text-sm">{ticket.subscriber}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                          {ticket.priority}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
                          {ticket.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">{ticket.issue}</p>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-500 border-t border-slate-100">
                      <div className="flex items-center gap-4">
                        <span>Assigned: <strong className="text-slate-800">{ticket.lineman}</strong></span>
                        <span>Location: <strong className="text-slate-800">{ticket.area}</strong></span>
                      </div>
                      <button 
                        onClick={() => alert(`Ticket ${ticket.id} resolved!`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-semibold transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Resolved</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'selfcare' && <SelfCarePayView onRefreshStats={refreshStats} />}
        </main>
      </div>
    </div>
  );
}

export default App;
