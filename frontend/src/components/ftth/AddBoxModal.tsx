import React, { useState } from 'react';
import { X, Network, MapPin, Sliders, CheckCircle2 } from 'lucide-react';
import { ftthService, FtthBox } from '@/services/ftth.service';
import { useToastContext } from '@/contexts/ToastContext';

interface AddBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBox: FtthBox) => void;
  defaultCoords?: [number, number];
}

export const AddBoxModal: React.FC<AddBoxModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultCoords = [23.7500, 90.3750],
}) => {
  const toast = useToastContext();
  const [formData, setFormData] = useState({
    box_name: '',
    box_code: '',
    box_type: 'splitter_box' as 'splitter_box' | 'tj_box' | 'odf' | 'pole_box',
    total_ports: 8,
    splitter_ratio: '1:8',
    pole_number: '',
    address: '',
    latitude: defaultCoords[0],
    longitude: defaultCoords[1],
    optical_input_power: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleRatioChange = (ratio: string) => {
    const ports = ratio === '1:4' ? 4 : ratio === '1:8' ? 8 : ratio === '1:16' ? 16 : ratio === '1:32' ? 32 : 8;
    setFormData({
      ...formData,
      splitter_ratio: ratio,
      total_ports: ports,
    });
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData({
            ...formData,
            latitude: parseFloat(pos.coords.latitude.toFixed(6)),
            longitude: parseFloat(pos.coords.longitude.toFixed(6)),
          });
          toast.success('Acquired device GPS coordinates');
        },
        () => {
          toast.error('Unable to fetch device location. Please enter manually.');
        }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.box_name.trim()) {
      toast.error('Box name is required');
      return;
    }
    if (!formData.latitude || !formData.longitude) {
      toast.error('Valid GPS coordinates are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await ftthService.createBox({
        box_name: formData.box_name.trim(),
        box_code: formData.box_code.trim() || undefined,
        box_type: formData.box_type,
        total_ports: formData.total_ports,
        splitter_ratio: formData.splitter_ratio,
        pole_number: formData.pole_number.trim() || null,
        address: formData.address.trim() || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
        optical_input_power: formData.optical_input_power !== '' ? parseFloat(formData.optical_input_power) : null,
        notes: formData.notes.trim() || null,
      });
      toast.success(`FTTH Box "${created.box_name}" added with ${created.total_ports} ports!`);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to create box');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Add FTTH Splitter / Distribution Box
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deploy a new FDB or TJ joint box with automatic port allocation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs sm:text-sm">
          {/* Box Name & Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Box Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. FDB-Dhanmondi-R4-P12"
                value={formData.box_name}
                onChange={(e) => setFormData({ ...formData, box_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Box Code (Auto-generated if empty)
              </label>
              <input
                type="text"
                placeholder="e.g. BOX-105"
                value={formData.box_code}
                onChange={(e) => setFormData({ ...formData, box_code: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Type & Splitter Ratio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Box Type
              </label>
              <select
                value={formData.box_type}
                onChange={(e) => setFormData({ ...formData, box_type: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white"
              >
                <option value="splitter_box">Splitter Box (FDB / NAP)</option>
                <option value="tj_box">Joint Enclosure (TJ Box)</option>
                <option value="odf">Optical Distribution Frame (ODF)</option>
                <option value="pole_box">Pole Distribution Box</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Splitter Ratio & Port Capacity
              </label>
              <select
                value={formData.splitter_ratio}
                onChange={(e) => handleRatioChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white"
              >
                <option value="1:4">1:4 PLC Splitter (4 Ports)</option>
                <option value="1:8">1:8 PLC Splitter (8 Ports - Standard)</option>
                <option value="1:16">1:16 PLC Splitter (16 Ports)</option>
                <option value="1:32">1:32 PLC Splitter (32 Ports)</option>
              </select>
            </div>
          </div>

          {/* Pole Number & Input Power */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Pole / Location ID
              </label>
              <input
                type="text"
                placeholder="e.g. DP-12 or Pole #45"
                value={formData.pole_number}
                onChange={(e) => setFormData({ ...formData, pole_number: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Optical Input Power (dBm)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. -14.5"
                value={formData.optical_input_power}
                onChange={(e) => setFormData({ ...formData, optical_input_power: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Street Address */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Street / Building Address
            </label>
            <input
              type="text"
              placeholder="e.g. Road #4, House #12, Dhanmondi, Dhaka"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* GPS Coordinates */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                Map GPS Coordinates
              </span>
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Use Device GPS
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500">Latitude:</label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Longitude:</label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Notes / Remarks
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Mounted on North-East electric post, easy ladder access..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-900 dark:text-white"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Deploy Box
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddBoxModal;
