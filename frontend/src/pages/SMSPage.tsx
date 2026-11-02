import { useParams } from 'react-router-dom';
import FeatureGuard from '@/components/FeatureGuard';
import PlaceholderPage from './PlaceholderPage';
import SmsSendPage from './SmsSendPage';
import SmsLogPage from './SmsLogPage';
import SmsTemplatePage from './SmsTemplatePage';

const SMS_TYPES: Record<string, { title: string; description: string }> = {
  send: { title: 'Send SMS', description: 'Send SMS messages to customers.' },
  template: { title: 'SMS Template', description: 'Manage SMS templates for quick messaging.' },
  log: { title: 'SMS Log', description: 'View SMS sending history and logs.' },
};

export default function SMSPage() {
  const { type = 'send' } = useParams<{ type: string }>();
  const smsType = SMS_TYPES[type] || SMS_TYPES.send;

  return (
    <FeatureGuard feature="sms">
      {type === 'send' && <SmsSendPage />}
      {type === 'template' && <SmsTemplatePage />}
      {type === 'log' && <SmsLogPage />}
      {type !== 'send' && type !== 'template' && type !== 'log' && (
        <PlaceholderPage title={smsType.title} description={smsType.description} />
      )}
    </FeatureGuard>
  );
}
