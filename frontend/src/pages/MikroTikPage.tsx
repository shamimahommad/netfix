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
import { Lock, Activity, Server, Cpu, RefreshCw, X, Users, Clock, AlertTriangle, CheckCircle2, Radio, Key } from 'lucide-react';

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

  // Pre-flight Connection & Login Testing States
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [isTestingLogin, setIsTestingLogin] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: 'ping' | 'login';
    success: boolean;
    message: string;
    latencyMs?: number | null;
  } | null>(null);
  const [useSsl, setUseSsl] = useState<boolean>(false);
  const [connMode, setConnMode] = useState<'api' | 'ssl' | 'rest'>('api');

  const handleTestPing = async (targetForm: CreateNetworkDevicePayload) => {
    if (!targetForm.managementIp) {
      toast.error('Please enter Management IP address first');
      return;
    }
    setIsTestingPing(true);
    setTestResult(null);
    try {
      const res = await networkService.testDeviceConnection({
        testType: 'ping',
        deviceType: 'router',
        vendor: 'mikrotik',
        managementIp: targetForm.managementIp,
        managementPort: targetForm.managementPort,
        winboxPort: targetForm.winboxPort,
        webPort: targetForm.webPort,
        useSsl: connMode === 'ssl' || targetForm.managementPort === 8729,
        apiType: connMode === 'rest' || targetForm.managementPort === 50000 ? 'rest' : (connMode === 'ssl' ? 'api-ssl' : 'api'),
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

  const handleTestLogin = async (targetForm: CreateNetworkDevicePayload) => {
    if (!targetForm.managementIp) {
      toast.error('Please enter Management IP address first');
      return;
    }
    if (!targetForm.apiUsername) {
      toast.error('Please enter API Username first');
      return;
    }
    setIsTestingLogin(true);
    setTestResult(null);
    try {
      const res = await networkService.testDeviceConnection({
        testType: 'login',
        deviceType: 'router',
        vendor: 'mikrotik',
        managementIp: targetForm.managementIp,
        managementPort: targetForm.managementPort,
        webPort: targetForm.webPort,
        useSsl: connMode === 'ssl' || targetForm.managementPort === 8729,
        apiType: connMode === 'rest' || targetForm.managementPort === 50000 ? 'rest' : (connMode === 'ssl' ? 'api-ssl' : 'api'),
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

  // Diagnostics Modal State with Persistent Live Stream & 5-minute Auto-Pause
  const [selectedRouterForDiag, setSelectedRouterForDiag] = useState<NetworkDevice | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagData, setDiagData] = useState<any | null>(null);
  const [diagStatus, setDiagStatus] = useState<'online' | 'offline' | 'error' | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [diagSecondsLeft, setDiagSecondsLeft] = useState<number>(300); // 5 minutes max
  const [diagIsPaused, setDiagIsPaused] = useState<boolean>(false);

  const pollingIntervalRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);

  const stopLiveStream = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const formatCountdown = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const startLiveStream = (deviceId: string) => {
    stopLiveStream();
    setDiagSecondsLeft(300); // Reset to 5 minutes
    setDiagIsPaused(false);

    // 1-second countdown timer
    countdownIntervalRef.current = setInterval(() => {
      setDiagSecondsLeft((prev) => {
        if (prev <= 1) {
          stopLiveStream();
          setDiagIsPaused(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 2.5-second silent live telemetry polling (reusing persistent MikroTik API socket)
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await networkService.getRouterDetails(deviceId);
        if (res.success && res.data) {
          setDiagData(res.data);
          setDiagStatus('online');
        }
      } catch (err) {
        // Silently preserve current frame on momentary network glitch
      }
    }, 2500);
  };

  const handleOpenDiagnostics = async (device: NetworkDevice) => {
    setSelectedRouterForDiag(device);
    setDiagLoading(true);
    setDiagData(null);
    setDiagError(null);
    setDiagStatus(null);
    stopLiveStream();

    try {
      const res = await networkService.getRouterDetails(device.networkDeviceId);
      if (res.success && res.data) {
        setDiagData(res.data);
        setDiagStatus('online');
        // Start 5-minute continuous live stream
        startLiveStream(device.networkDeviceId);
      } else {
        setDiagStatus('offline');
        setDiagError(res.message || 'Router unreachable or API disabled');
        stopLiveStream();
      }
    } catch (err: any) {
      setDiagStatus('offline');
      setDiagError(err?.response?.data?.message || err?.message || 'Failed to connect to router');
      stopLiveStream();
    } finally {
      setDiagLoading(false);
    }
  };

  const handleRefreshDiagnostics = async () => {
    if (!selectedRouterForDiag) return;
    setDiagLoading(true);
    setDiagError(null);

    try {
      const res = await networkService.getRouterDetails(selectedRouterForDiag.networkDeviceId);
      if (res.success && res.data) {
        setDiagData(res.data);
        setDiagStatus('online');
        // Restart 5-minute continuous live stream
        startLiveStream(selectedRouterForDiag.networkDeviceId);
      } else {
        setDiagStatus('offline');
        setDiagError(res.message || 'Router unreachable or API disabled');
        stopLiveStream();
      }
    } catch (err: any) {
      setDiagStatus('offline');
      setDiagError(err?.response?.data?.message || err?.message || 'Failed to connect to router');
      stopLiveStream();
    } finally {
      setDiagLoading(false);
    }
  };

  const handleCloseDiagnostics = () => {
    stopLiveStream();
    setSelectedRouterForDiag(null);
    setDiagData(null);
    setDiagError(null);
    setDiagIsPaused(false);
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      stopLiveStream();
    };
  }, []);

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
    const isRest = device.managementPort === 50000 || device.webPort === 50000 || device.managementPort === 80;
    const isSsl = !isRest && device.managementPort === 8729;
    setConnMode(isRest ? 'rest' : (isSsl ? 'ssl' : 'api'));
    setUseSsl(isSsl);
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
          const target = (response.data as any)?.target ? ` [${(response.data as any).target}]` : '';
          toast.success(`Device Online${target}: Successfully connected to ${device.deviceName}${latency} via TCP socket probe`);
        } else if (response.data.status === 'auth_failed') {
          toast.error(`Authentication Failed: TCP port responded, but credentials invalid for ${device.deviceName}. Please check username/password.`);
        } else {
          toast.error(`Device Offline: Could not reach ${device.deviceName} on management port (${device.managementIp}:${device.managementPort || 8728}).`);
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
    setUseSsl(false);
    setConnMode('api');
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      Add MikroTik Server
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        RouterOS
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Configure router management IP and API credentials</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
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
                      Server Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.deviceName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, deviceName: e.target.value }))}
                      className={`w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-all ${
                        formErrors.deviceName ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="e.g., Core Router-01"
                    />
                    {formErrors.deviceName && <p className="mt-0.5 text-[11px] text-red-500">{formErrors.deviceName}</p>}
                  </div>

                  {/* Management IP */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Management IP / Host <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.managementIp}
                      onChange={(e) => setFormData((prev) => ({ ...prev, managementIp: e.target.value }))}
                      className={`w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-all ${
                        formErrors.managementIp ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="e.g., 103.100.20.1"
                    />
                    {formErrors.managementIp && <p className="mt-0.5 text-[11px] text-red-500">{formErrors.managementIp}</p>}
                  </div>

                  {/* DNS Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      DNS Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.dnsName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, dnsName: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-all"
                      placeholder="e.g., core.isp.net"
                    />
                  </div>
                </div>

                {/* Ports 3-column Grid */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        API Port
                      </label>
                      <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            setConnMode('api');
                            setUseSsl(false);
                            setFormData((prev) => ({ ...prev, managementPort: 8728 }));
                          }}
                          className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                            connMode === 'api'
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                          title="Standard RouterOS API (Port 8728)"
                        >
                          API
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConnMode('ssl');
                            setUseSsl(true);
                            setFormData((prev) => ({ ...prev, managementPort: 8729 }));
                          }}
                          className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                            connMode === 'ssl'
                              ? 'bg-emerald-500 text-white shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                          title="RouterOS API-SSL (Port 8729)"
                        >
                          SSL
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConnMode('rest');
                            setUseSsl(false);
                            setFormData((prev) => ({ ...prev, managementPort: 50000, webPort: 50000 }));
                          }}
                          className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                            connMode === 'rest'
                              ? 'bg-blue-600 text-white shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                          title="RouterOS v7 REST API / WWW (Port 50000 or 80)"
                        >
                          REST
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      value={formData.managementPort}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setFormData((prev) => ({ ...prev, managementPort: val }));
                        if (val === 8729) { setConnMode('ssl'); setUseSsl(true); }
                        else if (val === 50000 || val === 80) { setConnMode('rest'); setUseSsl(false); }
                        else if (val === 8728) { setConnMode('api'); setUseSsl(false); }
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100"
                      placeholder={connMode === 'rest' ? "50000" : (connMode === 'ssl' ? "8729" : "8728")}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Winbox Port
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      value={formData.winboxPort}
                      onChange={(e) => setFormData((prev) => ({ ...prev, winboxPort: parseInt(e.target.value) || 8291 }))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100"
                      placeholder="8291"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Web Port
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      value={formData.webPort}
                      onChange={(e) => setFormData((prev) => ({ ...prev, webPort: parseInt(e.target.value) || 80 }))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100"
                      placeholder="80"
                    />
                  </div>
                </div>

                {/* API Credentials */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      API Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.apiUsername}
                      onChange={(e) => setFormData((prev) => ({ ...prev, apiUsername: e.target.value }))}
                      className={`w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-all ${
                        formErrors.apiUsername ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="e.g., admin"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      API Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={formData.apiPassword}
                      onChange={(e) => setFormData((prev) => ({ ...prev, apiPassword: e.target.value }))}
                      className={`w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-all ${
                        formErrors.apiPassword ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                      placeholder="Enter API password"
                    />
                  </div>
                </div>

                {/* Pre-flight Testing & Verification Section */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Pre-flight Verification:
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
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

                {/* Inline Production Toggle */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Mark as Production Server</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isProduction || false}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isProduction: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Form Actions Footer */}
                <div className="flex items-center justify-end gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Edit MikroTik Server
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Update router parameters and API credentials</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDevice(null);
                    resetForm();
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="p-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Device Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Device Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.deviceName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, deviceName: e.target.value }))}
                      className={`w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-all ${
                        formErrors.deviceName ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {formErrors.deviceName && <p className="mt-0.5 text-[11px] text-red-500">{formErrors.deviceName}</p>}
                  </div>

                  {/* Management IP */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Management IP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.managementIp}
                      onChange={(e) => setFormData((prev) => ({ ...prev, managementIp: e.target.value }))}
                      className={`w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-all ${
                        formErrors.managementIp ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    {formErrors.managementIp && <p className="mt-0.5 text-[11px] text-red-500">{formErrors.managementIp}</p>}
                  </div>

                  {/* DNS Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      DNS Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.dnsName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, dnsName: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-all"
                    />
                  </div>

                  {/* API Username */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      API Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.apiUsername}
                      onChange={(e) => setFormData((prev) => ({ ...prev, apiUsername: e.target.value }))}
                      className={`w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-all ${
                        formErrors.apiUsername ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                  </div>
                </div>

                {/* Ports 3-column Grid */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        API Port
                      </label>
                      <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            setConnMode('api');
                            setUseSsl(false);
                            setFormData((prev) => ({ ...prev, managementPort: 8728 }));
                          }}
                          className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                            connMode === 'api'
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                          title="Standard RouterOS API (Port 8728)"
                        >
                          API
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConnMode('ssl');
                            setUseSsl(true);
                            setFormData((prev) => ({ ...prev, managementPort: 8729 }));
                          }}
                          className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                            connMode === 'ssl'
                              ? 'bg-emerald-500 text-white shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                          title="RouterOS API-SSL (Port 8729)"
                        >
                          SSL
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConnMode('rest');
                            setUseSsl(false);
                            setFormData((prev) => ({ ...prev, managementPort: 50000, webPort: 50000 }));
                          }}
                          className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                            connMode === 'rest'
                              ? 'bg-blue-600 text-white shadow-xs font-bold'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                          }`}
                          title="RouterOS v7 REST API / WWW (Port 50000 or 80)"
                        >
                          REST
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      value={formData.managementPort}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setFormData((prev) => ({ ...prev, managementPort: val }));
                        if (val === 8729) { setConnMode('ssl'); setUseSsl(true); }
                        else if (val === 50000 || val === 80) { setConnMode('rest'); setUseSsl(false); }
                        else if (val === 8728) { setConnMode('api'); setUseSsl(false); }
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100"
                      placeholder={connMode === 'rest' ? "50000" : (connMode === 'ssl' ? "8729" : "8728")}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Winbox Port
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      value={formData.winboxPort}
                      onChange={(e) => setFormData((prev) => ({ ...prev, winboxPort: parseInt(e.target.value) || 8291 }))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Web Port
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      value={formData.webPort}
                      onChange={(e) => setFormData((prev) => ({ ...prev, webPort: parseInt(e.target.value) || 80 }))}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Password Change */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    API Password (leave blank to keep current)
                  </label>
                  <input
                    type="password"
                    value={formData.apiPassword}
                    onChange={(e) => setFormData((prev) => ({ ...prev, apiPassword: e.target.value }))}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 transition-all"
                    placeholder="Enter new password or leave blank"
                  />
                </div>

                {/* Pre-flight Testing & Verification Section */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
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

                {/* Inline Production Toggle */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Mark as Production Server</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isProduction || false}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isProduction: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Form Actions Footer */}
                <div className="flex items-center justify-end gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingDevice(null);
                      resetForm();
                    }}
                    className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Updating...' : 'Update Server'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Router Diagnostics Modal */}
        {selectedRouterForDiag && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
                    <Activity className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight">
                        {diagData?.identity || selectedRouterForDiag.deviceName}
                      </h2>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/80 text-slate-300 font-mono">
                        {diagData?.model || selectedRouterForDiag.vendor.toUpperCase()}
                      </span>
                      {diagStatus === 'online' && !diagIsPaused && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          Live Stream ({formatCountdown(diagSecondsLeft)})
                        </span>
                      )}
                      {diagIsPaused && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          Auto-Paused (5m reached)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {selectedRouterForDiag.managementIp}:{selectedRouterForDiag.managementPort}
                      {selectedRouterForDiag.winboxPort ? ` • Winbox: ${selectedRouterForDiag.winboxPort}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefreshDiagnostics}
                    disabled={diagLoading}
                    className="p-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold shadow-md active:scale-95"
                    title={diagIsPaused ? "Click to restart 5-minute live stream" : "Refresh live stats"}
                  >
                    <RefreshCw className={`w-4 h-4 ${diagLoading ? 'animate-spin' : ''}`} />
                    <span>{diagIsPaused ? 'Resume Live' : 'Refresh'}</span>
                  </button>
                  <button
                    onClick={handleCloseDiagnostics}
                    className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* 5-Minute Auto-Pause Notice Banner */}
                {diagIsPaused && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span>
                        <strong>Auto-refresh paused:</strong> 5-minute live monitoring limit reached to preserve router CPU. Click <strong>Resume Live</strong> to start another 5 minutes.
                      </span>
                    </div>
                    <button
                      onClick={handleRefreshDiagnostics}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-lg text-xs transition-all shadow-sm active:scale-95 flex-shrink-0"
                    >
                      Resume Live
                    </button>
                  </div>
                )}

                {/* Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Connection State:
                    </span>
                    {diagLoading && !diagData ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        Connecting to RouterOS API...
                      </span>
                    ) : diagStatus === 'online' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        ONLINE (1 Persistent API Session)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-700">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        OFFLINE
                      </span>
                    )}
                  </div>

                  {diagData && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <span>ROS {diagData.version}</span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold">1 Active Session</span>
                    </div>
                  )}
                </div>

                {/* Offline Warning Banner */}
                {diagStatus === 'offline' && !diagLoading && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-red-800 dark:text-red-300">
                        {diagError || 'Router unreachable or API disabled'}
                      </p>
                      <p className="mt-1 text-xs text-red-700 dark:text-red-400/90 leading-relaxed">
                        Unable to establish connection to <strong>{selectedRouterForDiag.managementIp}:{selectedRouterForDiag.managementPort}</strong>.
                        Please ensure the <code>api</code> service is enabled in MikroTik (<em>IP → Services</em>) and API port matches the configured management port.
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading State Spinner */}
                {diagLoading && !diagData && (
                  <div className="py-16 text-center space-y-3">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Reading system resource counters & active sessions...
                    </p>
                  </div>
                )}

                {/* Live Diagnostic Data */}
                {diagData && (
                  <>
                    {/* Top 4 Stat Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      {/* Active PPPoE Users */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-100 dark:border-indigo-900/40 shadow-sm">
                        <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
                          <Users className="w-5 h-5" />
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-200/60 dark:bg-indigo-900/60">Live</span>
                        </div>
                        <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                          {diagData.active_pppoe_users}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                          Active PPPoE Users
                        </div>
                      </div>

                      {/* System Uptime */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-100 dark:border-emerald-900/40 shadow-sm">
                        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
                          <Clock className="w-5 h-5" />
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60">Uptime</span>
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate" title={diagData.uptime}>
                          {diagData.uptime}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                          Continuous Running
                        </div>
                      </div>

                      {/* RouterOS Version */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-100 dark:border-purple-900/40 shadow-sm">
                        <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-2">
                          <Server className="w-5 h-5" />
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-200/60 dark:bg-purple-900/60">OS</span>
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate" title={diagData.version}>
                          {diagData.version}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                          RouterOS Version
                        </div>
                      </div>

                      {/* CPU Architecture */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-100 dark:border-amber-900/40 shadow-sm">
                        <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
                          <Cpu className="w-5 h-5" />
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/60">CPU</span>
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {diagData.cpu_cores} Cores
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                          {diagData.cpu_arch || 'Hardware Cores'}
                        </div>
                      </div>
                    </div>

                    {/* Hardware Utilization Bars */}
                    <div className="space-y-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500" />
                        Hardware Resource Utilization
                      </h3>

                      {/* CPU Load Progress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-700 dark:text-slate-300">CPU Load</span>
                          <span className={diagData.cpu_load > 80 ? 'text-red-500' : diagData.cpu_load > 50 ? 'text-amber-500' : 'text-emerald-500'}>
                            {diagData.cpu_load}%
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              diagData.cpu_load > 80 ? 'bg-red-500' : diagData.cpu_load > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, diagData.cpu_load))}%` }}
                          />
                        </div>
                      </div>

                      {/* RAM Usage Progress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-700 dark:text-slate-300">Memory (RAM)</span>
                          <span className="text-slate-500 dark:text-slate-400 font-normal">
                            {diagData.free_ram} free / {diagData.total_ram} ({diagData.ram_usage_percent}% used)
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              diagData.ram_usage_percent > 85 ? 'bg-red-500' : diagData.ram_usage_percent > 65 ? 'bg-amber-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, diagData.ram_usage_percent))}%` }}
                          />
                        </div>
                      </div>

                      {/* HDD Usage Progress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-700 dark:text-slate-300">Storage (HDD)</span>
                          <span className="text-slate-500 dark:text-slate-400 font-normal">
                            {diagData.free_hdd} free / {diagData.total_hdd} ({diagData.hdd_usage_percent}% used)
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              diagData.hdd_usage_percent > 90 ? 'bg-red-500' : diagData.hdd_usage_percent > 75 ? 'bg-amber-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, diagData.hdd_usage_percent))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Router Identity & Specs Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-400 font-medium">Board Model</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{diagData.model}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-400 font-medium">Identity Name</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{diagData.identity}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-400 font-medium">API Port</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedRouterForDiag.managementPort}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-400 font-medium">Winbox Port</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{selectedRouterForDiag.winboxPort || '8291'}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRouterForDiag(null);
                    setDiagData(null);
                    setDiagError(null);
                  }}
                  className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-sm transition-all"
                >
                  Close
                </button>
              </div>
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
                        <button
                          onClick={() => handleOpenDiagnostics(device)}
                          className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold text-left transition-colors flex items-center gap-1.5 group"
                          title="Click to view real-time diagnostics"
                        >
                          <span>{device.deviceName}</span>
                          <span className="opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-normal transition-opacity">Stats</span>
                        </button>
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
                      <td className="px-3 py-4 text-sm" style={{ width: '14%', minWidth: '150px' }}>
                        <div className="flex items-center gap-2">
                          {/* Live Diagnostics Button */}
                          <button
                            onClick={() => handleOpenDiagnostics(device)}
                            className="p-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 rounded-lg transition-all flex items-center gap-1 text-xs font-semibold shadow-sm hover:scale-105"
                            title="View Real-Time Hardware & Session Status"
                          >
                            <Activity className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Details</span>
                          </button>

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
                              {/* Live Diagnostics Action */}
                              <button
                                onClick={() => {
                                  setOpenPingMenuId(null);
                                  handleOpenDiagnostics(device);
                                }}
                                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center gap-2 font-medium border-b border-slate-100 dark:border-slate-700"
                              >
                                <Activity className="w-4 h-4 text-emerald-500" />
                                <span>View Live Stats</span>
                              </button>

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
