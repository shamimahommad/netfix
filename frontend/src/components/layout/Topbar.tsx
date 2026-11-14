import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import { MenuIcon, LogoutIcon, SettingsIcon } from '../icons/Icons';
import { useTenantStore } from '@/stores/tenantStore';
import { useAuthStore } from '@/stores/authStore';
import { tenantsService } from '@/services/tenants.service';
import { Tenant } from '@/types/tenant.types';
import { useTheme } from '@/contexts/ThemeContext';
import { searchService, SearchCustomerResult } from '@/services/search.service';
import { formatCustomerIdDisplay } from '@/lib/formatCustomerId';
import { smsService } from '@/services/sms.service';
import axios, { CancelTokenSource } from 'axios';

interface TopbarProps {
  onMenuClick: () => void;
  userType: 'saas' | 'isp' | 'customer' | 'tenant';
}

const getPageTitle = (pathname: string): string => {
  const path = pathname.split('/').pop() || 'dashboard';
  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    tenants: 'Tenants',
    customers: 'Customers',
    billing: 'Billing',
    network: 'Network',
    settings: 'Settings',
  };
  return titles[path] || 'Dashboard';
};

/** Map role_code to display label for navbar */
const getRoleDisplayLabel = (roleCode: string | undefined): string => {
  if (!roleCode) return 'User';
  const labels: Record<string, string> = {
    admin: 'Admin',
    isp_admin: 'ISP Admin',
    manager: 'Manager',
    reseller: 'Reseller',
    sub_reseller: 'Sub Reseller',
    agent: 'Agent',
  };
  return labels[roleCode] ?? roleCode.charAt(0).toUpperCase() + roleCode.slice(1).replace(/_/g, ' ');
};

/** "Back to X" label for avatar menu when impersonating (based on who we return to) */
const getBackToAdminLabel = (roleCode: string | undefined): string => {
  if (!roleCode) return 'Back to Admin';
  const r = roleCode.toLowerCase();
  if (r === 'saas_admin') return 'Back to Admin';
  if (r === 'admin' || r === 'isp_admin' || r === 'manager') return 'Back to Tenant Admin';
  if (r === 'reseller') return 'Back to Reseller';
  return 'Back to Admin';
};

