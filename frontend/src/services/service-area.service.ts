import api from '@/lib/api';
import {
  ServiceArea,
  SubArea,
  CreateAreaPayload,
  UpdateAreaPayload,
  CreateSubAreaPayload,
  UpdateSubAreaPayload,
} from '@/types/service-area.types';

export const serviceAreaService = {
  async listAreas(): Promise<{ success: boolean; data: ServiceArea[] }> {
    const res = await api.get('/service-area/areas');
    return res.data;
  },
  async createArea(payload: CreateAreaPayload): Promise<{ success: boolean; data: ServiceArea }> {
    const res = await api.post('/service-area/areas', payload);
    return res.data;
  },
  async updateArea(id: string, payload: UpdateAreaPayload): Promise<{ success: boolean; data: ServiceArea }> {
    const res = await api.put(`/service-area/areas/${id}`, payload);
    return res.data;
  },
  async deleteArea(id: string): Promise<{ success: boolean }> {
    const res = await api.delete(`/service-area/areas/${id}`);
    return res.data;
  },

  async listSubAreas(serviceAreaId?: string): Promise<{ success: boolean; data: SubArea[] }> {
    const res = await api.get('/service-area/sub-areas', { params: serviceAreaId ? { serviceAreaId } : {} });
    return res.data;
  },
  async createSubArea(payload: CreateSubAreaPayload): Promise<{ success: boolean; data: SubArea }> {
    const res = await api.post('/service-area/sub-areas', payload);
    return res.data;
  },
  async updateSubArea(id: string, payload: UpdateSubAreaPayload): Promise<{ success: boolean; data: SubArea }> {
    const res = await api.put(`/service-area/sub-areas/${id}`, payload);
    return res.data;
  },
  async deleteSubArea(id: string): Promise<{ success: boolean }> {
    const res = await api.delete(`/service-area/sub-areas/${id}`);
    return res.data;
  },
};

