import { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Lock, Zap, Radio, Key, RefreshCw, X, CheckCircle2, AlertTriangle } from 'lucide-react';

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

const getCachedOltDevices = (): NetworkDevice[] => {
  try {
    const raw = localStorage.getItem('netfix_olt_devices_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
};

export default function OltPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const initialCached = getCachedOltDevices();
  const [devices, setDevices] = useState<NetworkDevice[]>(initialCached);
  const [isLoading, setIsLoading] = useState(initialCached.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  // Pre-flight Connection & Login Testing States
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [isTestingLogin, setIsTestingLogin] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: 'ping' | 'login';
    success: boolean;
    message: string;
    latencyMs?: number | null;
  } | null>(null);

  const handleTestPing = async (targetForm: typeof formData) => {
    if (!targetForm.managementIp) {
      toast.error('Please enter Management IP address first');
      return;
    }
    setIsTestingPing(true);
    setTestResult(null);
    try {
      const res = await networkService.testDeviceConnection({
        testType: 'ping',
        deviceType: 'olt',
        vendor: targetForm.vendor || 'vsol',
        managementIp: targetForm.managementIp,
        managementPort: targetForm.managementPort,
        webPort: targetForm.webPort,
      });
      setTestResult({
        type: 'ping',
        success: res.success,
        message: res.message,
        latencyMs: res.latencyMs,
      });
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message || 'Ping failed');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Ping test failed';
      setTestResult({ type: 'ping', success: false, message: msg });
      toast.error(msg);
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleTestLogin = async (targetForm: typeof formData) => {
    if (!targetForm.managementIp) {
      toast.error('Please enter Management IP address first');
      return;
    }
    if (!targetForm.apiUsername) {
      toast.error('Please enter CLI/API Username first');
      return;
    }
    setIsTestingLogin(true);
    setTestResult(null);
    try {
      const res = await networkService.testDeviceConnection({
        testType: 'login',
        deviceType: 'olt',
        vendor: targetForm.vendor || 'vsol',
        managementIp: targetForm.managementIp,
        managementPort: targetForm.managementPort,
        webPort: targetForm.webPort,
        apiUsername: targetForm.apiUsername,
        apiPassword: targetForm.apiPassword,
      });
      setTestResult({
        type: 'login',
        success: res.success,
        message: res.message,
      });
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message || 'Login test failed');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login test failed';
      setTestResult({ type: 'login', success: false, message: msg });
      toast.error(msg);
    } finally {
      setIsTestingLogin(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const deviceIds = devices.map((d) => d.networkDeviceId);
  usePingStatus(deviceIds, devices.length > 0);

  const loadDevices = async () => {
    if (devices.length === 0) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      const response = await networkService.getNetworkDevices('olt');
      const list = response.data || [];
      setDevices(list);
      try {
        localStorage.setItem('netfix_olt_devices_cache', JSON.stringify(list));
      } catch {}
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load OLT devices';
      setError(errorMessage);
      if (devices.length === 0) toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const validateForm = (_isEdit = false): boolean => {
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
          const target = (response.data as any)?.target ? ` [${(response.data as any).target}]` : '';
          toast.success(`OLT Online${target}: ${device.deviceName}${latency} via TCP socket probe`);
        } else if (response.data.status === 'auth_failed') {
          toast.error(`Authentication Failed: ${device.deviceName}`);
        } else {
          toast.error(`OLT Offline: Device did not respond on management port (${device.managementIp}:${device.webPort || device.managementPort || 80})`);
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
    setTestResult(null);
    setIsTestingPing(false);
    setIsTestingLogin(false);
    networkService.getNextDeviceCode().then((res) => {
      if (res?.deviceCode) {
        setFormData((prev) => ({ ...prev, deviceCode: res.deviceCode }));
      }
    }).catch(() => {});
  };

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
        badge={
          <span className="inline-flex items-center gap-1.5">
            <span>{devices.length} Devices</span>
            {isRefreshing && (
              <span className="inline-flex items-center gap-1 text-[11px] font-normal text-blue-500 animate-pulse">
                • Syncing...
              </span>
            )}
          </span>
        }
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      Add OLT Device
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/40 text-teal-600 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                        Optical Line Terminal
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Configure OLT hardware, vendor protocol and ports</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleAddSubmit} className="p-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Device ID */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Device ID (System Locked)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={formData.deviceCode || ''}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-xs font-bold tracking-wider cursor-not-allowed select-none"
                        placeholder="Auto-generating..."
                      />
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Device Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Device Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.deviceName}
                      onChange={(e) => setFormData((p) => ({ ...p, deviceName: e.target.value }))}
                      className={`w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100 transition-all ${
                        formErrors.deviceName ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="e.g., Main OLT (Gulshan POP)"
                    />
                    {formErrors.deviceName && <p className="mt-0.5 text-[11px] text-red-500">{formErrors.deviceName}</p>}
                  </div>
                </div>

                {/* Vendor & PON Architecture Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      OLT Brand / Vendor <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.vendor || 'vsol'}
                      onChange={(e) => setFormData((p) => ({ ...p, vendor: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="vsol">VSOL (V1600 Series EPON/GPON)</option>
                      <option value="bdcom">BDCOM (P3310, GP3600 Series)</option>
                      <option value="btpon">BTPON / TBS (PTF Series)</option>
                      <option value="focuscom">Focuscom (EP5800 Series)</option>
                      <option value="huawei">Huawei (MA5608T / MA5800)</option>
                      <option value="zte">ZTE (C300 / C320)</option>
                      <option value="cdata">CDATA (FD1104, FD1208)</option>
                      <option value="syrotech">Syrotech</option>
                      <option value="other">Generic / Other OLT</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      PON Type
                    </label>
                    <select
                      value={formData.ponType || 'epon'}
                      onChange={(e) => setFormData((p) => ({ ...p, ponType: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="epon">EPON (1.25G)</option>
                      <option value="gpon">GPON (2.5G/1.25G)</option>
                      <option value="xgs-pon">XGS-PON (10G)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      PON Ports
                    </label>
                    <select
                      value={formData.totalPonPorts || 8}
                      onChange={(e) => setFormData((p) => ({ ...p, totalPonPorts: parseInt(e.target.value) || 8 }))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value={4}>4 PON Ports</option>
                      <option value={8}>8 PON Ports</option>
                      <option value={16}>16 PON Ports</option>
                      <option value={32}>32 PON Ports</option>
                    </select>
                  </div>
                </div>

                {/* Network & Ports 3-column Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Management IP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.managementIp}
                      onChange={(e) => setFormData((p) => ({ ...p, managementIp: e.target.value }))}
                      className={`w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100 transition-all ${
                        formErrors.managementIp ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="e.g., 192.168.1.10"
                    />
                    {formErrors.managementIp && <p className="mt-0.5 text-[11px] text-red-500">{formErrors.managementIp}</p>}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Web API Port
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={formData.webPort ?? 80}
                      onChange={(e) => setFormData((p) => ({ ...p, webPort: parseInt(e.target.value) || 80 }))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100"
                      placeholder="80 (or 1010/2322)"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Telnet / CLI Port {formData.vendor === 'bdcom' && <span className="text-emerald-500 font-bold">(BDCOM)</span>}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={formData.managementPort ?? 23}
                      onChange={(e) => setFormData((p) => ({ ...p, managementPort: parseInt(e.target.value) || 23 }))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100"
                      placeholder="23 (or 1081)"
                    />
                  </div>
                </div>

                {/* Credentials */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      CLI / API Username
                    </label>
                    <input
                      type="text"
                      value={formData.apiUsername || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, apiUsername: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100"
                      placeholder="admin"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      CLI / API Password
                    </label>
                    <input
                      type="password"
                      value={formData.apiPassword || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, apiPassword: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100"
                      placeholder="Enter password"
                    />
                  </div>
                </div>

                {/* Pre-flight Testing & Verification Section */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Pre-flight OLT Verification:
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestPing(formData)}
                        disabled={isTestingPing || isTestingLogin || !formData.managementIp}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isTestingPing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                        <span>{isTestingPing ? 'Pinging...' : 'PING Test'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTestLogin(formData)}
                        disabled={isTestingPing || isTestingLogin || !formData.managementIp || !formData.apiUsername}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-teal-200 dark:border-teal-800 bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isTestingLogin ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                        <span>{isTestingLogin ? 'Checking...' : 'Login Test'}</span>
                      </button>
                    </div>
                  </div>

                  {testResult && (
                    <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between border ${
                      testResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        )}
                        <span>{testResult.message}</span>
                      </div>
                      {testResult.latencyMs !== undefined && testResult.latencyMs !== null && (
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-white/70 dark:bg-slate-900/70">
                          {testResult.latencyMs} ms
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline SNMP & Production Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">SNMP: {formData.snmpCommunity || 'public'}:{formData.snmpPort ?? 161}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Production Device</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formData.isProduction || false} onChange={(e) => setFormData((p) => ({ ...p, isProduction: e.target.checked }))} className="sr-only peer" />
                      <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-teal-600"></div>
                    </label>
                  </div>
                </div>

                {/* Form Actions Footer */}
                <div className="flex items-center justify-end gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); resetForm(); }}
                    className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Adding...' : 'Add OLT'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit OLT Modal */}
        {showEditModal && editingDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Edit OLT Device
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Update OLT configuration and credentials</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingDevice(null); resetForm(); }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="p-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Device Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.deviceName}
                      onChange={(e) => setFormData((p) => ({ ...p, deviceName: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100"
                    />
                    {formErrors.deviceName && <p className="mt-0.5 text-[11px] text-red-500">{formErrors.deviceName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Management IP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.managementIp}
                      onChange={(e) => setFormData((p) => ({ ...p, managementIp: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100"
                    />
                    {formErrors.managementIp && <p className="mt-0.5 text-[11px] text-red-500">{formErrors.managementIp}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      OLT Vendor
                    </label>
                    <select
                      value={formData.vendor || 'vsol'}
                      onChange={(e) => setFormData((p) => ({ ...p, vendor: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100"
                    >
                      <option value="vsol">VSOL</option>
                      <option value="bdcom">BDCOM</option>
                      <option value="btpon">BTPON / TBS</option>
                      <option value="focuscom">Focuscom</option>
                      <option value="huawei">Huawei</option>
                      <option value="zte">ZTE</option>
                      <option value="cdata">CDATA</option>
                      <option value="syrotech">Syrotech</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Web Port
                    </label>
                    <input
                      type="number"
                      value={formData.webPort ?? 80}
                      onChange={(e) => setFormData((p) => ({ ...p, webPort: parseInt(e.target.value) || 80 }))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Telnet / CLI Port
                    </label>
                    <input
                      type="number"
                      value={formData.managementPort ?? 23}
                      onChange={(e) => setFormData((p) => ({ ...p, managementPort: parseInt(e.target.value) || 23 }))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      CLI / API Username
                    </label>
                    <input
                      type="text"
                      value={formData.apiUsername || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, apiUsername: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Password (leave blank to keep current)
                    </label>
                    <input
                      type="password"
                      value={formData.apiPassword || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, apiPassword: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-slate-100"
                      placeholder="Leave blank to keep current"
                    />
                  </div>
                </div>

                {/* Pre-flight Testing & Verification Section */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Connection Verification:
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestPing(formData)}
                        disabled={isTestingPing || isTestingLogin || !formData.managementIp}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isTestingPing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                        <span>{isTestingPing ? 'Pinging...' : 'PING Test'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTestLogin(formData)}
                        disabled={isTestingPing || isTestingLogin || !formData.managementIp || !formData.apiUsername}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-teal-200 dark:border-teal-800 bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isTestingLogin ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                        <span>{isTestingLogin ? 'Checking...' : 'Login Test'}</span>
                      </button>
                    </div>
                  </div>

                  {testResult && (
                    <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between border ${
                      testResult.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        )}
                        <span>{testResult.message}</span>
                      </div>
                      {testResult.latencyMs !== undefined && testResult.latencyMs !== null && (
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-white/70 dark:bg-slate-900/70">
                          {testResult.latencyMs} ms
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline Production Row */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Mark as Production Device</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.isProduction || false} onChange={(e) => setFormData((p) => ({ ...p, isProduction: e.target.checked }))} className="sr-only peer" />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                {/* Form Actions Footer */}
                <div className="flex items-center justify-end gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setEditingDevice(null); resetForm(); }}
                    className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Updating...' : 'Update OLT'}
                  </button>
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

                    return (
                      <tr key={device.networkDeviceId} className="hover:bg-gradient-to-r hover:from-teal-50/50 hover:to-cyan-50/50 dark:hover:from-teal-900/10 dark:hover:to-cyan-900/10 transition-all duration-200">
                        <td className="px-3 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono">
                          {device.deviceCode || `#${device.networkDeviceId}`}
                        </td>
                        <td className="px-3 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          <button
                            onClick={() => navigate(`/dashboard/network/olt/${device.networkDeviceId}`)}
                            className="hover:text-blue-600 dark:hover:text-blue-400 font-bold transition-colors text-left truncate block max-w-full"
                            title="Click to view full OLT details & connected ONUs"
                          >
                            {device.deviceName}
                          </button>
                        </td>
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
                          <span className="text-slate-900 dark:text-slate-100 font-semibold">{device.managementIp || '—'}</span>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Web: {device.webPort || 80} | CLI: {device.managementPort || 23}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-xs text-slate-600 dark:text-slate-400 font-mono truncate">
                          {device.snmpCommunity || 'public'}:{device.snmpPort || 161}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => navigate(`/dashboard/network/olt/${device.networkDeviceId}`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95"
                              title="View connected ONUs & system telemetry"
                            >
                              <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>ONUs</span>
                            </button>
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
                                <button
                                  onClick={() => {
                                    setOpenPingMenuId(null);
                                    navigate(`/dashboard/network/olt/${device.networkDeviceId}`);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 font-medium"
                                >
                                  <Zap className="w-4 h-4" /> View ONUs & Telemetry
                                </button>
                                <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
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
