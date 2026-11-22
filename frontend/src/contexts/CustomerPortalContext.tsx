import { createContext, useContext, useState, ReactNode } from 'react';
import { CustomerPortalCompany } from '@/services/customer-portal.service';

export type PortalDesignMode = 'classic' | 'crafted';

export interface CustomerPortalProfile {
  fullName: string;
  customerCode: string;
  phone: string | null;
  email: string | null;
  address?: string | null;
  /** Whether customer's network session is currently online (from dashboard API). */
  onlineStatus?: boolean;
  /** ISP company branding (Name, Logo, Support contact) */
  company?: CustomerPortalCompany | null;
}

export interface CustomerPortalContextValue {
  profile: CustomerPortalProfile | null;
  setProfile: (p: CustomerPortalProfile | null) => void;
  designMode: PortalDesignMode;
  setDesignMode: (mode: PortalDesignMode) => void;
  toggleDesignMode: () => void;
}

const STORAGE_KEY = 'netfix_customer_portal_design_mode';

const CustomerPortalContext = createContext<CustomerPortalContextValue | null>(null);

export function CustomerPortalProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CustomerPortalProfile | null>(null);
  const [designMode, setDesignModeState] = useState<PortalDesignMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'classic' || saved === 'crafted') {
        return saved;
      }
    } catch {
      // ignore
    }
    // Default to 'crafted' for the modern unslop design, while leaving 'classic' 1-click away
    return 'crafted';
  });

  const setDesignMode = (mode: PortalDesignMode) => {
    setDesignModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  };

  const toggleDesignMode = () => {
    setDesignMode(designMode === 'crafted' ? 'classic' : 'crafted');
  };

  return (
    <CustomerPortalContext.Provider
      value={{
        profile,
        setProfile,
        designMode,
        setDesignMode,
        toggleDesignMode,
      }}
    >
      {children}
    </CustomerPortalContext.Provider>
  );
}

export function useCustomerPortalProfile() {
  const ctx = useContext(CustomerPortalContext);
  if (!ctx) {
    return {
      profile: null,
      setProfile: () => {},
      designMode: 'crafted' as PortalDesignMode,
      setDesignMode: () => {},
      toggleDesignMode: () => {},
    };
  }
  return ctx;
}
