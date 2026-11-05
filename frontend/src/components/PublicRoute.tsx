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
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  // If user is authenticated and has active token, redirect to their dashboard
  if (token && isAuthenticated && user) {
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
