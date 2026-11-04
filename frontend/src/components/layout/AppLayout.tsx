import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';
import { useAuthStore } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';

interface AppLayoutProps {
  sidebarItems: SidebarItem[];
  userType: 'saas' | 'tenant' | 'isp' | 'customer';
  children?: React.ReactNode;
}

export interface SidebarSubItem {
  label: string;
  path: string;
  badge?: number;
  icon?: React.ReactNode;
}

export interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  badge?: number;
  submenu?: SidebarSubItem[];
}

export default function AppLayout({ sidebarItems, userType, children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const user = useAuthStore((s) => s.user);
  const { selectedTenant, clearSelectedTenant } = useTenantStore();

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  // On mobile, lock body scroll when sidebar is open so content behind doesn't scroll
  useEffect(() => {
    if (sidebarOpen && typeof document !== 'undefined') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [sidebarOpen]);

  const isSaasInspectingTenant = user?.user_type === 'saas' && location.pathname.startsWith('/dashboard');

  return (
    <div className="min-h-0 flex-1 flex flex-col bg-background">
      {/* Mobile sidebar overlay - above main content, below sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[45] lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - mobile drawer on top of overlay */}
      <Sidebar
        items={sidebarItems}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area - stays behind overlay on mobile (z-0) */}
      <div className="relative z-0 lg:pl-64 min-h-0 flex-1 flex flex-col">
        {/* SaaS Impersonation Notice Banner */}
        {isSaasInspectingTenant && (
          <div className="sticky top-0 z-40 bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium flex flex-wrap items-center justify-between gap-3 shadow-md border-b border-amber-600/30">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-2.5 w-2.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <span className="truncate">
                Managing ISP: <strong className="font-bold underline decoration-white/40">{selectedTenant?.tenantName || 'Tenant Network'}</strong> {selectedTenant?.tenantCode ? `[${selectedTenant.tenantCode}]` : ''} as <strong className="font-bold">SaaS Super Admin</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  clearSelectedTenant();
                  navigate('/saas/tenants');
                }}
                className="px-2.5 py-1 bg-black/20 hover:bg-black/30 text-white font-semibold text-xs rounded-lg transition-colors border border-white/20 active:scale-95"
              >
                Switch ISP
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSelectedTenant();
                  navigate('/saas/dashboard');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-lg transition-all shadow-sm active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Exit to SaaS Portal
              </button>
            </div>
          </div>
        )}

        {/* Topbar */}
        <Topbar
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          userType={userType}
        />

        {/* Page content */}
        <main className="p-4 lg:p-6 flex-1">
          <div className="w-full min-w-0">
            {children ?? <Outlet />}
          </div>
        </main>

        {/* Dashboard Footer */}
        <Footer />
      </div>
    </div>
  );
}
