import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { customersService } from '@/services/customers.service';

export type MapCustomerStatus = 'online' | 'offline' | 'expired' | 'suspended';

const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125]; // Dhaka, Bangladesh
const DEFAULT_ZOOM = 11;

const STATUS_COLORS: Record<MapCustomerStatus, string> = {
  online: '#10b981',   // emerald
  offline: '#64748b',  // slate
  expired: '#ef4444',  // red
  suspended: '#f97316', // orange
};

/** Create a pin-style marker icon colored by status (sky/teal style for online, gray/red/orange for others) */
function createStatusIcon(status: MapCustomerStatus): L.DivIcon {
  const color = STATUS_COLORS[status];
  const html = `
    <div style="
      position: relative;
      width: 28px;
      height: 36px;
      margin-left: -14px;
      margin-top: -36px;
    ">
      <div style="
        width: 24px;
        height: 24px;
        margin: 0 auto 2px;
        background: ${color};
        border: 2px solid #fff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      "></div>
      <div style="
        position: absolute;
        left: 50%;
        bottom: 0;
        width: 4px;
        height: 8px;
        margin-left: -2px;
        background: ${color};
        border-radius: 0 0 2px 2px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      "></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'map-status-marker',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
}

function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function formatExpDate(expDate: string | null): string {
  if (!expDate) return '—';
  try {
    const d = new Date(expDate);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return expDate;
  }
}

/** ID always 6 digits (e.g. 101010) */
function formatCustomerId(customerId: string): string {
  const num = String(customerId).replace(/\D/g, '') || '0';
  return num.slice(-6).padStart(6, '0');
}

export default function MapPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<
    {
      customerId: string;
      fullName: string;
      phone: string | null;
      username: string | null;
      expDate: string | null;
      status: MapCustomerStatus;
      latitude: number;
      longitude: number;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    customersService
      .getCustomersForMap()
      .then((data) => {
        if (!cancelled) setCustomers(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load map data.');
          setCustomers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-[400px] bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Customer Map
              </h1>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {loading ? 'Loading…' : `${customers.length} location${customers.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-white shadow" style={{ background: STATUS_COLORS.online }} />
                Online
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-white shadow" style={{ background: STATUS_COLORS.offline }} />
                Offline
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-white shadow" style={{ background: STATUS_COLORS.expired }} />
                Expired
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-white shadow" style={{ background: STATUS_COLORS.suspended }} />
                Suspended
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-teal-300 text-sm font-medium hover:bg-sky-100 dark:hover:bg-sky-800/50 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200/50 dark:bg-slate-800/50 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading map…</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
            scrollWheelZoom={true}
          >
            <MapResizeHandler />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {customers.map((c) => (
              <Marker
                key={c.customerId}
                position={[c.latitude, c.longitude]}
                icon={createStatusIcon(c.status)}
              >
                <Popup>
                  <div className="w-[240px] text-left rounded-xl overflow-hidden border border-sky-200/80 dark:border-sky-600/50 shadow-lg bg-gradient-to-br from-white to-sky-50/50 dark:from-slate-800 dark:to-sky-950/30">
                    <div className="p-3">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                        <dt className="text-sky-600 dark:text-teal-400 font-semibold text-left">ID:</dt>
                        <dd className="font-mono font-bold text-slate-900 dark:text-slate-100 min-w-0">{formatCustomerId(c.customerId)}</dd>
                        <dt className="text-sky-600 dark:text-teal-400 font-semibold text-left">Name:</dt>
                        <dd className="text-slate-800 dark:text-slate-200 min-w-0 truncate" title={c.fullName}>{c.fullName}</dd>
                        <dt className="text-sky-600 dark:text-teal-400 font-semibold text-left">Phone:</dt>
                        <dd className="text-slate-800 dark:text-slate-200 min-w-0 break-all">{c.phone ?? '—'}</dd>
                        <dt className="text-sky-600 dark:text-teal-400 font-semibold text-left">Username:</dt>
                        <dd className="font-mono text-slate-800 dark:text-slate-200 min-w-0 truncate" title={c.username ?? ''}>{c.username ?? '—'}</dd>
                        <dt className="text-sky-600 dark:text-teal-400 font-semibold text-left">Exp.Date:</dt>
                        <dd className="text-slate-800 dark:text-slate-200 min-w-0">{formatExpDate(c.expDate)}</dd>
                      </dl>
                    </div>
                    <div className="px-3 pb-3 pt-2 flex items-center gap-3 border-t border-sky-100 dark:border-sky-800/50">
                      <span
                        className={`shrink-0 px-2 py-1 rounded-md text-xs font-semibold ${
                          c.status === 'online'
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : c.status === 'offline'
                              ? 'bg-slate-400/20 text-slate-700 dark:text-slate-300'
                              : c.status === 'expired'
                                ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                                : 'bg-orange-500/20 text-orange-700 dark:text-orange-300'
                        }`}
                      >
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/customers/view/${c.customerId}`)}
                        className="shrink-0 py-1.5 px-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold shadow-sm"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
