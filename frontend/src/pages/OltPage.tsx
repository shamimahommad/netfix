import { useState, useEffect, useRef, memo } from 'react';
import { useToastContext } from '@/contexts/ToastContext';
import { networkService } from '@/services/network.service';
import {
  NetworkDevice,
  CreateOltDevicePayload,
  UpdateNetworkDevicePayload,
} from '@/types/network.types';
import { showDeleteConfirm, showSuccess, showError, showConfirm, showLoading, closeAlert, Swal } from '@/lib/swal';
import { ActionDropdown } from '@/components/ui/ActionDropdown';
import { usePingStatus } from '@/hooks/usePingStatus';
import { usePingStatusStore } from '@/stores/pingStatusStore';
import { PageHeader } from '@/components/common';
import { Lock, ExternalLink, Globe } from 'lucide-react';

const getStatusBadgeClass = (status: NetworkDevice['status']): string => {
  const classes: Record<NetworkDevice['status'], string> = {
    active: 'bg-gradient-to-r from-emerald-400 to-green-500 text-white border-emerald-300 dark:from-emerald-500 dark:to-green-600 dark:border-emerald-400 shadow-sm',
    inactive: 'bg-gradient-to-r from-gray-400 to-slate-500 text-white border-gray-300 dark:from-gray-500 dark:to-slate-600 dark:border-gray-400 shadow-sm',
    maintenance: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-amber-300 dark:from-amber-500 dark:to-yellow-600 dark:border-amber-400 shadow-sm',
    offline: 'bg-gradient-to-r from-red-400 to-rose-500 text-white border-red-300 dark:from-red-500 dark:to-rose-600 dark:border-red-400 shadow-sm',
    decommissioned: 'bg-gradient-to-r from-slate-400 to-gray-500 text-white border-slate-300 dark:from-slate-500 dark:to-gray-600 dark:border-slate-400 shadow-sm',
  };
  return classes[status] || classes.inactive;
};

const getStatusLabel = (status: NetworkDevice['status']): string => {
  const labels: Record<NetworkDevice['status'], string> = {
    active: 'Active',
    inactive: 'Inactive',
    maintenance: 'Maintenance',
    offline: 'Offline',
    decommissioned: 'Decommissioned',
  };
  return labels[status] || status;
};

const PingStatusIndicator = memo(({ deviceId }: { deviceId: string }) => {
  const pingStatus = usePingStatusStore((state) => state.getPingStatus(deviceId));

  if (pingStatus?.pingStatus === 'online') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
        <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
          {pingStatus.latencyMs !== null ? `${pingStatus.latencyMs}ms` : 'Online'}
        </span>
      </div>
    );
  }
  if (pingStatus?.pingStatus === 'auth_failed') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
        <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Auth Failed</span>
      </div>
    );
  }
  if (pingStatus?.pingStatus === 'offline') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500"></div>
        <span className="text-sm text-red-600 dark:text-red-400 font-medium">Offline</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-gray-400"></div>
      <span className="text-sm text-slate-500 dark:text-slate-500">Checking…</span>
    </div>
  );
});
PingStatusIndicator.displayName = 'PingStatusIndicator';

