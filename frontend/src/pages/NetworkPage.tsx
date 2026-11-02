import { useParams } from 'react-router-dom';
import PlaceholderPage from './PlaceholderPage';
import FeatureGuard from '@/components/FeatureGuard';

const NETWORK_TYPES: Record<string, { title: string; description: string; requiresMonitoring?: boolean }> = {
  mikrotik: { title: 'Mikrotik', description: 'Manage Mikrotik router configurations and settings.' },
  olt: { title: 'OLT', description: 'Manage OLT (Optical Line Terminal) devices and configurations.' },
  monitoring: { title: 'Monitoring', description: 'View network monitoring and analytics.', requiresMonitoring: true },
};

export default function NetworkPage() {
  const { type = 'mikrotik' } = useParams<{ type: string }>();
  const networkType = NETWORK_TYPES[type] || NETWORK_TYPES.mikrotik;

  const content = <PlaceholderPage title={networkType.title} description={networkType.description} />;

  // Wrap with FeatureGuard if monitoring feature is required
  if (networkType.requiresMonitoring) {
    return <FeatureGuard feature="monitoring">{content}</FeatureGuard>;
  }

  return content;
}
