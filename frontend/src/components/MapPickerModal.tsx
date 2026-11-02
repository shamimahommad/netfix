import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (lat: number, lng: number) => void;
  initialLat?: number | null;
  initialLng?: number | null;
}

/** Force map to recalc size after modal opens (fixes blank map in modals). */
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function LocationMarker({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  const [position, setPosition] = useState<L.LatLng | null>(null);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition(e.latlng);
      onLocationSelect(lat, lng);
    },
  });

  return position === null ? null : <Marker position={position} />;
}

export default function MapPickerModal({ isOpen, onClose, onSelect, initialLat, initialLng }: MapPickerModalProps) {
  const [selectedLat, setSelectedLat] = useState<number | null>(initialLat || null);
  const [selectedLng, setSelectedLng] = useState<number | null>(initialLng || null);
  // Default: Dhaka, Bangladesh
  const [mapCenter, setMapCenter] = useState<[number, number]>([23.8103, 90.4125]);

  useEffect(() => {
    if (initialLat && initialLng) {
      setSelectedLat(initialLat);
      setSelectedLng(initialLng);
      setMapCenter([initialLat, initialLng]);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
        },
        () => {
          // Use default if geolocation fails
        }
      );
    }
  }, [initialLat, initialLng]);

  const handleLocationSelect = (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
  };

  const handleSave = () => {
    if (selectedLat !== null && selectedLng !== null) {
      onSelect(selectedLat, selectedLng);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                Pick Location on Map
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                Click on the map to set the customer location
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Map - explicit height required for Leaflet to render */}
        <div className="relative w-full" style={{ height: '400px' }}>
          <MapContainer
            key={`map-${isOpen}`}
            center={mapCenter}
            zoom={13}
            style={{ height: '100%', width: '100%', minHeight: 400 }}
            className="rounded-b-2xl"
            scrollWheelZoom={true}
          >
            <MapResizeHandler />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {selectedLat !== null && selectedLng !== null && (
              <Marker position={[selectedLat, selectedLng]} />
            )}
            <LocationMarker onLocationSelect={handleLocationSelect} />
          </MapContainer>
        </div>

        {/* Selected Coordinates */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Latitude
              </label>
              <input
                type="text"
                readOnly
                value={selectedLat !== null ? selectedLat.toFixed(8) : ''}
                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Longitude
              </label>
              <input
                type="text"
                readOnly
                value={selectedLng !== null ? selectedLng.toFixed(8) : ''}
                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all font-semibold shadow-sm hover:shadow-md"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={selectedLat === null || selectedLng === null}
              className="px-6 py-3 text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl active:scale-95"
            >
              Save Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
