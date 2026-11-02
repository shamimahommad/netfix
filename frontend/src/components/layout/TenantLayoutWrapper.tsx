import { Outlet } from 'react-router-dom';
import RequireTenant from '../RequireTenant';

/**
 * Wrapper component that adds tenant requirement check for dashboard routes.
 * This is used when SaaS admin accesses /dashboard routes.
 */
export default function TenantLayoutWrapper() {
  const userType = 'isp';

  return (
    <RequireTenant userType={userType}>
      <Outlet />
    </RequireTenant>
  );
}
