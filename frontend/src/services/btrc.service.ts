import api from '@/lib/api';

export interface BtrcProfile {
  operator_name: string;
  license_no: string;
  license_category: string;
  purchased_bandwidth_mbps: number;
  contact_person: string;
  contact_designation: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  default_thana: string;
  default_district: string;
  reporting_month: string;
  reporting_year: number;
  reporting_period: string;
}

export interface BtrcCategorySummary {
  category_name: string;
  btrc_code: string;
  total_subscribers: number;
  active_subscribers: number;
  new_connections: number;
  disconnected: number;
  expired: number;
  prev_month_active: number;
  total_bandwidth_mbps: number;
  total_upload_mbps: number;
  avg_bandwidth_mbps: number;
  total_revenue_bdt: number;
}

export interface BtrcBandwidthSlab {
  label: string;
  home: number;
  corporate: number;
  sme: number;
  total: number;
  total_mbps: number;
}

export interface BtrcMediaDistribution {
  label: string;
  count: number;
  bandwidth_mbps: number;
}

export interface BtrcSubscriber {
  sl: number;
  customer_id: number;
  operator_name: string;
  client_id: string;
  client_name: string;
  client_type: string;
  btrc_category: 'home' | 'corporate' | 'sme';
  connection_type: string;
  connectivity_media: string;
  connectivity_type: 'fiber' | 'wireless' | 'copper';
  bandwidth_mbps: number;
  upload_mbps: number;
  bandwidth_display: string;
  allocated_ip: string;
  phone: string;
  national_id: string;
  installation_address: string;
  thana: string;
  district: string;
  activation_date: string;
  monthly_bill: number;
  status: string;
  billing_status: string;
  package_name: string;
  area_name: string;
}

export interface BtrcReportData {
  btrc_profile: BtrcProfile;
  category_summaries: {
    home: BtrcCategorySummary;
    corporate: BtrcCategorySummary;
    sme: BtrcCategorySummary;
  };
  grand_totals: BtrcCategorySummary;
  bandwidth_slabs: BtrcBandwidthSlab[];
  media_distribution: BtrcMediaDistribution[];
  subscribers: BtrcSubscriber[];
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
    btrc_category: string;
    connectivity_type?: string;
    thana?: string;
    district?: string;
  }): Promise<any> {
    const res = await api.post('/reports/btrc/categorize', payload);
    return res.data;
  },
};
