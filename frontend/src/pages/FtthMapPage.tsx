import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Network, 
  Plus, 
  Compass, 
  RefreshCw, 
  Layers, 
  Building2, 
  Server, 
  Cable, 
  Wifi, 
  Router,
  MapPin,
  ChevronRight
} from 'lucide-react';
import { ftthService, FtthBox, FtthCable, FtthStats, FtthNocStation } from '@/services/ftth.service';
import { customersService } from '@/services/customers.service';
import BoxDetailModal from '@/components/ftth/BoxDetailModal';
import AddBoxModal from '@/components/ftth/AddBoxModal';
import FeasibilityCheckModal from '@/components/ftth/FeasibilityCheckModal';
import NocStationModal from '@/components/ftth/NocStationModal';
import NocDetailModal from '@/components/ftth/NocDetailModal';
import AddCableModal from '@/components/ftth/AddCableModal';
import AddDeviceModal from '@/components/ftth/AddDeviceModal';
import { useToastContext } from '@/contexts/ToastContext';

const DEFAULT_CENTER: [number, number] = [24.8967, 89.6521];
const DEFAULT_ZOOM = 14;

/** Create custom SVG Marker for Office / NOC Station */
function createNocMarkerIcon(station: FtthNocStation): L.DivIcon {
  const isMain = station.station_type === 'main_office';
  const bgColor = isMain ? '#4338ca' : '#0369a1';
  const badgeText = `${station.olt_count} OLT • ${station.router_count} R`;

  const html = `
    <div style="position: relative; width: 54px; height: 60px; margin-left: -27px; margin-top: -60px; text-align: center;">
      <!-- Glowing Pulse Effect for Core Office -->
      <div style="
        position: absolute;
        top: 2px;
        left: 50%;
        transform: translateX(-50%);
        width: 44px;
        height: 44px;
        background: rgba(99, 102, 241, 0.3);
        border-radius: 14px;
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      "></div>

      <!-- Icon Container -->
      <div style="
        position: relative;
        width: 44px; 
        height: 44px; 
        margin: 0 auto; 
        background: ${bgColor}; 
        border: 2.5px solid #ffffff; 
        border-radius: 14px; 
        box-shadow: 0 6px 16px rgba(0,0,0,0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
      ">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path>
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path>
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path>
          <path d="M10 6h4"></path>
          <path d="M10 10h4"></path>
          <path d="M10 14h4"></path>
          <path d="M10 18h4"></path>
        </svg>
      </div>

      <!-- Device Count Badge -->
      <div style="
        position: absolute;
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        background: #0f172a;
        color: #e0e7ff;
        font-size: 8.5px;
        font-weight: 800;
        font-family: monospace;
        padding: 1.5px 6px;
        border-radius: 999px;
        border: 1px solid rgba(165, 180, 252, 0.6);
        box-shadow: 0 2px 5px rgba(0,0,0,0.4);
      ">
        ${badgeText}
      </div>

      <!-- Pointer -->
      <div style="
        width: 0;
        height: 0;
        border-left: 7px solid transparent;
        border-right: 7px solid transparent;
        border-top: 9px solid ${bgColor};
        margin: -1px auto 0;
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'ftth-noc-marker',
    iconSize: [54, 60],
    iconAnchor: [27, 60],
  });
}

/** Create custom SVG Marker for FTTH Boxes */
function createBoxMarkerIcon(box: FtthBox): L.DivIcon {
  const isFull = box.status === 'full' || (box.available_ports === 0 && (box.total_ports ?? 0) > 0);
  const isTJ = box.box_type === 'tj_box';
  
  const bgColor = isTJ ? '#7c3aed' : (isFull ? '#e11d48' : '#2563eb');
  const badgeColor = isFull ? '#fda4af' : '#86efac';
  const badgeText = `${box.occupied_ports || 0}/${box.total_ports}`;

  const html = `
    <div style="position: relative; width: 44px; height: 50px; margin-left: -22px; margin-top: -50px; text-align: center;">
      <!-- Pin Header -->
      <div style="
        width: 36px; 
        height: 36px; 
        margin: 0 auto; 
        background: ${bgColor}; 
        border: 2.5px solid #ffffff; 
        border-radius: ${isTJ ? '8px' : '12px'}; 
        box-shadow: 0 4px 10px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
          <line x1="6" y1="6" x2="6.01" y2="6"></line>
          <line x1="6" y1="18" x2="6.01" y2="18"></line>
        </svg>
      </div>

      <!-- Capacity Pill Badge -->
      <div style="
        position: absolute;
        top: -6px;
        right: -2px;
        background: #0f172a;
        color: ${badgeColor};
        font-size: 9px;
        font-weight: 800;
        font-family: monospace;
        padding: 1px 5px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.4);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        ${badgeText}
      </div>

      <!-- Pin Pointer -->
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid ${bgColor};
        margin: -1px auto 0;
      "></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'ftth-box-marker',
    iconSize: [44, 50],
    iconAnchor: [22, 50],
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

