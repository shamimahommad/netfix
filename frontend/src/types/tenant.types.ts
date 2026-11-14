export type TenantStatus = 'active' | 'suspended' | 'trial' | 'expired' | 'terminated';

export type LogStorageMode = 'short_term_redis' | 'long_term_victoria' | 'disabled';

export interface LogStoragePolicy {
  logStorageMode: LogStorageMode;
  logRetentionDays: number;
  maxLiveLogs: number;
}

export interface Tenant {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  tenantSlug: string;
  businessEmail: string;
  businessPhone: string | null;
  businessAddress: string | null;
  countryCode: string;
  timezone: string;
  currencyCode: string;
  status: TenantStatus;
  trialEndsAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  limits?: TenantLimits | null;
  totalCustomers?: number;
  totalRouters?: number;
  totalOlts?: number;
  totalUsers?: number;
  logStorageMode?: LogStorageMode;
  logRetentionDays?: number;
  maxLiveLogs?: number;
}

export interface TenantsResponse {
  success: boolean;
  data: Tenant[];
}

export interface TenantLimits {
  maxRouters: number;
  maxOlts: number;
  maxUsers: number;
  maxCustomers: number;
  mapEnabled: boolean;
  monitoringEnabled: boolean;
}

export interface CreateTenantPayload {
  tenantCode?: string; // Optional - will be auto-generated if not provided
  tenantName: string;
  tenantSlug: string;
  businessEmail: string;
  businessPhone?: string;
  businessAddress?: string;
  countryCode: string;
  timezone?: string;
  currencyCode?: string;
  status?: TenantStatus;
  limits: TenantLimits;
  adminPassword?: string; // Optional - admin user password
}

export interface UpdateTenantPayload {
  tenantName?: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  countryCode?: string;
  timezone?: string;
  currencyCode?: string;
  status?: TenantStatus;
  adminPassword?: string; // Optional - update admin user password
}

export interface UpdateTenantLimitsPayload {
  maxRouters?: number;
  maxOlts?: number;
  maxUsers?: number;
  maxCustomers?: number;
  mapEnabled?: boolean;
  monitoringEnabled?: boolean;
}

export interface CreateTenantResponse {
  success: boolean;
  data: Tenant;
}
