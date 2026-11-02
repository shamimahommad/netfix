import { Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface PublicRouteProps {
  children: React.ReactNode;
}

/**
 * PublicRoute component that redirects authenticated users away from public pages (like login)
 * This prevents users from accessing login page after authentication, even via browser back button
 */
export default function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  // Replace history entry to prevent back navigation to login
  useEffect(() => {
    if (isAuthenticated && user && location.pathname === '/login') {
      // Replace current history entry
      const target =
        user.user_type === 'saas'
          ? '/saas/dashboard'
          : user.user_type === 'isp'
          ? '/dashboard'
          : '/customer/dashboard';
      window.history.replaceState(null, '', target);
    }
  }, [isAuthenticated, user, location.pathname]);

  // If user is authenticated, redirect to their dashboard
  if (isAuthenticated && user) {
    const target =
      user.user_type === 'saas'
        ? '/saas/dashboard'
        : user.user_type === 'isp'
        ? '/dashboard'
        : '/customer/dashboard';
    return <Navigate to={target} replace />;
  }

  // If not authenticated, show the public page (e.g., login)
  return <>{children}</>;
}