export default function Topbar({ onMenuClick, userType }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = getPageTitle(location.pathname);
  const { selectedTenant, setSelectedTenant, clearSelectedTenant } = useTenantStore();
  const { user, balance, refreshMe, logout } = useAuthStore();
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [smsBalance, setSmsBalance] = useState<number | null>(null);
  const { theme, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  
  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchCustomerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const cancelTokenRef = useRef<CancelTokenSource | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const userName = user 
    ? `${user.first_name} ${user.last_name}`.trim() || user.email
    : 'User';
  const userInitials = user
    ? `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`.toUpperCase() || user.email.charAt(0).toUpperCase()
    : 'U';

  // Global search function with debouncing and cancellation
  const performSearch = useCallback(async (query: string) => {
    // Cancel previous request if exists
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel('New search initiated');
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Minimum 2 characters
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setShowSearchDropdown(false);
      return;
    }

    // Create new cancel token
    const cancelToken = axios.CancelToken.source();
    cancelTokenRef.current = cancelToken;

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      setShowSearchDropdown(true);

      try {
        const response = await searchService.searchCustomers(query.trim());
        if (response.success) {
          setSearchResults(response.data);
        } else {
          setSearchResults([]);
        }
      } catch (error: any) {
        // Ignore cancellation errors
        if (!axios.isCancel(error)) {
          console.error('Search error:', error);
          setSearchResults([]);
        }
      } finally {
        setIsSearching(false);
        cancelTokenRef.current = null;
      }
    }, 300);
  }, []);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedResultIndex(-1);
    performSearch(value);
  };

  // Handle search input focus
  const handleSearchFocus = () => {
    if (searchQuery.trim().length >= 2 && searchResults.length > 0) {
      setShowSearchDropdown(true);
    }
  };

  // Handle Enter key - redirect to customers list with filter or selected result
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedResultIndex >= 0 && selectedResultIndex < searchResults.length) {
        // Navigate to selected result
        handleResultClick(searchResults[selectedResultIndex]);
      } else if (searchQuery.trim().length >= 2) {
        // Navigate to customers list with search filter
        setShowSearchDropdown(false);
        navigate(`/dashboard/customers/all?search=${encodeURIComponent(searchQuery.trim())}`);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResultIndex((prev) => 
        prev < searchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResultIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSearchDropdown(false);
      searchInputRef.current?.blur();
    }
  };

  // Handle result click - redirect to customer profile
  const handleResultClick = (customer: SearchCustomerResult) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    setSearchResults([]);
    navigate(`/dashboard/customers/view/${customer.customerId}`);
  };

  // Highlight matched text with better styling
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800/50 text-slate-900 dark:text-yellow-100 px-0.5 rounded font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSearchDropdown(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(event.target as Node)) {
        setIsAvatarDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Scroll selected result into view
  useEffect(() => {
    if (selectedResultIndex >= 0 && searchDropdownRef.current) {
      const selectedElement = searchDropdownRef.current.querySelector(
        `[data-result-index="${selectedResultIndex}"]`
      ) as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedResultIndex]);

  const handleLogout = () => {
    logout();
    clearSelectedTenant();
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth-storage');
    sessionStorage.clear();
    window.location.replace('/login');
  };

  // Load balance on mount and on refresh for reseller-type (isp) users
  useEffect(() => {
    if (user && (userType === 'isp' || userType === 'tenant')) {
      refreshMe();
    }
  }, [user?.user_id, userType, refreshMe]);

  // Load SMS balance for dashboard header (isp/tenant)
  useEffect(() => {
    if (!user || (userType !== 'isp' && userType !== 'tenant' && userType !== 'saas')) return;
    smsService.getBalance().then((val) => setSmsBalance(val)).catch(() => setSmsBalance(null));
  }, [user?.user_id, userType]);

  const handleRefreshBalance = () => {
    if (userType !== 'isp' && userType !== 'tenant') return;
    setBalanceLoading(true);
    // Go to dashboard and reload page so balance and context refresh
    window.location.href = '/dashboard';
  };

  // Load tenants for dropdown (only for SaaS admin)
  useEffect(() => {
    if (userType === 'saas' && isDropdownOpen && availableTenants.length === 0) {
      loadTenants();
    }
  }, [userType, isDropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const loadTenants = async () => {
    setIsLoadingTenants(true);
    try {
      const response = await tenantsService.getTenants();
      setAvailableTenants(response.data);
    } catch (error: any) {
      // Silently handle 403 Forbidden - expected if not SaaS admin
      // Only log unexpected errors (not 403)
      if (error?.response?.status !== 403) {
        console.error('Failed to load tenants:', error);
      }
      setAvailableTenants([]);
    } finally {
      setIsLoadingTenants(false);
    }
  };

  const handleTenantSelect = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setIsDropdownOpen(false);
    // If on dashboard route, stay there; otherwise navigate to dashboard
    if (location.pathname.startsWith('/dashboard')) {
      // Refresh current page to update context
      window.location.reload();
    } else {
      navigate('/dashboard');
    }
  };

  const handleClearSelection = () => {
    setSelectedTenant(null);
    setIsDropdownOpen(false);
    navigate('/saas/tenants');
  };

  const { impersonated, impersonatedBy, user: authUser } = useAuthStore();
  const [exitingImpersonation, setExitingImpersonation] = useState(false);
  const handleExitImpersonation = async () => {
    try {
      setExitingImpersonation(true);
      const { authService } = await import('@/services/auth.service');
      const data = await authService.exitImpersonation();
      window.location.href = data.redirect_url || '/dashboard';
    } catch {
      setExitingImpersonation(false);
    }
  };

  return (
    <>
      {impersonated && (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-2 bg-amber-500 text-amber-950 shadow-md">
          <span className="text-sm font-medium truncate">
            Impersonating: {authUser ? `${authUser.first_name} ${authUser.last_name}`.trim() || authUser.email || (authUser as any).username : '—'} ({getRoleDisplayLabel(authUser?.role_code)})
          </span>
          <button
            type="button"
            onClick={handleExitImpersonation}
            disabled={exitingImpersonation}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-900/30 hover:bg-amber-900/50 text-amber-950 font-semibold text-sm disabled:opacity-70 transition-colors"
          >
            {exitingImpersonation ? 'Exiting...' : 'Exit Impersonation'}
          </button>
        </div>
      )}
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 lg:px-8 py-2 sm:py-3 bg-card border-b border-border shadow-sm">
      {/* Left: Menu + Search */}
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 max-w-full sm:max-w-md">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="flex-shrink-0 lg:hidden p-2 rounded-button text-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-text-primary transition-colors"
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>

        {/* Search Bar with Dropdown - responsive width */}
        <div className="flex-1 min-w-0 relative" ref={searchDropdownRef}>
          <form onSubmit={(e) => e.preventDefault()} className="relative">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={handleSearchFocus}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search customers..."
                className="w-full min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-11 pr-9 sm:pr-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all shadow-sm hover:shadow-md focus:shadow-lg"
              />
              <svg
                className="absolute left-2.5 sm:left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 dark:text-slate-500 pointer-events-none flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {isSearching && (
                <div className="absolute right-9 sm:right-11 top-1/2 transform -translate-y-1/2">
                  <svg className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
              {searchQuery && !isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchDropdown(false);
                  }}
                  className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </form>

          {/* Search Dropdown - fixed full width on mobile so it doesn't become a narrow strip; absolute on desktop */}
          {showSearchDropdown && searchQuery.trim().length >= 2 && (
            <div className="fixed sm:absolute left-0 sm:left-0 right-0 sm:right-0 top-14 sm:top-full sm:mt-2 mx-0 sm:mx-0 w-full sm:w-full min-w-0 bg-white dark:bg-slate-800 rounded-none sm:rounded-xl rounded-b-xl shadow-2xl border border-slate-200 dark:border-slate-700 border-t-0 sm:border-t z-[100] max-h-[70vh] sm:max-h-[480px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="overflow-y-auto max-h-[70vh] sm:max-h-[480px] custom-scrollbar">
                {isSearching ? (
                  <div className="px-6 py-12 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
                      <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Searching...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="py-2">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
                      </p>
                    </div>
                    {searchResults.map((customer, index) => (
                      <button
                        key={customer.customerId}
                        data-result-index={index}
                        onClick={() => handleResultClick(customer)}
                        className={`w-full text-left px-4 py-3.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-all duration-150 border-l-4 ${
                          index === selectedResultIndex 
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-500 dark:border-blue-400' 
                            : 'border-transparent hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                {customer.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate text-base">
                                  {highlightText(customer.fullName, searchQuery)}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 ml-10 text-xs text-slate-500 dark:text-slate-400">
                              {customer.customerCode && (
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                  </svg>
                                  <span className="font-mono">{highlightText(formatCustomerIdDisplay(customer.customerCode), searchQuery)}</span>
                                </div>
                              )}
                              {customer.username && (
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <span className="font-medium">{highlightText(customer.username, searchQuery)}</span>
                                </div>
                              )}
                              {customer.phone && (
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span>{highlightText(customer.phone, searchQuery)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              customer.status === 'active' 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                : customer.status === 'suspended'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : customer.status === 'terminated' || customer.status === 'cancelled'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                              {customer.status}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                        Press <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono">Enter</kbd> to view all results
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="px-6 py-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 mb-4">
                      <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">No results found</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">Try a different search term</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Page title + ISP Badge */}
      <div className="hidden lg:flex items-center gap-2 lg:gap-4 flex-shrink-0">
        {/* Page title */}
        <h2 className="text-base lg:text-lg font-semibold text-text-primary truncate max-w-[12rem] xl:max-w-none">
          {pageTitle}
        </h2>

        {/* Active ISP Badge/Dropdown (only for SaaS admin) */}
        {userType === 'saas' && (
          <div className="relative" ref={dropdownRef}>
            {selectedTenant ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors text-sm font-medium"
                >
                  <span>{selectedTenant.tenantName}</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-sm">
                No ISP Selected
              </div>
            )}

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto">
                <div className="p-2">
                  {selectedTenant && (
                    <div className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                      <button
                        onClick={handleClearSelection}
                        className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}
                  {isLoadingTenants ? (
                    <div className="px-3 py-4 text-center text-sm text-gray-500">Loading ISPs...</div>
                  ) : availableTenants.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-gray-500">No ISPs available</div>
                  ) : (
                    <div className="space-y-1">
                      {availableTenants.map((tenant) => (
                        <button
                          key={tenant.tenantId}
                          onClick={() => handleTenantSelect(tenant)}
                          className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                            selectedTenant?.tenantId === tenant.tenantId
                              ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-medium'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className="font-medium">{tenant.tenantName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">ID #{tenant.tenantCode}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Theme Toggle + User menu */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
          aria-label="Toggle theme"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <svg className="w-5 h-5 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>

        {/* Dashboard header badges: User ID, SMS, Balance, Refresh - hide P and SMS on small screens for space */}
        {user && (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap justify-end">
            <span className="hidden sm:inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              P{user.user_id}
            </span>
            <span className="hidden sm:inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title="SMS credit balance">
              SMS: {smsBalance != null ? smsBalance.toLocaleString('en-BD') : '—'}
            </span>
            {(userType === 'isp' || userType === 'tenant') && (
              <>
                <span className={`inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold border ${
                  balance != null && balance < 0
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}>
                  <span className="hidden sm:inline">Balance: </span>৳{balance != null ? Number(balance).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'}
                </span>
                <button
                  type="button"
                  onClick={handleRefreshBalance}
                  disabled={balanceLoading}
                  className="hidden sm:inline-flex p-2 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  aria-label="Refresh balance"
                  title="Refresh balance"
                >
                  <svg className={`w-5 h-5 ${balanceLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}

        {/* SaaS Super Admin Quick Exit Button */}
        {user?.user_type === 'saas' && location.pathname.startsWith('/dashboard') && (
          <button
            type="button"
            onClick={() => {
              clearSelectedTenant();
              navigate('/saas/dashboard');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-95 shrink-0"
            title="Exit Tenant and Return to SaaS Admin Portal"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Back to SaaS</span>
          </button>
        )}

        {/* User info + Avatar dropdown (single ref wraps both desktop and mobile) */}
        <div ref={avatarDropdownRef} className="flex items-center">
          <div className="relative hidden sm:block">
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-text-primary leading-tight">{userName}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAvatarDropdownOpen((o) => !o)}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-600 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
              aria-label="User menu"
              aria-expanded={isAvatarDropdownOpen}
            >
              <span className="text-sm font-medium">{userInitials}</span>
            </button>
          </div>
          {isAvatarDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 py-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50">
              {user?.user_type === 'saas' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarDropdownOpen(false);
                    clearSelectedTenant();
                    navigate('/saas/dashboard');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border-b border-slate-200 dark:border-slate-700 transition-colors"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-bold text-xs">Return to SaaS Admin</p>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400">Exit tenant and open SaaS</p>
                  </div>
                </button>
              )}
              {impersonated && (
                <button
                  type="button"
                  onClick={() => { setIsAvatarDropdownOpen(false); handleExitImpersonation(); }}
                  disabled={exitingImpersonation}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border-b border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-70"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-200 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </span>
                  {exitingImpersonation ? 'Exiting...' : getBackToAdminLabel(impersonatedBy?.role_code)}
                </button>
              )}
              <button
                type="button"
                onClick={() => { navigate('/dashboard/settings/company-profile'); setIsAvatarDropdownOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </span>
                Company Profile
              </button>
              <button
                type="button"
                onClick={() => { navigate('/dashboard/settings'); setIsAvatarDropdownOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 shrink-0">
                  <SettingsIcon />
                </span>
                Settings
              </button>
              <button
                type="button"
                onClick={() => { navigate('/dashboard/change-password'); setIsAvatarDropdownOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l11.964-11.964A6 6 0 1121 9z" />
                  </svg>
                </span>
                Change Password
              </button>
              <button
                type="button"
                onClick={() => { setIsAvatarDropdownOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 border-t border-slate-100 dark:border-slate-700 transition-colors"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 shrink-0">
                  <LogoutIcon />
                </span>
                <span className="font-medium">Logout</span>
              </button>
            </div>
          )}
          </div>

        {/* Mobile avatar + dropdown */}
          <div className="relative sm:hidden">
          <button
            type="button"
            onClick={() => setIsAvatarDropdownOpen((o) => !o)}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="User menu"
            aria-expanded={isAvatarDropdownOpen}
          >
            <span className="text-xs font-medium">{userInitials}</span>
          </button>
          {isAvatarDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 py-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50">
              {user?.user_type === 'saas' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarDropdownOpen(false);
                    clearSelectedTenant();
                    navigate('/saas/dashboard');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border-b border-slate-200 dark:border-slate-700 transition-colors"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-bold text-xs">Return to SaaS Admin</p>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400">Exit tenant and open SaaS</p>
                  </div>
                </button>
              )}
              {impersonated && (
                <button
                  type="button"
                  onClick={() => { setIsAvatarDropdownOpen(false); handleExitImpersonation(); }}
                  disabled={exitingImpersonation}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border-b border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-70"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-200 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </span>
                  {exitingImpersonation ? 'Exiting...' : getBackToAdminLabel(impersonatedBy?.role_code)}
                </button>
              )}
              <button
                type="button"
                onClick={() => { navigate('/dashboard/settings/company-profile'); setIsAvatarDropdownOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/20"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </span>
                Company Profile
              </button>
              <button
                type="button"
                onClick={() => { navigate('/dashboard/settings'); setIsAvatarDropdownOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 shrink-0">
                  <SettingsIcon />
                </span>
                Settings
              </button>
              <button
                type="button"
                onClick={() => { navigate('/dashboard/change-password'); setIsAvatarDropdownOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l11.964-11.964A6 6 0 1121 9z" />
                  </svg>
                </span>
                Change Password
              </button>
              <button
                type="button"
                onClick={() => { setIsAvatarDropdownOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-slate-200 dark:border-slate-700"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 shrink-0">
                  <LogoutIcon />
                </span>
                Logout
              </button>
            </div>
          )}
          </div>
        </div>

        {/* Logout button */}
        <button
          className="hidden sm:flex items-center space-x-2 px-4 py-2 text-sm font-medium text-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-button transition-colors"
          onClick={handleLogout}
        >
          <LogoutIcon />
          <span>Logout</span>
        </button>

        {/* Logout on mobile: hidden; desktop uses the "Logout" button above (sm:flex) */}
        <button
          className="hidden p-2 rounded-button text-text-secondary hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-text-primary transition-colors"
          onClick={handleLogout}
          aria-hidden
        >
          <LogoutIcon />
        </button>
      </div>
    </header>
    </>
  );
}
