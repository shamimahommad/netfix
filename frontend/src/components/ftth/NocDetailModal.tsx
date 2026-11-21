import React, { useState } from 'react';
import { X, Building2, Server, Router, Network, Cable, Edit3, Phone, MapPin, Activity, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { FtthNocStation } from '@/services/ftth.service';

interface NocDetailModalProps {
  station: FtthNocStation | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (station: FtthNocStation) => void;
  onRunCable: (station: FtthNocStation) => void;
  onAddDevice?: (station: FtthNocStation) => void;
}

export default function NocDetailModal({
  station,
  isOpen,
  onClose,
  onEdit,
  onRunCable,
  onAddDevice,
}: NocDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'olts' | 'routers'>('olts');

  if (!isOpen || !station) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="min-w-0 pr-8">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-xl font-bold tracking-tight truncate">{station.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {station.station_type === 'main_office' ? 'Main Office & NOC' : station.station_type === 'server_room' ? 'Server Room' : 'Sub POP'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-indigo-200/80 flex-wrap">
                {station.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    {station.address}
                  </span>
                )}
                {station.contact_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-indigo-400" />
                    {station.contact_phone}
                  </span>
                )}
                <span className="font-mono text-indigo-300">
                  [{station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}]
                </span>
              </div>
            </div>
          </div>

          {/* Quick KPIs Bar */}
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-indigo-500/20 text-center">
            <div className="bg-white/5 rounded-xl p-2.5 backdrop-blur-xs">
              <div className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">OLT Units</div>
              <div className="text-xl font-black text-white">{station.olt_count}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 backdrop-blur-xs">
              <div className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">MikroTik Routers</div>
              <div className="text-xl font-black text-white">{station.router_count}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 backdrop-blur-xs">
              <div className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Feeder Fibers Out</div>
              <div className="text-xl font-black text-emerald-400">{station.outgoing_cables_count}</div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={() => setActiveTab('olts')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'olts'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Network className="w-4 h-4" />
            Optical Line Terminals (OLT) ({station.olts.length})
          </button>
          <button
            onClick={() => setActiveTab('routers')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'routers'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Router className="w-4 h-4" />
            Core MikroTik Routers ({station.routers.length})
          </button>
        </div>

        {/* Device List Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {activeTab === 'olts' ? (
            station.olts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No OLT devices registered in this office.
              </div>
            ) : (
              station.olts.map(olt => (
                <div
                  key={olt.network_device_id}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                      OLT
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {olt.device_name}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono uppercase">
                          {olt.vendor}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-3 mt-0.5">
                        <span>IP: {olt.management_ip}</span>
                        {olt.total_pon_ports ? <span>• {olt.total_pon_ports} PON Ports</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                        olt.status === 'active'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${olt.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {olt.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )
          ) : station.routers.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No MikroTik routers registered in this office.
            </div>
          ) : (
            station.routers.map(r => (
              <div
                key={r.network_device_id}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                    ROUTER
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {r.device_name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono uppercase">
                        {r.vendor}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      IP: {r.management_ip}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                      r.status === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {r.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(station)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Location
            </button>
            {onAddDevice && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddDevice(station);
                }}
                className="px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Server className="w-3.5 h-3.5" />
                + Add Device
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onRunCable(station);
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <Cable className="w-4 h-4" />
            <span>Run Feeder Fiber Cable to Box</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
