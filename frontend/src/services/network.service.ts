import { api } from '@/lib/api';
import {
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

  async getDevicesDropdown(): Promise<{
    success: boolean;
    data: Array<{ id: string; name: string; type?: string; vendor?: string; status?: string }>;
  }> {
    const response = await api.get('/network/devices/dropdown');
    return response.data;
  },

  async getNextDeviceCode(): Promise<{ deviceCode: string }> {
    const response = await api.get<{ deviceCode: string }>('/network/devices/next-code');
    return response.data;
  },
};
