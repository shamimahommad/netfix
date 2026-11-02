import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, ChevronLeft, ChevronRight, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { useToastContext } from '@/contexts/ToastContext';
import { networkPackagesService } from '@/services/network-packages.service';
import { networkService } from '@/services/network.service';
import {
  NetworkPackage,
  NetworkProtocol,
  NetworkPackageStatus,
  NetworkPackagePrivacy,
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

const privacyLabel = (privacy: NetworkPackagePrivacy) => (privacy === 'public' ? 'Public' : 'Private');

export default function PackagePlansPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [packages, setPackages] = useState<NetworkPackage[]>([]);
  const [servers, setServers] = useState<NetworkDevice[]>([]);
  const [filters, setFilters] = useState<{ serverId?: string; protocol?: NetworkProtocol | ''; search?: string }>({
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
    price: 0,
    validityDays: 0,
    validityHours: 0,
    volumeType: 'unlimited',
    volumeGb: undefined,
    privacy: 'public',
    status: 'enabled',
    mikrotik_profile_id: undefined,
    mikrotik_profile_name: undefined,
  });

  const resetForm = () => {
    setEditing(null);
    setFormData({
      serverId: '',
      protocol: 'pppoe',
      name: '',
      code: '',
      color: '#2563EB',
      price: 0,
      validityDays: 0,
      validityHours: 0,
      volumeType: 'unlimited',
      volumeGb: undefined,
      privacy: 'public',
      status: 'enabled',
      mikrotik_profile_id: undefined,
      mikrotik_profile_name: undefined,
    });
  };

  const loadServers = async () => {
    try {
      const res = await networkService.getNetworkDevices('mikrotik');
      setServers(res.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to load servers');
    }
  };

  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);

  useEffect(() => {
    const shouldFetch = (formData.protocol === 'pppoe' || formData.protocol === 'hotspot') && formData.serverId;
    if (!shouldFetch) {
      setProfiles([]);
      setProfilesError(null);
      setLoadingProfiles(false);
      setFormData((prev) => ({
        ...prev,
        mikrotik_profile_id: undefined,
        mikrotik_profile_name: undefined,
      }));
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingProfiles(true);
      setProfilesError(null);
      try {
        const res = await networkService.getDeviceProfiles(formData.serverId, formData.protocol);
        if (!cancelled) {
          setProfiles(res.data || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setProfilesError(err.response?.data?.message || err.message || 'Failed to fetch profiles from MikroTik');
          setProfiles([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingProfiles(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formData.serverId, formData.protocol]);

  const loadPackages = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await networkPackagesService.list({
        page,
        limit: pagination.limit,
        serverId: filters.serverId || undefined,
        protocol: filters.protocol || undefined,
        search: filters.search || undefined,
      });
      setPackages(res.data || []);
      setPagination((prev) => ({ ...prev, page, total: res.meta?.total || 0 }));
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load packages');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isProfileRequired = formData.protocol === 'pppoe' || formData.protocol === 'hotspot';
    if (isProfileRequired && !formData.mikrotik_profile_id) {
      toast.error('MikroTik profile is required for PPPoE and Hotspot packages');
      return;
    }

    try {
      if (editing) {
        const payload: UpdateNetworkPackagePayload = {
          serverId: formData.serverId,
          protocol: formData.protocol,
          name: formData.name,
          color: formData.color,
          price: Number(formData.price),
          validityDays: Number(formData.validityDays),
          validityHours: Number(formData.validityHours),
          volumeType: formData.volumeType,
          volumeGb: formData.volumeGb ? Number(formData.volumeGb) : undefined,
          privacy: formData.privacy,
          status: formData.status,
          mikrotik_profile_id: formData.mikrotik_profile_id,
          mikrotik_profile_name: formData.mikrotik_profile_name,
        };
        await networkPackagesService.update(editing.id, payload);
        toast.success('Package updated successfully');
      } else {
        const payload: CreateNetworkPackagePayload = {
          ...formData,
          code: formData.name.toLowerCase().replace(/\s+/g, '-'),
          price: Number(formData.price),
          validityDays: Number(formData.validityDays),
          validityHours: Number(formData.validityHours),
          volumeGb: formData.volumeGb ? Number(formData.volumeGb) : undefined,
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
    const result = await showDeleteConfirm(pkg.name, pkg.count > 0 ? 'Package is in use and cannot be deleted.' : 'Delete this package?');
    if (!result.isConfirmed) return;

    if (pkg.count > 0) {
      await showError('Blocked', 'This package has assigned users and cannot be deleted.');
      return;
    }

    try {
      await networkPackagesService.delete(pkg.id);
      await showSuccess('Deleted', 'Package deleted successfully');
      loadPackages();
    } catch (err: any) {
      await showError('Error', err.response?.data?.message || err.message || 'Failed to delete package');
    }
  };

  const openEdit = (pkg: NetworkPackage) => {
    setEditing(pkg);
    setFormData({
      serverId: pkg.serverId,
      protocol: pkg.protocol,
      name: pkg.name,
      code: pkg.name.toLowerCase().replace(/\s+/g, '-'),
      color: pkg.color,
      price: pkg.price,
      validityDays: pkg.validity.days,
      validityHours: pkg.validity.hours,
      volumeType: pkg.volume.type,
      volumeGb: pkg.volume.gb ?? undefined,
      privacy: pkg.privacy,
      status: pkg.status,
      mikrotik_profile_id: pkg.mikrotikProfileId || undefined,
      mikrotik_profile_name: pkg.mikrotikProfileName || undefined,
    });
    setIsModalOpen(true);
  };

  const renderModal = () => {
    if (!isModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {editing ? 'Edit Package Plan' : 'Add New Package Plan'}
            </h2>
            <button
              onClick={() => { setIsModalOpen(false); resetForm(); }}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Server / Router</label>
                <select
                  value={formData.serverId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, serverId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  required
                >
                  <option value="">Select server</option>
                  {servers.map((srv) => (
                    <option key={srv.networkDeviceId} value={srv.networkDeviceId}>
                      {srv.deviceName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Protocol</label>
                <select
                  value={formData.protocol}
                  onChange={(e) => setFormData((prev) => ({ ...prev, protocol: e.target.value as NetworkProtocol }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  required
                >
                  <option value="pppoe">PPPoE</option>
                  <option value="hotspot">Hotspot</option>
                  <option value="static">Static</option>
                  <option value="ovpn">OVPN</option>
                  <option value="pptp">PPTP</option>
                </select>
              </div>

              {(formData.protocol === 'pppoe' || formData.protocol === 'hotspot') && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    MikroTik Profile <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.mikrotik_profile_id || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const profile = profiles.find((p) => p.id === selectedId);
                      setFormData((prev) => ({
                        ...prev,
                        mikrotik_profile_id: selectedId,
                        mikrotik_profile_name: profile?.name || '',
                      }));
                    }}
                    disabled={loadingProfiles || !formData.serverId}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none disabled:opacity-50"
                    required
                  >
                    <option value="">
                      {loadingProfiles
                        ? 'Fetching profiles from MikroTik...'
                        : !formData.serverId
                          ? 'Select a server first'
                          : profiles.length === 0
                            ? 'No profiles found'
                            : 'Select a profile'}
                    </option>
                    {profiles.map((prof) => (
                      <option key={prof.id} value={prof.id}>
                        {prof.name}
                      </option>
                    ))}
                  </select>
                  {profilesError && (
                    <p className="mt-1 text-xs text-rose-500">{profilesError}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Package Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Standard 20 Mbps"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Price (BDT)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Validity Days</label>
                <input
                  type="number"
                  min="0"
                  value={formData.validityDays}
                  onChange={(e) => setFormData((prev) => ({ ...prev, validityDays: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Validity Hours</label>
                <input
                  type="number"
                  min="0"
                  value={formData.validityHours}
                  onChange={(e) => setFormData((prev) => ({ ...prev, validityHours: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Volume Type</label>
                <select
                  value={formData.volumeType}
                  onChange={(e) => setFormData((prev) => ({ ...prev, volumeType: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  <option value="unlimited">Unlimited</option>
                  <option value="limited">Limited</option>
                </select>
              </div>

              {formData.volumeType === 'limited' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Volume (GB)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.volumeGb || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, volumeGb: parseInt(e.target.value) || undefined }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Color Tag</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                  className="w-full h-10 px-1 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); resetForm(); }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm shadow-sm"
              >
                {editing ? 'Update Plan' : 'Create Plan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const rows = useMemo(() => packages, [packages]);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Package Plans"
        subtitle="Manage bandwidth profiles, PPPoE tiers, hotspot cards, and billing rates"
        badge={`${pagination.total} Plans`}
        actions={
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Package
          </button>
        }
      />

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Server</label>
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
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Protocol</label>
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
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search plan name..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && loadPackages(1)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
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
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50">
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">SL</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Server</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Protocol</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Color</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Name</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">MikroTik Profile</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Price</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Validity</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Volume</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Subscribers</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Privacy</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Actions</th>
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
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                    No package plans found. Create your first plan to get started.
                  </td>
                </tr>
              ) : (
                rows.map((pkg, idx) => (
                  <tr
                    key={pkg.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {(pagination.page - 1) * pagination.limit + idx + 1}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{pkg.serverName}</td>
                    <td className="py-3 px-4 text-xs uppercase font-mono text-slate-600 dark:text-slate-400">{pkg.protocol}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600" style={{ background: pkg.color }} />
                        <span className="text-xs text-slate-500 font-mono">{pkg.color}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{pkg.name}</td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-mono text-xs">
                      {pkg.mikrotikProfileName || '—'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      ৳{pkg.price.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      {pkg.validity.days}d {pkg.validity.hours}h
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      {pkg.volume.type === 'unlimited' ? 'Unlimited' : `${pkg.volume.gb ?? 0} GB`}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">{pkg.count}</td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">{privacyLabel(pkg.privacy)}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={pkg.status === 'enabled' ? 'active' : 'suspended'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(pkg)}
                          className="p-1 rounded text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                          title="Edit package"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(pkg)}
                          disabled={pkg.count > 0}
                          className="p-1 rounded text-rose-600 hover:text-rose-800 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title={pkg.count > 0 ? 'Package has active subscribers' : 'Delete package'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && pagination.total > 0 && (
          <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-3">
            <p>
              Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{pagination.total}</span> plans
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => loadPackages(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
              </span>
              <button
                type="button"
                onClick={() => loadPackages(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
