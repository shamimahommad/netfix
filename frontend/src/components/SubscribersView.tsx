import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Zap, 
  PowerOff, 
  ShieldAlert, 
  Copy, 
  RotateCw,
  X,
  CreditCard,
  UserCheck,
  MapPin,
  Phone,
  Layers,
  Send,
  Plus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

interface SubscribersViewProps {
  onRefreshStats: () => void;
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  initialStatusFilter?: string;
}

export const SubscribersView: React.FC<SubscribersViewProps> = ({ 
  onRefreshStats, 
  showAddModal, 
  setShowAddModal,
  initialStatusFilter = 'ALL'
}) => {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('ALL');

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  // Quick Recharge Modal State
  const [rechargeModalSub, setRechargeModalSub] = useState<any | null>(null);
  const [rechargeDays, setRechargeDays] = useState(30);
  const [rechargeMethod, setRechargeMethod] = useState('CASH');

  // Full-Scale Add Customer Form State (All ISP Fields)
  const [newSub, setNewSub] = useState({
    name: '',
    mobile: '',
    altPhone: '',
    email: '',
    nid: '',
    connectionType: 'PPPOE',
    pppoeUsername: '',
    pppoePassword: 'net@' + Math.floor(1000 + Math.random() * 9000),
    packageId: 'pkg-02',
    routerId: 'router-01',
    zone: 'Uttara Sector 7',
    subZone: 'Block B',
    boxNumber: 'TJ-07-02',
    oltName: 'OLT-Central-01',
    coreColor: 'Blue',
    address: '',
    monthlyFee: 800,
    discount: 0,
    connectionFee: 1000,
    advanceAmount: 0,
    billingType: 'PREPAID',
    validityDays: 30,
    collectorName: 'Rafiqul Islam',
  });

  useEffect(() => {
    loadSubscribers();
  }, [statusFilter, searchQuery, selectedZone]);

  const loadSubscribers = async () => {
    setLoading(true);
    try {
      const data = await api.getSubscribers(statusFilter, selectedZone, searchQuery);
      if (data && data.subscribers) {
        setSubscribers(data.subscribers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecharge = async () => {
    if (!rechargeModalSub) return;
    try {
      await api.rechargeSubscriber(rechargeModalSub.id, {
        days: rechargeDays,
        paymentMethod: rechargeMethod,
        amount: rechargeModalSub.monthly_fee,
      });
      alert(`Customer ${rechargeModalSub.name} recharged successfully!`);
      setRechargeModalSub(null);
      loadSubscribers();
      onRefreshStats();
    } catch (e: any) {
      alert(e.message || 'Recharge failed');
    }
  };

  const handleKick = async (sub: any) => {
    if (!confirm(`Disconnect live PPPoE session for ${sub.pppoe_username} on MikroTik?`)) return;
    try {
      await api.kickSubscriber(sub.id);
      alert(`PPPoE session for ${sub.pppoe_username} disconnected from MikroTik`);
    } catch (e: any) {
      alert(e.message || 'Kick failed');
    }
  };

  const handleToggleStatus = async (sub: any) => {
    try {
      await api.toggleSubscriberStatus(sub.id);
      loadSubscribers();
      onRefreshStats();
    } catch (e: any) {
      alert(e.message || 'Toggle failed');
    }
  };

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSubscriber(newSub);
      alert(`Subscriber ${newSub.name} added and synchronized to MikroTik!`);
      setShowAddModal(false);
      loadSubscribers();
      onRefreshStats();
    } catch (err: any) {
      alert(err.message || 'Failed to add subscriber');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Page Title & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Subscriber Directory & Queue Control
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-semibold">
              {subscribers.length} Clients
            </span>
          </h2>
          <p className="text-xs text-slate-500">Manage client lifecycle, PPPoE credentials, area boxes & renewals</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard Subscriber</span>
        </button>
      </div>

      {/* Status Filter Tabs: Combined NetFee & SmartISP Buckets */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-slate-200">
        {[
          { id: 'ALL', label: 'All Subscribers', count: subscribers.length },
          { id: 'ACTIVE', label: 'Active (Paid)', count: 2 },
          { id: 'DUE', label: 'Due / Unpaid', count: 1 },
          { id: 'EXPIRED', label: 'Expired (Blocked)', count: 1 },
          { id: 'WARNING', label: 'Expiring in 3/7 Days', count: 1 },
          { id: 'SUSPENDED', label: 'Suspended', count: 0 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-2 rounded-t-lg font-medium transition flex items-center gap-2 border-b-2 ${
              statusFilter === tab.id
                ? 'border-indigo-600 text-indigo-700 font-semibold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
              statusFilter === tab.id ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="app-card p-3 rounded-xl flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, mobile, PPPoE username, code, or box number..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none"
          >
            <option value="ALL">All Coverage Areas</option>
            <option value="Uttara Sector 7">Uttara Sector 7</option>
            <option value="Gulshan 1">Gulshan 1</option>
            <option value="Mohakhali">Mohakhali</option>
          </select>

          <button 
            onClick={loadSubscribers}
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 transition"
            title="Reload Data"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* High-Density Subscribers Table */}
      <div className="app-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Subscriber & Code</th>
                <th className="py-3 px-4 font-semibold">Area & TJ Box</th>
                <th className="py-3 px-4 font-semibold">PPPoE Account</th>
                <th className="py-3 px-4 font-semibold">Bandwidth Plan</th>
                <th className="py-3 px-4 font-semibold">Monthly Bill</th>
                <th className="py-3 px-4 font-semibold">Expiry Countdown</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Loading subscribers...</td>
                </tr>
              ) : subscribers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">No subscribers match the current filter.</td>
                </tr>
              ) : (
                subscribers.map((sub) => {
                  const isExpired = sub.status === 'EXPIRED';
                  const isActive = sub.status === 'ACTIVE';
                  const expiry = new Date(sub.expiry_date);
                  const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/70 transition">
                      {/* Name & ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-700">
                            {sub.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{sub.name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{sub.mobile} • <span className="font-semibold text-indigo-600">{sub.customer_code}</span></span>
                          </div>
                        </div>
                      </td>

                      {/* Area & TJ Box */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800 block">{sub.zone || 'Central Area'}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Box: {sub.box_number || 'TJ-01'}</span>
                      </td>

                      {/* PPPoE User & Password */}
                      <td className="py-3 px-4 font-mono">
                        <div className="flex items-center gap-1.5 text-indigo-700 font-semibold">
                          <span>{sub.pppoe_username}</span>
                          <button 
                            onClick={() => navigator.clipboard.writeText(sub.pppoe_username)}
                            className="text-slate-400 hover:text-slate-700"
                            title="Copy username"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400">Pass: {sub.pppoe_password}</span>
                      </td>

                      {/* Bandwidth Package */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">{sub.package_name || 'Standard Plan'}</span>
                        <span className="inline-block px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-mono border border-indigo-200">
                          {sub.rate_limit || '20M/20M'}
                        </span>
                      </td>

                      {/* Monthly Fee */}
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-slate-900">৳{parseFloat(sub.monthly_fee).toLocaleString()}</span>
                      </td>

                      {/* Expiry Countdown */}
                      <td className="py-3 px-4 font-mono">
                        <span className="text-slate-700 block">{expiry.toLocaleDateString()}</span>
                        {isExpired ? (
                          <span className="text-[10px] text-rose-600 font-sans font-semibold">Expired {Math.abs(daysLeft)}d ago</span>
                        ) : (
                          <span className={`text-[10px] font-sans font-semibold ${daysLeft <= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {daysLeft} days left
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isExpired
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : isExpired ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                          {sub.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Recharge */}
                          <button
                            onClick={() => setRechargeModalSub(sub)}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                            title="Quick Recharge & Renew"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>

                          {/* Kick Active Session */}
                          <button
                            onClick={() => handleKick(sub)}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition"
                            title="Disconnect Active PPPoE Session"
                          >
                            <PowerOff className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Suspend */}
                          <button
                            onClick={() => handleToggleStatus(sub)}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Suspend / Reactivate Line"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK RECHARGE MODAL */}
      {rechargeModalSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 border border-slate-200 shadow-xl relative animate-in fade-in">
            <button 
              onClick={() => setRechargeModalSub(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Recharge Subscriber Line</h3>
                <p className="text-xs text-slate-500">{rechargeModalSub.name} • {rechargeModalSub.customer_code}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-500 block mb-1 font-medium">PPPoE Account</label>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-indigo-700">
                  {rechargeModalSub.pppoe_username}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 block mb-1 font-medium">Recharge Amount (৳)</label>
                  <input
                    type="number"
                    defaultValue={rechargeModalSub.monthly_fee}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block mb-1 font-medium">Validity Period</label>
                  <select
                    value={rechargeDays}
                    onChange={(e) => setRechargeDays(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium"
                  >
                    <option value={30}>30 Days (Standard)</option>
                    <option value={15}>15 Days</option>
                    <option value={60}>60 Days (2 Months)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-500 block mb-1 font-medium">Payment Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {['CASH', 'BKASH', 'NAGAD'].map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setRechargeMethod(pm)}
                      className={`py-2 rounded-xl font-bold border transition ${
                        rechargeMethod === pm
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRechargeModalSub(null)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRecharge}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition"
                >
                  Confirm & Unblock Internet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCALE ADD CUSTOMER SLIDEOVER (ALL REAL ISP FIELDS) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white border-l border-slate-200 h-full p-6 overflow-y-auto space-y-5 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-indigo-600" />
                    Onboard New Subscriber
                  </h3>
                  <p className="text-xs text-slate-500">Auto-creates MikroTik secret and initial billing invoice</p>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="add-sub-form" onSubmit={handleAddSubscriber} className="space-y-4 text-xs mt-4">
                {/* 1. Basic Subscriber Info */}
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block border-b pb-1">
                    1. Personal & Contact Details
                  </span>
                  
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Customer Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newSub.name}
                      onChange={(e) => setNewSub({ ...newSub, name: e.target.value })}
                      placeholder="e.g. Asif Mahmud"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">Primary Mobile *</label>
                      <input
                        type="text"
                        required
                        value={newSub.mobile}
                        onChange={(e) => setNewSub({ ...newSub, mobile: e.target.value })}
                        placeholder="017xxxxxxxx"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">National ID (NID)</label>
                      <input
                        type="text"
                        value={newSub.nid}
                        onChange={(e) => setNewSub({ ...newSub, nid: e.target.value })}
                        placeholder="Optional NID"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. MikroTik RouterOS Credentials */}
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-3">
                  <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block">
                    2. MikroTik Network & PPPoE Credentials
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 block mb-1 font-medium">PPPoE Username *</label>
                      <input
                        type="text"
                        required
                        value={newSub.pppoeUsername}
                        onChange={(e) => setNewSub({ ...newSub, pppoeUsername: e.target.value })}
                        placeholder="e.g. asif_net"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 block mb-1 font-medium">PPPoE Password *</label>
                      <input
                        type="text"
                        required
                        value={newSub.pppoePassword}
                        onChange={(e) => setNewSub({ ...newSub, pppoePassword: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1 font-medium">Gateway Router</label>
                    <select
                      value={newSub.routerId}
                      onChange={(e) => setNewSub({ ...newSub, routerId: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-medium"
                    >
                      <option value="router-01">Main Gateway (CCR2004-16G-2S+)</option>
                    </select>
                  </div>
                </div>

                {/* 3. Coverage, Area & Box Details */}
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block border-b pb-1">
                    3. FTTH Network & Distribution Box
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">Area / Zone</label>
                      <input
                        type="text"
                        value={newSub.zone}
                        onChange={(e) => setNewSub({ ...newSub, zone: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">TJ / Splitter Box No</label>
                      <input
                        type="text"
                        value={newSub.boxNumber}
                        onChange={(e) => setNewSub({ ...newSub, boxNumber: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Installation Address</label>
                    <input
                      type="text"
                      value={newSub.address}
                      onChange={(e) => setNewSub({ ...newSub, address: e.target.value })}
                      placeholder="House, Road, Floor, Apartment"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900"
                    />
                  </div>
                </div>

                {/* 4. Package & Billing Details */}
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block border-b pb-1">
                    4. Package, Fees & Collection
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">Bandwidth Package</label>
                      <select
                        value={newSub.packageId}
                        onChange={(e) => setNewSub({ ...newSub, packageId: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-medium"
                      >
                        <option value="pkg-01">10 Mbps Basic (৳500)</option>
                        <option value="pkg-02">20 Mbps Standard (৳800)</option>
                        <option value="pkg-03">35 Mbps Pro Gamer (৳1200)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">Monthly Fee (৳)</label>
                      <input
                        type="number"
                        value={newSub.monthlyFee}
                        onChange={(e) => setNewSub({ ...newSub, monthlyFee: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">Connection Fee (৳)</label>
                      <input
                        type="number"
                        value={newSub.connectionFee}
                        onChange={(e) => setNewSub({ ...newSub, connectionFee: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1 font-medium">Advance Paid (৳)</label>
                      <input
                        type="number"
                        value={newSub.advanceAmount}
                        onChange={(e) => setNewSub({ ...newSub, advanceAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-sub-form"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95"
              >
                Create Subscriber & Sync Router
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
