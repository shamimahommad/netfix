import React, { useState } from 'react';
import { X, Server, Router, Building2, CheckCircle2, Cpu, Globe } from 'lucide-react';
import { ftthService, FtthNocStation } from '@/services/ftth.service';
import { useToastContext } from '@/contexts/ToastContext';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  nocStations: FtthNocStation[];
  defaultNocId?: number | null;
}

const OLT_VENDORS = [
  { label: 'VSOL', value: 'vsol' },
  { label: 'BDCOM', value: 'bdcom' },
  { label: 'Focuscom', value: 'focuscom' },
  { label: 'Huawei', value: 'huawei' },
  { label: 'ZTE', value: 'zte' },
  { label: 'BTPON', value: 'btpon' },
  { label: 'C-Data', value: 'cdata' },
  { label: 'ATOP', value: 'atop' },
  { label: 'Generic OLT', value: 'generic' },
];

const ROUTER_VENDORS = [
  { label: 'MikroTik RouterOS', value: 'mikrotik' },
  { label: 'Cisco IOS', value: 'cisco' },
  { label: 'Huawei Core', value: 'huawei' },
  { label: 'Generic Router', value: 'generic' },
];

export default function AddDeviceModal({
  isOpen,
  onClose,
  onSuccess,
  nocStations,
  defaultNocId,
}: AddDeviceModalProps) {
  const toast = useToastContext();

  const [deviceType, setDeviceType] = useState<'olt' | 'router'>('olt');
  const [deviceName, setDeviceName] = useState('');
  const [vendor, setVendor] = useState('vsol');
  const [managementIp, setManagementIp] = useState('192.168.1.10');
  const [nocStationId, setNocStationId] = useState<number>(defaultNocId || (nocStations[0]?.id ?? 0));
  const [ponType, setPonType] = useState<'epon' | 'gpon'>('epon');
  const [totalPonPorts, setTotalPonPorts] = useState<number>(8);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync default NOC when modal opens
  React.useEffect(() => {
    if (isOpen && nocStations.length > 0) {
      setNocStationId(defaultNocId || nocStations[0].id);
    }
  }, [isOpen, defaultNocId, nocStations]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      toast.error('Device name is required');
      return;
    }
    if (!managementIp.trim()) {
      toast.error('Management IP address is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await ftthService.createDevice({
        device_name: deviceName.trim(),
        device_type: deviceType,
        vendor,
        management_ip: managementIp.trim(),
        noc_station_id: nocStationId > 0 ? nocStationId : null,
        pon_type: deviceType === 'olt' ? ponType : undefined,
        total_pon_ports: deviceType === 'olt' ? totalPonPorts : undefined,
      });

      toast.success(`${deviceType.toUpperCase()} "${deviceName}" added successfully!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to add network device');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Add Network Device (OLT / Router)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Register an OLT or MikroTik router and assign it to an Office / POP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
          {/* Device Type Selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 text-xs">
              Device Category *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeviceType('olt');
                  setVendor('vsol');
                }}
                className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  deviceType === 'olt'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Server className="w-4 h-4 text-blue-600" />
                Optical Line Terminal (OLT)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeviceType('router');
                  setVendor('mikrotik');
                }}
                className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  deviceType === 'router'
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Router className="w-4 h-4 text-emerald-600" />
                MikroTik Core Router
              </button>
            </div>
          </div>

          {/* Device Name */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
              Device Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={deviceType === 'olt' ? 'e.g. Focuscom EP5800-04 (Main)' : 'e.g. MikroTik CCR2004 Core 1'}
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Vendor & Management IP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                Device Vendor / Brand
              </label>
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 text-slate-900 dark:text-white font-medium"
              >
                {(deviceType === 'olt' ? OLT_VENDORS : ROUTER_VENDORS).map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                Management IP Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="192.168.1.10"
                value={managementIp}
                onChange={(e) => setManagementIp(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Office / NOC Location Assignment */}
          <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-2">
            <label className="font-bold text-indigo-900 dark:text-indigo-200 text-xs flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Office / POP Location (Physical Station) *
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Select which Office or Sub POP station houses this device
            </p>
            <select
              value={nocStationId}
              onChange={(e) => setNocStationId(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 text-slate-900 dark:text-white font-semibold"
            >
              {nocStations.length === 0 ? (
                <option value={0}>Main Office & NOC (Auto-created)</option>
              ) : (
                nocStations.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.station_type === 'main_office' ? '(Main Office)' : `(${st.station_type})`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* OLT Specific: PON Type & Port Count */}
          {deviceType === 'olt' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/40 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                  PON Technology
                </label>
                <select
                  value={ponType}
                  onChange={(e) => setPonType(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white font-semibold text-xs"
                >
                  <option value="epon">EPON (1.25 Gbps)</option>
                  <option value="gpon">GPON (2.5 Gbps / 1.25 Gbps)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                  Total PON Ports
                </label>
                <select
                  value={totalPonPorts}
                  onChange={(e) => setTotalPonPorts(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white font-bold text-xs"
                >
                  <option value={4}>4 PON Ports</option>
                  <option value={8}>8 PON Ports (Standard)</option>
                  <option value={16}>16 PON Ports (High Density)</option>
                </select>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Add Network Device
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
