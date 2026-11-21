import React, { useState, useEffect } from 'react';
import { X, Cable, Building2, Box, ArrowRight, Check } from 'lucide-react';
import { ftthService, FtthBox, FtthNocStation, FtthAvailableDevice } from '@/services/ftth.service';
import { useToastContext } from '@/contexts/ToastContext';

interface AddCableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  boxes: FtthBox[];
  nocStations: FtthNocStation[];
  preselectedNoc?: FtthNocStation | null;
  preselectedBoxId?: number | null;
}

const FIBER_COLORS = [
  { name: 'Blue (Core 1)', hex: '#2563eb' },
  { name: 'Orange (Core 2)', hex: '#f97316' },
  { name: 'Green (Core 3)', hex: '#10b981' },
  { name: 'Brown (Core 4)', hex: '#92400e' },
  { name: 'Slate (Core 5)', hex: '#64748b' },
  { name: 'Red (Core 6)', hex: '#ef4444' },
  { name: 'Black (Core 7)', hex: '#1e293b' },
  { name: 'Yellow (Core 8)', hex: '#eab308' },
  { name: 'Violet (Core 9)', hex: '#8b5cf6' },
  { name: 'Rose (Core 10)', hex: '#f43f5e' },
  { name: 'Aqua/Cyan (Core 11)', hex: '#06b6d4' },
];

