import api from '@/lib/api';

export interface BtrcSettings {
  division: string;
  district: string;
  thana: string;
  distribution_point: string;
  vat_percentage: number;
}

export interface BtrcSummary {
  total_subscribers: number;
  home_count: number;
  corporate_count: number;
  sme_count: number;
  total_bandwidth_mbps: number;
  total_revenue_ex_vat: number;
  total_revenue_inc_vat: number;
}

export interface BtrcRow {
  client_type: 'Home' | 'Corporate' | 'SME';
  connection_type: 'Wired' | 'Wireless';
  client_username: string | number;
  bandwidth_distribution_point: string;
  connectivity_type: 'Shared' | 'Dedicated';
  activation_date: string;
  bandwidth_allocation: number;
  allocated_ip: string;
  division: string;
  district: string;
  thana: string;
  address: string;
  client_mobile: string;
  client_email: string;
  selling_price_bdt_excluding_vat: number;
  customer_id: number;
  full_name?: string;
  status?: string;
  billing_status?: string;
}

export interface BtrcReportData {
  summary: BtrcSummary;
  settings: BtrcSettings;
  rows: BtrcRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface BtrcReportParams {
  year?: number;
  month?: number;
  client_type?: string;
  category?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  export?: string;
}

export const btrcService = {
  async getReport(params?: BtrcReportParams): Promise<BtrcReportData> {
    const res = await api.get('/reports/btrc', { params });
    return res.data?.data;
  },

  async updateSettings(settings: Record<string, any>): Promise<any> {
    const res = await api.post('/reports/btrc/settings', settings);
    return res.data;
  },

  async bulkCategorize(payload: {
    customer_ids: number[];
    client_type?: string;
    btrc_category?: string;
    connectivity_type?: string;
    connection_type?: string;
    distribution_point?: string;
    division?: string;
    district?: string;
    thana?: string;
  }): Promise<any> {
    const res = await api.post('/reports/btrc/categorize', payload);
    return res.data;
  },
};
