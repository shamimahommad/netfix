import React, { useState, useEffect } from 'react';
import { 
  X, 
  Network, 
  MapPin, 
  Radio, 
  User, 
  Phone, 
  Package, 
  Trash2, 
  Edit3, 
  PlusCircle, 
  Unlink, 
  CheckCircle2, 
  AlertCircle,
  Wifi,
  ExternalLink
} from 'lucide-react';
import { FtthBox, FtthBoxPort, ftthService } from '@/services/ftth.service';
import { customersService } from '@/services/customers.service';
import { useToastContext } from '@/contexts/ToastContext';

interface BoxDetailModalProps {
  isOpen: boolean;
  boxId: number | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const BoxDetailModal: React.FC<BoxDetailModalProps> = ({
  isOpen,
  boxId,
  onClose,
  onUpdated,
}) => {
  const toast = useToastContext();
  const [box, setBox] = useState<FtthBox | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPort, setSelectedPort] = useState<FtthBoxPort | null>(null);

  // Assign customer state
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [onuMac, setOnuMac] = useState('');
  const [portNotes, setPortNotes] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  const fetchBox = async () => {
    if (!boxId) return;
    try {
      setIsLoading(true);
      const data = await ftthService.getBox(boxId);
      setBox(data);
      // Auto-select first occupied or available port
      if (data.ports && data.ports.length > 0) {
        if (!selectedPort) {
          setSelectedPort(data.ports[0]);
        } else {
          const reSelected = data.ports.find((p) => p.portNumber === selectedPort.portNumber);
          setSelectedPort(reSelected || data.ports[0]);
        }
      }
    } catch (err: any) {
      toast.error('Failed to load box details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && boxId) {
      fetchBox();
    } else {
      setBox(null);
      setSelectedPort(null);
      setIsAssigning(false);
    }
  }, [isOpen, boxId]);

  // Load customers for assignment search
  useEffect(() => {
    if (isAssigning) {
      customersService
        .getCustomers({ limit: 50, search: searchQuery })
        .then((res: any) => {
          setCustomersList(res.data || []);
        })
        .catch(() => {});
    }
  }, [isAssigning, searchQuery]);

  if (!isOpen) return null;

