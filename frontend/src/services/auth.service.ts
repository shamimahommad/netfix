import api from '@/lib/api';

export interface LoginCredentials {
  email?: string;
  /** Email or mobile (for customer login) */
  login?: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    tenant_id: string | null;
    user_type: 'saas' | 'isp' | 'customer';
    role_code: string;
  };
}

export interface MeResponse {
  user_id: string;
  tenant_id: string | null;
  user_type: 'saas' | 'isp' | 'customer';
  role_code: string;
  balance: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  username?: string;
  impersonated?: boolean;
  impersonated_by?: string;
  impersonated_by_role?: string;
  impersonated_by_email?: string;
}

export interface ImpersonateResponse {
  redirect_url: string;
}

export interface CanImpersonateResponse {
  allowed: boolean;
}

export interface AuthError {
  statusCode?: number;
  message: string;
  error?: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const input = (credentials.login ?? credentials.email ?? '').trim();
    const body =
      input && !input.includes('@')
        ? { login: input, password: credentials.password }
        : credentials.login != null
          ? { login: credentials.login, password: credentials.password }
          : { email: credentials.email, password: credentials.password };
    const response = await api.post<LoginResponse & { redirect_url?: string }>('/auth/login', body);
    const data = response.data;
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
    }
    return data;
  },

  /** Customer portal: login = Email or Customer ID, phone = Phone/Mobile (used as password). */
  async customerLogin(login: string, phone: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse & { redirect_url?: string }>('/auth/customer-login', {
      login: login.trim(),
      phone: phone.trim(),
    });
    const data = response.data;
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
    }
    return data;
  },

  async getMe(): Promise<MeResponse> {
    const response = await api.get<MeResponse>('/auth/me');
    return response.data;
  },

  async canImpersonate(targetUserId: string): Promise<boolean> {
    const response = await api.get<CanImpersonateResponse>(`/auth/impersonate/can/${targetUserId}`);
    return response.data?.allowed ?? false;
  },

  async canImpersonateBatch(targetUserIds: string[]): Promise<Record<string, boolean>> {
    if (targetUserIds.length === 0) return {};
    const ids = targetUserIds.join(',');
    const response = await api.get<{ allowed: Record<string, boolean> }>('/auth/impersonate/can-batch', {
      params: { ids },
    });
    return response.data?.allowed ?? {};
  },

  /** Start impersonation. Server sets httpOnly cookie. Redirect to returned URL (no localStorage). */
  async impersonate(targetUserId: string): Promise<ImpersonateResponse> {
    const response = await api.post<ImpersonateResponse>(`/auth/impersonate/${targetUserId}`);
    return response.data;
  },

  /** Exit impersonation. Server sets httpOnly cookie with original user. Redirect to returned URL. */
  async exitImpersonation(): Promise<ImpersonateResponse> {
    const response = await api.post<ImpersonateResponse>('/auth/impersonate/exit');
    return response.data;
  },

  async logout(): Promise<void> {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth-storage');
    sessionStorage.clear();
    return Promise.resolve();
  },

  /** Change password for current user (dashboard). Requires current_password and new_password. */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  /** Update profile name, email, and phone for current user */
  async updateProfile(payload: { first_name?: string; last_name?: string; full_name?: string; email?: string; phone?: string }): Promise<{ success: boolean; message: string; user: LoginResponse['user'] }> {
    const response = await api.put<{ success: boolean; message: string; user: LoginResponse['user'] }>('/auth/profile', payload);
    return response.data;
  },
};
