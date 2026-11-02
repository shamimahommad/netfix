import { createContext, useContext, useState, ReactNode } from 'react';

export interface CustomerPortalProfile {
  fullName: string;
  customerCode: string;
  phone: string | null;
  email: string | null;
  /** Whether customer's network session is currently online (from dashboard API). */
  onlineStatus?: boolean;
}

const CustomerPortalContext = createContext<{
  profile: CustomerPortalProfile | null;
  setProfile: (p: CustomerPortalProfile | null) => void;
} | null>(null);

export function CustomerPortalProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CustomerPortalProfile | null>(null);
  return (
    <CustomerPortalContext.Provider value={{ profile, setProfile }}>
      {children}
    </CustomerPortalContext.Provider>
  );
}

export function useCustomerPortalProfile() {
  const ctx = useContext(CustomerPortalContext);
  if (!ctx) return { profile: null, setProfile: () => {} };
  return ctx;
}