export default function OltPage() {
  const toast = useToastContext();
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<NetworkDevice | null>(null);
  const [openPingMenuId, setOpenPingMenuId] = useState<string | null>(null);
  const pingMenuRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const { setPingStatus } = usePingStatusStore();

  const [formData, setFormData] = useState<CreateOltDevicePayload & {
    vendor?: string;
    ponType?: string;
    totalPonPorts?: number;
    managementPort?: number;
    webPort?: number;
    snmpCommunity?: string;
    snmpPort?: number;
    apiPassword?: string;
  }>({
    deviceCode: '',
    deviceName: '',
    vendor: 'vsol',
    ponType: 'gpon',
    totalPonPorts: 8,
    managementIp: '',
    dnsName: '',
    managementPort: 23,
    webPort: 80,
    snmpCommunity: 'public',
    snmpPort: 161,
    apiUsername: 'admin',
    apiPassword: '',
    isProduction: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadDevices();
  }, []);

  const deviceIds = devices.map((d) => d.networkDeviceId);
  usePingStatus(deviceIds, devices.length > 0);

  const loadDevices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await networkService.getNetworkDevices('olt');
      setDevices(response.data || []);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load OLT devices';
      setError(errorMessage);
      if (devices.length === 0) toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (isEdit = false): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.deviceName.trim()) errors.deviceName = 'Device name is required';
    if (!formData.managementIp.trim()) {
      errors.managementIp = 'Management IP is required';
    } else if (!/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(formData.managementIp)) {
      errors.managementIp = 'Invalid IP address format';
    }
    if (formData.managementPort != null && (formData.managementPort < 1 || formData.managementPort > 65535)) {
      errors.managementPort = 'Port must be between 1 and 65535';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;
    setIsSubmitting(true);
    try {
      await networkService.createOltDevice({
        deviceCode: formData.deviceCode.trim(),
        deviceName: formData.deviceName.trim(),
        vendor: formData.vendor || 'vsol',
        ponType: formData.ponType || 'gpon',
        totalPonPorts: formData.totalPonPorts || 8,
        managementIp: formData.managementIp.trim(),
        dnsName: formData.dnsName?.trim() || undefined,
        managementPort: formData.managementPort ?? 23,
        webPort: formData.webPort ?? 80,
        snmpCommunity: formData.snmpCommunity?.trim() || 'public',
        snmpPort: formData.snmpPort ?? 161,
        apiUsername: formData.apiUsername?.trim() || undefined,
        apiPassword: formData.apiPassword || undefined,
        isProduction: formData.isProduction ?? true,
      });
      await showSuccess('Success!', 'OLT device added successfully.', { timer: 1500 });
      setShowAddModal(false);
      resetForm();
      loadDevices();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to add OLT';
      await showError('Error!', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice || !validateForm(true)) return;
    setIsSubmitting(true);
    try {
      const payload: UpdateNetworkDevicePayload = {
        deviceName: formData.deviceName.trim(),
        vendor: formData.vendor || 'vsol',
        ponType: formData.ponType || 'gpon',
        totalPonPorts: formData.totalPonPorts || 8,
        managementIp: formData.managementIp.trim(),
        dnsName: formData.dnsName?.trim() || undefined,
        managementPort: formData.managementPort ?? 23,
        webPort: formData.webPort ?? 80,
        snmpCommunity: formData.snmpCommunity?.trim() || 'public',
        snmpPort: formData.snmpPort ?? 161,
        apiUsername: formData.apiUsername?.trim() || undefined,
        ...(formData.apiPassword ? { apiPassword: formData.apiPassword } : {}),
        isProduction: formData.isProduction ?? false,
      };
      await networkService.updateNetworkDevice(editingDevice.networkDeviceId, payload);
      await showSuccess('Success!', 'OLT device updated successfully.', { timer: 1500 });
      setShowEditModal(false);
      setEditingDevice(null);
      resetForm();
      loadDevices();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update OLT';
      await showError('Error!', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (device: NetworkDevice) => {
    setEditingDevice(device);
    setFormData({
      deviceCode: device.deviceCode,
      deviceName: device.deviceName,
      vendor: device.vendor || 'vsol',
      ponType: (device.ponType as any) || 'gpon',
      totalPonPorts: device.totalPonPorts || 8,
      managementIp: device.managementIp || '',
      dnsName: device.dnsName || '',
      managementPort: device.managementPort ?? 23,
      webPort: device.webPort ?? 80,
      snmpCommunity: device.snmpCommunity || 'public',
      snmpPort: device.snmpPort ?? 161,
      apiUsername: device.apiUsername || '',
      apiPassword: '',
      isProduction: device.isProduction ?? false,
    });
    setShowEditModal(true);
  };

  const handlePingNow = async (device: NetworkDevice) => {
    setOpenPingMenuId(null);
    showLoading('Checking device...', `Performing health check on ${device.deviceName}...`);
    try {
      const response = await networkService.pingNow(device.networkDeviceId);
      closeAlert();
      if (response.success && response.data) {
        setPingStatus(device.networkDeviceId, {
          deviceId: device.networkDeviceId,
          pingStatus: response.data.status,
          latencyMs: response.data.latencyMs,
          lastCheckedAt: new Date().toISOString(),
        });
        if (response.data.status === 'online') {
          const latency = response.data.latencyMs ? ` (${response.data.latencyMs}ms)` : '';
          toast.success(`Device Online: ${device.deviceName}${latency}`);
        } else if (response.data.status === 'auth_failed') {
          toast.error(`Authentication Failed: ${device.deviceName}`);
        } else {
          toast.error(`Device Offline: ${device.deviceName}`);
        }
      } else {
        toast.error(response.error_message || 'Health check failed');
      }
    } catch (err: any) {
      closeAlert();
      toast.error(err.response?.data?.error_message || err.message || 'Ping failed');
    }
  };

  const handleSetPingInterval = async (device: NetworkDevice) => {
    setOpenPingMenuId(null);
    const { value: interval } = await Swal.fire({
      title: 'Set Ping Interval',
      html: `<p class="text-left text-slate-600 dark:text-slate-400">Enter ping interval in seconds for <strong>${device.deviceName}</strong> (5-300).</p>`,
      input: 'number',
      inputValue: device.customPingInterval?.toString() || '10',
      inputAttributes: { min: '5', max: '300' },
      showCancelButton: true,
      confirmButtonText: 'Set',
      cancelButtonText: 'Cancel',
      inputValidator: (v) => {
        const n = parseInt(v, 10);
        if (!v || isNaN(n) || n < 5 || n > 300) return 'Enter 5-300';
        return null;
      },
    });
    if (interval) {
      showLoading('Updating...', '');
      try {
        await networkService.updatePingInterval(device.networkDeviceId, parseInt(interval, 10));
        closeAlert();
        await showSuccess('Ping Interval Updated', `Set to ${interval} seconds.`);
        loadDevices();
      } catch (err: any) {
        closeAlert();
        await showError('Update Failed', err.response?.data?.message || err.message);
      }
    }
  };

  const handleResetPingInterval = async (device: NetworkDevice) => {
    setOpenPingMenuId(null);
    const result = await showConfirm('Reset Ping Interval', `Reset ping interval for "${device.deviceName}" to default (10s)?`, 'Yes', 'Cancel', '#3b82f6');
    if (result.isConfirmed) {
      showLoading('Resetting...', '');
      try {
        await networkService.updatePingInterval(device.networkDeviceId, null);
        closeAlert();
        await showSuccess('Reset', 'Ping interval reset to default.');
        loadDevices();
      } catch (err: any) {
        closeAlert();
        await showError('Failed', err.response?.data?.message || err.message);
      }
    }
  };

  const handleStatusChange = async (device: NetworkDevice, status: NetworkDevice['status']) => {
    setOpenPingMenuId(null);
    try {
      await networkService.updateDeviceStatus(device.networkDeviceId, { status });
      await showSuccess('Success!', `Status updated to ${getStatusLabel(status)}.`);
      loadDevices();
    } catch (err: any) {
      await showError('Error!', err.response?.data?.message || err.message || 'Failed to update status');
    }
  };

  const handleDisable = async (device: NetworkDevice) => {
    setOpenPingMenuId(null);
    const result = await showConfirm('Disable OLT', `Disable "${device.deviceName}"?`, 'Disable', 'Cancel', '#f59e0b');
    if (result.isConfirmed) {
      try {
        await networkService.updateDeviceStatus(device.networkDeviceId, { status: 'inactive' });
        await showSuccess('Success!', 'OLT disabled.');
        loadDevices();
      } catch (err: any) {
        await showError('Error!', err.response?.data?.message || err.message);
      }
    }
  };

  const handleDeletePermanent = async (device: NetworkDevice) => {
    setOpenPingMenuId(null);
    const deviceId = device.networkDeviceId || (device as any).deviceId || (device as any).device_id || (device as any).id;
    if (!deviceId) {
      toast.error('Device ID is missing');
      return;
    }
    const result = await showDeleteConfirm(device.deviceName, 'Permanently delete this OLT? This cannot be undone.');
    if (result.isConfirmed) {
      try {
        await networkService.deleteNetworkDevice(deviceId);
        await showSuccess('Success!', 'OLT deleted.');
        loadDevices();
      } catch (err: any) {
        await showError('Error!', err.response?.data?.message || err.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      deviceCode: '',
      deviceName: '',
      vendor: 'vsol',
      ponType: 'gpon',
      totalPonPorts: 8,
      managementIp: '',
      dnsName: '',
      managementPort: 23,
      webPort: 80,
      snmpCommunity: 'public',
      snmpPort: 161,
      apiUsername: 'admin',
      apiPassword: '',
      isProduction: true,
    });
    setFormErrors({});
    networkService.getNextDeviceCode().then((res) => {
      if (res?.deviceCode) {
        setFormData((prev) => ({ ...prev, deviceCode: res.deviceCode }));
      }
    }).catch(() => {});
  };

  const inputClass = (field: string) =>
    `w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-teal-500 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-all ${
      formErrors[field] ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
    }`;

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        }
        title="OLT Devices"
        subtitle="Manage Optical Line Terminals, PON ports, and optical network health"
        badge={`${devices.length} Devices`}
        actions={
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-all shadow-sm active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add OLT
          </button>
        }
      />

        {/* Add OLT Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
                    Add OLT Device
                  </h2>
                  <button
                    onClick={() => { setShowAddModal(false); resetForm(); }}
                    className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Device ID</label>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        <Lock className="w-3 h-3" /> System Locked (Unique)
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={formData.deviceCode || ''}
                        className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-800 dark:text-slate-200 font-mono font-bold tracking-wider cursor-not-allowed select-none shadow-inner"
                        placeholder="Auto-generating (e.g. 300001)..."
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">Strictly numeric globally unique device ID (auto-assigned, cannot be edited).</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Device Name <span className="text-red-500">*</span></label>
                    <input type="text" required value={formData.deviceName} onChange={(e) => setFormData((p) => ({ ...p, deviceName: e.target.value }))} className={inputClass('deviceName')} placeholder="e.g., Main OLT (Dhanmondi POP)" />
                    {formErrors.deviceName && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.deviceName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">OLT Brand / Vendor <span className="text-red-500">*</span></label>
                    <select
                      value={formData.vendor || 'vsol'}
                      onChange={(e) => setFormData((p) => ({ ...p, vendor: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="vsol">VSOL (V1600 Series EPON/GPON)</option>
                      <option value="bdcom">BDCOM (P3310, GP3600 Series)</option>
                      <option value="huawei">Huawei (SmartAX MA5608T / MA5800)</option>
                      <option value="zte">ZTE (C300 / C320)</option>
                      <option value="cdata">CDATA (FD1104, FD1208 Series)</option>
                      <option value="syrotech">Syrotech</option>
                      <option value="other">Generic / Other SNMP OLT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">PON Architecture</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={formData.ponType || 'gpon'}
                        onChange={(e) => setFormData((p) => ({ ...p, ponType: e.target.value }))}
                        className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 font-medium text-sm"
                      >
                        <option value="gpon">GPON (2.5G/1.25G)</option>
                        <option value="epon">EPON (1.25G/1.25G)</option>
                        <option value="xgs-pon">XGS-PON (10G)</option>
                      </select>
                      <select
                        value={formData.totalPonPorts || 8}
                        onChange={(e) => setFormData((p) => ({ ...p, totalPonPorts: parseInt(e.target.value) || 8 }))}
                        className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 font-medium text-sm"
                      >
                        <option value={4}>4 PON Ports</option>
                        <option value={8}>8 PON Ports</option>
                        <option value={16}>16 PON Ports</option>
                        <option value={32}>32 PON Ports</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Management IP <span className="text-red-500">*</span></label>
                    <input type="text" required value={formData.managementIp} onChange={(e) => setFormData((p) => ({ ...p, managementIp: e.target.value }))} className={inputClass('managementIp')} placeholder="e.g., 192.168.1.10" />
                    {formErrors.managementIp && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.managementIp}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Web GUI Port</label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={formData.webPort ?? 80}
                      onChange={(e) => setFormData((p) => ({ ...p, webPort: parseInt(e.target.value) || 80 }))}
                      className={inputClass('webPort')}
                      placeholder="80"
                    />
                    <p className="mt-1 text-xs text-slate-500">Default: 80 (or 8080 / 443 for HTTPS)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Telnet / SSH CLI Port</label>
                    <input type="number" min={1} max={65535} value={formData.managementPort ?? 23} onChange={(e) => setFormData((p) => ({ ...p, managementPort: parseInt(e.target.value) || 23 }))} className={inputClass('managementPort')} />
                    {formErrors.managementPort && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.managementPort}</p>}
                    <p className="mt-1 text-xs text-slate-500">Default: 23 (Telnet) or 22 (SSH)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">CLI Username</label>
                    <input type="text" value={formData.apiUsername || ''} onChange={(e) => setFormData((p) => ({ ...p, apiUsername: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100" placeholder="admin" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">CLI Password</label>
                    <input type="password" value={formData.apiPassword || ''} onChange={(e) => setFormData((p) => ({ ...p, apiPassword: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100" placeholder="CLI Password" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">SNMP Community & Port</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={formData.snmpCommunity || 'public'}
                        onChange={(e) => setFormData((p) => ({ ...p, snmpCommunity: e.target.value }))}
                        className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 text-sm"
                        placeholder="public"
                      />
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        value={formData.snmpPort ?? 161}
                        onChange={(e) => setFormData((p) => ({ ...p, snmpPort: parseInt(e.target.value) || 161 }))}
                        className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 text-sm"
                        placeholder="161"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">For optical power & ONU polling (default: public:161)</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Production Device</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Mark as production-ready</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.isProduction || false} onChange={(e) => setFormData((p) => ({ ...p, isProduction: e.target.checked }))} className="sr-only peer" />
                    <div className="w-14 h-7 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-emerald-600 peer-checked:to-teal-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-7"></div>
                  </label>
                </div>
                <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm hover:shadow active:scale-95 disabled:opacity-50 transition-all">
                    {isSubmitting ? 'Adding...' : 'Add OLT'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit OLT Modal */}
        {showEditModal && editingDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
                    Edit OLT Device
                  </h2>
                  <button onClick={() => { setShowEditModal(false); setEditingDevice(null); resetForm(); }} className="p-2 text-slate-500 hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Device Name <span className="text-red-500">*</span></label>
                    <input type="text" required value={formData.deviceName} onChange={(e) => setFormData((p) => ({ ...p, deviceName: e.target.value }))} className={inputClass('deviceName')} />
                    {formErrors.deviceName && <p className="mt-1 text-xs text-red-600">{formErrors.deviceName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">OLT Brand / Vendor <span className="text-red-500">*</span></label>
                    <select
                      value={formData.vendor || 'vsol'}
                      onChange={(e) => setFormData((p) => ({ ...p, vendor: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="vsol">VSOL (V1600 Series EPON/GPON)</option>
                      <option value="bdcom">BDCOM (P3310, GP3600 Series)</option>
                      <option value="huawei">Huawei (SmartAX MA5608T / MA5800)</option>
                      <option value="zte">ZTE (C300 / C320)</option>
                      <option value="cdata">CDATA (FD1104, FD1208 Series)</option>
                      <option value="syrotech">Syrotech</option>
                      <option value="other">Generic / Other SNMP OLT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">PON Architecture</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={formData.ponType || 'gpon'}
                        onChange={(e) => setFormData((p) => ({ ...p, ponType: e.target.value }))}
                        className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 font-medium text-sm"
                      >
                        <option value="gpon">GPON (2.5G/1.25G)</option>
                        <option value="epon">EPON (1.25G/1.25G)</option>
                        <option value="xgs-pon">XGS-PON (10G)</option>
                      </select>
                      <select
                        value={formData.totalPonPorts || 8}
                        onChange={(e) => setFormData((p) => ({ ...p, totalPonPorts: parseInt(e.target.value) || 8 }))}
                        className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 font-medium text-sm"
                      >
                        <option value={4}>4 PON Ports</option>
                        <option value={8}>8 PON Ports</option>
                        <option value={16}>16 PON Ports</option>
                        <option value={32}>32 PON Ports</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Management IP <span className="text-red-500">*</span></label>
                    <input type="text" required value={formData.managementIp} onChange={(e) => setFormData((p) => ({ ...p, managementIp: e.target.value }))} className={inputClass('managementIp')} />
                    {formErrors.managementIp && <p className="mt-1 text-xs text-red-600">{formErrors.managementIp}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Web GUI Port</label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={formData.webPort ?? 80}
                      onChange={(e) => setFormData((p) => ({ ...p, webPort: parseInt(e.target.value) || 80 }))}
                      className={inputClass('webPort')}
                      placeholder="80"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Telnet / SSH CLI Port</label>
                    <input type="number" min={1} max={65535} value={formData.managementPort ?? 23} onChange={(e) => setFormData((p) => ({ ...p, managementPort: parseInt(e.target.value) || 23 }))} className={inputClass('managementPort')} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Username</label>
                    <input type="text" value={formData.apiUsername || ''} onChange={(e) => setFormData((p) => ({ ...p, apiUsername: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Password (leave blank to keep)</label>
                    <input type="password" value={formData.apiPassword || ''} onChange={(e) => setFormData((p) => ({ ...p, apiPassword: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-slate-100" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">SNMP Community & Port</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={formData.snmpCommunity || 'public'}
                        onChange={(e) => setFormData((p) => ({ ...p, snmpCommunity: e.target.value }))}
                        className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 text-sm"
                        placeholder="public"
                      />
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        value={formData.snmpPort ?? 161}
                        onChange={(e) => setFormData((p) => ({ ...p, snmpPort: parseInt(e.target.value) || 161 }))}
                        className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100 text-sm"
                        placeholder="161"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Production Device</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.isProduction || false} onChange={(e) => setFormData((p) => ({ ...p, isProduction: e.target.checked }))} className="sr-only peer" />
                    <div className="w-14 h-7 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-emerald-600 peer-checked:to-teal-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-7"></div>
                  </label>
                </div>
                <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button type="button" onClick={() => { setShowEditModal(false); setEditingDevice(null); resetForm(); }} className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm hover:shadow active:scale-95 disabled:opacity-50 transition-all">{isSubmitting ? 'Updating...' : 'Update OLT'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl p-12">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-lg">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Devices Table - same structure as MikroTik */}
        {!isLoading && !error && devices.length > 0 && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '9%' }}>Device ID</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '15%' }}>Name</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '15%' }}>Brand & PON</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '9%' }}>Status</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '9%' }}>Health</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '15%' }}>Management IP</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '12%' }}>SNMP</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '16%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {devices.map((device) => {
                    const vendorLabel = (device.vendor || 'olt').toUpperCase();
                    const ponInfo = `${(device.ponType || 'gpon').toUpperCase()} (${device.totalPonPorts || 8} Ports)`;
                    const isHttps = device.webPort === 1010 || device.webPort === 443;
                    const webUrl = `${isHttps ? 'https' : 'http'}://${device.managementIp}:${device.webPort || 80}/action/login.html`;

                    return (
                      <tr key={device.networkDeviceId} className="hover:bg-gradient-to-r hover:from-teal-50/50 hover:to-cyan-50/50 dark:hover:from-teal-900/10 dark:hover:to-cyan-900/10 transition-all duration-200">
                        <td className="px-3 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono">{device.deviceCode}</td>
                        <td className="px-3 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{device.deviceName}</td>
                        <td className="px-3 py-4 text-xs">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{vendorLabel}</span>
                          <span className="text-slate-400 dark:text-slate-500 mx-1">•</span>
                          <span className="text-slate-600 dark:text-slate-400 font-mono">{ponInfo}</span>
                        </td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(device.status)}`}>
                            {getStatusLabel(device.status)}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <PingStatusIndicator deviceId={device.networkDeviceId} />
                        </td>
                        <td className="px-3 py-4 text-sm font-mono">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-900 dark:text-slate-100 font-semibold">{device.managementIp || '—'}</span>
                            {device.managementIp && (
                              <a
                                href={webUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:hover:bg-teal-900/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800 transition-colors shadow-2xs"
                                title="Open VSOL Web GUI in new tab"
                              >
                                <ExternalLink className="w-3 h-3" />
                                GUI:{device.webPort || 80}
                              </a>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            CLI: {device.managementPort || 23}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-xs text-slate-600 dark:text-slate-400 font-mono truncate">
                          {device.snmpCommunity || 'public'}:{device.snmpPort || 161}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEdit(device)} className="p-2 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors" title="Edit">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <div className="relative">
                              <button
                                ref={(el) => (pingMenuRefs.current[device.networkDeviceId] = el)}
                                onClick={() => setOpenPingMenuId(openPingMenuId === device.networkDeviceId ? null : device.networkDeviceId)}
                                className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                title="More"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                              </button>
                              <ActionDropdown isOpen={openPingMenuId === device.networkDeviceId} onClose={() => setOpenPingMenuId(null)} triggerButton={pingMenuRefs.current[device.networkDeviceId]}>
                                {device.managementIp && (
                                  <>
                                    <a
                                      href={webUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-full px-3 py-1.5 text-left text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 flex items-center gap-2 font-medium"
                                    >
                                      <ExternalLink className="w-4 h-4" /> Open Web GUI
                                    </a>
                                    <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                                  </>
                                )}
                                <div className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Health Check</div>
                                <button onClick={() => handlePingNow(device)} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-green-500" /> Ping Now
                                </button>
                                <button onClick={() => handleSetPingInterval(device)} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2">
                                  Set Ping Interval {device.customPingInterval && `(${device.customPingInterval}s)`}
                                </button>
                                {device.customPingInterval && (
                                  <button onClick={() => handleResetPingInterval(device)} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20">Reset to Default</button>
                                )}
                                <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                                <div className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</div>
                                {(['active', 'inactive', 'maintenance', 'offline', 'decommissioned'] as const).map((s) => (
                                  <button key={s} onClick={() => { setOpenPingMenuId(null); handleStatusChange(device, s); }} className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700" disabled={device.status === s}>
                                    {getStatusLabel(s)} {device.status === s && '✓'}
                                  </button>
                                ))}
                                <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                                <button onClick={() => handleDisable(device)} disabled={device.status !== 'active'} className="w-full px-3 py-1.5 text-left text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50">Disable</button>
                                <button onClick={() => handleDeletePermanent(device)} className="w-full px-3 py-1.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                              </ActionDropdown>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && devices.length === 0 && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 mb-6">
              <svg className="w-10 h-10 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No OLT devices found</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Add your first OLT device to get started.</p>
            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              <span>Add OLT</span>
            </button>
          </div>
        )}
      </div>
  );
}
