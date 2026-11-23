import api from '@/lib/api';

export interface TicketItem {
  ticket_id: string;
  tenant_id: string;
  customer_id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_to: number | null;
  created_at: string;
  updated_at: string;
  customer_code: string;
  customer_name: string;
  customer_phone: string;
  installation_address?: string;
  assigned_username?: string | null;
  assigned_first_name?: string | null;
  assigned_last_name?: string | null;
  reseller_name?: string | null;
  reseller_username?: string | null;
}

export interface SupportDirectoryItem {
  title: string;
  number: string;
  category: string;
  hours: string;
}

export interface SupportNumbersResponse {
  success: boolean;
  supportPhone: string;
  directory: SupportDirectoryItem[];
}

export const supportService = {
  async getTickets(params?: { status?: string; priority?: string; search?: string }): Promise<{
    success: boolean;
    tickets: TicketItem[];
    metrics: {
      total: number;
      open: number;
      inProgress: number;
      resolved: number;
      closed: number;
    };
  }> {
    const res = await api.get('/support/tickets', { params });
    return res.data;
  },

  async createTicket(payload: {
    customer_id: string;
    title: string;
    description: string;
    priority?: string;
    assigned_to?: number;
  }): Promise<{ success: boolean; message: string; ticket_id: string }> {
    const res = await api.post('/support/tickets', payload);
    return res.data;
  },

  async updateTicketStatus(
    ticketId: string,
    payload: { status?: string; assigned_to?: number }
  ): Promise<{ success: boolean; message: string }> {
    const res = await api.post(`/support/tickets/${ticketId}/status`, payload);
    return res.data;
  },

  async getSupportNumbers(): Promise<SupportNumbersResponse> {
    const res = await api.get('/support/numbers');
    return res.data;
  },

  async saveSupportNumbers(payload: {
    supportPhone: string;
    directory: SupportDirectoryItem[];
  }): Promise<{ success: boolean; message: string }> {
    const res = await api.post('/support/numbers', payload);
    return res.data;
  },
};
