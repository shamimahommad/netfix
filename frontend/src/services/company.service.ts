import api from '@/lib/api';
import { CompanyProfile, CompanyProfileUpdatePayload } from '@/types/company.types';

export const companyService = {
  /**
   * Get current company profile
   */
  async getProfile(): Promise<{ success: boolean; data: CompanyProfile }> {
    const res = await api.get<{ success: boolean; data: CompanyProfile }>('/company/profile');
    return res.data;
  },

  /**
   * Update company profile with optional logo file
   */
  async updateProfile(
    payload: CompanyProfileUpdatePayload
  ): Promise<{ success: boolean; message: string; data: CompanyProfile }> {
    if (payload.logo instanceof File) {
      const formData = new FormData();
      if (payload.company_name !== undefined) formData.append('company_name', payload.company_name);
      if (payload.company_email !== undefined) formData.append('company_email', payload.company_email);
      if (payload.owner_phone !== undefined) formData.append('owner_phone', payload.owner_phone);
      if (payload.support_phone !== undefined) formData.append('support_phone', payload.support_phone);
      if (payload.address !== undefined) formData.append('address', payload.address);
      formData.append('logo', payload.logo);

      const res = await api.post<{ success: boolean; message: string; data: CompanyProfile }>(
        '/company/profile',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return res.data;
    }

    const res = await api.post<{ success: boolean; message: string; data: CompanyProfile }>(
      '/company/profile',
      payload
    );
    return res.data;
  },
};

