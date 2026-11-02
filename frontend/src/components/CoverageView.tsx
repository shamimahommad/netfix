import React, { useState, useEffect } from 'react';
import { MapPin, Box, Plus, Network, Layers, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { api } from '../services/api';

export const CoverageView: React.FC = () => {
  const [boxes, setBoxes] = useState<any[]>([
    { id: 'box-01', name: 'OLT-Central-01', code: 'OLT-01', type: 'OLT', area: 'Central Server Room', capacity: 16, used_ports: 8, core_color: 'Blue' },
    { id: 'box-02', name: 'TJ-Box-Uttara-07', code: 'TJ-07', type: 'TJ_BOX', area: 'Uttara Sector 7', capacity: 16, used_ports: 12, core_color: 'Blue' },
    { id: 'box-03', name: 'Splitter-Gulshan-04', code: 'SPL-04', type: 'SPLITTER', area: 'Gulshan 1', capacity: 8, used_ports: 6, core_color: 'Orange' },
    { id: 'box-04', name: 'TJ-Box-Mohakhali-01', code: 'TJ-M1', type: 'TJ_BOX', area: 'Mohakhali Wireless', capacity: 8, used_ports: 7, core_color: 'Green' },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'TJ_BOX',
    area: '',
    capacity: 8,
    core_color: 'Blue',
  });

  useEffect(() => {
    loadBoxes();
  }, []);

  const loadBoxes = async () => {
    try {
      const data = await api.getCoverageBoxes();
      if (data && data.boxes && data.boxes.length > 0) {
        setBoxes(data.boxes);
      }
    } catch (e) {
      console.log('Using default mock boxes');
    }
  };

  const handleCreateBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.area) {
      alert('Please fill in Box Name and Area');
      return;
    }

    setLoading(true);
    try {
      await api.createCoverageBox(formData);
      await loadBoxes();
      setShowAddModal(false);
      setFormData({
        name: '',
        code: '',
        type: 'TJ_BOX',
        area: '',
        capacity: 8,
        core_color: 'Blue',
      });
    } catch (err: any) {
      alert('Failed to add box: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            FTTH Optical Network & Coverage Zones
          </h2>
          <p className="text-xs text-slate-500">Track Areas, Sub-zones, OLT/PON ports, Splitters & TJ Distribution Boxes</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Distribution Box</span>
        </button>
      </div>

      {/* Coverage Areas Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { area: 'Uttara Sector 7', subZones: 4, boxes: 8, clients: 142, lineman: 'Sumon Mia' },
          { area: 'Gulshan 1 (Lake Drive)', subZones: 2, boxes: 5, clients: 98, lineman: 'Kamal Hossain' },
          { area: 'Mohakhali Wireless', subZones: 3, boxes: 6, clients: 110, lineman: 'Sumon Mia' },
        ].map((cov, idx) => (
          <div key={idx} className="app-card p-5 rounded-xl space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  {cov.area}
                </span>
                <span className="text-xs text-slate-500">{cov.subZones} Sub-Zones • {cov.boxes} Distribution Boxes</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ACTIVE
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500">Active Lines: <strong className="text-slate-800">{cov.clients}</strong></span>
              <span className="text-indigo-600 font-medium">Lineman: {cov.lineman}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Distribution Boxes Table */}
      <div className="app-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Distribution Boxes & Optical Splitters (TJ Boxes)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Total {boxes.length} Active Nodes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Box / Device Name</th>
                <th className="py-3 px-4">Device Type</th>
                <th className="py-3 px-4">Coverage Area</th>
                <th className="py-3 px-4">Optical Fiber Core</th>
                <th className="py-3 px-4">Port Capacity</th>
                <th className="py-3 px-4">Usage %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {boxes.map((b) => {
                const used = b.used_ports ?? b.used ?? 0;
                const cap = b.capacity || 8;
                const percent = Math.min(100, Math.round((used / cap) * 100));
                const core = b.core_color || b.core || 'Blue';
                return (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {b.name} <span className="text-slate-400 font-mono text-[11px] font-normal">({b.code})</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold border border-slate-200">
                        {b.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">{b.area}</td>
                    <td className="py-3 px-4 font-medium flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${core === 'Blue' ? 'bg-blue-500' : core === 'Orange' ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
                      {core} Core
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">
                      {used} / {cap} Ports
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${percent > 80 ? 'bg-rose-500' : 'bg-indigo-600'}`}
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">{percent}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Distribution Box Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Box className="w-4 h-4 text-indigo-600" />
                Add Distribution Box (TJ / Splitter)
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBox} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Box / Device Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. TJ-Box-Uttara-08" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Box Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. TJ-08" 
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Device Type</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TJ_BOX">TJ_BOX (Distribution)</option>
                    <option value="SPLITTER">SPLITTER (1:8 / 1:16)</option>
                    <option value="OLT">OLT</option>
                    <option value="PON_PORT">PON Port</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Area / Coverage Zone *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Uttara Sector 7, Road 5" 
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Port Capacity</label>
                  <input 
                    type="number" 
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 8 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                    min="1"
                    max="128"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fiber Core Color</label>
                  <select 
                    value={formData.core_color}
                    onChange={(e) => setFormData({ ...formData, core_color: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Blue">Blue Core</option>
                    <option value="Orange">Orange Core</option>
                    <option value="Green">Green Core</option>
                    <option value="Brown">Brown Core</option>
                    <option value="Slate">Slate Core</option>
                    <option value="White">White Core</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
                >
                  {loading ? 'Saving...' : 'Save Box'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
