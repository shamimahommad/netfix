import api from '@/lib/api';
import {
  CreateNetworkPackagePayload,
  UpdateNetworkPackagePayload,
  NetworkPackagesResponse,
  NetworkPackage,
  NetworkProtocol,
} from '@/types/network.types';

interface PackageFilters {
  serverId?: string;
  protocol?: NetworkProtocol;
  search?: string;
  page?: number;
  limit?: number;
}

export const networkPackagesService = {
  async list(filters: PackageFilters = {}): Promise<NetworkPackagesResponse> {
    const response = await api.get('/network/packages', { params: filters });
    return response.data;
  },

  async create(payload: CreateNetworkPackagePayload): Promise<{ success: boolean; data: NetworkPackage }> {
    const response = await api.post('/network/packages', payload);
    return response.data;
  },

  async update(id: string, payload: UpdateNetworkPackagePayload): Promise<{ success: boolean; data: NetworkPackage }> {
    const response = await api.put(`/network/packages/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/network/packages/${id}`);
    return response.data;
  },

  async mikrotikPreview(params: { serverId?: string; deviceId?: string; protocol?: string }): Promise<{
    success: boolean;
    router?: { id: string; name: string; ip: string };
    protocol?: string;
    total: number;
    data: Array<{
      id: string;
      name: string;
      rate_limit?: string;
      download_speed: number;
      upload_speed: number;
      download_kbps: number;
      upload_kbps: number;
      is_existing: boolean;
      suggested_price: number;
      is_default?: boolean;
    }>;
  }> {
    const response = await api.get('/network/packages/mikrotik-preview', { params });
    return response.data;
  },

  async mikrotikImport(payload: {
    serverId?: string;
    deviceId?: string;
    protocol?: string;
    packages: Array<{
      name: string;
      mikrotik_profile_name?: string;
      download_speed: number;
      upload_speed: number;
      price: number;
      validityDays?: number;
      volumeType?: string;
      volumeGb?: number;
    }>;
  }): Promise<{
    success: boolean;
    message: string;
    imported_count: number;
    updated_count: number;
    total_processed: number;
  }> {
    const response = await api.post('/network/packages/mikrotik-import', payload);
    return response.data;
  },
};
