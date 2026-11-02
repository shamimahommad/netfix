import api from '@/lib/api';

export interface ReceivedByOption {
  userId: string;
  fullName: string;
  roleCode: string;
}

export interface ReceivedByOptionsResponse {
  success: boolean;
  data: ReceivedByOption[];
}

export const usersService = {
  async getReceivedByOptions(): Promise<ReceivedByOption[]> {
    const response = await api.get<ReceivedByOptionsResponse>('/users/received-by-options');
    return response.data.data;
  },
};
