import api from '@/lib/api';

export interface CustomerDashboardData {
  customer: {
    customerId: string;
    fullName: string;
    customerCode: string;
    phone: string | null;
    email: string | null;
  };
  packageName: string | null;
  expiryDate: string | null;
  billingStatus: string | null;
  balance: number;
  planPrice: number | null;
  billingSummary: Record<string, unknown>;
  recentInvoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    totalAmount: number;
    status: string;
    invoiceDate: string;
    dueDate: string;
  }>;
  totalInvoices: number;
  network: {
    onlineStatus: boolean;
    username: string | null;
    uploadBytes: number | null;
    downloadBytes: number | null;
  } | null;
}

export interface CustomerDashboardResponse {
  success: boolean;
  data: CustomerDashboardData;
}

export interface CustomerInvoiceItem {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  invoiceDate: string;
  dueDate: string;
  /** Remarks if set; otherwise show "Payment details" (e.g. BKASH payment Tk 1050 TrxID CK54VNFA6O : (Cash)) */
  remarks?: string | null;
}

export interface CustomerInvoicesResponse {
  success: boolean;
  data: CustomerInvoiceItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CustomerPaymentHistoryItem {
  paymentId: string;
  tranId: string;
  gateway: string;
  gatewayPaymentId: string | null;
  amount: number;
  status: string;
  paidAt: string | null;
  invoiceId: string | null;
  doneBy: string;
  remarks?: string | null;
}

export interface CustomerPaymentHistoryResponse {
  success: boolean;
  data: CustomerPaymentHistoryItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CustomerRenewPayload {
  billing_cycle: 'Monthly' | 'Day-based';
  no_of_month?: number;
  selected_days?: number;
  plan_id: string;
  plan_price: number;
  send_sms?: boolean;
}

export interface CustomerRenewResponse {
  success: boolean;
  message: string;
  data: { new_expire_date: string; bill_amount: number };
}

export interface CustomerPackage {
  id: string;
  name: string;
  code: string;
  price: number;
  protocol: string;
}

export interface PaymentMethodItem {
  gateway: string;
  label: string;
  description: string;
}

export const customerPortalService = {
  async getPaymentMethods(): Promise<PaymentMethodItem[]> {
    const response = await api.get<PaymentMethodItem[]>('/customer/payment-methods');
    return Array.isArray(response.data) ? response.data : [];
  },

  async getPackages(): Promise<{ success: boolean; data: CustomerPackage[] }> {
    const response = await api.get<{ success: boolean; data: CustomerPackage[] }>('/customer/packages');
    return response.data;
  },

  async getDashboard(): Promise<CustomerDashboardResponse> {
    const response = await api.get<CustomerDashboardResponse>('/customer/dashboard');
    return response.data;
  },

  async getInvoices(page = 1, limit = 20): Promise<CustomerInvoicesResponse> {
    const response = await api.get<CustomerInvoicesResponse>('/customer/invoices', {
      params: { page, limit },
    });
    return response.data;
  },

  async getPaymentHistory(page = 1, limit = 20): Promise<CustomerPaymentHistoryResponse> {
    const response = await api.get<CustomerPaymentHistoryResponse>('/customer/payment-history', {
      params: { page, limit },
    });
    return response.data;
  },

  async renew(payload: CustomerRenewPayload): Promise<CustomerRenewResponse> {
    const response = await api.post<CustomerRenewResponse>('/customer/renew', payload);
    return response.data;
  },

  async changePassword(current_password: string, new_password: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>('/customer/change-password', {
      current_password,
      new_password,
    });
    return response.data;
  },

  async getLiveTraffic(): Promise<{
    success: boolean;
    data: {
      timestamp: string;
      download_bps: number;
      upload_bps: number;
      download_bytes?: number;
      upload_bytes?: number;
      router_name?: string;
      username?: string;
      status?: 'online' | 'offline';
      message?: string;
    };
  }> {
    const response = await api.get('/customer/live-traffic');
    return response.data;
  },

  async getSessionLog(page = 1, limit = 20): Promise<{
    success: boolean;
    data: Array<{
      session_id: string;
      username: string;
      connection_date: string;
      disconnection_date: string | null;
      upload: number;
      download: number;
      session_time: number;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const response = await api.get('/customer/session-log', { params: { page, limit } });
    return response.data;
  },

  async initiatePayment(
    amount: number,
    invoiceId?: string,
    gateway: string = 'bkash',
  ): Promise<{ success: boolean; payment_url: string; payment_id?: string }> {
    const response = await api.post('/customer/initiate-payment', { amount, invoice_id: invoiceId, gateway });
    return response.data;
  },

  /** Phase 2: Renew via gateway — creates renewal invoice (package + due balance) then redirects to payment. */
  async initiateRenewPayment(
    months: number,
    gateway: string = 'bkash',
  ): Promise<{ success: boolean; payment_url: string; payment_id?: string }> {
    const response = await api.post('/customer/initiate-renew-payment', { months, gateway });
    return response.data;
  },

  async confirmPayment(paymentID: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/customer/confirm-payment', { paymentID });
    return response.data;
  },

  async getTickets(page = 1, limit = 20): Promise<{
    success: boolean;
    data: Array<{
      ticket_id: string;
      ticket_number: string;
      title: string;
      description: string | null;
      status: string;
      assigned_to: string | null;
      created_at: string;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const response = await api.get('/customer/tickets', { params: { page, limit } });
    return response.data;
  },

  async createTicket(title: string, description?: string): Promise<{
    success: boolean;
    data: { ticket_id: string; ticket_number: string; title: string; description: string | null; status: string; created_at: string };
  }> {
    const response = await api.post('/customer/tickets', { title, description });
    return response.data;
  },
};
