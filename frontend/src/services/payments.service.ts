import api from '@/lib/api';

export interface CreatePaymentPayload {
  customerId: string;
  amount: number;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
  paymentDate?: string;
  receivedByUserId?: string;
  receivedByRole?: string;
  sendSms?: boolean;
}

export interface PaymentResponse {
  paymentId: string;
  tenantId: string;
  customerId: string;
  invoiceId: string | null;
  amount: number;
  paymentMethod: string | null;
  referenceNumber: string | null;
  notes: string | null;
  paymentDate: string;
  createdAt: string;
}

export interface RecordPaymentResponse {
  success: boolean;
  data: PaymentResponse;
  invoice?: {
    invoiceId: string;
    invoiceNumber: string;
    status: string;
    balanceDue: number;
  };
}

export interface OnlineTransactionItem {
  paymentIntentId: string;
  merchantInvoiceNumber: string;
  invoiceNumber: string | null;
  invoiceId: string | null;
  gateway: string;
  gatewayPaymentId: string | null;
  amount: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
  customerId: string;
  payeeName: string;
  payeeMobile: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

export interface OnlineTransactionsSummary {
  today: number;
  yesterday: number;
  thisMonth: number;
  lastMonth: number;
  filteredTotal: number;
}

export interface OnlineTransactionsResponse {
  success: boolean;
  data: {
    items: OnlineTransactionItem[];
    total: number;
    summary: OnlineTransactionsSummary;
  };
}

export interface OnlineTransactionsParams {
  status?: string;
  gateway?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface RechargeHistoryCombinedParams {
  userId?: string;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  method?: string;
  page?: number;
  limit?: number;
}

export interface CustomerPaymentsReportParams {
  userId?: string;
  createdBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  method?: string;
  page?: number;
  limit?: number;
}

export interface RechargeHistoryParams {
  userId?: string;
  initiator?: string;
  createdBy?: string;
  method?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  order?: 'asc' | 'desc';
}

export const paymentsService = {
  async recordPayment(payload: CreatePaymentPayload): Promise<RecordPaymentResponse> {
    const response = await api.post<RecordPaymentResponse>('/payments', payload);
    return response.data;
  },

  async getCustomerPayments(params: CustomerPaymentsReportParams | string = {}): Promise<{
    data: Array<{
      ref: string;
      ref_no: string;
      initiator_name: string;
      collector_name: string;
      pop_name: string;
      pop_in_charge_name: string;
      debit: number;
      credit: number | null;
      balance: number;
      balance_after: number;
      created_at: string;
      description: string;
      customer_name?: string;
      customer_code?: string;
      method?: string;
    }>;
    meta?: {
      total: number;
      page: number;
      limit: number;
    };
    total?: number;
  }> {
    if (typeof params === 'string') {
      const response = await api.get<{ success: boolean; data: any }>(`/payments/customers/${params}`);
      return { data: Array.isArray(response.data?.data) ? response.data.data : [] };
    }
    const searchParams = new URLSearchParams();
    if (params.userId) searchParams.set('userId', params.userId);
    if (params.createdBy) searchParams.set('createdBy', params.createdBy);
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) searchParams.set('dateTo', params.dateTo);
    if (params.search) searchParams.set('search', params.search);
    if (params.method) searchParams.set('method', params.method);
    if (params.page != null) searchParams.set('page', String(params.page));
    if (params.limit != null) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    const response = await api.get<{
      success: boolean;
      total: number;
      current_page: number;
      per_page: number;
      meta?: { total: number; page: number; limit: number };
      data: any[];
    }>(`/payments/customer-payments${qs ? `?${qs}` : ''}`);
    return {
      data: response.data?.data || [],
      meta: response.data?.meta || { total: response.data?.total || 0, page: response.data?.current_page || 1, limit: response.data?.per_page || 25 },
      total: response.data?.total || 0,
    };
  },

  async getOnlineTransactions(params: OnlineTransactionsParams = {}): Promise<OnlineTransactionsResponse['data']> {
    const searchParams = new URLSearchParams();
    if (params.status != null) searchParams.set('status', params.status);
    if (params.gateway != null) searchParams.set('gateway', params.gateway);
    if (params.dateFrom != null) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo != null) searchParams.set('dateTo', params.dateTo);
    if (params.search != null) searchParams.set('search', params.search);
    if (params.page != null) searchParams.set('page', String(params.page));
    if (params.limit != null) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    const url = `/payments/online-transactions${qs ? `?${qs}` : ''}`;
    const response = await api.get<OnlineTransactionsResponse>(url);
    return response.data.data;
  },

