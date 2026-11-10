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
  Download,
  AlertCircle,
  CheckCircle2,
  CheckCheck,
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
import { PageHeader, StatusBadge, ModernCheckbox } from '@/components/common';

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

interface ScannedMikrotikProfile {
  id: string;
  name: string;
  rate_limit?: string;
  download_speed: number;
  upload_speed: number;
  is_existing: boolean;
  suggested_price: number;
  price: number;
  selected: boolean;
  is_default?: boolean;
}

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

  // Manual Add / Edit Modal State
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

  // Import from MikroTik Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importServerId, setImportServerId] = useState<string>('');
  const [importProtocol, setImportProtocol] = useState<NetworkProtocol>('pppoe');
  const [isScanningMikrotik, setIsScanningMikrotik] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scannedProfiles, setScannedProfiles] = useState<ScannedMikrotikProfile[]>([]);
  const [importSearch, setImportSearch] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

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

  // Fetch MikroTik profiles when server or protocol changes (for manual form)
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
    if (isModalOpen) {
      fetchProfiles(formData.serverId, formData.protocol);
    }
  }, [isModalOpen, formData.serverId, formData.protocol]);

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

  // Submit manual create / edit form
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

  // ---------------------------------------------------------------------------
  // Import from MikroTik Handlers
  // ---------------------------------------------------------------------------
  const handleOpenImportModal = () => {
    const defaultServerId = filters.serverId || (servers.length > 0 ? servers[0].networkDeviceId : '');
    setImportServerId(defaultServerId);
    setImportProtocol(filters.protocol && filters.protocol !== '' ? filters.protocol : 'pppoe');
    setIsImportModalOpen(true);
    setImportError(null);
    if (defaultServerId) {
      handleScanMikrotik(defaultServerId, filters.protocol && filters.protocol !== '' ? filters.protocol : 'pppoe');
    }
  };

  const handleScanMikrotik = async (targetServerId?: string, targetProtocol?: NetworkProtocol) => {
    const sId = targetServerId || importServerId;
    const proto = targetProtocol || importProtocol;
    if (!sId) {
      toast.warning('Please select a MikroTik router');
      return;
    }

    setIsScanningMikrotik(true);
    setImportError(null);
    try {
      const res = await networkPackagesService.mikrotikPreview({
        serverId: sId,
        protocol: proto,
      });

      if (res.success && Array.isArray(res.data)) {
        const mapped = res.data.map((item) => ({
          ...item,
          price: item.suggested_price || 500,
          selected: !item.is_existing && !item.is_default,
        }));
        setScannedProfiles(mapped);
        if (mapped.length === 0) {
          toast.info('No profiles found on this MikroTik router for selected protocol');
        }
      } else {
        setImportError('Failed to scan profiles from MikroTik');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error connecting to MikroTik router';
      setImportError(msg);
      toast.error(msg);
      setScannedProfiles([]);
    } finally {
      setIsScanningMikrotik(false);
    }
  };

  const filteredScannedProfiles = useMemo(() => {
    if (!importSearch.trim()) return scannedProfiles;
    const q = importSearch.toLowerCase().trim();
    return scannedProfiles.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.rate_limit && p.rate_limit.toLowerCase().includes(q))
    );
  }, [scannedProfiles, importSearch]);

  const isAllImportSelected = useMemo(() => {
    if (filteredScannedProfiles.length === 0) return false;
    return filteredScannedProfiles.every((p) => p.selected);
  }, [filteredScannedProfiles]);

  const isSomeImportSelected = useMemo(() => {
    if (filteredScannedProfiles.length === 0) return false;
    const some = filteredScannedProfiles.some((p) => p.selected);
    return some && !isAllImportSelected;
  }, [filteredScannedProfiles, isAllImportSelected]);

  const selectedImportCount = useMemo(() => {
    return scannedProfiles.filter((p) => p.selected).length;
  }, [scannedProfiles]);

  const handleToggleSelectAllImport = (checked: boolean) => {
    setScannedProfiles((prev) =>
      prev.map((item) => ({
        ...item,
        selected: checked,
      }))
    );
  };

  const handleToggleSelectProfile = (id: string) => {
    setScannedProfiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleUpdateProfileSpeed = (
    id: string,
    field: 'download_speed' | 'upload_speed' | 'price',
    value: number
  ) => {
    setScannedProfiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleExecuteImport = async () => {
    const selected = scannedProfiles.filter((p) => p.selected);
    if (selected.length === 0) {
      toast.warning('Please select at least one package to import');
      return;
    }

    setIsImporting(true);
    try {
      const payload = {
        serverId: importServerId,
        protocol: importProtocol,
        packages: selected.map((p) => ({
          name: p.name,
          mikrotik_profile_name: p.name,
          download_speed: p.download_speed,
          upload_speed: p.upload_speed,
          price: p.price,
          validityDays: 30,
          volumeType: 'unlimited',
        })),
      };

      const res = await networkPackagesService.mikrotikImport(payload);
      if (res.success) {
        toast.success(res.message || `Successfully imported ${selected.length} package(s)!`);
        setIsImportModalOpen(false);
        setScannedProfiles([]);
        loadPackages(1);
      } else {
        toast.error(res.message || 'Failed to import packages');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to import packages';
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  };

  // Render manual Add / Edit Package Modal
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
                  Configure speed limits, billing rates, and MikroTik profile mapping manually
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
                        {profiles.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
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
                            mikrotik_profile_id: e.target.value,
                            mikrotik_profile_name: e.target.value,
                          }))
                        }
                        placeholder="e.g. 10Mbps or default"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: General & Bandwidth */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                2. Plan Name & Bandwidth
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Plan Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Bronze 10 Mbps"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Price (Monthly / Rate) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">৳</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.price}
                      onChange={(e) => setFormData((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="enabled">Active / Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Download Speed (Mbps)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={formData.download_speed}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, download_speed: parseInt(e.target.value) || 1 }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-blue-600 dark:text-blue-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                      Mbps
                    </span>
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
                      value={formData.upload_speed}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, upload_speed: parseInt(e.target.value) || 1 }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold text-indigo-600 dark:text-indigo-400"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                      Mbps
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Privacy Scope
                  </label>
                  <select
                    value={formData.privacy}
                    onChange={(e) => setFormData((prev) => ({ ...prev, privacy: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="public">Public (All Customers / Agents)</option>
                    <option value="private">Private (Admin only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Badge Color
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
                ) : null}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm font-medium"
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

  // Render Import from MikroTik Modal
  const renderImportModal = () => {
    if (!isImportModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shadow-xs">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Import Packages from MikroTik</span>
                  <span className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Live Router Sync
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Scan bandwidth profiles from your MikroTik router and import as NetFix billing plans
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls Bar: Router, Protocol & Scan Button */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Select MikroTik Router:
                </label>
                <select
                  value={importServerId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setImportServerId(sid);
                    handleScanMikrotik(sid, importProtocol);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {servers.map((s) => (
                    <option key={s.networkDeviceId} value={s.networkDeviceId}>
                      {s.deviceName} ({s.managementIp})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Target Protocol:
                </label>
                <select
                  value={importProtocol}
                  onChange={(e) => {
                    const proto = e.target.value as NetworkProtocol;
                    setImportProtocol(proto);
                    handleScanMikrotik(importServerId, proto);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="pppoe">PPPoE (Broadband Profiles)</option>
                  <option value="hotspot">Hotspot (User Profiles)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleScanMikrotik()}
                disabled={isScanningMikrotik}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningMikrotik ? 'animate-spin text-emerald-600' : ''}`} />
                <span>Re-Scan Profiles</span>
              </button>
            </div>
          </div>

          {/* Body: Profile List Table */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {isScanningMikrotik ? (
              <div className="p-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Querying MikroTik Router via RouterOS API...
                </p>
                <p className="text-xs text-slate-400">
                  Fetching bandwidth rate limits and profile configs
                </p>
              </div>
            ) : importError ? (
              <div className="p-8 text-center space-y-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl">
                <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{importError}</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Please verify that the router is reachable and API service is running on port 8728 (or Web API).
                </p>
                <button
                  type="button"
                  onClick={() => handleScanMikrotik()}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Retry Scan
                </button>
              </div>
            ) : scannedProfiles.length === 0 ? (
              <div className="p-16 text-center text-slate-400 space-y-2">
                <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No profiles found</p>
                <p className="text-xs text-slate-400">
                  Click 'Re-Scan Profiles' or check your MikroTik PPP / Hotspot configuration.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Search Bar for Scanned Profiles */}
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={importSearch}
                      onChange={(e) => setImportSearch(e.target.value)}
                      placeholder="Filter scanned profiles..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Found <strong>{filteredScannedProfiles.length}</strong> profile(s) on MikroTik
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px] select-none">
                        <tr>
                          <th className="py-2.5 px-3.5" style={{ width: '40px' }}>
                            <ModernCheckbox
                              checked={isAllImportSelected}
                              indeterminate={isSomeImportSelected}
                              onChange={(checked) => handleToggleSelectAllImport(checked)}
                              title="Select all profiles"
                            />
                          </th>
                          <th className="py-2.5 px-3.5">MIKROTIK PROFILE</th>
                          <th className="py-2.5 px-3.5">RATE LIMIT</th>
                          <th className="py-2.5 px-3.5 text-center">DOWNLOAD (MBPS)</th>
                          <th className="py-2.5 px-3.5 text-center">UPLOAD (MBPS)</th>
                          <th className="py-2.5 px-3.5 text-center">PRICE (৳)</th>
                          <th className="py-2.5 px-3.5 text-right">NETFIX STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 font-medium">
                        {filteredScannedProfiles.map((p) => (
                          <tr
                            key={p.id}
                            className={`transition-colors ${
                              p.selected ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-2.5 px-3.5">
                              <ModernCheckbox
                                checked={p.selected}
                                onChange={() => handleToggleSelectProfile(p.id)}
                                title="Select this profile for import"
                              />
                            </td>

                            <td className="py-2.5 px-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                  {p.name}
                                </span>
                                {p.is_default && (
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.2 rounded font-semibold">
                                    Default
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-xs text-slate-500 dark:text-slate-400">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                {p.rate_limit || 'None'}
                              </span>
                            </td>

                            <td className="py-2.5 px-3.5 text-center">
                              <input
                                type="number"
                                min="1"
                                value={p.download_speed}
                                onChange={(e) =>
                                  handleUpdateProfileSpeed(p.id, 'download_speed', parseInt(e.target.value) || 1)
                                }
                                className="w-16 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-center text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>

                            <td className="py-2.5 px-3.5 text-center">
                              <input
                                type="number"
                                min="1"
                                value={p.upload_speed}
                                onChange={(e) =>
                                  handleUpdateProfileSpeed(p.id, 'upload_speed', parseInt(e.target.value) || 1)
                                }
                                className="w-16 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-center text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>

                            <td className="py-2.5 px-3.5 text-center">
                              <div className="inline-flex items-center gap-1">
                                <span className="text-xs text-slate-400">৳</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={p.price}
                                  onChange={(e) =>
                                    handleUpdateProfileSpeed(p.id, 'price', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-20 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-center text-emerald-600 dark:text-emerald-400 outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                            </td>

                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                              {p.is_existing ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  Already in NetFix
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Ready to Import
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <strong className="text-slate-900 dark:text-slate-100 font-bold">{selectedImportCount}</strong> of{' '}
              {scannedProfiles.length} profile(s) selected for import
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={selectedImportCount === 0 || isImporting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing Packages...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Import Selected Packages ({selectedImportCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
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
          <div className="flex items-center gap-2 flex-wrap">
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
              onClick={handleOpenImportModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Scan and import bandwidth profiles directly from MikroTik"
            >
              <Download className="w-4 h-4" /> Import from MikroTik
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors active:scale-95 cursor-pointer"
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
              <option value="">All Servers & Gateways</option>
              {servers.map((srv) => (
                <option key={srv.networkDeviceId} value={srv.networkDeviceId}>
                  {srv.deviceName} ({srv.managementIp || 'MikroTik'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Protocol Filter
            </label>
            <select
              value={filters.protocol}
              onChange={(e) => setFilters((prev) => ({ ...prev, protocol: e.target.value as NetworkProtocol | '' }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {protocolOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
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
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && loadPackages(1)}
                placeholder="Search plan name, code..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px] sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Plan Name & Code</th>
                <th className="py-3 px-4">Router / Server</th>
                <th className="py-3 px-4">Protocol</th>
                <th className="py-3 px-4">Speed (DL / UL)</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Validity</th>
                <th className="py-3 px-4">Subscribers</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>Loading package plans...</span>
                  </td>
                </tr>
              ) : packages.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No package plans found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Create a new package manually or import profiles directly from your MikroTik router.
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button
                        type="button"
                        onClick={handleOpenImportModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Import from MikroTik
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetForm();
                          setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Package
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                packages.map((pkg) => {
                  const subscriberCount = pkg.count ?? (pkg as any).activeSubscribers ?? 0;
                  const dlSpeed =
                    pkg.download_speed ??
                    ((pkg as any).downloadSpeedKbps ? Math.round((pkg as any).downloadSpeedKbps / 1024) : 10);
                  const ulSpeed =
                    pkg.upload_speed ??
                    ((pkg as any).uploadSpeedKbps ? Math.round((pkg as any).uploadSpeedKbps / 1024) : 10);
                  const validityDays = pkg.validity?.days ?? (pkg as any).validityDays ?? 30;

                  return (
                    <tr
                      key={pkg.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: pkg.color || '#2563EB' }}
                          />
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100">{pkg.name}</p>
                            <p className="text-xs font-mono text-slate-400">{pkg.code || (pkg as any).profileCode}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                        {pkg.serverName || 'Default Router'}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {pkg.protocol || 'pppoe'}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span className="text-blue-600 dark:text-blue-400 flex items-center">
                            <ArrowDown className="w-3 h-3 mr-0.5" />
                            {dlSpeed}M
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">/</span>
                          <span className="text-indigo-600 dark:text-indigo-400 flex items-center">
                            <ArrowUp className="w-3 h-3 mr-0.5" />
                            {ulSpeed}M
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900 dark:text-slate-100">
                        ৳{Number(pkg.price || 0).toLocaleString()}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                        {validityDays} Days
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {subscriberCount}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={pkg.status === 'enabled' ? 'active' : 'suspended'} />
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(pkg)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Package"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(pkg)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Delete Package"
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
      {renderImportModal()}
    </div>
  );
}
