import api from '@/lib/api';

export interface AccessProfileDropdownItem {
  id: string;
  name: string;
  price?: number;
  download_kbps?: number;
  upload_kbps?: number;
  is_default?: boolean;
}

export const accessProfilesService = {
  async getDropdown(): Promise<{ success: boolean; data: AccessProfileDropdownItem[] }> {
    const response = await api.get<{ success: boolean; data: AccessProfileDropdownItem[] }>('/access-profiles/dropdown');
    return response.data;
  },
};
