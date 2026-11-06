import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  ArrowLeft,
  RotateCw,
  Play,
  Pause,
  Trash2,
  BarChart2,
  Activity,
  Server,
  User,
  Wifi,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { monitoringService, ActiveInterface } from '@/services/monitoring.service';
import { networkService } from '@/services/network.service';
import { useToastContext } from '@/contexts/ToastContext';

interface NetworkDevice {
  networkDeviceId: string;
  deviceName: string;
  deviceCode: string;
  managementIp?: string;
}

interface TrafficDataPoint {
  time: string;
  timestamp: number;
  tx: number; // bps (Upload - Red)
  rx: number; // bps (Download - Blue)
  txFormatted: string;
  rxFormatted: string;
}

export default function LiveTrafficPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToastContext();

  // Query params
  const paramServerId = searchParams.get('serverId') || searchParams.get('router_id');
  const paramServerName = searchParams.get('serverName');
  const paramUsername = searchParams.get('username');
  const paramUserId = searchParams.get('user_id');

  // State
  const [servers, setServers] = useState<NetworkDevice[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [routerName, setRouterName] = useState<string>('');
  const [activeSessions, setActiveSessions] = useState<ActiveInterface[]>([]);
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [selectedInterface, setSelectedInterface] = useState<string>('');
  const [trafficData, setTrafficData] = useState<TrafficDataPoint[]>([]);
  
  // Real-time rates
  const [currentTx, setCurrentTx] = useState<number>(0); // Upload bps
  const [currentRx, setCurrentRx] = useState<number>(0); // Download bps
  const [peakTx, setPeakTx] = useState<number>(0);
  const [peakRx, setPeakRx] = useState<number>(0);

  // Status & Telemetry
  const [sessionStatus, setSessionStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [sessionIp, setSessionIp] = useState<string>('');
  const [sessionMac, setSessionMac] = useState<string>('');
  const [sessionUptime, setSessionUptime] = useState<string>('');

  // UI Settings
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(2000); // 2s default
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [isLoadingServers, setIsLoadingServers] = useState<boolean>(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [sessionSearch, setSessionSearch] = useState<string>('');

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const maxHistoryPoints = 40; // Number of bars/points to show on X axis

  // Format speed (bps -> kbps / mbps / gbps) matching the user's demo graph
  const formatSpeed = (bps: number): string => {
    if (bps == null || isNaN(bps) || bps <= 0) return '0.00 kbps';
    if (bps >= 1000000000) {
      return `${(bps / 1000000000).toFixed(2)} gbps`;
    }
    if (bps >= 1000000) {
      return `${(bps / 1000000).toFixed(2)} mbps`;
    }
    if (bps >= 1000) {
      return `${(bps / 1000).toFixed(2)} kbps`;
    }
    return `${bps.toFixed(0)} bps`;
  };

  // Y-axis tick formatter matching demo graph: 0, 2.5M, 5M, 7.5M, 10M, 12.5M, 15M
  const formatSpeedY = (val: number): string => {
    if (val >= 1000000000) return `${(val / 1000000000).toFixed(1)}G`;
    if (val >= 1000000) {
      const num = val / 1000000;
      return `${Number.isInteger(num) ? num : num.toFixed(1)}M`;
    }
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return String(val);
  };

  // 1. Initial Load: Fetch MikroTik routers
  useEffect(() => {
    loadRouters();
  }, []);

  const loadRouters = async () => {
    try {
      setIsLoadingServers(true);
      const res = await networkService.getNetworkDevices('mikrotik');
      if (res.success && res.data) {
        setServers(res.data);

        // Auto-select router from URL param if available
        let targetRouter: NetworkDevice | undefined;
        if (paramServerId) {
          targetRouter = res.data.find(
            (d) => String(d.networkDeviceId) === String(paramServerId) || d.deviceCode === paramServerId
          );
        }
        if (!targetRouter && paramServerName) {
          targetRouter = res.data.find(
            (d) => d.deviceName?.toLowerCase() === paramServerName.toLowerCase() ||
                   d.deviceCode?.toLowerCase() === paramServerName.toLowerCase()
          );
        }

        if (targetRouter) {
          setSelectedServerId(String(targetRouter.networkDeviceId));
          setRouterName(targetRouter.deviceName || targetRouter.deviceCode);
        } else if (res.data.length > 0) {
          setSelectedServerId(String(res.data[0].networkDeviceId));
          setRouterName(res.data[0].deviceName || res.data[0].deviceCode);
        }
      }
    } catch (err: any) {
      console.error('Failed to load routers:', err);
      toast.error('Failed to load MikroTik routers');
    } finally {
      setIsLoadingServers(false);
    }
  };

  // 2. Set username from URL param
  useEffect(() => {
    if (paramUsername) {
      setSelectedUsername(paramUsername);
    }
  }, [paramUsername]);

  // 3. Load active PPPoE sessions whenever selected server changes
  useEffect(() => {
    if (selectedServerId) {
      loadSessions(selectedServerId);
      const r = servers.find((s) => String(s.networkDeviceId) === String(selectedServerId));
      if (r) setRouterName(r.deviceName || r.deviceCode);
    } else {
      setActiveSessions([]);
    }
  }, [selectedServerId, servers]);

  const loadSessions = async (serverId: string) => {
    try {
      setIsLoadingSessions(true);
      const res = await monitoringService.getActiveInterfaces(serverId, routerName);
      if (res.success && Array.isArray(res.data)) {
        setActiveSessions(res.data);
      }
    } catch (err) {
      console.warn('Could not load active sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // 4. Live Polling Loop
  useEffect(() => {
    // Clear timer
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    if (isPaused) {
      setIsPolling(false);
      return;
    }

    if (selectedUsername || selectedInterface || selectedServerId) {
      // Execute immediate poll
      executePoll();

      // Start recurring poll
      pollingTimerRef.current = setInterval(() => {
        executePoll();
      }, pollIntervalMs);
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [selectedServerId, selectedUsername, selectedInterface, isPaused, pollIntervalMs, routerName]);

  const executePoll = async () => {
    if (isFetchingRef.current) return;
    if (!selectedUsername && !selectedInterface) return;

    try {
      isFetchingRef.current = true;
      setIsPolling(true);

      const res = await monitoringService.getLiveTraffic(
        selectedServerId || undefined,
        selectedUsername || undefined,
        selectedInterface || undefined,
        routerName || undefined,
      );

      if (res.success && res.data) {
        const d = res.data;
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour12: false });

        // Tx = Upload (Router Rx), Rx = Download (Router Tx)
        const txBps = d.tx_bps ?? d.upload_bps ?? 0;
        const rxBps = d.rx_bps ?? d.download_bps ?? 0;

        setCurrentTx(txBps);
        setCurrentRx(rxBps);

        setPeakTx((prev) => Math.max(prev, txBps));
        setPeakRx((prev) => Math.max(prev, rxBps));

        if (d.router_name) {
          setRouterName(d.router_name);
        }

        setSessionStatus(d.status === 'online' ? 'online' : 'offline');
        if (d.ip) setSessionIp(d.ip);
        if (d.mac) setSessionMac(d.mac);
        if (d.uptime) setSessionUptime(d.uptime);

        const newPoint: TrafficDataPoint = {
          time: timeStr,
          timestamp: now.getTime(),
          tx: txBps,
          rx: rxBps,
          txFormatted: formatSpeed(txBps),
          rxFormatted: formatSpeed(rxBps),
        };

        setTrafficData((prev) => {
          const updated = [...prev, newPoint];
          return updated.slice(-maxHistoryPoints);
        });
      }
    } catch (err: any) {
      console.warn('Traffic polling error:', err);
      setSessionStatus('offline');
    } finally {
      isFetchingRef.current = false;
      // Brief spinner reset animation
      setTimeout(() => setIsPolling(false), 300);
    }
  };

  const handleClearHistory = () => {
    setTrafficData([]);
    setPeakTx(0);
    setPeakRx(0);
    setCurrentTx(0);
    setCurrentRx(0);
  };

  // Filtered active sessions for quick picker
  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) return activeSessions.slice(0, 50);
    const q = sessionSearch.toLowerCase();
    return activeSessions.filter(
      (s) => s.username?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q) || s.ip?.includes(q)
    );
  }, [activeSessions, sessionSearch]);

  // Calculate highest scale for Y-axis to give proper headroom
  const maxRecordedSpeed = useMemo(() => {
    let max = Math.max(peakRx, peakTx, currentRx, currentTx, 500000);
    // Headroom of 1.25x
    return Math.ceil(max * 1.25);
  }, [peakRx, peakTx, currentRx, currentTx]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-3 sm:p-6 transition-colors">
      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* Top Navigation & Router Selection Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (paramUserId) {
                  navigate(`/dashboard/customers/${paramUserId}`);
                } else {
                  navigate('/dashboard/customers');
                }
              }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shrink-0"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Live Bandwidth Monitor
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Single session real-time bandwidth meter on MikroTik
              </p>
            </div>
          </div>

          {/* Quick Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Router Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <Server className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={selectedServerId}
                onChange={(e) => {
                  setSelectedServerId(e.target.value);
                  const found = servers.find((s) => String(s.networkDeviceId) === e.target.value);
                  if (found) setRouterName(found.deviceName || found.deviceCode);
                }}
                disabled={isLoadingServers}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer max-w-[140px] sm:max-w-[180px] truncate"
              >
                {servers.map((s) => (
                  <option key={s.networkDeviceId} value={s.networkDeviceId} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                    {s.deviceName || s.deviceCode}
                  </option>
                ))}
              </select>
            </div>

            {/* PPPoE User Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <User className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={selectedUsername}
                onChange={(e) => setSelectedUsername(e.target.value.trim())}
                placeholder="PPPoE Username"
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none w-28 sm:w-36"
              />
              {activeSessions.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedUsername(e.target.value);
                    }
                  }}
                  className="bg-transparent text-xs text-slate-400 outline-none cursor-pointer"
                  title="Pick active session"
                >
                  <option value="">{activeSessions.length} active</option>
                  {activeSessions.map((s, idx) => (
                    <option key={idx} value={s.username || s.name} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      {s.username || s.name} {s.ip ? `(${s.ip})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Pause / Resume Button */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`p-2 rounded-xl border transition-all ${
                isPaused
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600'
              }`}
              title={isPaused ? 'Resume monitoring' : 'Pause monitoring'}
            >
              {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            </button>

            {/* Clear History */}
            <button
              onClick={handleClearHistory}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors"
              title="Clear graph history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Session Status Pill Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-xs flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5 font-semibold">
              <span className={`w-2.5 h-2.5 rounded-full ${
                sessionStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`} />
              <span className={sessionStatus === 'online' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
                {sessionStatus === 'online' ? 'Active Session' : 'Offline / Idle'}
              </span>
            </div>

            {sessionIp && (
              <span className="text-slate-500 dark:text-slate-400">
                IP: <strong className="text-slate-700 dark:text-slate-200 font-mono">{sessionIp}</strong>
              </span>
            )}
            {sessionMac && (
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                MAC: <strong className="text-slate-700 dark:text-slate-200 font-mono">{sessionMac}</strong>
              </span>
            )}
            {sessionUptime && (
              <span className="text-slate-500 dark:text-slate-400 hidden md:inline">
                Uptime: <strong className="text-slate-700 dark:text-slate-200">{sessionUptime}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-red-600 dark:text-red-400">
              Peak Tx: <strong>{formatSpeed(peakTx)}</strong>
            </span>
            <span className="text-blue-600 dark:text-blue-400">
              Peak Rx: <strong>{formatSpeed(peakRx)}</strong>
            </span>
            {/* Polling speed selector */}
            <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
              {[1000, 2000, 5000].map((int) => (
                <button
                  key={int}
                  onClick={() => setPollIntervalMs(int)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    pollIntervalMs === int
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {int / 1000}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Main Chart Box - EXACT Match of User Demo Image (media_...)    */}
        {/* ============================================================== */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-8 shadow-xs">
          
          {/* Centered Title Header matching demo graph */}
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 font-sans">
              Real Time Download-Upload Graph
            </h2>
            <div className="mt-1.5 space-y-0.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <p>
                Username:{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedUsername || '—'}
                </span>
              </p>
              <p>
                Router name:{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {routerName || 'MikroTik Router'}
                </span>
              </p>
            </div>
          </div>

          {/* Graph Section */}
          <div className="w-full h-[320px] sm:h-[380px] relative">
            {trafficData.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <RotateCw className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                <span className="text-xs font-medium">Connecting to MikroTik & waiting for traffic stream...</span>
              </div>
            ) : chartType === 'bar' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={trafficData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                  barCategoryGap="15%"
                  barGap={1}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis
                    dataKey="time"
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    domain={[0, maxRecordedSpeed]}
                    tickFormatter={formatSpeedY}
                    label={{
                      value: 'Speed',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 0,
                      style: { fontSize: 12, fill: '#64748b', fontWeight: 600 },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(val: number, name: string) => [
                      formatSpeed(val),
                      name === 'rx' ? 'Rx (Download)' : 'Tx (Upload)',
                    ]}
                  />
                  {/* Tx = Red bar */}
                  <Bar
                    dataKey="tx"
                    name="tx"
                    fill="#ef4444"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={8}
                    isAnimationActive={false}
                  />
                  {/* Rx = Blue bar */}
                  <Bar
                    dataKey="rx"
                    name="rx"
                    fill="#2563eb"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={8}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trafficData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis
                    dataKey="time"
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    domain={[0, maxRecordedSpeed]}
                    tickFormatter={formatSpeedY}
                    label={{
                      value: 'Speed',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 0,
                      style: { fontSize: 12, fill: '#64748b', fontWeight: 600 },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(val: number, name: string) => [
                      formatSpeed(val),
                      name === 'rx' ? 'Rx (Download)' : 'Tx (Upload)',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="rx"
                    name="rx"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#colorRx)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="tx"
                    name="tx"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#colorTx)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bottom Live Meter Indicator - EXACT Match of User Demo Image */}
          <div className="mt-6 flex flex-col items-center justify-center space-y-2">
            {/* Spinning refresh icon */}
            <div className="flex items-center justify-center">
              <RotateCw className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-all ${
                isPolling && !isPaused ? 'animate-spin text-blue-500' : ''
              }`} />
            </div>

            {/* Red Tx dot and Blue Rx dot with exact spacing & typography */}
            <div className="flex flex-col items-center justify-center space-y-1 text-sm sm:text-base font-semibold">
              {/* Tx (Upload) - Red dot */}
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block shrink-0 shadow-xs" />
                <span className="text-slate-900 dark:text-slate-100 font-sans">
                  Tx: {formatSpeed(currentTx)}
                </span>
              </div>

              {/* Rx (Download) - Blue dot */}
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-600 inline-block shrink-0 shadow-xs" />
                <span className="text-slate-900 dark:text-slate-100 font-sans">
                  Rx: {formatSpeed(currentRx)}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Chart View Switcher */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>View Mode:</span>
              <button
                onClick={() => setChartType('bar')}
                className={`px-2 py-1 rounded-md font-semibold transition-colors ${
                  chartType === 'bar'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    : 'hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Bar Graph (Demo)
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`px-2 py-1 rounded-md font-semibold transition-colors ${
                  chartType === 'area'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    : 'hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Area Waves
              </button>
            </div>
            <div>
              <span>Points: {trafficData.length} / {maxHistoryPoints}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
