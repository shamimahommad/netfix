import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { SidebarItem } from './AppLayout';
import { XIcon } from '../icons/Icons';

interface SidebarProps {
  items: SidebarItem[];
  isOpen: boolean;
  onClose: () => void;
}

interface SidebarMenuItemProps {
  item: SidebarItem;
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

function SidebarMenuItem({ item, isOpen = false, onToggle, onClose }: SidebarMenuItemProps) {
  const location = useLocation();

  const accentMap: Record<string, string> = {
    Dashboard: 'from-blue-500/15 via-blue-400/10 to-blue-500/5 text-blue-600',
    Customers: 'from-emerald-500/15 via-emerald-400/10 to-emerald-500/5 text-emerald-600',
    Billing: 'from-amber-500/20 via-amber-400/10 to-amber-500/5 text-amber-600',
    SMS: 'from-sky-500/20 via-sky-400/10 to-sky-500/5 text-sky-600',
    'Service Area': 'from-rose-500/20 via-rose-400/10 to-rose-500/5 text-rose-600',
    Hotspot: 'from-orange-500/20 via-red-400/10 to-orange-500/5 text-orange-600',
    Reseller: 'from-violet-500/25 via-purple-500/15 to-violet-500/5 text-violet-600',
    'Topup Balance': 'from-cyan-500/20 via-cyan-400/10 to-cyan-500/5 text-cyan-600',
    Report: 'from-indigo-500/20 via-indigo-400/10 to-indigo-500/5 text-indigo-600',
    Map: 'from-teal-500/20 via-teal-400/10 to-teal-500/5 text-teal-600',
    Support: 'from-fuchsia-500/20 via-fuchsia-400/10 to-fuchsia-500/5 text-fuchsia-600',
    Network: 'from-sky-500/20 via-blue-500/10 to-sky-500/5 text-sky-600',
    Settings: 'from-slate-500/20 via-slate-400/10 to-slate-500/5 text-slate-700',
    'My Packages': 'from-purple-500/20 via-purple-400/10 to-purple-500/5 text-purple-600',
  };

  const accentClass =
    accentMap[item.label] ?? 'from-slate-500/15 via-slate-400/10 to-slate-500/5 text-slate-600';

  const hasActiveSubmenu = item.submenu?.some(subItem => 
    subItem.path === '/dashboard' 
      ? location.pathname === '/dashboard' 
      : (location.pathname === subItem.path || (subItem.path !== '/' && location.pathname.startsWith(subItem.path)))
  );
  const isParentActive = item.path && location.pathname === item.path;

  if (item.submenu && item.submenu.length > 0) {
    const isActiveTab = Boolean(hasActiveSubmenu || isParentActive);
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={onToggle}
          className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-xl transition-all relative ${
            isActiveTab
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          {isActiveTab && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-full" />
          )}
          <div className="flex items-center flex-1">
            <span
              className={`mr-3 flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br ${accentClass} flex items-center justify-center shadow-sm`}
            >
              <span className="w-4 h-4">{item.icon}</span>
            </span>
            <span className="flex-1 text-left font-semibold tracking-[0.01em]">
              {item.label}
            </span>
          </div>
          {item.badge && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
              {item.badge}
            </span>
          )}
          <svg
            className={`w-4 h-4 ml-2 transition-transform text-blue-600 dark:text-blue-400 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && (
          <div className="ml-4 space-y-0.5 border-l-2 border-slate-200 dark:border-slate-700 pl-4 py-1">
            {item.submenu.map((subItem) => {
              const isActive = location.pathname === subItem.path;
              return (
                <NavLink
                  key={subItem.path}
                  to={subItem.path}
                  onClick={onClose}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/25 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {subItem.icon && <span className="flex-shrink-0 w-4 h-4">{subItem.icon}</span>}
                    <span>{subItem.label}</span>
                  </span>
                  {subItem.badge && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                      {subItem.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const isExactRoute = Boolean(item.path && (!item.submenu || item.submenu.length === 0));

  return (
    <NavLink
      to={item.path || '#'}
      end={isExactRoute}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl transition-all relative ${
          isActive
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold shadow-sm'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-full" />
          )}
          <span
            className={`mr-3 flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br ${accentClass} flex items-center justify-center shadow-sm`}
          >
            <span className="w-4 h-4">{item.icon}</span>
          </span>
          <span className="flex-1 font-semibold tracking-[0.01em]">{item.label}</span>
          {item.badge && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ items, isOpen, onClose }: SidebarProps) {
  const location = useLocation();

  // Find which parent tab contains the current active route
  const findActiveMenuLabel = useCallback((): string | null => {
    for (const item of items) {
      if (item.submenu && item.submenu.length > 0) {
        const hasMatch = item.submenu.some(sub => 
          sub.path === '/dashboard' 
            ? location.pathname === '/dashboard' 
            : (location.pathname === sub.path || (sub.path !== '/' && location.pathname.startsWith(sub.path)))
        );
        if (hasMatch) return item.label;
      }
    }
    return null;
  }, [items, location.pathname]);

  // Only one menu open at a time (accordion style)
  // IMPORTANT: exactly ONE label at a time — never an array
  const [openMenuLabel, setOpenMenuLabel] = useState<string | null>(() => findActiveMenuLabel());

  // Automatically keep ONLY the active tab expanded whenever the route changes
  useEffect(() => {
    setOpenMenuLabel(findActiveMenuLabel());
  }, [findActiveMenuLabel]);

  const handleToggle = (label: string) => {
    setOpenMenuLabel(prev => (prev === label ? null : label));
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:w-64 lg:bg-card lg:border-r lg:border-border">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-border">
          <h1 className="text-xl font-bold text-text-primary">ISP SaaS</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {items.map((item, idx) => (
            <SidebarMenuItem 
              key={item.path || item.label || idx} 
              item={item} 
              isOpen={openMenuLabel === item.label}
              onToggle={() => handleToggle(item.label)}
            />
          ))}
        </nav>
      </aside>

      {/* Mobile Sidebar - drawer above overlay, slides in from left */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-card border-r border-border shadow-2xl transform transition-transform duration-300 ease-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-modal="true"
        aria-label="Main navigation"
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-border">
          <h1 className="text-xl font-bold text-text-primary">ISP SaaS</h1>
          <button
            onClick={onClose}
            className="p-2 rounded-button text-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-text-primary transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {items.map((item, idx) => (
            <SidebarMenuItem 
              key={item.path || item.label || idx} 
              item={item} 
              isOpen={openMenuLabel === item.label}
              onToggle={() => handleToggle(item.label)}
              onClose={onClose} 
            />
          ))}
        </nav>
      </aside>
    </>
  );
}
