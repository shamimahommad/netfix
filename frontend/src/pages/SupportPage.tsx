import { useParams } from 'react-router-dom';
import PlaceholderPage from './PlaceholderPage';

const SUPPORT_TYPES: Record<string, { title: string; description: string }> = {
  ticket: { title: 'Open Support Ticket', description: 'Create and manage support tickets for customer issues.' },
  numbers: { title: 'Support Numbers', description: 'View and manage support contact numbers.' },
  'package-change': { title: 'Package Change', description: 'Manage customer package changes and upgrades.' },
  'activity-log': { title: 'Activity Log', description: 'View system activity and user action logs.' },
};

export default function SupportPage() {
  const { type = 'ticket' } = useParams<{ type: string }>();
  const supportType = SUPPORT_TYPES[type] || SUPPORT_TYPES.ticket;

  return <PlaceholderPage title={supportType.title} description={supportType.description} />;
}
