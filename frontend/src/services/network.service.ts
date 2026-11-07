import { api } from '@/lib/api';
import {
  NetworkDevice,
  CreateNetworkDevicePayload,
  CreateNetworkDeviceResponse,
  CreateOltDevicePayload,
  NetworkDevicesResponse,
  UpdateNetworkDevicePayload,
  UpdateNetworkDeviceResponse,
  UpdateDeviceStatusPayload,
  UpdateDeviceStatusResponse,
  DeviceActionPayload,
  DeviceActionResponse,
  NetworkProtocol,
} from '@/types/network.types';

export const networkService = {
  async createNetworkDevice(payload: CreateNetworkDevicePayload): Promise<CreateNetworkDeviceResponse> {
    const response = await api.post<CreateNetworkDeviceResponse>('/network/devices', payload);
    return response.data;
  },

  async getNetworkDevices(type?: 'mikrotik' | 'olt'): Promise<NetworkDevicesResponse> {
    const params = type ? { type } : {};
    const response = await api.get<NetworkDevicesResponse>('/network/devices', { params });
    return response.data;
  },

  async getNetworkDeviceById(deviceId: string): Promise<{ success: boolean; data: NetworkDevice }> {
    const response = await api.get<{ success: boolean; data: NetworkDevice }>(`/network/devices/${deviceId}`);
    return response.data;
  },

  async createOltDevice(payload: CreateOltDevicePayload): Promise<CreateNetworkDeviceResponse> {
    const response = await api.post<CreateNetworkDeviceResponse>('/network/devices/olt', payload);
    return response.data;
  },

  async updateNetworkDevice(deviceId: string, payload: UpdateNetworkDevicePayload): Promise<UpdateNetworkDeviceResponse> {
    const response = await api.put<UpdateNetworkDeviceResponse>(`/network/devices/${deviceId}`, payload);
    return response.data;
  },

  async updateDeviceStatus(deviceId: string, payload: UpdateDeviceStatusPayload): Promise<UpdateDeviceStatusResponse> {
    const response = await api.patch<UpdateDeviceStatusResponse>(`/network/devices/${deviceId}/status`, payload);
    return response.data;
  },

  async deleteNetworkDevice(deviceId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/network/devices/${deviceId}`);
    return response.data;
  },

  async executeDeviceAction(deviceId: string, payload: DeviceActionPayload): Promise<DeviceActionResponse> {
    const response = await api.post<DeviceActionResponse>(`/network/devices/${deviceId}/action`, payload);
    return response.data;
  },

  async getPingStatuses(): Promise<{ success: boolean; data: Array<{ deviceId: string; pingStatus: 'online' | 'auth_failed' | 'offline' | null; latencyMs: number | null; lastCheckedAt: string | null }> }> {
    const response = await api.get('/network/devices/ping-status');
    return response.data;
  },

  async pingNow(deviceId: string): Promise<{ success: boolean; action_status: 'success' | 'failed' | 'timeout'; execution_time: number; error_message: string | null; data?: { status: 'online' | 'auth_failed' | 'offline'; latencyMs: number | null } }> {
    const response = await api.post(`/network/devices/${deviceId}/ping-now`);
    return response.data;
  },

  async updatePingInterval(deviceId: string, customPingInterval: number | null): Promise<{ success: boolean; message: string }> {
    const response = await api.patch(`/network/devices/${deviceId}/ping-interval`, { customPingInterval });
    return response.data;
  },

  async getDeviceProfiles(
    deviceId: string,
    protocol: NetworkProtocol,
  ): Promise<{ success: boolean; data: Array<{ id: string; name: string }> }> {
    const response = await api.get(`/network/devices/${deviceId}/profiles`, { params: { protocol } });
    return response.data;
  },

  async getDevicesDropdown(type: string = 'router'): Promise<{
    success: boolean;
    data: Array<{ id: string; name: string; type?: string; vendor?: string; status?: string }>;
  }> {
    const response = await api.get('/network/devices/dropdown', {
      params: type ? { type } : undefined,
    });
    return response.data;
  },

  async getNextDeviceCode(): Promise<{ deviceCode: string }> {
    const response = await api.get<{ deviceCode: string }>('/network/devices/next-code');
    return response.data;
  },

  async getOltStatus(deviceId: string, refresh = false): Promise<{ success: boolean; data: any }> {
    const response = await api.get<{ success: boolean; data: any }>(`/network/devices/${deviceId}/olt-status`, {
      params: refresh ? { refresh: 'true' } : undefined,
    });
    return response.data;
  },

  async getRouterDetails(deviceId: string): Promise<{
    success: boolean;
    status: 'online' | 'offline' | 'error';
    message?: string;
    target?: string;
    data?: {
      identity: string;
      model: string;
      version: string;
      uptime: string;
      cpu_load: number;
      cpu_cores: number;
      cpu_arch?: string;
      total_ram: string;
      free_ram: string;
      ram_usage_percent: number;
      total_hdd: string;
      free_hdd: string;
      hdd_usage_percent: number;
      active_pppoe_users: number;
    };
  }> {
    const response = await api.get(`/network/devices/${deviceId}/details`);
    return response.data;
  },

  async getOltOnus(deviceId: string, pon?: number): Promise<{ success: boolean; data: { total: number; onus: any[] } }> {
    const response = await api.get<{ success: boolean; data: { total: number; onus: any[] } }>(`/network/devices/${deviceId}/onus`, {
      params: pon ? { pon } : undefined,
    });
    return response.data;
  },

  async syncOlt(deviceId: string): Promise<{ success: boolean; message: string; data: any }> {
    const response = await api.post<{ success: boolean; message: string; data: any }>(`/network/devices/${deviceId}/sync-olt`);
    return response.data;
  },
};
