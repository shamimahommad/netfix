import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { networkPackagesService } from '@/services/network-packages.service';
import { networkService } from '@/services/network.service';
import {
  NetworkPackage,
  NetworkDevice,
  CreateNetworkPackagePayload,
  NetworkProtocol,
} from '@/types/network.types';
import { showConfirm, showError } from '@/lib/swal';
import { useToastContext } from '@/contexts/ToastContext';

function ArrowLeftIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function ServerIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

function PackageIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function TransferArrowIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}

/** Animated transfer indicator: horizontal arrow with moving dots */
function AnimatedTransferIndicator() {
  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-violet-950/30 border border-blue-100 dark:border-indigo-800/50">
      <div className="flex items-center gap-0.5">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-[transferDot_1.2s_ease-in-out_infinite]" />
        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-[transferDot_1.2s_ease-in-out_0.15s_infinite]" />
        <span className="w-2 h-2 rounded-full bg-violet-500 animate-[transferDot_1.2s_ease-in-out_0.3s_infinite]" />
        <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-[transferDot_1.2s_ease-in-out_0.45s_infinite]" />
      </div>
      <TransferArrowIcon className="w-7 h-7 text-indigo-500 mx-2 drop-shadow-sm" />
      <div className="flex items-center gap-0.5">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-[transferDot_1.2s_ease-in-out_0.6s_infinite]" />
        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-[transferDot_1.2s_ease-in-out_0.75s_infinite]" />
        <span className="w-2 h-2 rounded-full bg-violet-500 animate-[transferDot_1.2s_ease-in-out_0.9s_infinite]" />
        <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-[transferDot_1.2s_ease-in-out_1.05s_infinite]" />
      </div>
      <style>{`
        @keyframes transferDot {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

function getStatusBadge(device: NetworkDevice) {
  const isOnline = device.status === 'active';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        isOnline
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 shadow-sm'
          : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      {isOnline ? 'Online' : device.status === 'offline' ? 'Offline' : device.status}
    </span>
  );
}

function formatValidity(days: number, hours: number): string {
  if (days > 0 && (hours ?? 0) > 0) return `${days}d ${hours}h`;
  if (days > 0) return `${days}d`;
  if ((hours ?? 0) > 0) return `${hours}h`;
  return '0d';
}

type RowState = { selected: boolean; newName: string; routerProfile: string };

const PROTOCOL_OPTIONS: { label: string; value: NetworkProtocol | '' }[] = [
  { label: 'All protocols', value: '' },
  { label: 'PPPoE', value: 'pppoe' },
  { label: 'Hotspot', value: 'hotspot' },
  { label: 'Static', value: 'static' },
  { label: 'OVPN', value: 'ovpn' },
  { label: 'PPTP', value: 'pptp' },
];

export default function PackageCopyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToastContext();
  const sourceDevice = (location.state as { sourceDevice?: NetworkDevice })?.sourceDevice;

  const [packages, setPackages] = useState<NetworkPackage[]>([]);
  const [servers, setServers] = useState<NetworkDevice[]>([]);
  const [targetServerId, setTargetServerId] = useState<string>('');
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<NetworkProtocol | ''>('');

  useEffect(() => {
    if (!sourceDevice) {
      setError('No source server selected. Go back and click Copy Packages on a server.');
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [packRes, devRes] = await Promise.all([
          networkPackagesService.list({ serverId: sourceDevice.networkDeviceId, limit: 500 }),
          networkService.getNetworkDevices('mikrotik'),
        ]);
        setPackages(packRes.data || []);
        const others = (devRes.data || []).filter((d) => d.networkDeviceId !== sourceDevice.networkDeviceId);
        setServers(others);
        if (others.length > 0) setTargetServerId((prev) => (prev ? prev : others[0].networkDeviceId));

        const initial: Record<string, RowState> = {};
        (packRes.data || []).forEach((p) => {
          initial[p.id] = {
            selected: false,
            newName: p.name,
            routerProfile: p.mikrotikProfileName || p.name || '',
          };
        });
        setRowStates(initial);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [sourceDevice?.networkDeviceId]);

  const filteredPackages = useMemo(() => {
    let list = packages;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (protocolFilter) list = list.filter((p) => p.protocol === protocolFilter);
    return list;
  }, [packages, search, protocolFilter]);

  const toggleAll = (checked: boolean) => {
    setRowStates((prev) => {
      const next = { ...prev };
      filteredPackages.forEach((p) => {
        if (next[p.id]) next[p.id] = { ...next[p.id], selected: checked };
      });
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setRowStates((prev) => ({ ...prev, [id]: { ...prev[id], selected: checked } }));
  };

  const setNewName = (id: string, value: string) => {
    setRowStates((prev) => ({ ...prev, [id]: { ...prev[id], newName: value } }));
  };

  const setRouterProfile = (id: string, value: string) => {
    setRowStates((prev) => ({ ...prev, [id]: { ...prev[id], routerProfile: value } }));
  };

  const selectedIds = packages.filter((p) => rowStates[p.id]?.selected).map((p) => p.id);
  const allFilteredSelected =
    filteredPackages.length > 0 &&
    filteredPackages.every((p) => rowStates[p.id]?.selected);
  const targetServer = servers.find((s) => s.networkDeviceId === targetServerId);

  const handleTransferClick = () => {
    if (!targetServerId || selectedIds.length === 0) {
      showError('Error', 'Select destination server and at least one package.');
      return;
    }
    showConfirm(
      'Confirm Package Transfer',
      'Are you sure you want to copy the selected packages to the destination server?',
      'Confirm Transfer',
      'Cancel',
      '#4f46e5'
    ).then(async (result) => {
      if (!result.isConfirmed) return;
      await doTransfer();
    });
  };

  const doTransfer = async () => {
    if (!targetServerId || selectedIds.length === 0) return;
    setTransferring(true);
    try {
      let successCount = 0;
      for (const id of selectedIds) {
        const pkg = packages.find((p) => p.id === id);
        if (!pkg) continue;
        const state = rowStates[id];
        const payload: CreateNetworkPackagePayload = {
          serverId: targetServerId,
          protocol: pkg.protocol,
          name: (state?.newName || pkg.name).trim() || pkg.name,
          code: (state?.newName || pkg.name).toLowerCase().replace(/\s+/g, '-'),
          color: pkg.color,
          price: pkg.price,
          validityDays: pkg.validity.days,
          validityHours: pkg.validity.hours ?? 0,
          volumeType: pkg.volume.type,
          volumeGb: pkg.volume.type === 'gb' ? (pkg.volume.gb ?? 0) : undefined,
          privacy: pkg.privacy,
          status: pkg.status,
          mikrotik_profile_name: (state?.routerProfile || pkg.mikrotikProfileName || '').trim() || undefined,
        };
        await networkPackagesService.create(payload);
        successCount++;
      }
      toast.success('Package transfer completed successfully.');
      navigate('/dashboard/network/mikrotik');
    } catch (err: any) {
      showError('Transfer failed', err.response?.data?.message || err.message || 'Failed to transfer packages.');
    } finally {
      setTransferring(false);
    }
  };

  if (!sourceDevice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 p-6 flex items-center justify-center">
        <div className="max-w-md w-full text-center bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-slate-700 p-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40 text-violet-600 dark:text-violet-400 mb-4">
            <PackageIcon className="w-8 h-8" />
          </div>
          <p className="text-gray-700 dark:text-slate-300 mb-6">{error || 'No source server.'}</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard/network/mikrotik')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeftIcon /> Back to MikroTik
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20">
      {/* Page header */}
      <header className="border-b border-gray-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800/90 backdrop-blur-sm shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/network/mikrotik')}
                className="p-2 rounded-xl text-gray-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 transition-colors"
                aria-label="Back"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white items-center justify-center shadow-lg shadow-blue-500/25">
                  <PackageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-indigo-800 dark:from-white dark:to-indigo-200 bg-clip-text text-transparent">Package Transfer</h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                    Copy internet packages from one router to another server.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!loading && (
                <>
                  {selectedIds.length > 0 && (
                    <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg">
                      {selectedIds.length} Selected
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleTransferClick}
                    disabled={selectedIds.length === 0 || transferring}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-[1.02] focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
                  >
                    {transferring ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Transferring...
                      </>
                    ) : (
                      `Transfer ${selectedIds.length} Package${selectedIds.length !== 1 ? 's' : ''}`
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Two-column: Source | Arrow | Destination */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 lg:gap-6 mb-6 items-stretch">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-gray-200 dark:border-slate-700 p-6 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 via-cyan-400 to-teal-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3">Source Server</p>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-500/20 dark:to-cyan-500/20 flex items-center justify-center ring-2 ring-blue-200/50 dark:ring-blue-500/20">
                <ServerIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 dark:text-white truncate">{sourceDevice.deviceName}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Server ID · {sourceDevice.deviceCode}</p>
                <div className="mt-2">{getStatusBadge(sourceDevice)}</div>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-center flex-shrink-0">
            <AnimatedTransferIndicator />
          </div>
          <div className="lg:hidden flex justify-center py-2">
            <AnimatedTransferIndicator />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-gray-200 dark:border-slate-700 p-6 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 via-teal-400 to-cyan-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">Destination Server</p>
            {servers.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">No other servers available.</p>
            ) : (
              <>
                <select
                  value={targetServerId}
                  onChange={(e) => setTargetServerId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white px-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select server</option>
                  {servers.map((s) => (
                    <option key={s.networkDeviceId} value={s.networkDeviceId}>
                      {s.deviceName} · {s.deviceCode}
                    </option>
                  ))}
                </select>
                {targetServer && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-slate-400">Server ID · {targetServer.deviceCode}</span>
                    {getStatusBadge(targetServer)}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-gray-200 dark:border-slate-700 p-12 text-center">
            <div className="inline-block w-10 h-10 border-2 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-500 dark:text-slate-400">Loading packages...</p>
          </div>
        ) : packages.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-gray-200 dark:border-slate-700 p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/40 dark:to-fuchsia-900/40 text-violet-500 dark:text-violet-400 mb-4">
              <PackageIcon className="w-10 h-10" />
            </div>
            <p className="font-semibold text-gray-800 dark:text-slate-200">No packages available on this server.</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Add packages on the source server first.</p>
          </div>
        ) : (
          <>
            {/* Packages card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-gray-200 dark:border-slate-700 p-6 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-4 border-b border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30">
                    <PackageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 dark:text-white">Available Packages</h2>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-violet-100 to-fuchsia-100 dark:from-violet-500/20 dark:to-fuchsia-500/20 text-violet-700 dark:text-violet-300 mt-1">
                      {filteredPackages.length} Package{filteredPackages.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    placeholder="Search packages..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 w-full sm:w-48"
                  />
                  <select
                    value={protocolFilter}
                    onChange={(e) => setProtocolFilter(e.target.value as NetworkProtocol | '')}
                    className="h-9 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 px-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 w-full sm:w-36"
                  >
                    {PROTOCOL_OPTIONS.map((opt) => (
                      <option key={opt.value || 'all'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Select All + count */}
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-200 dark:border-slate-700">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Select All</span>
                </label>
                {selectedIds.length > 0 && (
                  <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-lg">{selectedIds.length} Selected</span>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-slate-800/80 dark:to-slate-800/50">
                      <th className="text-left py-3.5 pr-2 w-10"><span className="sr-only">Select</span></th>
                      <th className="text-left py-3.5 px-2 font-semibold text-gray-600 dark:text-slate-400">Current Name</th>
                      <th className="text-left py-3.5 px-2 font-semibold text-gray-600 dark:text-slate-400">New Name</th>
                      <th className="text-left py-3.5 px-2 font-semibold text-gray-600 dark:text-slate-400">Router Profile</th>
                      <th className="text-left py-3.5 px-2 font-semibold text-gray-600 dark:text-slate-400">Protocol</th>
                      <th className="text-right py-3.5 px-2 font-semibold text-gray-600 dark:text-slate-400">Price</th>
                      <th className="text-left py-3.5 px-2 font-semibold text-gray-600 dark:text-slate-400">Validity</th>
                      <th className="text-left py-3.5 pl-2 font-semibold text-gray-600 dark:text-slate-400">Data Limit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                    {filteredPackages.map((pkg) => {
                      const state = rowStates[pkg.id] ?? {
                        selected: false,
                        newName: pkg.name,
                        routerProfile: pkg.mikrotikProfileName || pkg.name || '',
                      };
                      const protocolClass =
                        pkg.protocol === 'pppoe'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                          : pkg.protocol === 'hotspot'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                            : pkg.protocol === 'static'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                              : pkg.protocol === 'ovpn'
                                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300';
                      return (
                        <tr
                          key={pkg.id}
                          className={`transition-colors ${
                            state.selected
                              ? 'bg-indigo-50/80 dark:bg-indigo-500/10'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'
                          }`}
                        >
                          <td className="py-3 pr-2">
                            <input
                              type="checkbox"
                              checked={state.selected}
                              onChange={(e) => toggleOne(pkg.id, e.target.checked)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-2 font-medium text-gray-900 dark:text-white">{pkg.name}</td>
                          <td className="py-3 px-2">
                            <input
                              type="text"
                              value={state.newName}
                              onChange={(e) => setNewName(pkg.id, e.target.value)}
                              className="h-9 w-full min-w-[120px] rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="text"
                              value={state.routerProfile}
                              onChange={(e) => setRouterProfile(pkg.id, e.target.value)}
                              className="h-9 w-full min-w-[100px] rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${protocolClass}`}>
                              {pkg.protocol}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            ৳{pkg.price}
                          </td>
                          <td className="py-3 px-2 text-gray-500 dark:text-slate-400 tabular-nums">
                            {formatValidity(pkg.validity.days, pkg.validity.hours ?? 0)}
                          </td>
                          <td className="py-3 pl-2">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                                pkg.volume.type === 'unlimited'
                                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                              }`}
                            >
                              {pkg.volume.type === 'unlimited' ? 'Unlimited' : `${pkg.volume.gb ?? 0} GB`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/network/mikrotik')}
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransferClick}
                disabled={selectedIds.length === 0 || transferring}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-[1.02] focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
              >
                {transferring ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Transferring...
                  </>
                ) : (
                  `Transfer ${selectedIds.length} Package${selectedIds.length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
