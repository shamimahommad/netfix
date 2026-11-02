import api from '@/lib/api';

export interface LiveTrafficData {
  timestamp: string;
  download_bps: number; // from tx-bits-per-second (tx-byte delta)
  upload_bps: number; // from rx-bits-per-second (rx-byte delta)
  download_bytes?: number; // from tx-byte (cumulative)
  upload_bytes?: number; // from rx-byte (cumulative)
  router_name: string;
  username?: string;
  status?: 'online' | 'offline';
}

export interface ActiveInterface {
  name: string;
  type: string;
  username?: string;
}

export interface LiveTrafficResponse {
  success: boolean;
  data: LiveTrafficData;
}

export interface ActiveInterfacesResponse {
  success: boolean;
  data: ActiveInterface[];
}

export const monitoringService = {
  async getLiveTraffic(
    serverId: string,
    username?: string,
    interfaceName?: string,
  ): Promise<LiveTrafficResponse> {
    const params: any = { serverId };
    if (username) params.username = username;
    if (interfaceName) params.interfaceName = interfaceName;

    const response = await api.get<LiveTrafficResponse>('/monitoring/live-traffic', { params });
    return response.data;
  },

  async getActiveInterfaces(serverId: string): Promise<ActiveInterfacesResponse> {
    const response = await api.get<ActiveInterfacesResponse>(`/monitoring/servers/${serverId}/interfaces`);
    return response.data;
  },
};
