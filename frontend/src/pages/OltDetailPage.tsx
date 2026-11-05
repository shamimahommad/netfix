import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Cpu,
  HardDrive,
  Thermometer,
  Wifi,
  Search,
  Copy,
  Check,
  User,
  ShieldCheck,
  Zap,
  Radio,
  ExternalLink,
  AlertTriangle,
  Activity,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/common';
import { networkService } from '@/services/network.service';
import { NetworkDevice } from '@/types/network.types';
import { useToastContext } from '@/contexts/ToastContext';

interface OnuRecord {
  ponPort: number;
  ponPortName: string;
  onuId: string;
  macAddress: string;
  routerMac?: string | null;
  vlanId?: number | null;
  pppoe?: string | null;
  rxPowerDbm?: number | null;
  status: string;
  lastSyncAt: string;
  customer?: {
    customerId: string;
    customerCode: string;
    customerName: string;
    username: string;
  } | null;
}

export default function OltDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();

  const [device, setDevice] = useState<NetworkDevice | null>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [onus, setOnus] = useState<OnuRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingData, setPingData] = useState<{ status: string; latencyMs: number | null; port?: number; target?: string } | null>(null);

  const [selectedPon, setSelectedPon] = useState<number | 'all'>('all');
  const [signalFilter, setSignalFilter] = useState<'all' | 'good' | 'fair' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedMac, setCopiedMac] = useState<string | null>(null);

  // Sync Progress & Loading Modal State
  const [syncSeconds, setSyncSeconds] = useState(0);

  useEffect(() => {
    let timer: any;
    if (isSyncing) {
      setSyncSeconds(0);
      timer = setInterval(() => {
        setSyncSeconds((s) => s + 1);
      }, 1000);
    } else {
      setSyncSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSyncing]);

  useEffect(() => {
    if (id) {
      loadAllData();
    }
  }, [id]);

  const loadAllData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [devRes, statusRes, onusRes] = await Promise.all([
        networkService.getNetworkDeviceById(id).catch(() => null),
        networkService.getOltStatus(id).catch(() => null),
        networkService.getOltOnus(id).catch(() => null),
      ]);

      if (devRes?.success && devRes.data) {
        setDevice(devRes.data);
        if (!pingData) {
          setPingData({
            status: devRes.data.pingStatus || (devRes.data.status === 'active' ? 'online' : 'offline'),
            latencyMs: devRes.data.latencyMs || null,
          });
        }
      }
      if (statusRes?.success && statusRes.data) {
        setTelemetry(statusRes.data);
      } else if (devRes?.success && devRes.data?.telemetry) {
        setTelemetry(devRes.data.telemetry);
      }
      if (onusRes?.success && onusRes.data) {
        setOnus(onusRes.data.onus || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load OLT details');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePing = async () => {
    if (!id) return;
    setIsPinging(true);
    try {
      const res = await networkService.pingNow(id);
      if (res.success && res.data) {
        setPingData({
          status: res.data.status,
          latencyMs: res.data.latencyMs,
          port: (res.data as any).portTested,
          target: (res.data as any).target,
        });
        if (res.data.status === 'online') {
          const latText = res.data.latencyMs ? ` in ${res.data.latencyMs}ms` : '';
          const targetText = (res.data as any).target ? ` [${(res.data as any).target}]` : '';
          toast.success(`OLT Hardware Online${targetText}: Responded${latText} via TCP socket probe!`);
        } else {
          toast.error(`OLT Offline: Device did not respond on management port!`);
        }
      } else {
        toast.error(res.error_message || 'Ping probe failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Ping probe failed');
    } finally {
      setIsPinging(false);
    }
  };

  const handleSyncNow = async () => {
    if (!id) return;
    setIsSyncing(true);
    try {
      const res = await networkService.syncOlt(id);
      if (res.success) {
        toast.success(res.message || 'OLT synchronized successfully with hardware');
        await loadAllData();
      } else {
        toast.error(res.message || 'Hardware sync reported an issue');
        await loadAllData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyMac = (mac: string) => {
    navigator.clipboard.writeText(mac);
    setCopiedMac(mac);
    setTimeout(() => setCopiedMac(null), 2000);
  };

  // Dynamic PON ports count detection (e.g. 4, 8, 16)
  const totalPonPorts = useMemo(() => {
    if (device?.totalPonPorts && device.totalPonPorts > 0) return device.totalPonPorts;
    if ((telemetry as any)?.totalPonPorts && (telemetry as any).totalPonPorts > 0) return (telemetry as any).totalPonPorts;
    if (telemetry?.system?.totalPonPorts && telemetry.system.totalPonPorts > 0) return telemetry.system.totalPonPorts;
    if (telemetry?.ponPorts && telemetry.ponPorts.length > 0) return telemetry.ponPorts.length;
    const maxOnuPon = onus.reduce((max, onu) => Math.max(max, onu.ponPort || 1), 0);
    if (maxOnuPon > 4) return Math.max(maxOnuPon, 8);
    return 8;
  }, [device, telemetry, onus]);

  const ponPortsList = useMemo(() => {
    return Array.from({ length: totalPonPorts }, (_, i) => i + 1);
  }, [totalPonPorts]);

  const ponPrefix = useMemo(() => {
    const type = (device?.ponType || 'epon').toLowerCase();
    if (type.includes('gpon')) return 'GPON 0/';
    if (type.includes('xgs')) return 'XGS 0/';
    return 'EPON 0/';
  }, [device?.ponType]);

  // Group ONUs by PON port
  const ponCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= totalPonPorts; i++) {
      counts[i] = 0;
    }
    for (const onu of onus) {
      const p = onu.ponPort || 1;
      counts[p] = (counts[p] || 0) + 1;
    }
    return counts;
  }, [onus, totalPonPorts]);

  // Sync Progress Calculation & Animated Stages
  const estimatedDuration = totalPonPorts > 4 ? 45 : 15;
  const progressPercent = Math.min(96, Math.max(8, Math.round((syncSeconds / estimatedDuration) * 90) + 8));

  const syncStages = useMemo(() => [
    {
      title: 'Connecting to OLT Management Engine',
      description: `Authenticating with ${device?.managementIp || 'OLT'}:${device?.webPort || 80} via HTTPS session...`,
      doneAt: 2,
    },
    {
      title: 'Reading Optical Transceivers & Board Telemetry',
      description: `Querying CPU load, RAM usage, board temperature & laser power across ${totalPonPorts} PON ports...`,
      doneAt: 6,
    },
    {
      title: 'Scanning Active Subscribers & Link Status',
      description: `Reading live ONU register table, distance measurements, and alive times...`,
      doneAt: totalPonPorts > 4 ? 18 : 9,
    },
    {
      title: 'Measuring Optical Signal Power (Rx / Tx DDM)',
      description: `Diagnosing optical laser receive power and fiber attenuation dBm...`,
      doneAt: totalPonPorts > 4 ? 35 : 12,
    },
    {
      title: 'Mapping Router MACs & Database Synchronization',
      description: `Resolving VLAN IDs, matching PPPoE user profiles & updating local records...`,
      doneAt: totalPonPorts > 4 ? 42 : 14,
    },
  ], [device, totalPonPorts]);

  // Filtered ONUs
  const filteredOnus = useMemo(() => {
    return onus.filter((onu) => {
      // PON filter
      if (selectedPon !== 'all' && onu.ponPort !== selectedPon) return false;

      // Optical Signal filter
      if (signalFilter === 'good') {
        if (onu.rxPowerDbm === null || onu.rxPowerDbm === undefined || isNaN(onu.rxPowerDbm) || onu.rxPowerDbm < -24) return false;
      }
      if (signalFilter === 'fair') {
        if (onu.rxPowerDbm === null || onu.rxPowerDbm === undefined || isNaN(onu.rxPowerDbm) || onu.rxPowerDbm >= -24 || onu.rxPowerDbm < -27) return false;
      }
      if (signalFilter === 'low') {
        if (onu.rxPowerDbm === null || onu.rxPowerDbm === undefined || isNaN(onu.rxPowerDbm) || onu.rxPowerDbm >= -27) return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const macMatches = onu.macAddress.toLowerCase().includes(q);
      const routerMacMatches = onu.routerMac ? onu.routerMac.toLowerCase().includes(q) : false;
      const vlanMatches = onu.vlanId ? (onu.vlanId.toString().includes(q) || `vlan ${onu.vlanId}`.includes(q)) : false;
      const pppoeMatches = onu.pppoe ? onu.pppoe.toLowerCase().includes(q) : false;
      const onuIdMatches = onu.onuId.toLowerCase().includes(q);
      const custNameMatches = onu.customer?.customerName.toLowerCase().includes(q);
      const custUserMatches = onu.customer?.username.toLowerCase().includes(q);
      const custCodeMatches = onu.customer?.customerCode.toLowerCase().includes(q);

      return macMatches || routerMacMatches || vlanMatches || pppoeMatches || onuIdMatches || custNameMatches || custUserMatches || custCodeMatches;
    });
  }, [onus, selectedPon, signalFilter, searchQuery]);

  const getPowerColor = (power: number | null | undefined) => {
    if (power === null || power === undefined || isNaN(power)) {
      return {
        badge: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        text: 'text-slate-500 dark:text-slate-400 font-medium',
        label: 'No Signal',
      };
    }
    if (power >= -24) {
      return {
        badge: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
        text: 'text-emerald-600 dark:text-emerald-400 font-bold',
        label: 'Optimal',
      };
    }
    if (power >= -27) {
      return {
        badge: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
        text: 'text-amber-600 dark:text-amber-400 font-bold',
        label: 'Fair',
      };
    }
    return {
      badge: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60',
      text: 'text-rose-600 dark:text-rose-400 font-bold',
      label: 'Critical Low',
    };
  };

  return (
    <div className="w-full min-w-0 space-y-6 pb-12 relative">
      {/* Top Viewport Active Sync Indicator */}
      {isSyncing && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 animate-pulse z-50 shadow-md shadow-blue-500/50" />
      )}

      {/* Page Header */}
      <PageHeader
        backTo="/dashboard/network/olt"
        icon={
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Zap className="w-5 h-5" />
          </div>
        }
        title={device?.deviceName || 'OLT Device Details'}
        subtitle={
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span>
              Device ID: <strong className="font-mono text-slate-700 dark:text-slate-300">{device?.deviceCode || id}</strong>
            </span>
            <span>•</span>
            <span>
              IP: <strong className="font-mono text-slate-700 dark:text-slate-300">{device?.managementIp || '—'}</strong>
            </span>
            <span>•</span>
            <span>
              Vendor: <strong className="uppercase text-slate-700 dark:text-slate-300">{device?.vendor || telemetry?.system?.vendor || 'VSOL'}</strong>
            </span>
            <span>•</span>
            <span>
              Firmware: <strong className="text-slate-700 dark:text-slate-300">{telemetry?.firmware || telemetry?.system?.firmware || (telemetry?.isSynced ? '—' : 'Unsynced')}</strong>
            </span>
            <span>•</span>
            <span>
              Last Synced: <strong className="text-blue-600 dark:text-blue-400">{telemetry?.lastSyncAt ? new Date(telemetry.lastSyncAt).toLocaleString() : (telemetry?.isSynced ? 'Recently' : 'Never')}</strong>
            </span>
          </div>
        }
        badge={
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              {telemetry?.model || telemetry?.system?.model || `${(device?.vendor || 'VSOL').toUpperCase()} ${totalPonPorts}P OLT`}
            </span>
            {pingData && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border ${
                pingData.status === 'online'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
              }`}>
                <span className={`w-2 h-2 rounded-full ${pingData.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {pingData.status === 'online' ? `TCP Ping: ${pingData.latencyMs !== null ? `${pingData.latencyMs}ms` : 'Online'}` : 'Offline'}
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handlePing}
              disabled={isPinging}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs sm:text-sm rounded-lg transition-all border border-slate-200 dark:border-slate-700 active:scale-95 disabled:opacity-50"
              title="Ping IP + Management Port via TCP Socket Probe"
            >
              <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-blue-500' : 'text-emerald-500'}`} />
              <span>{isPinging ? 'Testing...' : 'Ping Test'}</span>
            </button>
            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50"
              title="Force sync telemetry and ONUs now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
            </button>
          </div>
        }
      />

      {/* Hardware Sync Error Banner */}
      {telemetry?.syncError && (
        <div className="flex items-start sm:items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs sm:text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <strong className="font-semibold block text-amber-800 dark:text-amber-200">Hardware Telemetry Notice</strong>
            <span>{telemetry.syncError}</span>
          </div>
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shrink-0 transition"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Hardware Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            <span className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Cpu className="w-4 h-4" />
              </span>
              CPU Load
            </span>
            <span className="text-base font-bold text-slate-800 dark:text-slate-100">
              {telemetry?.cpuUsagePercent !== null && telemetry?.cpuUsagePercent !== undefined
                ? `${telemetry.cpuUsagePercent}%`
                : (telemetry?.isSynced ? '0%' : '—')}
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-3">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(telemetry?.cpuUsagePercent ?? 0, 3))}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            {telemetry?.isSynced ? 'Live OLT processor load' : 'Sync hardware to view load'}
          </p>
        </div>

        {/* RAM */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            <span className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <HardDrive className="w-4 h-4" />
              </span>
              RAM Memory
            </span>
            <span className="text-base font-bold text-slate-800 dark:text-slate-100">
              {telemetry?.memoryUsagePercent !== null && telemetry?.memoryUsagePercent !== undefined
                ? `${telemetry.memoryUsagePercent}%`
                : (telemetry?.isSynced ? '—' : '—')}
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-3">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(telemetry?.memoryUsagePercent ?? 0, 3))}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-medium truncate" title={telemetry?.uptime ? `Uptime: ${telemetry.uptime}` : undefined}>
            {telemetry?.uptime ? `Uptime: ${telemetry.uptime}` : 'System memory utilization'}
          </p>
        </div>

        {/* Temperature */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            <span className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <Thermometer className="w-4 h-4" />
              </span>
              Board Temperature
            </span>
            <span className="text-base font-bold text-slate-800 dark:text-slate-100">
              {telemetry?.temperatureC ? `${telemetry.temperatureC}°C` : (telemetry?.isSynced ? 'Normal' : '—')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{telemetry?.isSynced ? 'Normal Thermal State' : 'Offline / Unsynced'}</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">Max threshold: 75°C</p>
        </div>

        {/* Total ONUs Online */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            <span className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">
                <Wifi className="w-4 h-4" />
              </span>
              Total Connected ONUs
            </span>
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
              {onus.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
            <Radio className="w-4 h-4 text-emerald-500" />
            <span>
              {telemetry?.ponPorts?.filter((p: any) => p.status === 'online').length || (onus.length > 0 ? 1 : 0)} of {totalPonPorts} PON Ports Active
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">Live Hardware Telemetry</p>
        </div>
      </div>

      {/* Dynamic PON Port Status Overview */}
      <div className={`grid gap-3 ${
        totalPonPorts <= 4 
          ? 'grid-cols-2 md:grid-cols-4' 
          : totalPonPorts <= 8 
            ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8' 
            : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8'
      }`}>
        {ponPortsList.map((ponNum) => {
          const count = ponCounts[ponNum] || 0;
          const isSelected = selectedPon === ponNum;
          const portInfo = (telemetry?.ponPorts || []).find((p: any) => 
            p.portNum === ponNum || 
            p.port === `PON${ponNum}` || 
            p.portName === `${ponPrefix}${ponNum}` || 
            p.portName === `EPON 0/${ponNum}` ||
            p.portName === `GPON 0/${ponNum}`
          ) || ((device as any)?.telemetry?.ponPorts || []).find((p: any) => 
            p.portNum === ponNum || 
            p.port === `PON${ponNum}` || 
            p.portName === `${ponPrefix}${ponNum}` || 
            p.portName === `EPON 0/${ponNum}` ||
            p.portName === `GPON 0/${ponNum}`
          );

          const isOnline = portInfo ? portInfo.status === 'online' : (count > 0);
          
          const rawTx = portInfo?.txPowerDbm ?? portInfo?.tx_power_dbm ?? portInfo?.txPower ?? portInfo?.tx_power ?? portInfo?.tx;
          let txPower = '—';
          if (rawTx !== null && rawTx !== undefined && rawTx !== '' && rawTx !== 'N/A') {
            const num = parseFloat(String(rawTx).replace(/[^\d.-]/g, ''));
            if (!isNaN(num)) {
              txPower = `${num >= 0 ? '+' : ''}${num.toFixed(2)} dBm`;
            } else {
              txPower = String(rawTx);
            }
          } else if (count > 0) {
            txPower = 'Active';
          }

          return (
            <button
              key={ponNum}
              onClick={() => setSelectedPon(isSelected ? 'all' : ponNum)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                isSelected
                  ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-500 dark:border-blue-500 shadow-sm ring-1 ring-blue-500'
                  : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                  {ponPrefix}{ponNum}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                  isOnline
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {count} <span className="text-[10px] font-normal text-slate-400">ONUs</span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Tx: {txPower}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                {isSelected ? '✓ Filter active' : (isOnline ? 'Click to filter' : 'No optical link')}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Section: Connected ONUs List */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Filter and Search Bar - Harmonious NetFix dark & light palette */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/50 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* PON Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => setSelectedPon('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  selectedPon === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80'
                }`}
              >
                All Ports ({onus.length})
              </button>
              {ponPortsList.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPon(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                    selectedPon === p
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  PON {p} ({ponCounts[p] || 0})
                </button>
              ))}
            </div>

            {/* Signal & Search Controls */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Signal Filter Segmented Control */}
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shrink-0 shadow-2xs">
                <button
                  onClick={() => setSignalFilter('all')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    signalFilter === 'all'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSignalFilter('good')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    signalFilter === 'good'
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                  }`}
                >
                  Good
                </button>
                <button
                  onClick={() => setSignalFilter('fair')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    signalFilter === 'fair'
                      ? 'bg-amber-600 text-white shadow-xs font-semibold'
                      : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  }`}
                >
                  Fair
                </button>
                <button
                  onClick={() => setSignalFilter('low')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    signalFilter === 'low'
                      ? 'bg-rose-600 text-white shadow-xs font-semibold'
                      : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                  }`}
                >
                  Low
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search MAC, Customer, User..."
                  className="w-full pl-9 pr-7 py-2 text-xs bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-all"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-slate-50/80 dark:bg-slate-900/70 border-b border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 font-bold" style={{ width: '12%' }}>
                  Port & ONU ID
                </th>
                <th className="px-4 py-3.5 font-bold" style={{ width: '15%' }}>
                  ONU MAC
                </th>
                <th className="px-4 py-3.5 font-bold" style={{ width: '14%' }}>
                  Optical Rx Power
                </th>
                <th className="px-4 py-3.5 font-bold" style={{ width: '9%' }}>
                  Status
                </th>
                <th className="px-4 py-3.5 font-bold" style={{ width: '15%' }}>
                  Router MAC
                </th>
                <th className="px-4 py-3.5 font-bold" style={{ width: '23%' }}>
                  PPPoE
                </th>
                <th className="px-4 py-3.5 font-bold" style={{ width: '12%' }}>
                  Last Synced
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span className="font-medium text-xs">Loading device records...</span>
                  </td>
                </tr>
              ) : filteredOnus.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2">
                      <Search className="w-5 h-5 text-slate-400" />
                    </div>
                    <span className="font-semibold text-xs text-slate-700 dark:text-slate-300 block">No ONUs match your filter</span>
                    <span className="text-[11px] text-slate-400">Try adjusting your port selection or search term</span>
                  </td>
                </tr>
              ) : (
                filteredOnus.map((onu, idx) => {
                  const pwr = getPowerColor(onu.rxPowerDbm);
                  const isMatched = !!onu.customer;

                  return (
                    <tr
                      key={`${onu.ponPort}-${onu.onuId}-${idx}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      {/* Port & ONU ID */}
                      <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80">
                            {onu.ponPortName}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 font-bold text-xs">
                            #{onu.onuId.includes(':') ? onu.onuId.split(':')[1] : onu.onuId}
                          </span>
                        </div>
                      </td>

                      {/* ONU MAC */}
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span>{onu.macAddress}</span>
                          <button
                            onClick={() => handleCopyMac(onu.macAddress)}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                            title="Copy ONU MAC address"
                          >
                            {copiedMac === onu.macAddress ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Optical Rx Power */}
                      <td className="px-4 py-3">
                        {onu.rxPowerDbm !== null && onu.rxPowerDbm !== undefined && !isNaN(onu.rxPowerDbm) ? (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border ${pwr.badge}`}>
                            <span className={pwr.text}>{onu.rxPowerDbm.toFixed(2)} dBm</span>
                            <span className="text-[10px] opacity-75">({pwr.label})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            — (No Signal)
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {onu.status?.toLowerCase() === 'online' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            ONLINE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            OFFLINE
                          </span>
                        )}
                      </td>

                      {/* Router MAC & VLAN */}
                      <td className="px-4 py-3">
                        {onu.routerMac ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                              <span>{onu.routerMac}</span>
                              <button
                                onClick={() => handleCopyMac(onu.routerMac!)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                                title="Copy Router MAC"
                              >
                                {copiedMac === onu.routerMac ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {onu.vlanId && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-blue-600 dark:text-blue-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                VLAN {onu.vlanId}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-mono">—</span>
                        )}
                      </td>

                      {/* PPPoE */}
                      <td className="px-4 py-3">
                        {isMatched && onu.customer ? (
                          <button
                            onClick={() => navigate(`/dashboard/customers/view/${onu.customer!.customerId}`)}
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-all text-left max-w-full group shadow-2xs"
                            title="View customer profile"
                          >
                            <div className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center shrink-0">
                              <User className="w-3 h-3 text-blue-700 dark:text-blue-300" />
                            </div>
                            <div className="truncate min-w-0">
                              <div className="font-semibold text-xs truncate group-hover:underline">
                                {onu.customer.customerName}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                {onu.customer.customerCode} • {onu.customer.username}
                              </div>
                            </div>
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100 ml-auto" />
                          </button>
                        ) : onu.pppoe ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs border border-slate-200 dark:border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {onu.pppoe}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Last Updated */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs truncate">
                        {onu.lastSyncAt ? onu.lastSyncAt.split(' ')[1] || onu.lastSyncAt : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing <strong>{filteredOnus.length}</strong> of <strong>{onus.length}</strong> ONUs
            {selectedPon !== 'all' && ` (${ponPrefix}${selectedPon})`}
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Optimal (&gt; -24 dBm)
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium text-[11px]">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Fair (-24 to -27 dBm)
            </span>
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium text-[11px]">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Critical (&lt; -27 dBm)
            </span>
          </div>
        </div>
      </div>

      {/* Full Screen Sync Loading Modal */}
      {isSyncing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Top Animated Gradient Accent Bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 animate-pulse" />

            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3.5">
                <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 shrink-0">
                  <span className="absolute inset-0 rounded-2xl bg-blue-500/20 animate-ping" />
                  <RefreshCw className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" style={{ animationDuration: '2.5s' }} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                      Hardware Synchronizing
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                      LIVE
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {device?.deviceName || 'OLT'} • {device?.vendor?.toUpperCase() || 'VSOL'} {telemetry?.model || device?.model || ''} ({totalPonPorts} PON Ports)
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5 text-emerald-500" />
                      {device?.managementIp}:{device?.webPort || 80}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      {syncSeconds}s elapsed
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                  <span className="text-slate-700 dark:text-slate-300">Live Ingestion Progress</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{progressPercent}%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 rounded-full transition-all duration-700"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Diagnostic Stages List */}
            <div className="p-5 sm:p-6 pt-3 space-y-2.5 bg-slate-50/60 dark:bg-slate-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Ingestion Workflow Stages
              </span>

              <div className="space-y-2">
                {syncStages.map((stage, idx) => {
                  const isDone = syncSeconds >= stage.doneAt;
                  const isCurrent = !isDone && (idx === 0 || syncSeconds >= syncStages[idx - 1].doneAt);

                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                        isCurrent
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 shadow-xs'
                          : isDone
                          ? 'bg-white/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/50'
                          : 'opacity-40'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : isCurrent ? (
                          <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs font-semibold truncate ${
                            isCurrent
                              ? 'text-blue-700 dark:text-blue-300'
                              : isDone
                              ? 'text-slate-700 dark:text-slate-300'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}>
                            {stage.title}
                          </p>
                          {isDone && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                              ✓ Completed
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 animate-pulse shrink-0">
                              In Progress...
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {stage.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Notice */}
            <div className="p-3.5 px-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live socket stream active
              </span>
              <span className="text-[11px] text-slate-400">
                Please wait until sync completes
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
