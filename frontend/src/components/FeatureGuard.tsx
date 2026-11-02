import { useEffect, useState } from 'react';
import { useFeatureAvailability } from '@/hooks/useTenantSettings';
import PlaceholderPage from '@/pages/PlaceholderPage';

interface FeatureGuardProps {
  feature: 'sms' | 'map' | 'monitoring';
  children: React.ReactNode;
}

export default function FeatureGuard({ feature, children }: FeatureGuardProps) {
  const { isSmsEnabled, isMapEnabled, isMonitoringEnabled } = useFeatureAvailability();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Small delay to allow settings to load
    const timer = setTimeout(() => {
      setIsChecking(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  const isFeatureEnabled =
    (feature === 'sms' && isSmsEnabled) ||
    (feature === 'map' && isMapEnabled) ||
    (feature === 'monitoring' && isMonitoringEnabled);

  if (!isFeatureEnabled) {
    return (
      <PlaceholderPage
        title="Feature Not Available"
        description={`This feature is not enabled for your account. Please contact your administrator to enable ${feature === 'sms' ? 'SMS' : feature === 'map' ? 'Map/GIS' : 'Monitoring'} features.`}
      />
    );
  }

  return <>{children}</>;
}
