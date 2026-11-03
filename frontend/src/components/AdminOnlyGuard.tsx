import { useAuthStore } from '@/stores/authStore';
import ErrorPage from '@/pages/ErrorPage';

const ADMIN_ROLES = ['admin', 'manager', 'isp_admin', 'tenant_admin', 'saas_admin', 'super_admin'];

function isAdminRole(roleCode: string | undefined): boolean {
  const r = (roleCode ?? '').toLowerCase();
  return ADMIN_ROLES.includes(r);
}

interface AdminOnlyGuardProps {
  children: React.ReactElement;
}

/**
 * Renders children only for admin-level roles (admin, manager, tenant_admin, isp_admin, saas_admin).
 * Reseller, sub_reseller, agent get 403 error page when they try to access admin-only URLs directly.
 */
export function AdminOnlyGuard({ children }: AdminOnlyGuardProps) {
  const { user, isAuthenticated } = useAuthStore();
  const roleCode = user?.role_code;

  if (!isAuthenticated || !user) {
    return children; // Let RouteGuard handle unauthenticated
  }

  if (user.user_type === 'saas' || isAdminRole(roleCode)) {
    return children;
  }

  return (
    <ErrorPage
      status={403}
      title="Access denied"
      message="This page is only for administrators. You don't have permission to view it."
    />
  );
}
