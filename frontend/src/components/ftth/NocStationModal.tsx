import React, { useState, useEffect } from 'react';
import { X, Building2, Server, MapPin, Phone, Radio, Check, AlertCircle } from 'lucide-react';
import { ftthService, FtthNocStation, FtthAvailableDevice } from '@/services/ftth.service';
import { useToastContext } from '@/contexts/ToastContext';

interface NocStationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stationToEdit?: FtthNocStation | null;
}

export default function NocStationModal({ isOpen, onClose, onSuccess, stationToEdit }: NocStationModalProps) {
  const toast = useToastContext();

  const [name, setName] = useState('');
  const [stationType, setStationType] = useState<'main_office' | 'sub_pop' | 'server_room'>('main_office');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [availableDevices, setAvailableDevices] = useState<FtthAvailableDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDevices, setIsFetchingDevices] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
      if (stationToEdit) {
        setName(stationToEdit.name);
        setStationType(stationToEdit.station_type);
        setLatitude(stationToEdit.latitude.toString());
        setLongitude(stationToEdit.longitude.toString());
        setAddress(stationToEdit.address || '');
        setContactPhone(stationToEdit.contact_phone || '');
        setNotes(stationToEdit.notes || '');
        setSelectedDeviceIds(stationToEdit.devices.map(d => d.network_device_id));
      } else {
        setName('');
        setStationType('sub_pop');
        setLatitude('');
        setLongitude('');
        setAddress('');
        setContactPhone('');
        setNotes('');
        setSelectedDeviceIds([]);
      }
    }
  }, [isOpen, stationToEdit]);

  const loadDevices = async () => {
    setIsFetchingDevices(true);
    try {
      const devs = await ftthService.getDevices();
      setAvailableDevices(devs);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setIsFetchingDevices(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        toast.success('Office coordinates captured from your current location');
      },
      () => toast.error('Unable to retrieve location. Please enter manually.')
    );
  };

  const toggleDevice = (devId: number) => {
    setSelectedDeviceIds(prev =>
      prev.includes(devId) ? prev.filter(id => id !== devId) : [...prev, devId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Office / NOC name is required');
      return;
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      toast.error('Please enter valid Latitude and Longitude');
      return;
    }

    setIsLoading(true);
    try {
      await ftthService.saveNocStation({
        id: stationToEdit?.id,
        name: name.trim(),
        station_type: stationType,
        latitude: lat,
        longitude: lng,
        address: address.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        device_ids: selectedDeviceIds,
      });

      toast.success(stationToEdit ? 'Office / NOC Station updated' : 'Office / NOC Station deployed');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save Office / NOC');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl my-8 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {stationToEdit ? 'Edit Office / POP Station' : 'Add Office / Sub POP Location'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Setup your 1st Main Office, 2nd Branch Office, or Regional POP Station
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
          {/* Station Name & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Office / Station Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. 2nd Office - Sariyakandi Mor"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Facility Category
              </label>
              <select
                value={stationType}
                onChange={e => setStationType(e.target.value as any)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
              >
                <option value="main_office">1st Main Office & NOC</option>
                <option value="sub_pop">2nd Office / Sub POP</option>
                <option value="server_room">3rd Regional Server Room</option>
              </select>
            </div>
          </div>

          {/* GPS Coordinates */}
          <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Office Map Coordinates (GPS) *
              </span>
              <button
                type="button"
                onClick={handleGetLocation}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Auto-Detect Current GPS
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 block">Latitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latitude}
                  onChange={e => setLatitude(e.target.value)}
                  placeholder="e.g. 23.8103"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400 mb-1 block">Longitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={longitude}
                  onChange={e => setLongitude(e.target.value)}
                  placeholder="e.g. 90.4125"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 italic">
              Tip: You can also copy coordinates directly from Google Maps (Right click location → copy lat/long).
            </p>
          </div>

          {/* Physical Address & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Physical Address
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. Holding 12, Main Road, Sariyakandi"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                NOC Emergency Contact Phone
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="e.g. 01700000000"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Devices Installed Inside this Office / NOC */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-indigo-500" />
                  Devices Installed at this Office / Server Room
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Select which MikroTik Core Routers and OLTs are physically located in this office
                </p>
              </div>
              <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {selectedDeviceIds.length} Selected
              </span>
            </div>

            {isFetchingDevices ? (
              <div className="py-4 text-center text-xs text-slate-400">Loading devices...</div>
            ) : availableDevices.length === 0 ? (
              <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>No MikroTik or OLT devices found. You can add devices from Network &gt; MikroTik or OLT menu.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                {availableDevices.map(dev => {
                  const isChecked = selectedDeviceIds.includes(dev.network_device_id);
                  const isOlt = dev.device_type === 'olt';
                  return (
                    <div
                      key={dev.network_device_id}
                      onClick={() => toggleDevice(dev.network_device_id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                        isChecked
                          ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
                          isChecked
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                              isOlt
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                            }`}
                          >
                            {isOlt ? 'OLT' : 'ROUTER'}
                          </span>
                          <span className="text-xs font-bold truncate">{dev.device_name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {dev.vendor.toUpperCase()} • {dev.management_ip}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Buttons */}
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
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              {isLoading ? 'Saving...' : stationToEdit ? 'Save Changes' : 'Deploy Office / NOC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
