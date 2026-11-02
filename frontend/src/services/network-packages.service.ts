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
};
