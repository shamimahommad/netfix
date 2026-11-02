import api from '@/lib/api';

export type ResellerRole =
  | 'admin'
  | 'manager'
  | 'reseller'
  | 'sub_reseller'
  | 'agent';

export interface Reseller {
  userId: string;
  name: string;
  username: string;
  email?: string;
  role: string;
  balance: number;
  credit_limit: number | null;
  phone: string | null;
  status: string;
  serverId: string | null;
}

export interface ListResellersParams {
  role?: ResellerRole;
  status?: 'active' | 'suspended';
  serverId?: string;
}

export interface CreateResellerPayload {
  name: string;
  username: string;
  password: string;
  phone?: string;
  serverId?: string;
  role: ResellerRole;
  status?: 'active' | 'suspended';
  credit_limit?: number;
  opening_balance?: number;
}

export interface UpdateResellerPayload {
  name?: string;
  username?: string;
  password?: string;
  phone?: string;
  serverId?: string;
  role?: ResellerRole;
  status?: 'active' | 'suspended';
  credit_limit?: number;
}

export interface PopOption {
  userId: string;
  name: string;
  username: string;
}

export const resellerService = {
  async list(params?: ListResellersParams): Promise<{ data: Reseller[] }> {
    const res = await api.get<{ data: Reseller[] }>('/resellers', {
      params: params || {},
    });
    return res.data;
  },

  async listPops(): Promise<PopOption[]> {
    const res = await api.get<PopOption[]>('/resellers/pops');
    return Array.isArray(res.data) ? res.data : (res.data as any)?.data ?? [];
  },

  async getOne(id: string): Promise<Reseller> {
    const res = await api.get<Reseller>(`/resellers/${id}`);
    return res.data as Reseller;
  },

  async create(
    payload: CreateResellerPayload,
  ): Promise<{ success: boolean; data: { userId: string; username: string } }> {
    const res = await api.post<{ success: boolean; data: { userId: string; username: string } }>(
      '/resellers',
      payload,
    );
    return res.data;
  },

  async update(
    id: string,
    payload: UpdateResellerPayload,
  ): Promise<{ success: boolean; data: Reseller }> {
    const res = await api.patch<{ success: boolean; data: Reseller }>(
      `/resellers/${id}`,
      payload,
    );
    return res.data;
  },

  async setStatus(
    id: string,
    status: 'active' | 'suspended',
  ): Promise<{ success: boolean; status: string }> {
    const res = await api.patch<{ success: boolean; status: string }>(
      `/resellers/${id}/status`,
      { status },
    );
    return res.data;
  },

  async delete(id: string): Promise<{ success: boolean }> {
    const res = await api.delete<{ success: boolean }>(`/resellers/${id}`);
    return res.data;
  },

  async loginAs(id: string): Promise<{ access_token: string }> {
    const res = await api.post<{ access_token: string }>(`/resellers/${id}/login-as`);
    return res.data;
  },

  async addBalance(
    userId: string,
    amount: number,
    notes?: string,
  ): Promise<{ success: boolean; balance: number }> {
    const res = await api.post<{ success: boolean; balance: number }>(
      '/resellers/add-balance',
      { userId, amount, notes },
    );
    return res.data;
  },

  async transferBalance(
    fromUserId: string,
    toUserId: string,
    amount: number,
  ): Promise<{ success: boolean; fromBalance: number; toBalance: number }> {
    const res = await api.post<{
      success: boolean;
      fromBalance: number;
      toBalance: number;
    }>('/resellers/transfer-balance', { fromUserId, toUserId, amount });
    return res.data;
  },

  async getMyPackages(params?: { page?: number; limit?: number; search?: string }): Promise<{
    data: Array<{
      id: string;
      server: string;
      protocol: string;
      name: string;
      mikrotik_profile: string;
      price: number;
      my_price: number;
      my_profit: number;
      count: number;
      validity: string;
      volume: string;
      status: string;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const res = await api.get<{
      data: Array<{
        id: string;
        server: string;
        protocol: string;
        name: string;
        mikrotik_profile: string;
        price: number;
        my_price: number;
        my_profit: number;
        count: number;
        validity: string;
        volume: string;
        status: string;
      }>;
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>('/resellers/my-packages', { params: params || {} });
    return res.data;
  },

  async getPlanPermissions(userId: string): Promise<{
    items: Array<{
      packageId: string;
      sellPrice: number;
      popProfit: number;
      popProfitPercent: number;
      allowed: boolean;
    }>;
  }> {
    const res = await api.get<{
      items: Array<{
        packageId: string;
        sellPrice: number;
        popProfit: number;
        popProfitPercent: number;
        allowed: boolean;
      }>;
    }>(`/resellers/${userId}/plan-permissions`);
    return res.data;
  },

  async putPlanPermissions(
    userId: string,
    items: Array<{
      packageId: string;
      sellPrice: number;
      popProfit: number;
      popProfitPercent: number;
      allowed: boolean;
    }>,
  ): Promise<{ success: boolean }> {
    const res = await api.put<{ success: boolean }>(`/resellers/${userId}/plan-permissions`, { items });
    return res.data;
  },

  async getLoginLog(userId: string): Promise<{
    items: Array<{ logTime: string; ip: string; browser: string; os: string; method: string }>;
  }> {
    const res = await api.get<{ items: Array<{ logTime: string; ip: string; browser: string; os: string; method: string }> }>(
      `/resellers/${userId}/login-log`,
    );
    return res.data;
  },

  /** Recharge history (reseller ledger) with filters and pagination */
  async getRechargeHistory(params: {
    userId?: string;
    createdBy?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    data: Array<{
      sl: number;
      ref: string;
      initiator: string;
      popInCharge: string;
      debit: number;
      credit: number | null;
      balance: number;
      time: string;
      description: string;
    }>;
    total: number;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 25;
    const res = await api.get<{
      total: number;
      data: Array<{
        sl: number;
        ref: string;
        initiator: string;
        popInCharge: string;
        debit: number;
        credit: number | null;
        balance: number;
        time: string;
        description: string;
      }>;
    }>('/resellers/ledger', {
      params: {
        userId: params.userId || undefined,
        createdBy: params.createdBy || undefined,
        dateFrom: params.dateFrom || undefined,
        dateTo: params.dateTo || undefined,
        page,
        limit,
        search: params.search || undefined,
      },
    });

    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    return {
      total: res.data?.total ?? 0,
      data: list.map((r, i) => ({
        sl: r.sl ?? (page - 1) * limit + i + 1,
        ref: r.ref,
        initiator: r.initiator,
        popInCharge: r.popInCharge,
        debit: r.debit ?? 0,
        credit: r.credit ?? null,
        balance: r.balance ?? 0,
        time: r.time,
        description: r.description,
      })),
    };
  },
};
