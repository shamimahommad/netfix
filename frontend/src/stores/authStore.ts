import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LoginResponse, authService, MeResponse } from '@/services/auth.service';
import { useTenantStore } from '@/stores/tenantStore';

export interface ImpersonationInfo {
  user_id: string;
  role_code: string;
  email?: string;
}

interface AuthState {
  user: LoginResponse['user'] | null;
  balance: number | null;
  isAuthenticated: boolean;
  /** True when current session is impersonating another user */
  impersonated: boolean;
  /** Original actor who started impersonation (when impersonated is true) */
  impersonatedBy: ImpersonationInfo | null;
  isSaas: () => boolean;
  isIsp: () => boolean;
  isCustomer: () => boolean;
  setUser: (user: LoginResponse['user'] | null) => void;
  setBalance: (balance: number | null) => void;
  setImpersonation: (impersonated: boolean, impersonatedBy: ImpersonationInfo | null) => void;
  refreshMe: () => Promise<void>;
  logout: () => void;
}

// Initialize from localStorage if available
const getInitialUser = (): LoginResponse['user'] | null => {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      return null;
    }
    const stored = localStorage.getItem('auth_user');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load auth from localStorage:', error);
  }
  return null;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: getInitialUser(),
      balance: null,
      isAuthenticated: !!getInitialUser() && typeof window !== 'undefined' && !!localStorage.getItem('access_token'),
      isSaas: () => {
        const user = getInitialUser();
        return typeof window !== 'undefined' && !!localStorage.getItem('access_token') && user?.user_type === 'saas';
      },
      isIsp: () => {
        const user = getInitialUser();
        return typeof window !== 'undefined' && !!localStorage.getItem('access_token') && user?.user_type === 'isp';
      },
      isCustomer: () => {
        const user = getInitialUser();
        return typeof window !== 'undefined' && !!localStorage.getItem('access_token') && user?.user_type === 'customer';
      },
      setUser: (user) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        set({ user, isAuthenticated: !!user && !!token });
        if (user) {
          localStorage.setItem('auth_user', JSON.stringify(user));
        } else {
          localStorage.removeItem('auth_user');
          localStorage.removeItem('access_token');
          localStorage.removeItem('auth-storage');
        }
      },
      setBalance: (balance) => set({ balance }),
      setImpersonation: (impersonated, impersonatedBy) => set({ impersonated, impersonatedBy }),
      refreshMe: async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        if (!token) {
          set({ user: null, balance: null, isAuthenticated: false, impersonated: false, impersonatedBy: null });
          return;
        }
        try {
          const me = await authService.getMe();
          const existing = getInitialUser();
          const userFromMe: LoginResponse['user'] = {
            user_id: me.user_id,
            email: me.email ?? existing?.email ?? '',
            first_name: me.first_name ?? existing?.first_name ?? '',
            last_name: me.last_name ?? existing?.last_name ?? '',
            tenant_id: me.tenant_id ?? existing?.tenant_id ?? null,
            user_type: me.user_type ?? existing?.user_type ?? 'isp',
            role_code: me.role_code,
          };
          set({
            balance: me.balance,
            user: userFromMe,
            isAuthenticated: true,
            impersonated: me.impersonated ?? false,
            impersonatedBy:
              me.impersonated && me.impersonated_by
                ? {
                    user_id: me.impersonated_by,
                    role_code: me.impersonated_by_role ?? '',
                    email: me.impersonated_by_email,
                  }
                : null,
          });
          if (me.email) {
            try {
              localStorage.setItem('auth_user', JSON.stringify(userFromMe));
            } catch {
              /* ignore */
            }
          }
        } catch {
          set({ user: null, balance: null, isAuthenticated: false, impersonated: false, impersonatedBy: null });
          localStorage.removeItem('auth_user');
          localStorage.removeItem('access_token');
          localStorage.removeItem('auth-storage');
        }
      },
      logout: () => {
        set({ user: null, balance: null, isAuthenticated: false, impersonated: false, impersonatedBy: null });
        localStorage.removeItem('auth_user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth-storage');
        sessionStorage.clear();
        useTenantStore.getState().clearSelectedTenant();
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
