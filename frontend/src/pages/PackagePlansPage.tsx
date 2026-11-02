import { useEffect, useMemo, useState } from 'react';
import {
  Package,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit,
  Trash2,
  Wifi,
  Radio,
  Users,
  ArrowDown,
  ArrowUp,
  X,
  Globe,
  Lock,
} from 'lucide-react';
import { useToastContext } from '@/contexts/ToastContext';
import { networkPackagesService } from '@/services/network-packages.service';
import { networkService } from '@/services/network.service';
import {
  NetworkPackage,
  NetworkProtocol,
  NetworkDevice,
  CreateNetworkPackagePayload,
  UpdateNetworkPackagePayload,
} from '@/types/network.types';
import { showDeleteConfirm, showError, showSuccess } from '@/lib/swal';
import { PageHeader, StatusBadge } from '@/components/common';

const protocolOptions: { label: string; value: NetworkProtocol | '' }[] = [
  { label: 'All Protocols', value: '' },
  { label: 'PPPoE', value: 'pppoe' },
  { label: 'Hotspot', value: 'hotspot' },
  { label: 'Static', value: 'static' },
  { label: 'OVPN', value: 'ovpn' },
  { label: 'PPTP', value: 'pptp' },
];

const PRESET_COLORS = [
  '#2563EB', // Blue
  '#059669', // Emerald
  '#7C3AED', // Violet
  '#D97706', // Amber
  '#DC2626', // Red
  '#0284C7', // Sky
  '#4F46E5', // Indigo
  '#DB2777', // Pink
];

