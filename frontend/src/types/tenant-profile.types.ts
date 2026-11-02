import { Tenant } from './tenant.types';

export interface TenantSettings {
  tenantSettingsId: string;
  tenantId: string;
  mapEnabled: boolean;
  monitoringEnabled: boolean;
  smsEnabled: boolean;
  paymentBkashEnabled: boolean;
  paymentSurjopayEnabled: boolean;
  paymentSslEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentGatewaySettings {
  paymentGatewaySettingsId: string;
  tenantId: string;
  gateway: 'bkash' | 'surjopay' | 'ssl';
  isEnabled: boolean;
  credentials: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmsGatewaySettings {
  smsGatewaySettingsId: string;
  tenantId: string;
  providerName: string;
  isEnabled: boolean;
  credentials: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantProfile {
  tenant: Tenant;
  settings: TenantSettings | null;
  paymentGateways: PaymentGatewaySettings[];
  smsGateways: SmsGatewaySettings[];
}

export interface TenantProfileResponse {
  success: boolean;
  data: TenantProfile;
}

export interface UpdateTenantFeaturesPayload {
  mapEnabled?: boolean;
  monitoringEnabled?: boolean;
}

export interface UpdateTenantFeaturesResponse {
  success: boolean;
  data: TenantSettings;
}

/** Bkash PGW credentials stored in payment_gateway_settings.credentials */
export interface BkashCredentials {
  apiContextRoot?: string;
  username?: string;
  password?: string;
  appKey?: string;
  appSecret?: string;
  /** true = Sandbox, false = Live */
  sandbox?: boolean;
}

export interface PaymentGatewayConfig {
  gateway: 'bkash' | 'surjopay' | 'ssl';
  isEnabled: boolean;
  credentials?: Record<string, any>;
}

export interface UpdatePaymentGatewaysPayload {
  gateways: PaymentGatewayConfig[];
}

export interface UpdatePaymentGatewaysResponse {
  success: boolean;
  data: PaymentGatewaySettings[];
}

export interface UpdateSmsGatewayPayload {
  providerName: string;
  isEnabled: boolean;
  credentials?: Record<string, any>;
}

export interface UpdateSmsGatewayResponse {
  success: boolean;
  data: SmsGatewaySettings;
}

export interface SmsProvider {
  id: string;
  name: string;
  docUrl?: string;
}

export interface SmsProvidersResponse {
  success: boolean;
  data: SmsProvider[];
}
