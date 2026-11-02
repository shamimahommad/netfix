import { useState, useEffect } from 'react';
import { tenantSettingsService } from '@/services/tenant-settings.service';
import { TenantSettings, PaymentGatewaySettings, SmsGatewaySettings } from '@/types/tenant-profile.types';

export interface TenantSettingsData {
  settings: TenantSettings | null;
  paymentGateways: PaymentGatewaySettings[];
  smsGateways: SmsGatewaySettings[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTenantSettings(): TenantSettingsData {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGatewaySettings[]>([]);
  const [smsGateways, setSmsGateways] = useState<SmsGatewaySettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tenantSettingsService.getMyTenantSettings();
      setSettings(response.data.settings);
      setPaymentGateways(response.data.paymentGateways || []);
      setSmsGateways(response.data.smsGateways || []);
    } catch (err: any) {
      console.error('Error fetching tenant settings:', err);
      // Don't set error for 403 (SaaS admin) or 404 (settings not configured yet)
      if (err.response?.status === 403 || err.response?.status === 404) {
        // Settings not available, use defaults
        setSettings(null);
        setPaymentGateways([]);
        setSmsGateways([]);
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to load tenant settings');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    paymentGateways,
    smsGateways,
    isLoading,
    error,
    refetch: fetchSettings,
  };
}

// Helper functions to check feature availability
export function useFeatureAvailability() {
  const { settings, paymentGateways } = useTenantSettings();

  return {
    isMapEnabled: settings?.mapEnabled ?? false,
    isMonitoringEnabled: settings?.monitoringEnabled ?? false,
    isSmsEnabled: settings?.smsEnabled ?? false,
    enabledPaymentGateways: paymentGateways.filter((pg) => pg.isEnabled).map((pg) => pg.gateway),
    getPaymentGateway: (gateway: 'bkash' | 'surjopay' | 'ssl') =>
      paymentGateways.find((pg) => pg.gateway === gateway),
  };
}
