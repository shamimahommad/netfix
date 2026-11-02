import api from '@/lib/api';
import { customersService } from '@/services/customers.service';

export interface SearchCustomerResult {
  customerId: string;
  customerCode: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: string;
  username: string | null;
}

export interface SearchCustomersResponse {
  success: boolean;
  data: SearchCustomerResult[];
}

function toSearchResult(c: any): SearchCustomerResult {
  return {
    customerId: String(c.customerId ?? c.customer_id ?? ''),
    customerCode: c.customerCode ?? c.customer_code ?? '',
    fullName: c.fullName ?? c.full_name ?? '',
    phone: c.phone ?? '',
    email: c.email ?? null,
    status: c.status ?? '',
    username: c.username ?? null,
  };
}

export const searchService = {
  async searchCustomers(query: string): Promise<SearchCustomersResponse> {
    if (!query || query.length < 2) {
      return {
        success: true,
        data: [],
      };
    }

    try {
      const response = await api.get<SearchCustomersResponse>('/search/customers', {
        params: { q: query },
      });
      const body = response.data;
      const list = Array.isArray(body?.data) ? body.data : [];
      return { success: true, data: list.map(toSearchResult) };
    } catch {
      try {
        const res = await customersService.getCustomers({
          search: query.trim(),
          limit: 15,
          page: 1,
        });
        const list = Array.isArray(res?.data) ? res.data : [];
        return {
          success: true,
          data: list.map(toSearchResult),
        };
      } catch {
        return { success: false, data: [] };
      }
    }
  },
};
