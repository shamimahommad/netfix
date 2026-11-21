import React, { useState } from 'react';
import { X, Search, MapPin, CheckCircle2, AlertCircle, Compass, ArrowRight, Cable } from 'lucide-react';
import { ftthService, NearestBoxResult } from '@/services/ftth.service';
import { useToastContext } from '@/contexts/ToastContext';

interface FeasibilityCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBox: (boxId: number) => void;
  initialCoords?: [number, number];
}

export const FeasibilityCheckModal: React.FC<FeasibilityCheckModalProps> = ({
  isOpen,
  onClose,
  onSelectBox,
  initialCoords = [23.7500, 90.3750],
}) => {
  const toast = useToastContext();
  const [lat, setLat] = useState(initialCoords[0]);
  const [lng, setLng] = useState(initialCoords[1]);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<NearestBoxResult[]>([]);
  const [searched, setSearched] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!lat || !lng) {
      toast.error('Please specify valid latitude and longitude');
      return;
    }
    setIsSearching(true);
    setSearched(true);
    try {
      const data = await ftthService.findNearest(lat, lng, 10);
      setResults(data);
    } catch (err: any) {
      toast.error('Failed to compute nearest splitter boxes');
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(parseFloat(pos.coords.latitude.toFixed(6)));
          setLng(parseFloat(pos.coords.longitude.toFixed(6)));
          toast.success('Acquired device coordinates');
        },
        () => {
          toast.error('Could not obtain device location');
        }
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                New Customer Feasibility & Nearest Box Checker
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Instantly find the closest distribution boxes with available ports & cable estimates
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Coordinates input */}
          <form onSubmit={handleSearch} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                Customer House GPS Coordinates
              </label>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Use Device GPS
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-500">Latitude:</span>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Longitude:</span>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Calculating Distance...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Check Feasibility & Find Nearest Boxes
                </>
              )}
            </button>
          </form>

          {/* Results List */}
          {searched && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Nearby Distribution Boxes ({results.length} found within 10 km)
                </h3>
              </div>

              {results.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs">
                  No distribution boxes found within 10 km of these coordinates.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {results.map((r, idx) => (
                    <div
                      key={r.boxId}
                      className={`p-4 rounded-2xl border transition-all ${
                        idx === 0 && r.isFeasible
                          ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {r.boxName}
                            </span>
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {r.boxCode}
                            </span>
                            {idx === 0 && r.isFeasible && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                                Best Match (Closest)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{r.address || 'Location on map'}</span>
                            {r.poleNumber && <span>• Pole: <strong>{r.poleNumber}</strong></span>}
                          </p>
                        </div>

                        {/* Distance Badge & Action */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                              {r.distanceDisplay}
                            </div>
                            <span className={`text-[11px] font-semibold ${r.availablePorts > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {r.availablePorts > 0 ? `${r.availablePorts} Free Ports` : 'Box Full (0 Free)'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              onSelectBox(r.boxId);
                              onClose();
                            }}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Open Box Ports"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Cable Recommendation Bar */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Cable className="w-3.5 h-3.5 text-slate-400" />
                          Recommended Cable: <strong className="text-slate-700 dark:text-slate-300">{r.recommendedCable}</strong>
                        </span>
                        <span>Estimated Drop Wire: ~{r.distanceMeters + 15}m (with sag & wall loop)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeasibilityCheckModal;
