import api from '@/lib/api';

export interface LiveTrafficData {
  timestamp: string;
  download_bps: number; // Client Download (from Router tx-bits-per-second)
  upload_bps: number;   // Client Upload (from Router rx-bits-per-second)
  tx_bps: number;       // Upload bps (Red series in demo graph)
  rx_bps: number;       // Download bps (Blue series in demo graph)
  tx_mbps?: number;
  rx_mbps?: number;
  router_name: string;
  router_id?: string | number;
  username?: string;
  interface?: string;
  status?: 'online' | 'offline';
  ip?: string;
  mac?: string;
  uptime?: string;
  session?: any;
}

export interface ActiveInterface {
  name: string;
  type: string;
  username?: string;
  ip?: string;
  mac?: string;
  callerId?: string;
  uptime?: string;
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
    serverId?: string,
    username?: string,
    interfaceName?: string,
    serverName?: string,
  ): Promise<LiveTrafficResponse> {
    const params: any = {};
    if (serverId) params.serverId = serverId;
    if (serverName) params.serverName = serverName;
    if (username) params.username = username;
    if (interfaceName) params.interfaceName = interfaceName;

    const response = await api.get<LiveTrafficResponse>('/monitoring/live-traffic', { params });
    return response.data;
  },

  async getActiveInterfaces(serverId: string, serverName?: string): Promise<ActiveInterfacesResponse> {
    const params: any = {};
    if (serverName) params.serverName = serverName;
    const response = await api.get<ActiveInterfacesResponse>(`/monitoring/servers/${serverId || '0'}/interfaces`, { params });
    return response.data;
  },
};