export default function FtthMapPage() {
  const navigate = useNavigate();
  const toast = useToastContext();

  const [boxes, setBoxes] = useState<FtthBox[]>([]);
  const [cables, setCables] = useState<FtthCable[]>([]);
  const [nocStations, setNocStations] = useState<FtthNocStation[]>([]);
  const [stats, setStats] = useState<FtthStats | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Layer Visibility
  const [showNocs, setShowNocs] = useState(true);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showCables, setShowCables] = useState(true);
  const [showCustomers, setShowCustomers] = useState(false);

  // Modals
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);
  const [isAddBoxOpen, setIsAddBoxOpen] = useState(false);
  const [isFeasibilityOpen, setIsFeasibilityOpen] = useState(false);

  // Office / NOC Modals
  const [isNocModalOpen, setIsNocModalOpen] = useState(false);
  const [editingNocStation, setEditingNocStation] = useState<FtthNocStation | null>(null);
  const [inspectingNocStation, setInspectingNocStation] = useState<FtthNocStation | null>(null);

  // Fiber Cable Modal
  const [isAddCableOpen, setIsAddCableOpen] = useState(false);
  const [cablePreselectedNoc, setCablePreselectedNoc] = useState<FtthNocStation | null>(null);

  // Add Device Modal
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [devicePreselectedNocId, setDevicePreselectedNocId] = useState<number | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [boxRes, cableRes, statRes, nocRes] = await Promise.allSettled([
        ftthService.getBoxes(),
        ftthService.getCables(),
        ftthService.getStats(),
        ftthService.getNocStations(),
      ]);

      if (boxRes.status === 'fulfilled') {
        setBoxes(boxRes.value || []);
      } else {
        const msg = boxRes.reason?.response?.data?.message || boxRes.reason?.message || 'Failed to load boxes';
        toast.error(`Boxes: ${msg}`);
      }

      if (cableRes.status === 'fulfilled') {
        setCables(cableRes.value || []);
      }

      if (statRes.status === 'fulfilled') {
        setStats(statRes.value);
      }

      if (nocRes.status === 'fulfilled') {
        setNocStations(nocRes.value || []);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load FTTH map data';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Lazy load customer pins when toggle is enabled
  useEffect(() => {
    if (showCustomers && customers.length === 0) {
      customersService
        .getCustomersForMap()
        .then((data) => setCustomers(data))
        .catch(() => {});
    }
  }, [showCustomers]);

  // Determine Map Initial Center: Focus on NOC if available, or first Box, or default
  const mapCenter: [number, number] = nocStations.length > 0
    ? [nocStations[0].latitude, nocStations[0].longitude]
    : boxes.length > 0
    ? [boxes[0].latitude, boxes[0].longitude]
    : DEFAULT_CENTER;

  return (
    <div className="flex flex-col h-[calc(100vh-4.2rem)] min-h-[500px] bg-slate-100 dark:bg-slate-900">
      {/* Top Header & Telemetry Bar */}
      <div className="flex-shrink-0 p-3 sm:p-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3 z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Title & Mode Switcher */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  FTTH Optical Network Map
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  GIS Live Topology
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Office / OLT server room, feeder cables, PLC splitters & drop routing
              </p>
            </div>
          </div>

          {/* Action Buttons & Layer Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Switcher: Customer Map */}
            <button
              type="button"
              onClick={() => navigate('/dashboard/map')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
            >
              Switch to Customer Status Map
            </button>

            {/* + Add Office / POP Station */}
            <button
              type="button"
              onClick={() => {
                setEditingNocStation(null);
                setIsNocModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              + Add Office / POP
            </button>

            {/* + Add Device (OLT / Router) */}
            <button
              type="button"
              onClick={() => {
                setDevicePreselectedNocId(nocStations[0]?.id || null);
                setIsAddDeviceOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Server className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              + Add Device
            </button>

            {/* + Deploy Box Button */}
            <button
              type="button"
              onClick={() => setIsAddBoxOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Deploy Box
            </button>

            {/* Run Fiber Cable Button */}
            <button
              type="button"
              onClick={() => {
                setCablePreselectedNoc(nocStations[0] || null);
                setIsAddCableOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Cable className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Run Fiber Cable
            </button>

            {/* Feasibility Check */}
            <button
              type="button"
              onClick={() => setIsFeasibilityOpen(true)}
              className="px-3.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Feasibility Check
            </button>

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Refresh Map"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Telemetry Metric Badges & Layer Toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Quick Metrics */}
          <div className="flex items-center gap-4 flex-wrap text-slate-600 dark:text-slate-300 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              Office / POPs: <strong className="text-slate-900 dark:text-white">{nocStations.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              FTTH Boxes: <strong className="text-slate-900 dark:text-white">{stats?.totalBoxes ?? boxes.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
              Total Ports: <strong className="text-slate-900 dark:text-white">{stats?.totalPorts ?? 0}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Available: <strong className="text-emerald-600 dark:text-emerald-400">{stats?.availablePorts ?? 0} Free</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Utilization: <strong className="text-slate-900 dark:text-white">{stats?.utilizationRate ?? 0}%</strong>
            </span>
          </div>

          {/* Layer Controls */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3" /> Layers:
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showNocs}
                onChange={(e) => setShowNocs(e.target.checked)}
                className="rounded text-indigo-600"
              />
              <span className="font-semibold text-indigo-700 dark:text-indigo-300">Office / NOC</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showBoxes}
                onChange={(e) => setShowBoxes(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>Boxes</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showCables}
                onChange={(e) => setShowCables(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>Fiber Cables</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showCustomers}
                onChange={(e) => setShowCustomers(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span>Customers</span>
            </label>
          </div>
        </div>
      </div>

      {/* Main Map Canvas */}
      <div className="flex-1 min-h-0 relative">
        {isLoading && boxes.length === 0 && nocStations.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200/50 dark:bg-slate-800/50 z-20">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full border-3 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Loading FTTH infrastructure...</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
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

            {/* Fiber Cable Route Lines */}
            {showCables && cables.map((cable) => (
              <Polyline
                key={`cable-${cable.id}`}
                positions={cable.routeCoords}
                pathOptions={{
                  color: cable.color || '#2563eb',
                  weight: 3.5,
                  opacity: 0.85,
                  dashArray: cable.status === 'cut' ? '6, 8' : undefined,
                }}
              >
                <Tooltip sticky direction="top" className="ftth-cable-tooltip">
                  <div className="text-xs font-sans">
                    <strong className="text-slate-900">{cable.cableName}</strong>
                    <div className="text-[11px] text-slate-500">
                      From: {cable.fromName} → To: {cable.toBoxName}
                    </div>
                    <div className="text-[10px] text-blue-600 font-mono">
                      {cable.coreCount}-Core Optical Fiber
                    </div>
                  </div>
                </Tooltip>
              </Polyline>
            ))}

            {/* Office / Central NOC Markers (Fully Draggable) */}
            {showNocs && nocStations.map((station) => (
              <Marker
                key={`noc-${station.id}`}
                position={[station.latitude, station.longitude]}
                icon={createNocMarkerIcon(station)}
                draggable={true}
                eventHandlers={{
                  click: () => setInspectingNocStation(station),
                  dragend: async (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    const newLat = parseFloat(position.lat.toFixed(6));
                    const newLng = parseFloat(position.lng.toFixed(6));

                    // Optimistically update position
                    setNocStations((prev) =>
                      prev.map((n) => (n.id === station.id ? { ...n, latitude: newLat, longitude: newLng } : n))
                    );

                    try {
                      await ftthService.updateNocLocation(station.id, newLat, newLng);
                      toast.success(`📍 "${station.name}" moved to: ${newLat}, ${newLng}`);
                      loadData();
                    } catch (err) {
                      toast.error('Failed to update office location on server');
                    }
                  },
                }}
              >
                <Popup className="ftth-noc-popup">
                  <div className="w-[280px] text-left p-1">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{station.name}</h4>
                        <span className="text-[10px] text-indigo-600 font-bold uppercase">
                          {station.station_type === 'main_office' ? 'Main Office & NOC' : 'Sub POP'}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        {station.olt_count} OLTs
                      </span>
                    </div>

                    <div className="py-2.5 space-y-1.5 text-xs text-slate-600">
                      {station.address && (
                        <p className="text-[11px] text-slate-500 truncate" title={station.address}>
                          📍 {station.address}
                        </p>
                      )}
                      <div className="flex justify-between">
                        <span>MikroTik Routers:</span>
                        <strong className="text-slate-900">{station.router_count} Installed</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>OLT Devices:</span>
                        <strong className="text-slate-900">{station.olt_count} Units</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Outgoing Feeder Lines:</span>
                        <strong className="text-emerald-600 font-bold">{station.outgoing_cables_count} Lines</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">
                        💡 Drag & Drop this marker to position your office precisely on the map!
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectingNocStation(station);
                        }}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer text-center"
                      >
                        Inspect NOC
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCablePreselectedNoc(station);
                          setIsAddCableOpen(true);
                        }}
                        className="w-full py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-semibold text-xs rounded-xl transition-all cursor-pointer text-center"
                      >
                        Run Cable
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* FTTH Box Markers (Fully Draggable) */}
            {showBoxes && boxes.map((box) => (
              <Marker
                key={`box-${box.id}`}
                position={[box.latitude, box.longitude]}
                icon={createBoxMarkerIcon(box)}
                draggable={true}
                eventHandlers={{
                  dragend: async (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    const newLat = parseFloat(position.lat.toFixed(6));
                    const newLng = parseFloat(position.lng.toFixed(6));

                    // Optimistically update position
                    setBoxes((prev) =>
                      prev.map((b) => (b.id === box.id ? { ...b, latitude: newLat, longitude: newLng } : b))
                    );

                    try {
                      await ftthService.updateBoxLocation(box.id, newLat, newLng);
                      toast.success(`📍 Box "${box.box_code}" moved to: ${newLat}, ${newLng}`);
                      loadData();
                    } catch (err) {
                      toast.error('Failed to update box location on server');
                    }
                  },
                }}
              >
                <Popup className="ftth-box-popup">
                  <div className="w-[260px] text-left p-1">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{box.box_name}</h4>
                        <span className="font-mono text-[10px] text-blue-600 font-semibold">{box.box_code}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        box.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {box.status}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="py-2.5 space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Ratio:</span>
                        <strong className="text-slate-900">{box.splitter_ratio} PLC</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Port Capacity:</span>
                        <strong className="text-slate-900">
                          {box.occupied_ports || 0} / {box.total_ports} ({box.available_ports || 0} Free)
                        </strong>
                      </div>
                      {box.pole_number && (
                        <div className="flex justify-between">
                          <span>Pole ID:</span>
                          <span className="font-semibold">{box.pole_number}</span>
                        </div>
                      )}
                      {box.optical_input_power && (
                        <div className="flex justify-between">
                          <span>Input Signal:</span>
                          <span className="font-bold text-blue-600">{box.optical_input_power} dBm</span>
                        </div>
                      )}
                      {box.address && (
                        <p className="text-[11px] text-slate-500 pt-1 truncate" title={box.address}>
                          {box.address}
                        </p>
                      )}
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedBoxId(box.id)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Wifi className="w-3.5 h-3.5" />
                      Manage Splitter Ports
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Optional Customer Pins */}
            {showCustomers && customers.map((c) => (
              <Marker
                key={`cust-${c.customerId}`}
                position={[c.latitude, c.longitude]}
                icon={L.divIcon({
                  html: `<div style="width: 10px; height: 10px; background: #64748b; border: 2px solid #ffffff; border-radius: 50%;"></div>`,
                  className: 'cust-pin',
                  iconSize: [10, 10],
                  iconAnchor: [5, 5],
                })}
              >
                <Popup>
                  <div className="text-xs">
                    <strong>{c.fullName}</strong>
                    <div className="text-slate-500">{c.phone || c.username}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Office / NOC Detail Inspector Modal */}
      <NocDetailModal
        station={inspectingNocStation}
        isOpen={Boolean(inspectingNocStation)}
        onClose={() => setInspectingNocStation(null)}
        onEdit={(st) => {
          setInspectingNocStation(null);
          setEditingNocStation(st);
          setIsNocModalOpen(true);
        }}
        onRunCable={(st) => {
          setCablePreselectedNoc(st);
          setIsAddCableOpen(true);
        }}
        onAddDevice={(st) => {
          setDevicePreselectedNocId(st.id);
          setIsAddDeviceOpen(true);
        }}
      />

      {/* Add Device Modal (OLT / MikroTik) */}
      <AddDeviceModal
        isOpen={isAddDeviceOpen}
        onClose={() => {
          setIsAddDeviceOpen(false);
          setDevicePreselectedNocId(null);
        }}
        onSuccess={loadData}
        nocStations={nocStations}
        defaultNocId={devicePreselectedNocId}
      />

      {/* Office / NOC Setup Modal */}
      <NocStationModal
        isOpen={isNocModalOpen}
        stationToEdit={editingNocStation}
        onClose={() => {
          setIsNocModalOpen(false);
          setEditingNocStation(null);
        }}
        onSuccess={loadData}
      />

      {/* Run Fiber Cable Modal */}
      <AddCableModal
        isOpen={isAddCableOpen}
        onClose={() => {
          setIsAddCableOpen(false);
          setCablePreselectedNoc(null);
        }}
        onSuccess={loadData}
        boxes={boxes}
        nocStations={nocStations}
        preselectedNoc={cablePreselectedNoc}
      />

      {/* Box Detail Modal */}
      <BoxDetailModal
        isOpen={Boolean(selectedBoxId)}
        boxId={selectedBoxId}
        onClose={() => setSelectedBoxId(null)}
        onUpdated={loadData}
      />

      {/* Add Box Modal */}
      <AddBoxModal
        isOpen={isAddBoxOpen}
        onClose={() => setIsAddBoxOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* Feasibility Checker Modal */}
      <FeasibilityCheckModal
        isOpen={isFeasibilityOpen}
        onClose={() => setIsFeasibilityOpen(false)}
        onSelectBox={(boxId) => setSelectedBoxId(boxId)}
      />
    </div>
  );
}
