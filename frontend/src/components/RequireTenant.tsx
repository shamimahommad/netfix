import { useNavigate, useLocation } from 'react-router-dom';
import { useTenantStore } from '@/stores/tenantStore';

interface RequireTenantProps {
  children: React.ReactNode;
  userType: 'saas' | 'isp' | 'customer';
}

/**
 * Route protection component for SaaS admin dashboard routes.
 * Blocks access if no ISP (tenant) is selected and shows a message.
 */
export default function RequireTenant({ children, userType }: RequireTenantProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedTenant } = useTenantStore();

  // Only enforce tenant selection for SaaS admin on dashboard routes
  if (userType === 'saas' && location.pathname.startsWith('/dashboard') && !selectedTenant) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Select an ISP to continue</h3>
          <p className="text-sm text-text-secondary mb-6">
            Please select an ISP from the list to access the dashboard and manage tenant data.
          </p>
          <button
            onClick={() => navigate('/saas/tenants')}
            className="px-4 py-2 bg-primary text-white rounded-button hover:bg-primary-hover transition-colors"
          >
            Go to ISPs
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
