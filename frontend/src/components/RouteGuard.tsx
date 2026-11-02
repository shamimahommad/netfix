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

  if (!isAuthenticated || !userType) {
    return <Navigate to="/login" replace state={{ from: location }} />;
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

