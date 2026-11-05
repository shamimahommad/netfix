import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useTenantStore } from '@/stores/tenantStore';
import { useAuthStore } from '@/stores/authStore';

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (import.meta.env.PROD) {
    if (!envUrl || envUrl.includes('localhost')) {
      return '/api/v1';
    }
    return envUrl;
  }
  return envUrl || 'http://localhost:4000/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // For httpOnly cookies
});

// Request interceptor to add tenant context and auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authUser = useAuthStore.getState().user;
    const isSaas = authUser?.user_type === 'saas' || authUser?.role_code === 'saas_admin';
    const isPublicTopup = (config.url || '').includes('public/topup');

    // SaaS Super Admin: allow context switching via tenantStore
    if (isSaas) {
      const tenantId = useTenantStore.getState().getTenantId();
      if (tenantId && !isPublicTopup) {
        config.params = { ...(config.params || {}), tenant_id: tenantId };
      }
    } else if (authUser?.tenant_id) {
      // ISP / Tenant user: strictly attach their genuine tenant_id
      if (config.headers) {
        config.headers['X-Tenant-Id'] = authUser.tenant_id;
      }
      // Never allow an unintended query param override for tenant users
      if (config.params && config.params.tenant_id && !isPublicTopup) {
        delete config.params.tenant_id;
      }
    }

    // Add Authorization header if token exists in localStorage
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Only run logout+redirect once when multiple requests get 401 (e.g. page load)
let isHandling401 = false;

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      // Handle 401 Unauthorized
      if (error.response.status === 401) {
        const url = error.config?.url ?? '';
        const isLoginRequest = url.includes('/auth/login') || url.includes('/auth/customer-login');
        // For login requests: keep the server message (e.g. "Account is not active", "Invalid credentials")
        if (isLoginRequest) {
          const data = error.response.data as { message?: string | string[] };
          const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
          return Promise.reject({ message: msg || 'Invalid credentials', statusCode: 401 });
        }
        // For other requests: session expired – only logout and redirect once
        if (!isHandling401) {
          isHandling401 = true;
          useAuthStore.getState().logout();
          localStorage.removeItem('access_token');
          localStorage.removeItem('auth_user');
          localStorage.removeItem('auth-storage');
          sessionStorage.clear();
          const path = window.location.pathname;
          if (path !== '/login' && path !== '/' && !path.startsWith('/customer/login')) {
            window.location.replace(path.startsWith('/customer') ? '/customer/login' : '/login');
          }
          // Reset so next login can handle 401 again
          setTimeout(() => { isHandling401 = false; }, 1000);
        }
        return Promise.reject({
          message: 'Your session has expired. Please log in again.',
          statusCode: 401,
        });
      }

      // Server responded with error
      return Promise.reject(error.response.data);
    } else if (error.request) {
      // Request made but no response
      return Promise.reject({ message: 'Network error. Please check your connection.' });
    } else {
      // Something else happened
      return Promise.reject({ message: 'An unexpected error occurred.' });
    }
  }
);

export default api;
