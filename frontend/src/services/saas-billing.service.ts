import { api } from '@/lib/api';

export interface SaaSPackageLimits {
  maxCustomers: number;
  maxRouters: number;
  maxOlts: number;
  maxUsers: number;
}

export interface SaaSPackagePermissions {
  mapEnabled: boolean;
  monitoringEnabled: boolean;
  smsEnabled: boolean;
  customerPortalEnabled: boolean;
  resellerEnabled: boolean;
}

export interface SaaSTenantSummary {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  businessEmail: string;
  businessPhone: string | null;
  status: string;
  totalCustomers: number;
  totalRouters: number;
  totalOlts: number;
  trialEndsAt: string | null;
}

export interface SaaSPackage {
  id: number;
  code: string;
  name: string;
  tagline: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  limits: SaaSPackageLimits;
  permissions: SaaSPackagePermissions;
  isPopular: boolean;
  status: 'active' | 'inactive';
  assignedTenantsCount: number;
  assignedTenants: SaaSTenantSummary[];
  createdAt: string;
}

export interface SaaSPackagesResponse {
  success: boolean;
  data: SaaSPackage[];
  unassignedTenants: SaaSTenantSummary[];
  totalPackages: number;
}

export interface ISPSubscriptionItem {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  businessEmail: string;
  businessPhone: string | null;
  tenantStatus: string;
  billingStatus: 'paid' | 'due' | 'trial' | 'overdue' | 'suspended';
  isTrial: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  package: {
    id: number;
    code: string;
    name: string;
    price: number;
    billingCycle: string;
    limits: SaaSPackageLimits;
    permissions: SaaSPackagePermissions;
  } | null;
  totalCustomers: number;
  totalRouters: number;
  totalInvoiced: number;
  totalPaid: number;
  balanceDue: number;
  lastPaymentDate: string | null;
  nextDueDate: string;
  createdAt: string;
}

export interface SaaSInvoiceItem {
  id: number;
  invoiceNo: string;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  packageName: string;
  amount: number;
  paidAmount: number;
  balanceDue: number;
  status: 'paid' | 'due' | 'overdue' | 'cancelled';
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  dueDate: string;
  paidAt: string | null;
  paymentMethod: string | null;
  transactionRef: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SaaSPlatformBillingOverview {
  success: boolean;
  metrics: {
    mrr: number;
    totalCollected: number;
    totalDue: number;
    totalTenants: number;
    paidCount: number;
    dueCount: number;
    trialCount: number;
  };
  ispSubscriptions: ISPSubscriptionItem[];
  invoices: SaaSInvoiceItem[];
}

export const saasBillingService = {
  async getPackages(): Promise<SaaSPackagesResponse> {
    const response = await api.get<SaaSPackagesResponse>('/saas/packages');
    return response.data;
  },

  async createPackage(payload: {
    name: string;
    code?: string;
    tagline?: string;
    price: number;
    billingCycle?: 'monthly' | 'yearly';
    limits: SaaSPackageLimits;
    permissions: SaaSPackagePermissions;
    isPopular?: boolean;
  }): Promise<{ success: boolean; message: string; id: number }> {
    const response = await api.post<{ success: boolean; message: string; id: number }>('/saas/packages', payload);
    return response.data;
  },

  async updatePackage(
    id: number,
    payload: {
      name: string;
      tagline?: string;
      price: number;
      billingCycle?: 'monthly' | 'yearly';
      limits: SaaSPackageLimits;
      permissions: SaaSPackagePermissions;
      isPopular?: boolean;
    }
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.put<{ success: boolean; message: string }>(`/saas/packages/${id}`, payload);
    return response.data;
  },

  async deletePackage(id: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/saas/packages/${id}`);
    return response.data;
  },

  async assignTenantPackage(tenantId: string | number, packageId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>('/saas/packages/assign', {
      tenantId: Number(tenantId),
      packageId,
    });
    return response.data;
  },

  async getBillingOverview(): Promise<SaaSPlatformBillingOverview> {
    const response = await api.get<SaaSPlatformBillingOverview>('/saas/billing/overview');
    return response.data;
  },

  async recordPayment(payload: {
    tenantId: string | number;
    amount: number;
    invoiceId?: number;
    paymentMethod: string;
    transactionRef?: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>('/saas/billing/record-payment', {
      ...payload,
      tenantId: Number(payload.tenantId),
    });
    return response.data;
  },

  async extendTrial(tenantId: string | number, days: number): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>('/saas/billing/extend-trial', {
      tenantId: Number(tenantId),
      days,
    });
    return response.data;
  },

  async generateInvoice(payload: {
    tenantId: string | number;
    amount?: number;
    dueDate?: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string; invoiceNo: string }> {
    const response = await api.post<{ success: boolean; message: string; invoiceNo: string }>('/saas/billing/generate-invoice', {
      ...payload,
      tenantId: Number(payload.tenantId),
    });
    return response.data;
  },
};

