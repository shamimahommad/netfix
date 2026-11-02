import api from '@/lib/api';

export interface BillingAccountsResponse {
  success: boolean;
  data: any[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    newCustomersCount?: number | null;
  };
}

export interface BillingAccountsFilters {
  search?: string;
  page?: number;
  limit?: number;
  dateRange?: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'custom';
  startDate?: string;
  endDate?: string;
}

export const billingService = {
  async getBillingAccounts(
    filterType: 'all' | 'active' | 'new-customers' | 'expire-3-days' | 'expire-7-days' | 'expired' | 'suspended' | 'left',
    filters: BillingAccountsFilters = {},
  ): Promise<BillingAccountsResponse> {
    const params = new URLSearchParams();
    
    if (filters.search) {
      params.append('search', filters.search);
    }
    if (filters.page) {
      params.append('page', filters.page.toString());
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString());
    }
    if (filters.dateRange) {
      params.append('dateRange', filters.dateRange);
    }
    if (filters.startDate) {
      params.append('startDate', filters.startDate);
    }
    if (filters.endDate) {
      params.append('endDate', filters.endDate);
    }

    const queryString = params.toString();
    const url = `/billing/accounts/${filterType}${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get<BillingAccountsResponse>(url);
    return response.data;
  },

  async renewService(payload: {
    customer_id: string;
    old_expire_date: string;
    billing_cycle: 'Monthly' | 'Day-based';
    no_of_month?: number;
    selected_days?: number;
    plan_id: string;
    plan_price: number;
    send_sms?: boolean;
    renew_as_reseller?: boolean;
    pay_from_customer_balance?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      new_expire_date: string;
      bill_amount: number;
    };
  }> {
    const response = await api.post('/billing/renew', payload);
    return response.data;
  },

  async changePackage(payload: {
    customer_id: string;
    plan_id: string;
    plan_price?: number;
  }): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/billing/change-package', payload);
    return response.data;
  },

  async getTenantInvoices(params?: {
    status?: string;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    ownerId?: string;
    serverId?: string;
    protocol?: string;
    area?: string;
    subArea?: string;
    payMethod?: string;
    searchBy?: string;
    search?: string;
  }): Promise<{
    success: boolean;
    data: InvoiceDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.page != null) search.set('page', String(params.page));
    if (params?.limit != null) search.set('limit', String(params.limit));
    if (params?.dateFrom) search.set('dateFrom', params.dateFrom);
    if (params?.dateTo) search.set('dateTo', params.dateTo);
    if (params?.ownerId) search.set('ownerId', params.ownerId);
    if (params?.serverId) search.set('serverId', params.serverId);
    if (params?.protocol) search.set('protocol', params.protocol);
    if (params?.area) search.set('area', params.area);
    if (params?.subArea) search.set('subArea', params.subArea);
    if (params?.payMethod) search.set('payMethod', params.payMethod);
    if (params?.searchBy) search.set('searchBy', params.searchBy);
    if (params?.search?.trim()) search.set('search', params.search.trim());
    const q = search.toString();
    const response = await api.get<{
      success: boolean;
      data: InvoiceDto[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(`/billing/invoices${q ? `?${q}` : ''}`);
    return response.data;
  },

  async listInvoices(params?: any) {
    return this.getTenantInvoices(params);
  },

  async getCustomerInvoices(
    customerId: string,
    status?: string,
  ): Promise<{ success: boolean; data: InvoiceDto[] }> {
    const params = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await api.get<{ success: boolean; data: InvoiceDto[] }>(
      `/billing/customers/${customerId}/invoices${params}`,
    );
    return response.data;
  },

  async getInvoice(invoiceId: string): Promise<{ success: boolean; data: InvoiceDto }> {
    const response = await api.get<{ success: boolean; data: InvoiceDto }>(
      `/billing/invoices/${invoiceId}`,
    );
    return response.data;
  },

  async cancelInvoice(invoiceId: string): Promise<{ success: boolean; message: string; data: InvoiceDto }> {
    const response = await api.post<{ success: boolean; message: string; data: InvoiceDto }>(
      `/billing/invoices/${invoiceId}/cancel`,
    );
    return response.data;
  },

  async returnInvoice(invoiceId: string): Promise<{
    success: boolean;
    message: string;
    returnAmount: number;
    usedAmount: number;
    data: InvoiceDto;
  }> {
    const response = await api.post<{
      success: boolean;
      message: string;
      returnAmount: number;
      usedAmount: number;
      data: InvoiceDto;
    }>(`/billing/invoices/${invoiceId}/return`);
    return response.data;
  },
};

export interface InvoiceDto {
  invoiceId: string;
  tenantId: string;
  customerId: string;
  customerServiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  basePrice?: number | null;
  sellPrice?: number | null;
  commissionPercent?: number | null;
  commissionAmount?: number | null;
  collectedBy?: string | null;
  parentUserId?: string | null;
  renewMode?: string | null;
  chargedUserId?: string | null;
  doneBy?: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Only the last paid invoice can be cancelled or returned */
  isLastPaidInvoice?: boolean;
  /** Report list: customer full name */
  customerName?: string | null;
  /** Report list: customer network username */
  username?: string | null;
  /** Report list: customer phone/mobile */
  mobile?: string | null;
  /** Report list: customer's current balance from ledger */
  customerBalance?: number | null;
}
