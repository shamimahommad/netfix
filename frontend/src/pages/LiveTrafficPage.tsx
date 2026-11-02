import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { monitoringService, LiveTrafficData, ActiveInterface } from '@/services/monitoring.service';
import { networkService } from '@/services/network.service';
import { useToastContext } from '@/contexts/ToastContext';
import { useTenantStore } from '@/stores/tenantStore';

interface NetworkDevice {
  networkDeviceId: string;
  deviceName: string;
  deviceCode: string;
}

interface TrafficDataPoint {
  time: string;
  download: number;
  upload: number;
  downloadFormatted: string;
  uploadFormatted: string;
}

export default function LiveTrafficPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToastContext();
  const { selectedTenant } = useTenantStore();

  // State
  const [servers, setServers] = useState<NetworkDevice[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [interfaces, setInterfaces] = useState<ActiveInterface[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>('');
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [trafficData, setTrafficData] = useState<TrafficDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInterfaces, setIsLoadingInterfaces] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDownload, setCurrentDownload] = useState<number>(0);
  const [currentUpload, setCurrentUpload] = useState<number>(0);
  const [routerName, setRouterName] = useState<string>('');

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxDataPoints = 60; // 60 seconds of data (2s interval = 30 points, but we'll keep 60 for smoother chart)

  // Load servers on mount
  useEffect(() => {
    loadServers();
  }, []);

  // Handle URL parameters for auto-selection (from customer profile)
  useEffect(() => {
    const serverId = searchParams.get('serverId') || searchParams.get('router_id');
    const serverName = searchParams.get('serverName');
    const username = searchParams.get('username');
    const interfaceName = searchParams.get('interfaceName');
    const userId = searchParams.get('user_id');

    // If serverName is provided, find matching server by name
    if (serverName && servers.length > 0 && !serverId) {
      const matchingServer = servers.find(
        (s) => s.deviceName?.toLowerCase() === serverName.toLowerCase() || 
               s.deviceCode?.toLowerCase() === serverName.toLowerCase()
      );
      if (matchingServer) {
        setSelectedServerId(matchingServer.networkDeviceId);
      }
    } else if (serverId && servers.length > 0) {
      setSelectedServerId(serverId);
    }

    // Set username if provided
    if (username) {
      setSelectedUsername(username);
    }

    // Set interface if provided
    if (interfaceName) {
      setSelectedInterface(interfaceName);
    }
  }, [searchParams, servers]);

  // Load interfaces when server is selected
  useEffect(() => {
    if (selectedServerId) {
      loadInterfaces(selectedServerId);
      const server = servers.find((s) => s.networkDeviceId === selectedServerId);
      if (server) {
        setRouterName(server.deviceName || server.deviceCode);
      }
    } else {
      setInterfaces([]);
      setSelectedInterface('');
      setSelectedUsername('');
    }
  }, [selectedServerId, servers]);

  // Start/stop polling when selection changes
  useEffect(() => {
    // Clear existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Reset data when selection changes
    setTrafficData([]);
    setCurrentDownload(0);
    setCurrentUpload(0);
    setError(null);

    // Start polling if we have a valid selection
    if (selectedServerId && (selectedInterface || selectedUsername)) {
      startPolling();
    }

    // Cleanup on unmount or selection change
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [selectedServerId, selectedInterface, selectedUsername]);

  const loadServers = async () => {
    try {
      setIsLoading(true);
      const response = await networkService.getNetworkDevices('mikrotik');
      if (response.success && response.data) {
        setServers(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load servers:', err);
      toast.error('Failed to load servers');
    } finally {
      setIsLoading(false);
    }
  };

  const loadInterfaces = async (serverId: string) => {
    try {
      setIsLoadingInterfaces(true);
      const response = await monitoringService.getActiveInterfaces(serverId);
      if (response.success && response.data) {
        setInterfaces(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load interfaces:', err);
      toast.error('Failed to load active interfaces');
      setInterfaces([]);
    } finally {
      setIsLoadingInterfaces(false);
    }
  };

  const fetchTrafficData = async () => {
    if (!selectedServerId || (!selectedInterface && !selectedUsername)) {
      return;
    }

    try {
      const response = await monitoringService.getLiveTraffic(
        selectedServerId,
        selectedUsername || undefined,
        selectedInterface || undefined,
      );

      if (response.success && response.data) {
        const data = response.data;
        // FRONTEND - Fix swapped display
        // Backend sends: download_bps (from tx-byte), upload_bps (from rx-byte)
        // But cards are showing swapped, so we need to swap them here
        // TEMP DEBUG LOG (remove after confirmation)
        console.log('[TRAFFIC MAP] Frontend received:', {
          download_bps: data.download_bps,
          upload_bps: data.upload_bps,
          download_bytes: data.download_bytes,
          upload_bytes: data.upload_bytes,
        });
        // FIX: Swap to match card labels
        // Current Download card should show upload_bps (rx-byte)
        // Current Upload card should show download_bps (tx-byte)
        setCurrentDownload(data.upload_bps); // Download card shows upload_bps
        setCurrentUpload(data.download_bps); // Upload card shows download_bps
        setError(null);

        // Add new data point
        // FIX: Swap for chart to match card labels
        const newPoint: TrafficDataPoint = {
          time: new Date(data.timestamp).toLocaleTimeString(),
          download: data.upload_bps, // Download line shows upload_bps (rx-byte)
          upload: data.download_bps, // Upload line shows download_bps (tx-byte)
          downloadFormatted: formatBandwidth(data.upload_bps),
          uploadFormatted: formatBandwidth(data.download_bps),
        };

        setTrafficData((prev) => {
          const updated = [...prev, newPoint];
          // Keep only last maxDataPoints
          return updated.slice(-maxDataPoints);
        });
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to fetch traffic data';
      if (errorMessage.includes('offline') || errorMessage.includes('not found')) {
        setError('User offline / No active session');
      } else {
        setError(errorMessage);
      }
      // Stop polling on error
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  };

  const startPolling = () => {
    // Fetch immediately
    fetchTrafficData();

    // Then poll every 5 seconds (default interval)
    pollingIntervalRef.current = setInterval(() => {
      fetchTrafficData();
    }, 5000);
  };

  const formatBandwidth = (bps: number): string => {
    if (bps >= 1000000) {
      return `${(bps / 1000000).toFixed(2)} Mbps`;
    } else if (bps >= 1000) {
      return `${(bps / 1000).toFixed(2)} Kbps`;
    }
    return `${bps.toFixed(0)} bps`;
  };

  const handleInterfaceChange = (value: string) => {
    setSelectedInterface(value);
    setSelectedUsername('');
    
    // Extract username if it's a PPPoE interface
    const iface = interfaces.find((i) => i.name === value);
    if (iface && iface.type === 'pppoe' && iface.username) {
      setSelectedUsername(iface.username);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="max-w-[1920px] mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl p-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent mb-2">
            Live Traffic Monitor
          </h1>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Real-time bandwidth monitoring for MikroTik interfaces and users
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Server Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Select Server
              </label>
              <select
                value={selectedServerId}
                onChange={(e) => {
                  setSelectedServerId(e.target.value);
                  setSelectedInterface('');
                  setSelectedUsername('');
                }}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm text-slate-900 dark:text-slate-100 transition-all"
                disabled={isLoading}
              >
                <option value="">-- Select Server --</option>
                {servers.map((server) => (
                  <option key={server.networkDeviceId} value={server.networkDeviceId}>
                    {server.deviceName || server.deviceCode}
                  </option>
                ))}
              </select>
            </div>

            {/* Interface/User Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Select Interface / User
              </label>
              <select
                value={selectedInterface}
                onChange={(e) => handleInterfaceChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm text-slate-900 dark:text-slate-100 transition-all"
                disabled={!selectedServerId || isLoadingInterfaces}
              >
                <option value="">-- Select Interface / User --</option>
                {isLoadingInterfaces ? (
                  <option disabled>Loading interfaces...</option>
                ) : (
                  interfaces.map((iface) => (
                    <option key={iface.name} value={iface.name}>
                      {iface.type === 'pppoe' && iface.username
                        ? `${iface.username} (PPPoE)`
                        : `${iface.name} (${iface.type})`}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Current Stats */}
        {(selectedInterface || selectedUsername) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                Current Download
              </div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {formatBandwidth(currentDownload)}
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4">
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">
                Current Upload
              </div>
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                {formatBandwidth(currentUpload)}
              </div>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-800/50 dark:to-gray-900/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                Router
              </div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                {routerName || '—'}
              </div>
              {selectedUsername && (
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  User: {selectedUsername}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Chart */}
        {!error && (selectedInterface || selectedUsername) && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl p-6">
            {trafficData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative mb-4">
                  <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-transparent border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading traffic data...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={trafficData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    className="dark:stroke-slate-400"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    className="dark:stroke-slate-400"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => formatBandwidth(value)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatBandwidth(value)}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="download"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorDownload)"
                    name="Download"
                  />
                  <Area
                    type="monotone"
                    dataKey="upload"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#colorUpload)"
                    name="Upload"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Empty State */}
        {!selectedServerId && !isLoading && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 mb-6">
              <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No Selection</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Please select a server and interface/user to start monitoring
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