  const handleUnassign = async (portNum: number) => {
    if (!box) return;
    if (!window.confirm(`Are you sure you want to disconnect the subscriber from Port #${portNum}? This will free the port.`)) {
      return;
    }
    try {
      await ftthService.unassignPort(box.id, portNum);
      toast.success(`Port #${portNum} is now available`);
      fetchBox();
      onUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to unassign port');
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!box || !selectedPort || !selectedCustomerId) {
      toast.error('Please select a customer to connect');
      return;
    }
    setIsSubmittingAssign(true);
    try {
      await ftthService.assignPort(box.id, {
        portNumber: selectedPort.portNumber,
        customerId: selectedCustomerId,
        onuMac: onuMac.trim() || undefined,
        notes: portNotes.trim() || undefined,
      });
      toast.success(`Subscriber connected to Port #${selectedPort.portNumber}`);
      setIsAssigning(false);
      setSelectedCustomerId(null);
      setOnuMac('');
      setPortNotes('');
      fetchBox();
      onUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to assign customer to port');
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  const handleDeleteBox = async () => {
    if (!box) return;
    if (!window.confirm(`Are you sure you want to delete ${box.box_name}? All ports and routes will be removed.`)) {
      return;
    }
    try {
      await ftthService.deleteBox(box.id);
      toast.success('Box deleted successfully');
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Cannot delete box');
    }
  };

  const getRxPowerColor = (rx: number | null) => {
    if (rx === null) return 'text-slate-400';
    if (rx >= -24 && rx <= -15) return 'text-emerald-500 font-bold';
    if (rx >= -27 && rx < -24) return 'text-amber-500 font-bold';
    return 'text-rose-500 font-bold';
  };

  const getRxPowerQuality = (rx: number | null) => {
    if (rx === null) return 'No optical reading';
    if (rx >= -24 && rx <= -15) return 'Optimal Signal (Good)';
    if (rx >= -27 && rx < -24) return 'Moderate Loss (Fair)';
    return 'High Attenuation / Critical Signal';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/50">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {box?.box_name || 'FTTH Splitter Box Details'}
                </h2>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  {box?.box_code}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  box?.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : box?.status === 'full'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400'
                }`}>
                  {box?.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Splitter Ratio: <strong className="text-slate-700 dark:text-slate-200">{box?.splitter_ratio || '1:8'}</strong></span>
                {box?.pole_number && <span>• Pole: <strong className="text-slate-700 dark:text-slate-200">{box.pole_number}</strong></span>}
                {box?.optical_input_power && (
                  <span>• Input Power: <strong className="text-blue-600 dark:text-blue-400">{box.optical_input_power} dBm</strong></span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteBox}
              className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
              title="Delete Box"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Loading splitter ports...</p>
            </div>
          )}

          {!isLoading && box && (
            <>
              {/* Location & Infrastructure Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="truncate text-slate-700 dark:text-slate-300" title={box.address || 'No street address'}>
                    {box.address || 'Street location not specified'}
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <Radio className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="truncate text-slate-700 dark:text-slate-300">
                    GPS: {box.latitude.toFixed(5)}, {box.longitude.toFixed(5)}
                  </span>
                  <a
                    href={`https://maps.google.com/?q=${box.latitude},${box.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center"
                    title="Open in Google Maps"
                  >
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 text-slate-700 dark:text-slate-300">
                  <span>Capacity:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {box.ports?.filter((p) => p.status === 'occupied').length || 0} / {box.total_ports} Ports Used
                  </span>
                </div>
              </div>

              {/* Physical Splitter Box Visualizer */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-blue-600" />
                    Physical Splitter Box & Port Grid
                  </h3>
                  <div className="flex items-center gap-3 text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Free
                    </span>
                    <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Connected
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Damaged
                    </span>
                  </div>
                </div>

                {/* Ports Hardware Grid (Real realistic box look) */}
                <div className="p-4 bg-slate-900 rounded-2xl border-2 border-slate-700 shadow-inner">
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                    {box.ports?.map((port) => {
                      const isSelected = selectedPort?.portNumber === port.portNumber;
                      const isOccupied = port.status === 'occupied';

                      return (
                        <button
                          key={port.portNumber}
                          type="button"
                          onClick={() => {
                            setSelectedPort(port);
                            setIsAssigning(false);
                          }}
                          className={`group relative p-2.5 rounded-xl border flex flex-col items-center justify-between min-h-[85px] transition-all cursor-pointer ${
                            isSelected
                              ? 'ring-2 ring-blue-400 bg-slate-800 border-blue-400 shadow-md'
                              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {/* Port Number Header */}
                          <div className="w-full flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-400">#{port.portNumber}</span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOccupied
                                  ? 'bg-blue-500 shadow-sm shadow-blue-500'
                                  : port.status === 'damaged'
                                  ? 'bg-rose-500'
                                  : 'bg-emerald-500 shadow-sm shadow-emerald-500 animate-pulse'
                              }`}
                            />
                          </div>

                          {/* Optical Connector Icon Graphic */}
                          <div className="my-1">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                              isOccupied ? 'bg-blue-900/60 text-blue-300' : 'bg-slate-700 text-slate-400'
                            }`}>
                              SC
                            </div>
                          </div>

                          {/* Customer summary or Free badge */}
                          <div className="w-full text-center">
                            {isOccupied ? (
                              <p className="text-[10px] font-semibold text-blue-200 truncate w-full" title={port.customer?.name}>
                                {port.customer?.customerCode || 'Active'}
                              </p>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-medium">Available</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Selected Port Inspector Panel */}
              {selectedPort && (
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 transition-all">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/60">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-mono text-xs font-bold flex items-center justify-center">
                        #{selectedPort.portNumber}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Port #{selectedPort.portNumber} Inspection
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Cable Core Color: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedPort.cableColor || 'Standard Blue'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedPort.status === 'occupied' && (
                        <button
                          type="button"
                          onClick={() => handleUnassign(selectedPort.portNumber)}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          Disconnect Port
                        </button>
                      )}
                    </div>
                  </div>

                  {/* If Port is Occupied */}
                  {selectedPort.status === 'occupied' && selectedPort.customer && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Left: Subscriber info */}
                      <div className="space-y-2 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 uppercase font-semibold">Subscriber</span>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {selectedPort.customer.customerCode}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {selectedPort.customer.name}
                        </p>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{selectedPort.customer.phone || 'No phone'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span>Plan: <strong className="text-slate-800 dark:text-slate-200">{selectedPort.customer.package || 'Standard Package'}</strong></span>
                        </div>
                      </div>

                      {/* Right: Optical Telemetry */}
                      <div className="space-y-2 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 uppercase font-semibold">Optical Rx Signal</span>
                          <span className={getRxPowerColor(selectedPort.opticalRxPower)}>
                            {selectedPort.opticalRxPower !== null ? `${selectedPort.opticalRxPower} dBm` : '—'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {getRxPowerQuality(selectedPort.opticalRxPower)}
                        </p>
                        <div className="pt-1 text-[11px] text-slate-500">
                          ONU MAC: <span className="font-mono font-medium">{selectedPort.onuMac || 'Matched from account'}</span>
                        </div>
                        {selectedPort.notes && (
                          <div className="pt-1 text-[11px] text-slate-500">
                            Notes: <span className="italic">{selectedPort.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* If Port is Available */}
                  {selectedPort.status === 'available' && !isAssigning && (
                    <div className="mt-4 p-6 text-center space-y-3 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Port #{selectedPort.portNumber} is Free for Connection
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Connect a new or existing subscriber to this splitter port
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAssigning(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Connect Customer to Port #{selectedPort.portNumber}
                      </button>
                    </div>
                  )}

                  {/* Assign Form */}
                  {selectedPort.status === 'available' && isAssigning && (
                    <form onSubmit={handleAssignSubmit} className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900/60 space-y-4 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          Connect Customer to Port #{selectedPort.portNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsAssigning(false)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Customer Selector */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Select Subscriber:
                        </label>
                        <input
                          type="text"
                          placeholder="Search customer by name, code, or phone..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-blue-500"
                        />
                        <select
                          value={selectedCustomerId || ''}
                          onChange={(e) => setSelectedCustomerId(e.target.value ? parseInt(e.target.value, 10) : null)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-blue-500 mt-1"
                          required
                        >
                          <option value="">-- Choose Subscriber ({customersList.length} found) --</option>
                          {customersList.map((c: any) => (
                            <option key={c.customerId || c.customer_id} value={c.customerId || c.customer_id}>
                              {c.customerCode || c.customer_code} - {c.fullName || c.full_name} ({c.username || c.phone || 'No phone'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* ONU MAC & Notes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            ONU MAC Address (Optional):
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. FHTT:00:1A:2B"
                            value={onuMac}
                            onChange={(e) => setOnuMac(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-blue-500 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Drop Cable / Port Notes:
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Drop cable 45m from pole 12"
                            value={portNotes}
                            onChange={(e) => setPortNotes(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAssigning(false)}
                          className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingAssign || !selectedCustomerId}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          {isSubmittingAssign ? 'Connecting...' : 'Confirm Connection'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoxDetailModal;