export default function PackagePlansPage() {
  const toast = useToastContext();

  const [packages, setPackages] = useState<NetworkPackage[]>([]);
  const [servers, setServers] = useState<NetworkDevice[]>([]);
  const [filters, setFilters] = useState<{ serverId: string; protocol: NetworkProtocol | ''; search: string }>({
    serverId: '',
    protocol: '',
    search: '',
  });

  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<NetworkPackage | null>(null);

  const [formData, setFormData] = useState<CreateNetworkPackagePayload>({
    serverId: '',
    protocol: 'pppoe',
    name: '',
    code: '',
    color: '#2563EB',
    price: 500,
    download_speed: 10,
    upload_speed: 10,
    validityDays: 30,
    validityHours: 0,
    volumeType: 'unlimited',
    volumeGb: undefined,
    privacy: 'public',
    status: 'enabled',
    mikrotik_profile_id: '',
    mikrotik_profile_name: '',
  });

  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);

  const resetForm = () => {
    setEditing(null);
    setFormData({
      serverId: servers.length > 0 ? servers[0].networkDeviceId : '',
      protocol: 'pppoe',
      name: '',
      code: '',
      color: '#2563EB',
      price: 500,
      download_speed: 10,
      upload_speed: 10,
      validityDays: 30,
      validityHours: 0,
      volumeType: 'unlimited',
      volumeGb: undefined,
      privacy: 'public',
      status: 'enabled',
      mikrotik_profile_id: '',
      mikrotik_profile_name: '',
    });
    setProfiles([]);
    setProfilesError(null);
  };

  const loadServers = async () => {
    try {
      const res = await networkService.getNetworkDevices('mikrotik');
      setServers(res.data || []);
    } catch (err: any) {
      console.warn('Failed to load servers:', err);
    }
  };

  // Fetch MikroTik profiles when server or protocol changes
  const fetchProfiles = async (targetServerId?: string, targetProtocol?: NetworkProtocol) => {
    const proto = targetProtocol || formData.protocol;
    const isProfileProtocol = proto === 'pppoe' || proto === 'hotspot';
    if (!isProfileProtocol) {
      setProfiles([]);
      setProfilesError(null);
      setLoadingProfiles(false);
      return;
    }

    const sid = targetServerId || formData.serverId || (servers.length > 0 ? servers[0].networkDeviceId : '0');

    setLoadingProfiles(true);
    setProfilesError(null);
    try {
      const res = await networkService.getDeviceProfiles(sid, proto);
      const list = res.data || [];
      setProfiles(list);
      if (list.length > 0 && !formData.mikrotik_profile_name) {
        setFormData((prev) => ({
          ...prev,
          mikrotik_profile_id: list[0].id,
          mikrotik_profile_name: list[0].name,
        }));
      }
    } catch (err: any) {
      setProfiles([
        { id: 'default', name: 'default' },
        { id: 'default-encryption', name: 'default-encryption' },
        { id: 'standard', name: 'standard' },
      ]);
    } finally {
      setLoadingProfiles(false);
    }
  };

  useEffect(() => {
    fetchProfiles(formData.serverId, formData.protocol);
  }, [formData.serverId, formData.protocol, servers]);

  const loadPackages = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await networkPackagesService.list({
        page,
        limit: pagination.limit,
        serverId: filters.serverId || undefined,
        protocol: filters.protocol || undefined,
        search: filters.search.trim() || undefined,
      });

      const list = Array.isArray(res.data) ? res.data : [];
      setPackages(list);
      setPagination((prev) => ({
        ...prev,
        page,
        total: res.meta?.total ?? list.length,
      }));
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load packages';
      setError(msg);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    loadPackages(1);
  }, [filters.serverId, filters.protocol]);

  // Quick stats derived from loaded list & pagination
  const stats = useMemo(() => {
    const total = pagination.total;
    const pppoeCount = packages.filter((p) => p.protocol === 'pppoe').length;
    const hotspotCount = packages.filter((p) => p.protocol === 'hotspot').length;
    const totalSubscribers = packages.reduce((acc, p) => acc + (p.count ?? (p as any).activeSubscribers ?? 0), 0);
    return { total, pppoeCount, hotspotCount, totalSubscribers };
  }, [packages, pagination.total]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Please enter a package name');
      return;
    }

    try {
      if (editing) {
        const payload: UpdateNetworkPackagePayload = {
          serverId: formData.serverId || '0',
          protocol: formData.protocol,
          name: formData.name.trim(),
          color: formData.color,
          price: Number(formData.price) || 0,
          download_speed: Number(formData.download_speed) || 10,
          upload_speed: Number(formData.upload_speed) || 10,
          downloadSpeedKbps: (Number(formData.download_speed) || 10) * 1024,
          uploadSpeedKbps: (Number(formData.upload_speed) || 10) * 1024,
          validityDays: Number(formData.validityDays) || 30,
          validityHours: Number(formData.validityHours) || 0,
          volumeType: formData.volumeType,
          volumeGb: formData.volumeType === 'gb' && formData.volumeGb ? Number(formData.volumeGb) : undefined,
          privacy: formData.privacy,
          status: formData.status,
          mikrotik_profile_id: formData.mikrotik_profile_id || formData.mikrotik_profile_name || 'default',
          mikrotik_profile_name: formData.mikrotik_profile_name || 'default',
        };
        await networkPackagesService.update(editing.id, payload);
        toast.success('Package updated successfully');
      } else {
        const payload: CreateNetworkPackagePayload = {
          ...formData,
          serverId: formData.serverId || '0',
          code: formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          price: Number(formData.price) || 0,
          download_speed: Number(formData.download_speed) || 10,
          upload_speed: Number(formData.upload_speed) || 10,
          downloadSpeedKbps: (Number(formData.download_speed) || 10) * 1024,
          uploadSpeedKbps: (Number(formData.upload_speed) || 10) * 1024,
          validityDays: Number(formData.validityDays) || 30,
          validityHours: Number(formData.validityHours) || 0,
          volumeGb: formData.volumeType === 'gb' && formData.volumeGb ? Number(formData.volumeGb) : undefined,
          mikrotik_profile_id: formData.mikrotik_profile_id || formData.mikrotik_profile_name || 'default',
          mikrotik_profile_name: formData.mikrotik_profile_name || 'default',
        };
        await networkPackagesService.create(payload);
        toast.success('Package created successfully');
      }
      setIsModalOpen(false);
      resetForm();
      loadPackages(pagination.page);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save package');
    }
  };

  const handleDelete = async (pkg: NetworkPackage) => {
    const subscriberCount = pkg.count ?? (pkg as any).activeSubscribers ?? 0;
    if (subscriberCount > 0) {
      await showError('Blocked', `This package has ${subscriberCount} assigned active subscriber(s) and cannot be deleted.`);
      return;
    }

    const result = await showDeleteConfirm(pkg.name, 'Are you sure you want to delete this package plan?');
    if (!result.isConfirmed) return;

    try {
      await networkPackagesService.delete(pkg.id);
      await showSuccess('Deleted', 'Package deleted successfully');
      loadPackages(pagination.page);
    } catch (err: any) {
      await showError('Error', err.response?.data?.message || err.message || 'Failed to delete package');
    }
  };

  const openEdit = (pkg: NetworkPackage) => {
    setEditing(pkg);
    const validityDays = pkg.validity?.days ?? (pkg as any).validityDays ?? 30;
    const validityHours = pkg.validity?.hours ?? (pkg as any).validityHours ?? 0;
    const volType = pkg.volume?.type ?? (pkg as any).volumeType ?? (pkg as any).dataVolumeType ?? 'unlimited';
    const volGb = pkg.volume?.gb ?? (pkg as any).volumeGb ?? (pkg as any).dataVolumeGb ?? undefined;
    const dlSpeed = pkg.download_speed ?? ((pkg as any).downloadSpeedKbps ? Math.round((pkg as any).downloadSpeedKbps / 1024) : 10);
    const ulSpeed = pkg.upload_speed ?? ((pkg as any).uploadSpeedKbps ? Math.round((pkg as any).uploadSpeedKbps / 1024) : 10);

    setFormData({
      serverId: pkg.serverId || '',
      protocol: pkg.protocol || 'pppoe',
      name: pkg.name || '',
      code: pkg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      color: pkg.color || (pkg as any).colorHex || '#2563EB',
      price: pkg.price || 0,
      download_speed: dlSpeed,
      upload_speed: ulSpeed,
      validityDays,
      validityHours,
      volumeType: volType,
      volumeGb: volGb,
      privacy: pkg.privacy || 'public',
      status: pkg.status || 'enabled',
      mikrotik_profile_id: pkg.mikrotikProfileId || undefined,
      mikrotik_profile_name: pkg.mikrotikProfileName || (pkg as any).mikrotikProfile || undefined,
    });
    setIsModalOpen(true);
  };

  const renderModal = () => {
    if (!isModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {editing ? 'Edit Package Plan' : 'Add New Package Plan'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure speed limits, billing rates, and MikroTik profile mapping
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
            {/* Section 1: Router & Protocol */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                1. Network & Protocol
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Server / Router
                  </label>
                  <select
                    value={formData.serverId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, serverId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="">Default Gateway / All</option>
                    {servers.map((srv) => (
                      <option key={srv.networkDeviceId} value={srv.networkDeviceId}>
                        {srv.deviceName} ({srv.managementIp || 'MikroTik'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Protocol <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.protocol}
                    onChange={(e) => setFormData((prev) => ({ ...prev, protocol: e.target.value as NetworkProtocol }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    required
                  >
                    <option value="pppoe">PPPoE (Broadband)</option>
                    <option value="hotspot">Hotspot (Card / Voucher)</option>
                    <option value="static">Static IP</option>
                    <option value="ovpn">OpenVPN</option>
                    <option value="pptp">PPTP</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      MikroTik Profile
                    </label>
                    <div className="flex items-center gap-1.5">
                      {loadingProfiles ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-blue-500 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                          Syncing...
                        </span>
                      ) : profiles.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Live ({profiles.length})
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => fetchProfiles()}
                        disabled={loadingProfiles}
                        title="Re-fetch live profiles from MikroTik"
                        className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingProfiles ? 'animate-spin text-blue-500' : ''}`} />
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    {profiles.length > 0 ? (
                      <select
                        value={formData.mikrotik_profile_name || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const selected = profiles.find((p) => p.name === val);
                          setFormData((prev) => {
                            const next = {
                              ...prev,
                              mikrotik_profile_id: selected?.id || val,
                              mikrotik_profile_name: val,
                            };
                            // Auto-suggest speed if profile name contains bandwidth (e.g. 10Mbps, 20Mbps)
                            const speedMatch = val.match(/(\d+)\s*(?:mbps|m)/i);
                            if (speedMatch) {
                              const spd = parseInt(speedMatch[1], 10);
                              if (spd > 0) {
                                if (!prev.name || /^\d+\s*mbps$/i.test(prev.name.trim())) {
                                  next.name = `${spd}Mbps`;
                                }
                                next.download_speed = spd;
                                next.upload_speed = spd;
                              }
                            }
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      >
                        <option value="">Select profile</option>
                        {profiles.map((prof) => (
                          <option key={prof.id} value={prof.name}>
                            {prof.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formData.mikrotik_profile_name || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            mikrotik_profile_name: e.target.value,
                            mikrotik_profile_id: e.target.value,
                          }))
                        }
                        placeholder={loadingProfiles ? 'Loading profiles from router...' : 'e.g. default or 10Mbps'}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    )}
                    {profilesError && (
                      <p className="text-[11px] text-amber-500 mt-1">{profilesError}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Plan Details & Bandwidth */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                2. Plan Information & Bandwidth
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Package Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Premium 30 Mbps Unlimited"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Price (BDT ৳) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.price}
                    onChange={(e) => setFormData((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Download Speed (Mbps)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={formData.download_speed || 10}
                      onChange={(e) => setFormData((prev) => ({ ...prev, download_speed: parseInt(e.target.value) || 1 }))}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                    <ArrowDown className="w-3.5 h-3.5 text-blue-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Upload Speed (Mbps)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={formData.upload_speed || 10}
                      onChange={(e) => setFormData((prev) => ({ ...prev, upload_speed: parseInt(e.target.value) || 1 }))}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                    <ArrowUp className="w-3.5 h-3.5 text-indigo-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Color Tag
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                      className="w-9 h-9 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer"
                    />
                    <div className="flex items-center gap-1">
                      {PRESET_COLORS.slice(0, 4).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, color: c }))}
                          className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-600 transition-transform hover:scale-110"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Billing & Limits */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                3. Validity & Volume Limits
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Validity Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.validityDays}
                    onChange={(e) => setFormData((prev) => ({ ...prev, validityDays: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Validity Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.validityHours}
                    onChange={(e) => setFormData((prev) => ({ ...prev, validityHours: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Volume Type
                  </label>
                  <select
                    value={formData.volumeType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, volumeType: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="unlimited">Unlimited FUP</option>
                    <option value="gb">Data Cap (GB)</option>
                  </select>
                </div>

                {formData.volumeType === 'gb' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Data Cap (GB) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.volumeGb || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, volumeGb: parseInt(e.target.value) || undefined }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Privacy & Portal
                    </label>
                    <select
                      value={formData.privacy}
                      onChange={(e) => setFormData((prev) => ({ ...prev, privacy: e.target.value as any }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    >
                      <option value="public">Public (Visible to Clients)</option>
                      <option value="private">Private (Admin only)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm shadow-sm"
              >
                {editing ? 'Update Plan' : 'Create Plan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Package Plans"
        subtitle="Manage bandwidth profiles, PPPoE tiers, hotspot cards, and billing rates"
        badge={`${pagination.total} Plans`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadPackages(pagination.page)}
              disabled={loading}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              title="Refresh package list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add Package
            </button>
          </div>
        }
      />

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Plans</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Wifi className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">PPPoE Broadband</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.pppoeCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Hotspot Cards</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.hotspotCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Subscribed Users</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.totalSubscribers}</p>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Server / Router
            </label>
            <select
              value={filters.serverId}
              onChange={(e) => setFilters((prev) => ({ ...prev, serverId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="">All Servers</option>
              {servers.map((srv) => (
                <option key={srv.networkDeviceId} value={srv.networkDeviceId}>
                  {srv.deviceName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Protocol
            </label>
            <select
              value={filters.protocol}
              onChange={(e) => setFilters((prev) => ({ ...prev, protocol: e.target.value as NetworkProtocol | '' }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {protocolOptions.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Search Plans
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search plan name or code..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && loadPackages(1)}
                className="w-full pl-9 pr-9 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, search: '' }));
                    loadPackages(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">SL</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Server</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Protocol</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Plan Name</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Bandwidth</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">MikroTik Profile</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Price</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Validity</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Volume</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Users</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Privacy</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="inline-flex items-center gap-2 text-sm">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      Loading package plans...
                    </div>
                  </td>
                </tr>
              ) : packages.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center">
                    <div className="max-w-sm mx-auto text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <Package className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No package plans found</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Create bandwidth packages to start provisioning PPPoE or Hotspot subscribers.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          resetForm();
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Create First Plan
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                packages.map((pkg, idx) => {
                  const subscriberCount = pkg.count ?? (pkg as any).activeSubscribers ?? 0;
                  const color = pkg.color || (pkg as any).colorHex || '#2563EB';
                  const dlSpeed = pkg.download_speed ?? ((pkg as any).downloadSpeedKbps ? Math.round((pkg as any).downloadSpeedKbps / 1024) : 10);
                  const ulSpeed = pkg.upload_speed ?? ((pkg as any).uploadSpeedKbps ? Math.round((pkg as any).uploadSpeedKbps / 1024) : 10);
                  const validityDays = pkg.validity?.days ?? (pkg as any).validityDays ?? 30;
                  const validityHours = pkg.validity?.hours ?? (pkg as any).validityHours ?? 0;
                  const volType = pkg.volume?.type ?? (pkg as any).volumeType ?? (pkg as any).dataVolumeType ?? 'unlimited';
                  const volGb = pkg.volume?.gb ?? (pkg as any).volumeGb ?? (pkg as any).dataVolumeGb;

                  return (
                    <tr
                      key={pkg.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* SL */}
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono">
                        {(pagination.page - 1) * pagination.limit + idx + 1}
                      </td>

                      {/* Server */}
                      <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300 text-xs">
                        {pkg.serverName || 'Main Gateway'}
                      </td>

                      {/* Protocol */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                            pkg.protocol === 'pppoe'
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                              : pkg.protocol === 'hotspot'
                              ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {pkg.protocol}
                        </span>
                      </td>

                      {/* Color & Plan Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-slate-300 dark:border-slate-600 shadow-2xs"
                            style={{ backgroundColor: color }}
                          />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{pkg.name}</p>
                            {(pkg as any).code && (
                              <p className="text-[11px] text-slate-400 font-mono">{(pkg as any).code}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Bandwidth */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono">
                          <span className="text-blue-600 dark:text-blue-400 flex items-center font-semibold">
                            ↓{dlSpeed}M
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">/</span>
                          <span className="text-indigo-600 dark:text-indigo-400 flex items-center font-semibold">
                            ↑{ulSpeed}M
                          </span>
                        </div>
                      </td>

                      {/* MikroTik Profile */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {pkg.mikrotikProfileName || (pkg as any).mikrotikProfile || '—'}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          ৳{pkg.price.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-400 block">/ cycle</span>
                      </td>

                      {/* Validity */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs font-medium">
                        {validityDays > 0 ? `${validityDays} Days` : ''}
                        {validityHours > 0 ? ` ${validityHours}h` : ''}
                        {validityDays === 0 && validityHours === 0 ? 'Unlimited' : ''}
                      </td>

                      {/* Volume */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                        {volType === 'unlimited' ? (
                          <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                            Unlimited
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {volGb || 0} GB
                          </span>
                        )}
                      </td>

                      {/* Subscribers */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {subscriberCount}
                        </span>
                      </td>

                      {/* Privacy */}
                      <td className="py-3 px-4">
                        {pkg.privacy === 'public' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <Globe className="w-3.5 h-3.5" /> Public
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                            <Lock className="w-3.5 h-3.5" /> Private
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge status={pkg.status === 'enabled' ? 'active' : 'suspended'} />
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(pkg)}
                            className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            title="Edit package"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(pkg)}
                            disabled={subscriberCount > 0}
                            className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={
                              subscriberCount > 0
                                ? 'Cannot delete package with active subscribers'
                                : 'Delete package'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && pagination.total > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
            <p>
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-semibold text-slate-700 dark:text-slate-300">{pagination.total}</span> plans
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => loadPackages(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit) || 1}
              </span>
              <button
                type="button"
                onClick={() => loadPackages(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {renderModal()}
    </div>
  );
}
