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
    tenant_name?: string | null;
    tenant_logo?: string | null;
    user_type: 'saas' | 'isp' | 'customer';
    role_code: string;
    assigned_server_id?: string | null;
    assigned_server_name?: string | null;
  };
}

export interface MeResponse {
  user_id: string;
  tenant_id: string | null;
  tenant_name?: string | null;
  tenant_logo?: string | null;
  user_type: 'saas' | 'isp' | 'customer';
  role_code: string;
  assigned_server_id?: string | null;
  assigned_server_name?: string | null;
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
  access_token?: string;
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
    return response.data;
  },

  /** Customer portal: login = Email or Customer ID, phone = Phone/Mobile (used as password). */
  async customerLogin(login: string, phone: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse & { redirect_url?: string }>('/auth/customer-login', {
      login: login.trim(),
      phone: phone.trim(),
    });
    return response.data;
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

  /** Start impersonation using HttpOnly session cookie rotation and redirect to dashboard. */
  async impersonate(targetUserId: string): Promise<ImpersonateResponse> {
    const response = await api.post<ImpersonateResponse>(`/auth/impersonate/${targetUserId}`);
    localStorage.removeItem('auth_user');
    return response.data;
  },

  /** Exit impersonation using HttpOnly session cookie rotation and redirect. */
  async exitImpersonation(): Promise<ImpersonateResponse> {
    const response = await api.post<ImpersonateResponse>('/auth/impersonate/exit');
    localStorage.removeItem('auth_user');
    return response.data;
  },

  async refreshToken(): Promise<{ success: boolean; authenticated: boolean }> {
    const response = await api.post<{ success: boolean; authenticated: boolean }>('/auth/refresh');
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // Proceed with local cleanup even if cookie is already invalid
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth-storage');
    sessionStorage.clear();
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
