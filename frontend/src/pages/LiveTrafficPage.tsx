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
  Activity,
  RotateCw,
} from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { monitoringService } from '@/services/monitoring.service';
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

  // Query parameters passed from Customer View or Router
  const paramServerId = searchParams.get('serverId') || searchParams.get('router_id');
  const paramServerName = searchParams.get('serverName');
  const paramUsername = searchParams.get('username');
  const paramUserId = searchParams.get('user_id');

  // State
  const [servers, setServers] = useState<NetworkDevice[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>(paramServerId || '');
  const [routerName, setRouterName] = useState<string>(paramServerName || '');
  const [username, setUsername] = useState<string>(paramUsername || '');
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

  // UI state
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [isPolling, setIsPolling] = useState<boolean>(false);

  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const maxHistoryPoints = 40; // Number of bars shown on graph

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

  // 1. Initial Load: Fetch MikroTik routers if needed
  useEffect(() => {
    const loadRouters = async () => {
      try {
        const res = await networkService.getNetworkDevices('mikrotik');
        if (res.success && res.data) {
          setServers(res.data);

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
          } else if (!routerName && res.data.length > 0) {
            setSelectedServerId(String(res.data[0].networkDeviceId));
            setRouterName(res.data[0].deviceName || res.data[0].deviceCode);
          }
        }
      } catch (err) {
        console.warn('Failed to load routers:', err);
      }
    };

    loadRouters();
  }, [paramServerId, paramServerName]);

  // Sync params when URL changes
  useEffect(() => {
    if (paramUsername) setUsername(paramUsername);
    if (paramServerName) setRouterName(paramServerName);
    if (paramServerId) setSelectedServerId(paramServerId);
  }, [paramUsername, paramServerName, paramServerId]);

  // 2. Real-time Live Polling Loop
  useEffect(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    if (username || selectedServerId) {
      // Immediate initial fetch
      executePoll();

      // Poll every 2 seconds
      pollingTimerRef.current = setInterval(() => {
        executePoll();
      }, 2000);
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [selectedServerId, username, routerName]);

  const executePoll = async () => {
    if (isFetchingRef.current) return;
    if (!username) return;

    try {
      isFetchingRef.current = true;
      setIsPolling(true);

      const res = await monitoringService.getLiveTraffic(
        selectedServerId || undefined,
        username || undefined,
        undefined,
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
      setTimeout(() => setIsPolling(false), 250);
    }
  };

  // Y-axis maximum dynamic scale with 25% headroom
  const maxRecordedSpeed = useMemo(() => {
    const max = Math.max(peakRx, peakTx, currentRx, currentTx, 500000);
    return Math.ceil(max * 1.25);
  }, [peakRx, peakTx, currentRx, currentTx]);

  return (
    <div className="w-full min-w-0 overflow-x-hidden space-y-3 sm:space-y-4 pb-2 sm:pb-4 relative">
      
      {/* Standard NetFix PageHeader */}
      <PageHeader
        backTo={paramUserId ? `/dashboard/customers/${paramUserId}` : '/dashboard/customers'}
        icon={<Activity className="w-5 h-5 text-emerald-500" />}
        title="Live Traffic Monitor"
        subtitle={
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span>
              Customer: <strong className="font-mono text-slate-800 dark:text-slate-200">{username || '—'}</strong>
            </span>
            <span>•</span>
            <span>
              Router: <strong className="text-slate-800 dark:text-slate-200">{routerName || 'MikroTik Router'}</strong>
            </span>
          </div>
        }
        badge={
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border ${
            sessionStatus === 'online'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${sessionStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {sessionStatus === 'online' ? 'Active Session' : 'Offline / Idle'}
          </span>
        }
      />

      {/* Compact Session Telemetry & Peak Throughput Strip */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
          {sessionIp && (
            <span>
              IP: <strong className="font-mono text-slate-900 dark:text-slate-100">{sessionIp}</strong>
            </span>
          )}
          {sessionMac && (
            <span className="hidden sm:inline">
              MAC: <strong className="font-mono text-slate-900 dark:text-slate-100">{sessionMac}</strong>
            </span>
          )}
          {sessionUptime && (
            <span className="hidden md:inline">
              Uptime: <strong className="text-slate-900 dark:text-slate-100">{sessionUptime}</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-red-600 dark:text-red-400 font-semibold">
            Peak Tx: {formatSpeed(peakTx)}
          </span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold">
            Peak Rx: {formatSpeed(peakRx)}
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* Main Chart Box - EXACT Match of User Demo Image (media_...)    */}
      {/* ============================================================== */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden">
        
        {/* Centered Title Header matching demo graph */}
        <div className="text-center mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-sans">
            Real Time Download-Upload Graph
          </h2>
          <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <p>
              Username:{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {username || '—'}
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
        <div className="w-full h-[260px] sm:h-[280px] lg:h-[300px] relative min-w-0 overflow-hidden">
          {trafficData.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <RotateCw className="w-7 h-7 animate-spin text-blue-500 mb-2" />
              <span className="text-xs font-medium">Connecting to MikroTik & waiting for traffic stream...</span>
            </div>
          ) : chartType === 'bar' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trafficData}
                margin={{ top: 10, right: 15, left: 5, bottom: 10 }}
                barCategoryGap="15%"
                barGap={1}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#e2e8f0" className="dark:stroke-slate-700/60" />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  domain={[0, maxRecordedSpeed]}
                  tickFormatter={formatSpeedY}
                  label={{
                    value: 'Speed',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 5,
                    style: { fontSize: 11, fill: '#64748b', fontWeight: 600 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '10px',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: '11px',
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
                margin={{ top: 10, right: 15, left: 5, bottom: 10 }}
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
                <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#e2e8f0" className="dark:stroke-slate-700/60" />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  domain={[0, maxRecordedSpeed]}
                  tickFormatter={formatSpeedY}
                  label={{
                    value: 'Speed',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 5,
                    style: { fontSize: 11, fill: '#64748b', fontWeight: 600 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '10px',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: '11px',
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
        <div className="mt-3 sm:mt-4 flex flex-col items-center justify-center space-y-1.5">
          {/* Spinning refresh icon */}
          <div className="flex items-center justify-center">
            <RotateCw className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-all ${
              isPolling ? 'animate-spin text-blue-500' : ''
            }`} />
          </div>

          {/* Red Tx dot and Blue Rx dot with exact spacing & typography */}
          <div className="flex flex-col items-center justify-center space-y-1 text-xs sm:text-sm font-semibold">
            {/* Tx (Upload) - Red dot */}
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shrink-0 shadow-xs" />
              <span className="text-slate-900 dark:text-slate-100 font-sans">
                Tx: {formatSpeed(currentTx)}
              </span>
            </div>

            {/* Rx (Download) - Blue dot */}
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shrink-0 shadow-xs" />
              <span className="text-slate-900 dark:text-slate-100 font-sans">
                Rx: {formatSpeed(currentRx)}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Chart View Toggle */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>View Style:</span>
            <button
              onClick={() => setChartType('bar')}
              className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                chartType === 'bar'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                  : 'hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Bar Graph (Demo)
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                chartType === 'area'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                  : 'hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Area Waves
            </button>
          </div>
          <div>
            <span>Data Points: {trafficData.length} / {maxHistoryPoints}</span>
          </div>
        </div>

      </div>

    </div>
  );
}
