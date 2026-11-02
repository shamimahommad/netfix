export interface NetworkDevice {
  networkDeviceId: string;
  deviceCode: string;
  deviceName: string;
  deviceType: 'router' | 'switch' | 'olt' | 'access_point' | 'firewall' | 'other';
  vendor: 'mikrotik' | 'olt' | 'cisco' | 'ubiquiti' | 'huawei' | 'other';
  status: 'active' | 'inactive' | 'maintenance' | 'offline' | 'decommissioned';
  managementIp: string | null;
  dnsName: string | null;
  managementPort: number;
  winboxPort: number | null;
  webPort: number | null;
  apiUsername: string | null;
  apiPassword: string | null; // Masked as '******' from backend
  isProduction: boolean;
  customPingInterval: number | null;
  pingStatus: 'online' | 'auth_failed' | 'offline' | null;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNetworkDevicePayload {
  deviceCode: string;
  deviceName: string;
  managementIp: string;
  dnsName?: string;
  managementPort?: number;
  winboxPort?: number;
  webPort?: number;
  apiUsername: string;
  apiPassword: string;
  vendor?: 'mikrotik';
  deviceType?: 'router';
  isProduction?: boolean;
}

export interface CreateOltDevicePayload {
  deviceCode: string;
  deviceName: string;
  managementIp: string;
  dnsName?: string;
  managementPort?: number;
  apiUsername?: string;
  apiPassword?: string;
  isProduction?: boolean;
}

export interface UpdateNetworkDevicePayload {
  deviceName?: string;
  managementIp?: string;
  dnsName?: string;
  managementPort?: number;
  winboxPort?: number;
  webPort?: number;
  apiUsername?: string;
  apiPassword?: string;
  isProduction?: boolean;
}

export interface UpdateDeviceStatusPayload {
  status: 'active' | 'inactive' | 'maintenance' | 'offline' | 'decommissioned';
}

export interface CreateNetworkDeviceResponse {
  success: boolean;
  data: NetworkDevice;
}

export interface NetworkDevicesResponse {
  success: boolean;
  data: NetworkDevice[];
}

export interface UpdateNetworkDeviceResponse {
  success: boolean;
  data: NetworkDevice;
}

export interface UpdateDeviceStatusResponse {
  success: boolean;
  data: NetworkDevice;
}

export enum MikroTikAction {
  RESTART = 'restart',
  DNS_FLUSH = 'dns_flush',
  CREATE_BACKUP = 'create_backup',
  SYNC_CLIENTS = 'sync_clients',
  PPP_SERVER_TROUBLESHOOT = 'ppp_server_troubleshoot',
  PPP_MAC_BIND_ALL = 'ppp_mac_bind_all',
  PPP_MAC_UNBIND_ALL = 'ppp_mac_unbind_all',
  HOTSPOT_TROUBLESHOOT = 'hotspot_troubleshoot',
  HS_DISABLE_DNS_REDIRECT = 'hs_disable_dns_redirect',
  HOTSPOT_ADDRESS_LIST = 'hotspot_address_list',
  HOTSPOT_UPDATE_CONFIG_JS = 'hotspot_update_config_js',
  BIND_API_IP = 'bind_api_ip',
  COPY_PACKAGES = 'copy_packages',
}

export interface DeviceActionPayload {
  action: MikroTikAction;
}

export interface DeviceActionResponse {
  success: boolean;
  action: MikroTikAction;
  deviceId: string;
  action_status: 'success' | 'failed' | 'timeout';
  execution_time: number;
  error_message: string | null;
  data?: any;
}

export type NetworkProtocol = 'pppoe' | 'hotspot' | 'static' | 'ovpn' | 'pptp';
export type NetworkPackageStatus = 'enabled' | 'disabled';
export type NetworkPackagePrivacy = 'public' | 'private';

export interface NetworkPackage {
  id: string;
  serverId: string;
  serverName: string;
  protocol: NetworkProtocol;
  color: string;
  name: string;
  mikrotikProfileId?: string | null;
  mikrotikProfileName?: string | null;
  price: number;
  downloadSpeedKbps?: number;
  uploadSpeedKbps?: number;
  download_speed?: number;
  upload_speed?: number;
  validity: {
    days: number;
    hours: number;
  };
  volume: {
    type: 'unlimited' | 'gb';
    gb: number | null;
  };
  privacy: NetworkPackagePrivacy;
  status: NetworkPackageStatus;
  count: number;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkPackagesResponse {
  success: boolean;
  data: NetworkPackage[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateNetworkPackagePayload {
  serverId: string;
  protocol: NetworkProtocol;
  name: string;
  code?: string;
  color?: string;
  price: number;
  download_speed?: number;
  upload_speed?: number;
  downloadSpeedKbps?: number;
  uploadSpeedKbps?: number;
  validityDays: number;
  validityHours?: number;
  volumeType: 'unlimited' | 'gb';
  volumeGb?: number;
  privacy: NetworkPackagePrivacy;
  status?: NetworkPackageStatus;
  mikrotik_profile_id?: string;
  mikrotik_profile_name?: string;
}

export interface UpdateNetworkPackagePayload extends Partial<CreateNetworkPackagePayload> {}