import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuthStore } from '@/stores/authStore';

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
  const refreshMe = useAuthStore((s) => s.refreshMe);

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
        {/* Topbar */}
        <Topbar
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          userType={userType}
        />

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <div className="w-full min-w-0">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