  /** Customer payments only: recharge/renew/topup/manual cash from transactions table */
  async getRechargeHistory(params: RechargeHistoryParams): Promise<{
    data: Array<{
      sl: number;
      ref: string;
      initiator_name: string;
      pop_in_charge_name: string;
      debit: number;
      credit: number | null;
      balance_after: number;
      created_at: string;
      description: string;
    }>;
    total: number;
    current_page: number;
    per_page: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params.userId != null) searchParams.set('userId', params.userId);
    if (params.initiator != null) searchParams.set('initiator', params.initiator);
    if (params.createdBy != null) searchParams.set('pop_in_charge', params.createdBy);
    if (params.method != null) searchParams.set('method', params.method);
    if (params.dateFrom != null) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo != null) searchParams.set('dateTo', params.dateTo);
    if (params.search != null) searchParams.set('search', params.search);
    if (params.page != null) searchParams.set('page', String(params.page));
    if (params.limit != null) searchParams.set('limit', String(params.limit));
    if (params.order != null) searchParams.set('order', params.order);
    const qs = searchParams.toString();
    const url = `/payments/recharge-history${qs ? `?${qs}` : ''}`;
    const response = await api.get<{
      total: number;
      current_page: number;
      per_page: number;
      data: Array<{
        ref: string;
        initiator_name: string;
        collector_name: string;
        debit: number | null;
        credit: number | null;
        balance_after: number | null;
        created_at: string;
        description: string;
      }>;
    }>(url);
    const page = params.page ?? 1;
    const limit = params.limit ?? 25;
    const list = Array.isArray(response.data?.data) ? response.data.data : [];
    return {
      total: response.data?.total ?? 0,
      current_page: response.data?.current_page ?? page,
      per_page: response.data?.per_page ?? limit,
      data: list.map((r, i) => ({
        sl: (page - 1) * limit + i + 1,
        ref: r.ref,
        initiator_name: r.initiator_name ?? '-',
        pop_in_charge_name: r.collector_name ?? '-',
        debit: r.debit ?? 0,
        credit: r.credit ?? null,
        balance_after: r.balance_after ?? 0,
        created_at: r.created_at ?? '',
        description: r.description ?? '',
      })),
    };
  },

  /** Combined recharge history: reseller ledger + customer transactions in one list */
  async getRechargeHistoryCombined(params: RechargeHistoryCombinedParams): Promise<{
    data: Array<{
      sl: number;
      ref: string;
      initiator_name: string;
      pop_in_charge_name: string;
      debit: number;
      credit: number | null;
      balance_after: number;
      created_at: string;
      description: string;
    }>;
    total: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params.userId != null) searchParams.set('userId', params.userId);
    if (params.createdBy != null) searchParams.set('createdBy', params.createdBy);
    if (params.dateFrom != null) searchParams.set('dateFrom', params.dateFrom);
    if (params.dateTo != null) searchParams.set('dateTo', params.dateTo);
    if (params.search != null) searchParams.set('search', params.search);
    if (params.method != null) searchParams.set('method', params.method);
    if (params.page != null) searchParams.set('page', String(params.page));
    if (params.limit != null) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    const url = `/payments/recharge-history-combined${qs ? `?${qs}` : ''}`;
    const response = await api.get<{
      total: number;
      current_page: number;
      per_page: number;
      data: Array<{
        ref: string;
        initiator_name: string;
        pop_in_charge_name: string;
        debit: number | null;
        credit: number | null;
        balance_after: number | null;
        created_at: string;
        description: string;
      }>;
    }>(url);
    const page = params.page ?? 1;
    const limit = params.limit ?? 25;
    const list = Array.isArray(response.data?.data) ? response.data.data : [];
    return {
      total: response.data?.total ?? 0,
      data: list.map((r, i) => ({
        sl: (page - 1) * limit + i + 1,
        ref: r.ref,
        initiator_name: r.initiator_name ?? '-',
        pop_in_charge_name: r.pop_in_charge_name ?? '-',
        debit: r.debit ?? 0,
        credit: r.credit ?? null,
        balance_after: r.balance_after ?? 0,
        created_at: r.created_at ?? '',
        description: r.description ?? '',
      })),
    };
  },
};
