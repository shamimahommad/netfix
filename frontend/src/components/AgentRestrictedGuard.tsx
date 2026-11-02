import { useAuthStore } from '@/stores/authStore';
import ErrorPage from '@/pages/ErrorPage';

interface AgentRestrictedGuardProps {
  children: React.ReactElement;
  /** Optional custom message when access is denied (agent) */
  message?: string;
}

/**
 * Renders children only for non-agent roles.
 * Agent cannot access SMS or Reseller sections; they see 403 error page.
 */
export default function AgentRestrictedGuard({ children, message }: AgentRestrictedGuardProps) {
  const { user, isAuthenticated } = useAuthStore();
  const roleCode = (user?.role_code ?? '').toLowerCase();
  const isAgent = roleCode === 'agent';

  if (!isAuthenticated || !user) {
    return children; // Let RouteGuard handle unauthenticated
  }

  if (isAgent) {
    return (
      <ErrorPage
        status={403}
        title="Access denied"
        message={message ?? "SMS and Reseller sections are not available for your role. You don't have permission to access this page."}
      />
    );
  }

  return children;
}
