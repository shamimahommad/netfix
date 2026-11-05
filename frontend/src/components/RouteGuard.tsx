import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import ErrorPage from '@/pages/ErrorPage';

interface RouteGuardProps {
  allow: Array<'saas' | 'isp' | 'customer'>;
  children: React.ReactElement;
}

export function RouteGuard({ allow, children }: RouteGuardProps) {
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const userType = user?.user_type;
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  if (!token || !isAuthenticated || !user || !userType) {
    const redirectPath = allow.includes('customer') ? '/customer/login' : '/login';
    return <Navigate to={redirectPath} replace state={{ from: location }} />;
  }

  // SaaS Super Admin has master access across portals (including tenant ISP dashboard when inspecting/impersonating)
  if (userType === 'saas') {
    return children;
  }

  if (!allow.includes(userType)) {
    return (
      <ErrorPage
        status={403}
        title="Access denied"
        message="You don't have permission to access this area. This page is restricted to another role."
      />
    );
  }

  return children;
}

