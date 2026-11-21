import api from '@/lib/api';

export interface FtthBoxPort {
  portRecordId: number;
  portNumber: number;
  status: 'available' | 'occupied' | 'reserved' | 'damaged';
  onuMac: string | null;
  opticalRxPower: number | null;
  cableColor: string | null;
  coreNumber: number | null;
  notes: string | null;
  customer: {
    customerId: number;
    customerCode: string;
    name: string;
    phone: string | null;
    username: string | null;
    package: string | null;
    status: string;
    billingStatus: string | null;
  } | null;
}

export interface FtthBox {
  id: number;
  tenant_id?: number;
  box_name: string;
  box_code: string;
  box_type: 'splitter_box' | 'tj_box' | 'odf' | 'pole_box';
  latitude: number;
  longitude: number;
  address: string | null;
  pole_number: string | null;
  total_ports: number;
  splitter_ratio: string;
  olt_device_id: number | null;
  olt_name?: string | null;
  pon_port: string | null;
  upstream_box_id: number | null;
  optical_input_power: number | null;
  status: 'active' | 'full' | 'maintenance' | 'damaged';
  notes: string | null;
  occupied_ports?: number;
  available_ports?: number;
  damaged_ports?: number;
  reserved_ports?: number;
  utilization_pct?: number;
  ports?: FtthBoxPort[];
  created_at?: string;
  updated_at?: string;
}

export interface FtthAvailableDevice {
  network_device_id: number;
  device_code: string;
  device_name: string;
  device_type: 'router' | 'olt' | 'switch';
  vendor: string;
  status: 'active' | 'offline' | 'warning';
  management_ip: string;
  pon_type?: string | null;
  total_pon_ports?: number | null;
  noc_station_id?: number | null;
  noc_station_name?: string | null;
}

export interface FtthNocStation {
  id: number;
  tenant_id: number;
  name: string;
  station_type: 'main_office' | 'sub_pop' | 'server_room';
  latitude: number;
  longitude: number;
  address: string | null;
  contact_phone: string | null;
  coverage_radius_km: number;
  notes: string | null;
  olt_count: number;
  router_count: number;
  outgoing_cables_count: number;
  devices: FtthAvailableDevice[];
  olts: FtthAvailableDevice[];
  routers: FtthAvailableDevice[];
}

export interface FtthCable {
  id: number;
  cableName: string;
  coreCount: number;
  fromType: 'olt' | 'box' | 'noc';
  fromId: number | null;
  fromName: string;
  toBoxId: number;
  toBoxName: string;
  color: string;
  lengthMeters: number | null;
  status: 'active' | 'cut' | 'high_loss' | 'maintenance';
  routeCoords: [number, number][];
}

export interface FtthStats {
  totalBoxes: number;
  totalPorts: number;
  occupiedPorts: number;
  availablePorts: number;
  damagedPorts: number;
  reservedPorts: number;
  totalCables: number;
  utilizationRate: number;
}

export interface NearestBoxResult {
  boxId: number;
  boxName: string;
  boxCode: string;
  boxType: string;
  latitude: number;
  longitude: number;
  address: string | null;
  poleNumber: string | null;
  splitterRatio: string;
  totalPorts: number;
  availablePorts: number;
  occupiedPorts: number;
  distanceMeters: number;
  distanceDisplay: string;
  isFeasible: boolean;
  recommendedCable: string;
}

export const ftthService = {
  async getBoxes(params?: { status?: string; box_type?: string; search?: string }): Promise<FtthBox[]> {
    const res = await api.get<{ success: boolean; data: FtthBox[] }>('/ftth/boxes', { params });
    return res.data.data;
  },

  async getBox(id: number): Promise<FtthBox> {
    const res = await api.get<{ success: boolean; data: FtthBox }>(`/ftth/boxes/${id}`);
    return res.data.data;
  },

  async createBox(data: Partial<FtthBox>): Promise<FtthBox> {
    const res = await api.post<{ success: boolean; message: string; data: FtthBox }>('/ftth/boxes', data);
    return res.data.data;
  },

  async updateBox(id: number, data: Partial<FtthBox>): Promise<FtthBox> {
    const res = await api.put<{ success: boolean; message: string; data: FtthBox }>(`/ftth/boxes/${id}`, data);
    return res.data.data;
  },

  async deleteBox(id: number): Promise<void> {
    await api.delete(`/ftth/boxes/${id}`);
  },

  async assignPort(boxId: number, payload: { portNumber: number; customerId: number; onuMac?: string; notes?: string }): Promise<FtthBox> {
    const res = await api.post<{ success: boolean; message: string; data: FtthBox }>(`/ftth/boxes/${boxId}/assign`, payload);
    return res.data.data;
  },

  async unassignPort(boxId: number, portNumber: number): Promise<FtthBox> {
    const res = await api.post<{ success: boolean; message: string; data: FtthBox }>(`/ftth/boxes/${boxId}/unassign`, { portNumber });
    return res.data.data;
  },

  async findNearest(lat: number, lng: number, maxKm: number = 10): Promise<NearestBoxResult[]> {
    const res = await api.get<{ success: boolean; data: NearestBoxResult[] }>('/ftth/nearest', {
      params: { lat, lng, max_km: maxKm },
    });
    return res.data.data;
  },

  async getCables(): Promise<FtthCable[]> {
    const res = await api.get<{ success: boolean; data: FtthCable[] }>('/ftth/cables');
    return res.data.data;
  },

  async saveCable(data: Partial<FtthCable>): Promise<{ id: number }> {
    const res = await api.post<{ success: boolean; message: string; data: { id: number } }>('/ftth/cables', data);
    return res.data.data;
  },

  async deleteCable(id: number): Promise<void> {
    await api.delete(`/ftth/cables/${id}`);
  },

  async getStats(): Promise<FtthStats> {
    const res = await api.get<{ success: boolean; data: FtthStats }>('/ftth/stats');
    return res.data.data;
  },

  async getNocStations(): Promise<FtthNocStation[]> {
    const res = await api.get<{ success: boolean; data: FtthNocStation[] }>('/ftth/nocs');
    return res.data.data;
  },

  async saveNocStation(data: Partial<FtthNocStation> & { device_ids?: number[] }): Promise<{ id: number }> {
    const res = await api.post<{ success: boolean; message: string; data: { id: number } }>('/ftth/nocs', data);
    return res.data.data;
  },

  async deleteNocStation(id: number): Promise<void> {
    await api.delete(`/ftth/nocs/${id}`);
  },

  async getDevices(): Promise<FtthAvailableDevice[]> {
    const res = await api.get<{ success: boolean; data: FtthAvailableDevice[] }>('/ftth/devices');
    return res.data.data;
  },
};

export default ftthService;
