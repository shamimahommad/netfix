import { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastContext } from '@/contexts/ToastContext';
import { networkService } from '@/services/network.service';
import { NetworkDevice, CreateNetworkDevicePayload, UpdateNetworkDevicePayload, MikroTikAction } from '@/types/network.types';
import { showDeleteConfirm, showSuccess, showError, showConfirm, showLoading, showProgressBar, closeAlert, Swal } from '@/lib/swal';
import { ActionDropdown } from '@/components/ui/ActionDropdown';
import { usePingStatus } from '@/hooks/usePingStatus';
import { usePingStatusStore } from '@/stores/pingStatusStore';
import { PageHeader } from '@/components/common';

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

// Memoized Ping Status Component
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

export default function MikroTikPage() {
  const navigate = useNavigate();
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
  const [formData, setFormData] = useState<CreateNetworkDevicePayload>({
    deviceCode: '',
    deviceName: '',
    managementIp: '',
    dnsName: '',
    managementPort: 8728,
    winboxPort: 8291,
    webPort: 80,
    apiUsername: '',
    apiPassword: '',
    vendor: 'mikrotik',
    deviceType: 'router',
    isProduction: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadDevices();
  }, []);

  // Use ping status hook for real-time updates (doesn't reload device list)
  const deviceIds = devices.map((d) => d.networkDeviceId);
  usePingStatus(deviceIds, devices.length > 0);


  const loadDevices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await networkService.getNetworkDevices('mikrotik');
      setDevices(response.data || []);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load MikroTik devices';
      setError(errorMessage);
      // Only show error on initial load, not on background refreshes
      if (devices.length === 0) {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (isEdit = false): boolean => {
    const errors: Record<string, string> = {};

    if (!isEdit && !formData.deviceCode.trim()) {
      errors.deviceCode = 'Device code is required';
    }

    if (!formData.deviceName.trim()) {
      errors.deviceName = 'Device name is required';
    }

    if (!formData.managementIp.trim()) {
      errors.managementIp = 'Management IP is required';
    } else if (!/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(formData.managementIp)) {
      errors.managementIp = 'Invalid IP address format';
    }

    if (formData.managementPort && (formData.managementPort < 1 || formData.managementPort > 65535)) {
      errors.managementPort = 'Port must be between 1 and 65535';
    }

    if (formData.winboxPort && (formData.winboxPort < 1 || formData.winboxPort > 65535)) {
      errors.winboxPort = 'Winbox port must be between 1 and 65535';
    }

    if (formData.webPort && (formData.webPort < 1 || formData.webPort > 65535)) {
      errors.webPort = 'Web port must be between 1 and 65535';
    }

    if (!formData.apiUsername.trim()) {
      errors.apiUsername = 'API username is required';
    }

    if (!isEdit && !formData.apiPassword.trim()) {
      errors.apiPassword = 'API password is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm(false)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateNetworkDevicePayload = {
        ...formData,
        deviceType: 'router',
        vendor: 'mikrotik',
      };
      await networkService.createNetworkDevice(payload);
      await showSuccess('Success!', 'MikroTik server added successfully.', { timer: 1500 });
      setShowAddModal(false);
      resetForm();
      loadDevices();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to add server';
      await showError('Error!', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingDevice || !validateForm(true)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: UpdateNetworkDevicePayload = {
        deviceName: formData.deviceName,
        managementIp: formData.managementIp,
        dnsName: formData.dnsName,
        managementPort: formData.managementPort,
        winboxPort: formData.winboxPort,
        webPort: formData.webPort,
        apiUsername: formData.apiUsername,
        ...(formData.apiPassword && { apiPassword: formData.apiPassword }),
        isProduction: formData.isProduction,
      };
      await networkService.updateNetworkDevice(editingDevice.networkDeviceId, payload);
      await showSuccess('Success!', 'MikroTik server updated successfully.', { timer: 1500 });
      setShowEditModal(false);
      setEditingDevice(null);
      resetForm();
      loadDevices();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update server';
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
      managementIp: device.managementIp || '',
      dnsName: device.dnsName || '',
      managementPort: device.managementPort,
      winboxPort: device.winboxPort || 8291,
      webPort: device.webPort || 80,
      apiUsername: device.apiUsername || '',
      apiPassword: '', // Don't pre-fill password
      vendor: 'mikrotik',
      deviceType: 'router',
      isProduction: device.isProduction,
    });
    setShowEditModal(true);
  };

  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());

  const handleAction = async (device: NetworkDevice, action: MikroTikAction) => {
    const actionKey = `${device.networkDeviceId}-${action}`;
    
    // Set loading state
    setLoadingActions((prev) => new Set(prev).add(actionKey));

    // Action labels for display
    const actionLabels: Record<MikroTikAction, string> = {
      [MikroTikAction.RESTART]: 'Restart',
      [MikroTikAction.DNS_FLUSH]: 'DNS Flush',
      [MikroTikAction.CREATE_BACKUP]: 'Create Backup',
      [MikroTikAction.SYNC_CLIENTS]: 'Sync Customers',
      [MikroTikAction.PPP_SERVER_TROUBLESHOOT]: 'PPP Server Troubleshoot',
      [MikroTikAction.PPP_MAC_BIND_ALL]: 'PPP MAC Bind All',
      [MikroTikAction.PPP_MAC_UNBIND_ALL]: 'PPP MAC Unbind All',
      [MikroTikAction.HOTSPOT_TROUBLESHOOT]: 'Hotspot Troubleshoot',
      [MikroTikAction.HS_DISABLE_DNS_REDIRECT]: 'HS Disable DNS Redirect',
      [MikroTikAction.HOTSPOT_ADDRESS_LIST]: 'Hotspot Address List',
      [MikroTikAction.HOTSPOT_UPDATE_CONFIG_JS]: 'Hotspot Update config.js',
      [MikroTikAction.BIND_API_IP]: 'Bind API IP',
      [MikroTikAction.COPY_PACKAGES]: 'Copy Packages',
    };

    const actionLabel = actionLabels[action] || action;

    // Destructive actions require confirmation
    const destructiveActions = [
      MikroTikAction.RESTART,
      MikroTikAction.PPP_MAC_BIND_ALL,
      MikroTikAction.PPP_MAC_UNBIND_ALL,
      MikroTikAction.HS_DISABLE_DNS_REDIRECT,
    ];

    if (destructiveActions.includes(action)) {
      const result = await showConfirm(
        `Confirm ${actionLabel}`,
        `Are you sure you want to ${actionLabel.toLowerCase()} on "${device.deviceName}"?`,
        'Yes, proceed',
        'Cancel',
        '#ef4444'
      );

      if (!result.isConfirmed) {
        setLoadingActions((prev) => {
          const next = new Set(prev);
          next.delete(actionKey);
          return next;
        });
        return;
      }
    }

    const isPppMacAction = action === MikroTikAction.PPP_MAC_BIND_ALL || action === MikroTikAction.PPP_MAC_UNBIND_ALL;
    if (isPppMacAction) {
      showProgressBar(
        action === MikroTikAction.PPP_MAC_BIND_ALL ? 'PPP MAC Bind All' : 'PPP MAC Unbind All',
        `Processing secrets on ${device.deviceName}...`
      );
    }

    try {
      const response = await networkService.executeDeviceAction(device.networkDeviceId, { action });

      if (isPppMacAction) closeAlert();

      if (response.success && response.action_status === 'success') {
        if (action === MikroTikAction.SYNC_CLIENTS && response.data?.syncedCount !== undefined) {
          const count = response.data.syncedCount;
          const msg = count === 0
            ? (response.data?.message || 'All customers already present on router')
            : `${count} Customer${count !== 1 ? 's' : ''} Successfully Synced`;
          await showSuccess('Sync Customers', msg, { timer: 1500 });
        } else if (isPppMacAction && response.data) {
          const d = response.data;
          const bound = d.bound ?? d.unbound ?? 0;
          const total = d.total ?? 0;
          const label = action === MikroTikAction.PPP_MAC_BIND_ALL ? 'bound' : 'unbound';
          await showSuccess(
            action === MikroTikAction.PPP_MAC_BIND_ALL ? 'PPP MAC Bind All' : 'PPP MAC Unbind All',
            `${bound} secret${bound !== 1 ? 's' : ''} ${label} successfully${total ? ` (${total} total)` : ''}.`,
            { timer: 2500 }
          );
        } else {
          const executionTime = response.execution_time ? ` (${response.execution_time}ms)` : '';
          toast.success(`${actionLabel} completed: Action executed on ${device.deviceName}${executionTime}`);
        }
      } else {
        const errorMsg = response.error_message || 'Action failed';
        if (isPppMacAction) {
          await showError(actionLabel + ' failed', errorMsg);
        } else {
          toast.error(`${actionLabel} failed: ${errorMsg}`);
        }
      }
    } catch (err: any) {
      if (isPppMacAction) closeAlert();
      const errorMessage = err.response?.data?.error_message || err.response?.data?.message || err.message || `Failed to execute ${actionLabel}`;
      if (isPppMacAction) {
        await showError(actionLabel + ' failed', errorMessage);
      } else {
        toast.error(`${actionLabel} failed: ${errorMessage}`);
      }
    } finally {
      // Clear loading state
      setLoadingActions((prev) => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
  };

  const handlePingNow = async (device: NetworkDevice) => {
    setOpenPingMenuId(null);
    
    // Show loading modal
    showLoading('Checking device...', `Performing health check on ${device.deviceName}...`);
    
    try {
      const response = await networkService.pingNow(device.networkDeviceId);
      
      // Close loading
      closeAlert();
      
      if (response.success && response.data) {
        // Update ping status store
        setPingStatus(device.networkDeviceId, {
          deviceId: device.networkDeviceId,
          pingStatus: response.data.status,
          latencyMs: response.data.latencyMs,
          lastCheckedAt: new Date().toISOString(),
        });
        
        if (response.data.status === 'online') {
          const latency = response.data.latencyMs ? ` (${response.data.latencyMs}ms)` : '';
          toast.success(`Device Online: Successfully connected to ${device.deviceName}${latency}`);
        } else if (response.data.status === 'auth_failed') {
          toast.error(`Authentication Failed: Invalid credentials for ${device.deviceName}. Please check username/password.`);
        } else {
          toast.error(`Device Offline: Could not reach ${device.deviceName}. The device may be down or unreachable.`);
        }
      } else {
        const errorMsg = response.error_message || 'Health check failed';
        toast.error(`Health Check Failed: ${errorMsg}`);
      }
    } catch (err: any) {
      closeAlert();
      const errorMessage = err.response?.data?.error_message || err.response?.data?.message || err.message || 'Failed to ping device';
      toast.error(`Ping Failed: ${errorMessage}`);
    }
  };

  const handleSetPingInterval = async (device: NetworkDevice) => {
    setOpenPingMenuId(null);
    
    const { value: interval } = await Swal.fire({
      title: 'Set Ping Interval',
      html: `
        <div class="text-left">
          <p class="mb-4 text-slate-600 dark:text-slate-400">Enter custom ping interval in seconds for <strong>${device.deviceName}</strong></p>
          <p class="text-xs text-slate-500 dark:text-slate-500 mb-2">Range: 5-300 seconds (Default: 10 seconds)</p>
        </div>
      `,
      input: 'number',
      inputValue: device.customPingInterval?.toString() || '10',
      inputPlaceholder: 'Enter interval in seconds',
      inputAttributes: {
        min: '5',
        max: '300',
        step: '1',
      },
      showCancelButton: true,
      confirmButtonText: 'Set Interval',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#6b7280',
      inputValidator: (value) => {
        if (!value) {
          return 'Please enter an interval';
        }
        const num = parseInt(value, 10);
        if (isNaN(num)) {
          return 'Please enter a valid number';
        }
        if (num < 5 || num > 300) {
          return 'Interval must be between 5 and 300 seconds';
        }
        return null;
      },
    });

    if (interval) {
      const intervalNum = parseInt(interval, 10);
      
      showLoading('Updating ping interval...', 'Please wait...');
      
      try {
        await networkService.updatePingInterval(device.networkDeviceId, intervalNum);
        closeAlert();
        await showSuccess(
          'Ping Interval Updated',
          `Ping interval for ${device.deviceName} has been set to ${intervalNum} seconds.`
        );
        loadDevices();
      } catch (err: any) {
        closeAlert();
        const errorMessage = err.response?.data?.message || err.message || 'Failed to update ping interval';
        await showError('Update Failed', errorMessage);
      }
    }
  };

  const handleResetPingInterval = async (device: NetworkDevice) => {
    setOpenPingMenuId(null);
    
    const result = await showConfirm(
      'Reset Ping Interval',
      `Are you sure you want to reset the ping interval for "${device.deviceName}" to the default (10 seconds)?`,
      'Yes, Reset',
      'Cancel',
      '#3b82f6'
    );

    if (result.isConfirmed) {
      showLoading('Resetting ping interval...', 'Please wait...');
      
      try {
        await networkService.updatePingInterval(device.networkDeviceId, null);
        closeAlert();
        await showSuccess(
          'Ping Interval Reset',
          `Ping interval for ${device.deviceName} has been reset to the default (10 seconds).`
        );
        loadDevices();
      } catch (err: any) {
        closeAlert();
        const errorMessage = err.response?.data?.message || err.message || 'Failed to reset ping interval';
        await showError('Reset Failed', errorMessage);
      }
    }
  };

  const handleDisable = async (device: NetworkDevice) => {
    const result = await showConfirm(
      'Disable server',
      `Disable "${device.deviceName}"? You can re-enable it later from the status dropdown.`,
      'Disable',
      'Cancel',
      '#f59e0b'
    );

    if (!result.isConfirmed) {
      return;
    }

    try {
      await networkService.updateDeviceStatus(device.networkDeviceId, { status: 'inactive' });
      await showSuccess('Success!', 'Server disabled successfully.');
      loadDevices();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to disable server';
      await showError('Error!', errorMessage);
    }
  };

  const handleDeletePermanent = async (device: NetworkDevice) => {
    const deviceId = device.networkDeviceId || (device as any).deviceId || (device as any).device_id || (device as any).id;
    if (!deviceId) {
      toast.error('Device ID is missing');
      return;
    }

    const result = await showDeleteConfirm(
      device.deviceName,
      'Permanently delete this server? This cannot be undone. Delete only if no packages or customers use this device.'
    );

    if (!result.isConfirmed) {
      return;
    }

    try {
      await networkService.deleteNetworkDevice(deviceId);
      await showSuccess('Success!', 'Server deleted permanently.');
      loadDevices();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to delete server';
      await showError('Error!', errorMessage);
    }
  };

  const resetForm = () => {
    setFormData({
      deviceCode: '',
      deviceName: '',
      managementIp: '',
      dnsName: '',
      managementPort: 8728,
      winboxPort: 8291,
      webPort: 80,
      apiUsername: '',
      apiPassword: '',
      vendor: 'mikrotik',
      deviceType: 'router',
      isProduction: false,
    });
    setFormErrors({});
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
        }
        title="MikroTik Servers"
        subtitle="Manage routers, API sockets, credentials, and live interface traffic"
        badge={`${devices.length} Servers`}
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
            Add Server
          </button>
        }
      />

        {/* Add Server Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                    Add MikroTik Server
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Device Code */}
                  <div>
                    <label htmlFor="deviceCode" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Device Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="deviceCode"
                      required
                      value={formData.deviceCode}
                      onChange={(e) => setFormData((prev) => ({ ...prev, deviceCode: e.target.value.replace(/\D/g, '') }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-mono transition-all ${
                        formErrors.deviceCode ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="e.g., 300001"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">Strictly numeric globally unique server ID (e.g. 300001).</p>
                    {formErrors.deviceCode && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.deviceCode}</p>}
                  </div>

                  {/* Device Name */}
                  <div>
                    <label htmlFor="deviceName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Device Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="deviceName"
                      required
                      value={formData.deviceName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, deviceName: e.target.value }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.deviceName ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="e.g., Main Office Router"
                    />
                    {formErrors.deviceName && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.deviceName}</p>}
                  </div>

                  {/* Management IP */}
                  <div>
                    <label htmlFor="managementIp" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Management IP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="managementIp"
                      required
                      value={formData.managementIp}
                      onChange={(e) => setFormData((prev) => ({ ...prev, managementIp: e.target.value }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.managementIp ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="e.g., 192.168.1.1"
                    />
                    {formErrors.managementIp && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.managementIp}</p>}
                  </div>

                  {/* DNS Name */}
                  <div>
                    <label htmlFor="dnsName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      DNS Name
                    </label>
                    <input
                      type="text"
                      id="dnsName"
                      value={formData.dnsName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, dnsName: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                      placeholder="e.g., router.example.com"
                    />
                  </div>

                  {/* API Port */}
                  <div>
                    <label htmlFor="managementPort" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      API Port (Port)
                    </label>
                    <input
                      type="number"
                      id="managementPort"
                      min="1"
                      max="65535"
                      value={formData.managementPort}
                      onChange={(e) => setFormData((prev) => ({ ...prev, managementPort: parseInt(e.target.value) || 8728 }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.managementPort ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="8728"
                    />
                    {formErrors.managementPort && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.managementPort}</p>}
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Default: 8728</p>
                  </div>

                  {/* Winbox Port */}
                  <div>
                    <label htmlFor="winboxPort" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      WinPort (Winbox)
                    </label>
                    <input
                      type="number"
                      id="winboxPort"
                      min="1"
                      max="65535"
                      value={formData.winboxPort}
                      onChange={(e) => setFormData((prev) => ({ ...prev, winboxPort: parseInt(e.target.value) || 8291 }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.winboxPort ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="8291"
                    />
                    {formErrors.winboxPort && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.winboxPort}</p>}
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Default: 8291</p>
                  </div>

                  {/* Web Port */}
                  <div>
                    <label htmlFor="webPort" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      WebPort
                    </label>
                    <input
                      type="number"
                      id="webPort"
                      min="1"
                      max="65535"
                      value={formData.webPort}
                      onChange={(e) => setFormData((prev) => ({ ...prev, webPort: parseInt(e.target.value) || 80 }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.webPort ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="80"
                    />
                    {formErrors.webPort && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.webPort}</p>}
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Default: 80 (or 443 for HTTPS)</p>
                  </div>

                  {/* API Username */}
                  <div>
                    <label htmlFor="apiUsername" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="apiUsername"
                      required
                      value={formData.apiUsername}
                      onChange={(e) => setFormData((prev) => ({ ...prev, apiUsername: e.target.value }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.apiUsername ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="e.g., admin"
                    />
                    {formErrors.apiUsername && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.apiUsername}</p>}
                  </div>

                  {/* API Password */}
                  <div>
                    <label htmlFor="apiPassword" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      id="apiPassword"
                      required
                      value={formData.apiPassword}
                      onChange={(e) => setFormData((prev) => ({ ...prev, apiPassword: e.target.value }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.apiPassword ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="Enter API password"
                    />
                    {formErrors.apiPassword && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.apiPassword}</p>}
                  </div>
                </div>

                {/* Is Production Toggle */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">Production Device</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Mark this device as production-ready</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isProduction || false}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isProduction: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-emerald-600 peer-checked:to-teal-600"></div>
                  </label>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="px-6 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all shadow-sm hover:shadow-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Server'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Server Modal */}
        {showEditModal && editingDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                    Edit MikroTik Server
                  </h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingDevice(null);
                      resetForm();
                    }}
                    className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Device Name */}
                  <div>
                    <label htmlFor="edit-deviceName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Device Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="edit-deviceName"
                      required
                      value={formData.deviceName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, deviceName: e.target.value }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.deviceName ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {formErrors.deviceName && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.deviceName}</p>}
                  </div>

                  {/* Management IP */}
                  <div>
                    <label htmlFor="edit-managementIp" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Management IP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="edit-managementIp"
                      required
                      value={formData.managementIp}
                      onChange={(e) => setFormData((prev) => ({ ...prev, managementIp: e.target.value }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.managementIp ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {formErrors.managementIp && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.managementIp}</p>}
                  </div>

                  {/* DNS Name */}
                  <div>
                    <label htmlFor="edit-dnsName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      DNS Name
                    </label>
                    <input
                      type="text"
                      id="edit-dnsName"
                      value={formData.dnsName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, dnsName: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                    />
                  </div>

                  {/* API Port */}
                  <div>
                    <label htmlFor="edit-managementPort" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      API Port (Port)
                    </label>
                    <input
                      type="number"
                      id="edit-managementPort"
                      min="1"
                      max="65535"
                      value={formData.managementPort}
                      onChange={(e) => setFormData((prev) => ({ ...prev, managementPort: parseInt(e.target.value) || 8728 }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.managementPort ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {formErrors.managementPort && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.managementPort}</p>}
                  </div>

                  {/* Winbox Port */}
                  <div>
                    <label htmlFor="edit-winboxPort" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      WinPort (Winbox)
                    </label>
                    <input
                      type="number"
                      id="edit-winboxPort"
                      min="1"
                      max="65535"
                      value={formData.winboxPort}
                      onChange={(e) => setFormData((prev) => ({ ...prev, winboxPort: parseInt(e.target.value) || 8291 }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.winboxPort ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {formErrors.winboxPort && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.winboxPort}</p>}
                  </div>

                  {/* Web Port */}
                  <div>
                    <label htmlFor="edit-webPort" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      WebPort
                    </label>
                    <input
                      type="number"
                      id="edit-webPort"
                      min="1"
                      max="65535"
                      value={formData.webPort}
                      onChange={(e) => setFormData((prev) => ({ ...prev, webPort: parseInt(e.target.value) || 80 }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.webPort ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {formErrors.webPort && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.webPort}</p>}
                  </div>

                  {/* API Username */}
                  <div>
                    <label htmlFor="edit-apiUsername" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="edit-apiUsername"
                      required
                      value={formData.apiUsername}
                      onChange={(e) => setFormData((prev) => ({ ...prev, apiUsername: e.target.value }))}
                      className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all ${
                        formErrors.apiUsername ? 'border-red-500 dark:border-red-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {formErrors.apiUsername && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.apiUsername}</p>}
                  </div>

                  {/* API Password */}
                  <div>
                    <label htmlFor="edit-apiPassword" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Password (leave blank to keep current)
                    </label>
                    <input
                      type="password"
                      id="edit-apiPassword"
                      value={formData.apiPassword}
                      onChange={(e) => setFormData((prev) => ({ ...prev, apiPassword: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                      placeholder="Enter new password or leave blank"
                    />
                  </div>
                </div>

                {/* Is Production Toggle */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">Production Device</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Mark this device as production-ready</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isProduction || false}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isProduction: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-emerald-600 peer-checked:to-teal-600"></div>
                  </label>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingDevice(null);
                      resetForm();
                    }}
                    className="px-6 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all shadow-sm hover:shadow-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Updating...' : 'Update Server'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl p-12">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-lg">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Devices Table */}
        {!isLoading && !error && devices.length > 0 && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden">
            <div className="overflow-x-hidden">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '6%' }}>ID</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '10%' }}>Name</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '8%' }}>Status</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '8%' }}>Ping</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '10%' }}>IP</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '10%' }}>DNS Name</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '6%' }}>Port (API)</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '6%' }}>WinPort</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '6%' }}>WebPort</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '10%' }}>Username</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '8%' }}>Password</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider" style={{ width: '12%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {devices.map((device) => (
                    <tr key={device.networkDeviceId} className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-blue-900/10 dark:hover:to-indigo-900/10 transition-all duration-200">
                      <td className="px-3 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate" title={device.deviceCode}>
                        {device.deviceCode}
                      </td>
                      <td className="px-3 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 truncate" title={device.deviceName}>
                        {device.deviceName}
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(device.status)}`}>
                          {getStatusLabel(device.status)}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <PingStatusIndicator deviceId={device.networkDeviceId} />
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-600 dark:text-slate-400 truncate" title={device.managementIp || undefined}>
                        {device.managementIp || '—'}
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-600 dark:text-slate-400 truncate" title={device.dnsName || undefined}>
                        {device.dnsName || '—'}
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {device.managementPort}
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {device.winboxPort || '—'}
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {device.webPort || '—'}
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-600 dark:text-slate-400 truncate" title={device.apiUsername || undefined}>
                        {device.apiUsername || '—'}
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-600 dark:text-slate-400 font-mono truncate">
                        {device.apiPassword || '******'}
                      </td>
                      <td className="px-3 py-4 text-sm" style={{ width: '12%', minWidth: '120px' }}>
                        <div className="flex items-center gap-2">
                          {/* Edit Button */}
                          <button
                            onClick={() => handleEdit(device)}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Edit Server"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Three-dot Menu */}
                          <div className="relative">
                            <button
                              ref={(el) => (pingMenuRefs.current[device.networkDeviceId] = el)}
                              onClick={() => setOpenPingMenuId(openPingMenuId === device.networkDeviceId ? null : device.networkDeviceId)}
                              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title="More options"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>

                            <ActionDropdown
                              isOpen={openPingMenuId === device.networkDeviceId}
                              onClose={() => setOpenPingMenuId(null)}
                              triggerButton={pingMenuRefs.current[device.networkDeviceId]}
                            >
                              {/* Ping Controls Section */}
                              <div className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Ping Controls
                              </div>
                              
                              <button
                                onClick={() => handlePingNow(device)}
                                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center gap-2"
                              >
                                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span>Ping Now</span>
                              </button>

                              <button
                                onClick={() => handleSetPingInterval(device)}
                                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2"
                              >
                                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Set Ping Interval</span>
                                {device.customPingInterval && (
                                  <span className="ml-auto text-xs text-slate-500">({device.customPingInterval}s)</span>
                                )}
                              </button>

                              {device.customPingInterval && (
                                <button
                                  onClick={() => handleResetPingInterval(device)}
                                  className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-2"
                                >
                                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  <span>Reset to Default (10s)</span>
                                </button>
                              )}

                              <div className="border-t border-slate-200 dark:border-slate-700 my-0.5"></div>

                              {/* Device Actions Section */}
                              <div className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                Device Actions
                              </div>
                              {/* Restart */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleAction(device, MikroTikAction.RESTART);
                                }}
                                disabled={device.status !== 'active' || loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.RESTART}`)}
                                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.RESTART}`) ? (
                                  <>
                                    <svg className="animate-spin w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Processing...</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>Restart</span>
                                  </>
                                )}
                              </button>

                              {/* DNS Flush */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleAction(device, MikroTikAction.DNS_FLUSH);
                                }}
                                disabled={device.status !== 'active' || loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.DNS_FLUSH}`)}
                                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.DNS_FLUSH}`) ? (
                                  <>
                                    <svg className="animate-spin w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Processing...</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    <span>DNS Flush</span>
                                  </>
                                )}
                              </button>

                              {/* Create Backup */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleAction(device, MikroTikAction.CREATE_BACKUP);
                                }}
                            disabled={device.status !== 'active' || loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.CREATE_BACKUP}`)}
                            className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            <span>Create Backup</span>
                          </button>

                              {/* Sync Customers */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleAction(device, MikroTikAction.SYNC_CLIENTS);
                                }}
                            disabled={device.status !== 'active' || loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.SYNC_CLIENTS}`)}
                            className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Sync Customers</span>
                          </button>

                              {/* Divider */}
                              <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>

                              {/* PPP Server Troubleshoot */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleAction(device, MikroTikAction.PPP_SERVER_TROUBLESHOOT);
                                }}
                            disabled={device.status !== 'active' || loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.PPP_SERVER_TROUBLESHOOT}`)}
                            className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span>PPP Server Troubleshoot</span>
                          </button>

                              {/* PPP MAC Bind All */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleAction(device, MikroTikAction.PPP_MAC_BIND_ALL);
                                }}
                                disabled={device.status !== 'active' || loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.PPP_MAC_BIND_ALL}`)}
                                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span>PPP MAC Bind All</span>
                          </button>

                              {/* PPP MAC Unbind All */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleAction(device, MikroTikAction.PPP_MAC_UNBIND_ALL);
                                }}
                                disabled={device.status !== 'active' || loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.PPP_MAC_UNBIND_ALL}`)}
                                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            <span>PPP MAC Unbind All</span>
                          </button>

                              {/* Divider */}
                              <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>

                              {/* Hotspot Troubleshoot */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleAction(device, MikroTikAction.HOTSPOT_TROUBLESHOOT);
                                }}
                            disabled={device.status !== 'active'}
                            className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span>Hotspot Troubleshoot</span>
                          </button>

                              {/* HS Disable DNS Redirect */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleAction(device, MikroTikAction.HS_DISABLE_DNS_REDIRECT);
                                }}
                                disabled={device.status !== 'active' || loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.HS_DISABLE_DNS_REDIRECT}`)}
                                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            <span>HS Disable DNS Redirect</span>
                          </button>

                              {/* Hotspot Address List */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleAction(device, MikroTikAction.HOTSPOT_ADDRESS_LIST);
                                }}
                                disabled={device.status !== 'active' || loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.HOTSPOT_ADDRESS_LIST}`)}
                                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span>Hotspot Address List</span>
                          </button>

                              {/* Hotspot Update config.js */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleAction(device, MikroTikAction.HOTSPOT_UPDATE_CONFIG_JS);
                                }}
                                disabled={device.status !== 'active' || loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.HOTSPOT_UPDATE_CONFIG_JS}`)}
                                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Hotspot Update config.js</span>
                          </button>

                              {/* Divider */}
                              <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>

                              {/* Bind API IP */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleAction(device, MikroTikAction.BIND_API_IP);
                                }}
                                disabled={device.status !== 'active' || loadingActions.has(`${device.networkDeviceId}-${MikroTikAction.BIND_API_IP}`)}
                                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                <span>Bind API IP</span>
                              </button>

                              {/* Copy Packages */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  navigate('/dashboard/network/package-copy', { state: { sourceDevice: device } });
                                }}
                                disabled={device.status !== 'active'}
                                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span>Copy Packages</span>
                              </button>

                              {/* Disable */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleDisable(device);
                                }}
                                disabled={device.status !== 'active'}
                                className="w-full px-3 py-1.5 text-left text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                                <span>Disable</span>
                              </button>
                              {/* Delete permanently */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleDeletePermanent(device);
                                }}
                                className="w-full px-3 py-1.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                              >
                                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Delete</span>
                              </button>
                            </ActionDropdown>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && devices.length === 0 && (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 mb-6">
              <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No MikroTik servers found</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Get started by adding your first MikroTik server.</p>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Server</span>
            </button>
          </div>
        )}
      </div>
  );
}