export default function AddCableModal({
  isOpen,
  onClose,
  onSuccess,
  boxes,
  nocStations,
  preselectedNoc,
  preselectedBoxId,
}: AddCableModalProps) {
  const toast = useToastContext();

  const [fromType, setFromType] = useState<'olt' | 'noc' | 'box'>('olt');
  const [selectedNocId, setSelectedNocId] = useState<number>(0);
  const [selectedOltId, setSelectedOltId] = useState<number>(0);
  const [selectedFromBoxId, setSelectedFromBoxId] = useState<number>(0);
  const [selectedToBoxId, setSelectedToBoxId] = useState<number>(0);

  const [cableName, setCableName] = useState('');
  const [coreCount, setCoreCount] = useState<number>(12);
  const [color, setColor] = useState('#2563eb');
  const [lengthMeters, setLengthMeters] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (preselectedNoc) {
        setFromType('olt');
        setSelectedNocId(preselectedNoc.id);
        if (preselectedNoc.olts.length > 0) {
          setSelectedOltId(preselectedNoc.olts[0].network_device_id);
        }
      } else if (nocStations.length > 0) {
        setSelectedNocId(nocStations[0].id);
        if (nocStations[0].olts.length > 0) {
          setSelectedOltId(nocStations[0].olts[0].network_device_id);
        }
      }

      if (preselectedBoxId) {
        setSelectedToBoxId(preselectedBoxId);
      } else if (boxes.length > 0) {
        setSelectedToBoxId(boxes[0].id);
      }

      setCableName('');
      setCoreCount(12);
      setColor('#2563eb');
      setLengthMeters('');
    }
  }, [isOpen, preselectedNoc, preselectedBoxId, nocStations, boxes]);

  // Auto-generate sensible cable name
  useEffect(() => {
    if (fromType === 'olt') {
      const activeNoc = nocStations.find(n => n.id === selectedNocId);
      const activeOlt = activeNoc?.olts.find(o => o.network_device_id === selectedOltId);
      const targetBox = boxes.find(b => b.id === selectedToBoxId);
      if (targetBox) {
        setCableName(`Feeder Fiber - ${activeOlt?.device_name || 'Office'} to ${targetBox.box_code}`);
      }
    } else if (fromType === 'box') {
      const fromBox = boxes.find(b => b.id === selectedFromBoxId);
      const targetBox = boxes.find(b => b.id === selectedToBoxId);
      if (fromBox && targetBox) {
        setCableName(`Branch Fiber - ${fromBox.box_code} to ${targetBox.box_code}`);
      }
    }
  }, [fromType, selectedNocId, selectedOltId, selectedFromBoxId, selectedToBoxId, nocStations, boxes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedToBoxId) {
      toast.error('Destination Box is required');
      return;
    }

    if (fromType === 'box' && selectedFromBoxId === selectedToBoxId) {
      toast.error('Source box and destination box cannot be the same');
      return;
    }

    const fromId = fromType === 'olt' ? selectedOltId : fromType === 'noc' ? selectedNocId : selectedFromBoxId;

    setIsLoading(true);
    try {
      await ftthService.saveCable({
        cableName: cableName.trim() || 'Fiber Route',
        coreCount,
        fromType,
        fromId: fromId || null,
        toBoxId: selectedToBoxId,
        color,
        lengthMeters: lengthMeters ? parseInt(lengthMeters, 10) : null,
        status: 'active',
      });

      toast.success('Fiber cable route deployed successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to deploy fiber cable');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentNoc = nocStations.find(n => n.id === selectedNocId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Cable className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Run Fiber Optical Cable
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect Office / OLT feeder lines to field boxes or cascade between boxes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Source Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Fiber Origin Source (From)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFromType('olt')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  fromType === 'olt'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Office / OLT (Feeder)
              </button>
              <button
                type="button"
                onClick={() => setFromType('box')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  fromType === 'box'
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-2xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Box className="w-4 h-4" />
                Cascade from Box
              </button>
            </div>
          </div>

          {/* Specific Source Selection */}
          {fromType === 'olt' ? (
            <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Office / Server Room (NOC)
                  </label>
                  <select
                    value={selectedNocId}
                    onChange={e => setSelectedNocId(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {nocStations.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Source OLT Device
                  </label>
                  <select
                    value={selectedOltId}
                    onChange={e => setSelectedOltId(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {currentNoc?.olts && currentNoc.olts.length > 0 ? (
                      currentNoc.olts.map(o => (
                        <option key={o.network_device_id} value={o.network_device_id}>
                          {o.device_name} ({o.vendor.toUpperCase()})
                        </option>
                      ))
                    ) : (
                      <option value="0">Default Main OLT Rack</option>
                    )}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Source Splitter / Distribution Box
              </label>
              <select
                value={selectedFromBoxId}
                onChange={e => setSelectedFromBoxId(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="0">Select Upstream Box...</option>
                {boxes.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.box_code} - {b.box_name} ({b.splitter_ratio})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Destination Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
              Target FTTH Box (To) *
            </label>
            <select
              required
              value={selectedToBoxId}
              onChange={e => setSelectedToBoxId(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="0">Select Destination Box...</option>
              {boxes.map(b => (
                <option key={b.id} value={b.id}>
                  {b.box_code} - {b.box_name} [{b.address || 'Pole #' + (b.pole_number || b.id)}]
                </option>
              ))}
            </select>
          </div>

          {/* Core Count & Cable Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cable Identifier / Route Name
              </label>
              <input
                type="text"
                required
                value={cableName}
                onChange={e => setCableName(e.target.value)}
                placeholder="e.g. Feeder Fiber - OLT to Box 101"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Core Capacity
              </label>
              <select
                value={coreCount}
                onChange={e => setCoreCount(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
              >
                <option value={24}>24-Core Feeder</option>
                <option value={12}>12-Core Standard</option>
                <option value={8}>8-Core Branch</option>
                <option value={6}>6-Core Branch</option>
                <option value={4}>4-Core Distribution</option>
                <option value={2}>2-Core Drop</option>
                <option value={1}>1-Core Drop</option>
              </select>
            </div>
          </div>

          {/* Color Palette Picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Fiber Map Polyline Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {FIBER_COLORS.map(c => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${
                    color === c.hex ? 'border-slate-900 dark:border-white scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {color === c.hex && <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Cable className="w-4 h-4" />
              {isLoading ? 'Connecting...' : 'Connect Fiber Cable'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
