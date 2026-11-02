const API_BASE = (typeof window !== 'undefined' && window.location.port === '3000') ? 'http://127.0.0.1:8000/api' : '/api';

class ApiService {
  private token: string | null = null;
  private tenantId: string = 'tenant-cloudnet-001';

  constructor() {
    this.token = localStorage.getItem('isp_auth_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('isp_auth_token', token);
  }

  logout() {
    this.token = null;
    localStorage.removeItem('isp_auth_token');
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': this.tenantId,
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }
      return data;
    } catch (err: any) {
      console.error(`[API Error] ${endpoint}:`, err.message);
      throw err;
    }
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Dashboard
  async getDashboardStats() {
    return this.request('/dashboard/stats');
  }

  // Subscribers
  async getSubscribers(status = 'ALL', zone = 'ALL', search = '') {
    const query = new URLSearchParams({ status, zone, search }).toString();
    return this.request(`/subscribers?${query}`);
  }

  async createSubscriber(subData: any) {
    return this.request('/subscribers', {
      method: 'POST',
      body: JSON.stringify(subData),
    });
  }

  async rechargeSubscriber(id: string, rechargeData: any) {
    return this.request(`/subscribers/${id}/recharge`, {
      method: 'POST',
      body: JSON.stringify(rechargeData),
    });
  }

  async kickSubscriber(id: string) {
    return this.request(`/subscribers/${id}/kick`, {
      method: 'POST',
    });
  }

  async toggleSubscriberStatus(id: string) {
    return this.request(`/subscribers/${id}/toggle-status`, {
      method: 'PATCH',
    });
  }

  // Routers
  async getRouters() {
    return this.request('/routers');
  }

  async pingRouter(id: string) {
    return this.request(`/routers/${id}/ping`, {
      method: 'POST',
    });
  }

  async getActiveSessions(id: string) {
    return this.request(`/routers/${id}/active-sessions`);
  }

  // Packages
  async getPackages() {
    return this.request('/packages');
  }

  async createPackage(pkgData: any) {
    return this.request('/packages', {
      method: 'POST',
      body: JSON.stringify(pkgData),
    });
  }

  // Billing
  async getInvoices(status = 'ALL', search = '') {
    const query = new URLSearchParams({ status, search }).toString();
    return this.request(`/billing/invoices?${query}`);
  }

  async collectPayment(invoiceId: string, paymentData: any) {
    return this.request(`/billing/invoices/${invoiceId}/collect`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  async generateMonthlyBills() {
    return this.request('/billing/generate-monthly-bills', {
      method: 'POST',
    });
  }

  // Resellers
  async getResellers() {
    return this.request('/resellers');
  }

  async topupReseller(id: string, amount: number) {
    return this.request(`/resellers/${id}/topup`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  // Hotspot
  async getHotspotVouchers() {
    return this.request('/hotspot');
  }

  async generateHotspotBatch(batchData: any) {
    return this.request('/hotspot/generate-batch', {
      method: 'POST',
      body: JSON.stringify(batchData),
    });
  }

  // Tenant & White-label
  async getTenantInfo() {
    return this.request('/tenant/info');
  }

  async updateTenantSettings(settings: any) {
    return this.request('/tenant/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  // Optical FTTH & Coverage Boxes
  async getCoverageBoxes() {
    return this.request('/coverage/boxes');
  }

  async createCoverageBox(boxData: any) {
    return this.request('/coverage/boxes', {
      method: 'POST',
      body: JSON.stringify(boxData),
    });
  }

  // Tickets
  async getTickets() {
    return this.request('/tickets');
  }

  async createTicket(ticketData: any) {
    return this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  }

  async updateTicketStatus(id: string, status: string, resolutionNotes = '') {
    return this.request(`/tickets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, resolutionNotes }),
    });
  }

  // Payment Webhook Simulation (bKash Instant Reconnect)
  async simulateBkashPayment(invoiceId: string, trxId?: string) {
    return this.request('/payments/bkash/callback', {
      method: 'POST',
      body: JSON.stringify({
        invoiceId,
        trxID: trxId || `BKASH_${Date.now()}`,
        status: 'COMPLETED',
      }),
    });
  }
}

export const api = new ApiService();
