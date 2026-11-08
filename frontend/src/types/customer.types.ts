export interface Customer {
  customer_id: string;
  customer_code: string;
  username: string | null;
  full_name: string;
  phone: string;
  mobile?: string; // Alias for phone
  email: string | null;
  status: 'pending_activation' | 'active' | 'suspended' | 'terminated' | 'cancelled' | 'expired';
  connection_date: string | null;
  balance: number | null;
  area_name: string | null;
  sub_area_name: string | null;
  district_name?: string | null;
  thana_name?: string | null;
  server_name: string | null;
  protocol: 'pppoe' | 'hotspot' | 'static' | 'ovpn' | 'pptp' | null;
  package_name: string | null;
  package_price: number | null;
  bill_amount: number | null;
  billing_cycle: 'monthly' | 'custom' | null;
  expiry_date: string | null;
  last_payment_date: string | null;
  account_status: 'active' | 'suspended' | 'expired' | null;
  billing_status: 'Paid' | 'Due' | 'Expired' | 'Left' | 'Suspended' | 'Pending' | null;
  online_status: boolean;
  last_logout_at: string | null;
  created_at: string;
  used_months: number | null;
  // Online session fields (optional, may not be present for all customers)
  ip_address?: string | null;
  mac_address?: string | null;
  uptime_seconds?: number | null;
  upload_bytes?: number | null;
  download_bytes?: number | null;
  last_offline_at?: string | null;
  last_disconnect_reason?: string | null;
  session_start_time?: string | null;
  // Legacy fields for backward compatibility
  customerId?: string;
  customerCode?: string;
  fullName?: string;
  connectionDate?: string | null;
  createdAt?: string;
}

export interface CustomerDetail {
  customerId: string;
  customerCode: string;
  customerType: 'individual' | 'business';
  fullName: string;
  email: string | null;
  phone: string;
  alternatePhone: string | null;
  nationalId: string | null;
  taxIdentifier: string | null;
  billingAddress: string | null;
  installationAddress: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  status: 'pending_activation' | 'active' | 'suspended' | 'terminated' | 'cancelled';
  connectionDate: string | null;
  creditLimit: number | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetailResponse {
  success: boolean;
  data: {
    customer: CustomerDetail & {
      dob?: string | null;
      area?: string | null;
      subArea?: string | null;
      district?: string | null;
      thana?: string | null;
      /** Owner user id (reseller/agent); when same as logged-in user, customer is "own" */
      ownerId?: string | null;
    };
    service: {
      packageName: string | null;
      expiryDate: string | null;
      dataUsed: string | null;
      billingCycle: 'monthly' | 'custom' | null;
      billingType: 'Free' | 'Paid' | null;
      /** Prepaid, Postpaid, VIP, Free (from customer metadata) */
      customerType?: string | null;
    };
    network: {
      protocolType: 'pppoe' | 'hotspot' | 'static' | 'ovpn' | 'pptp' | null;
      serverName: string | null;
      username: string | null;
      password: string | null;
      ipAddress: string | null;
      macAddress: string | null;
      activeMacAddress: string | null;
      deviceVendor: string | null;
      vendorSource: string | null;
      uptime: number | null;
      onlineStatus: boolean;
      lastLogoutTime: string | null;
      lastDisconnectReason?: string | null;
      uploadBytes: number | null;
      downloadBytes: number | null;
      totalDataUsed: number | null;
      isSuspended?: boolean; // True if MikroTik PPP secret profile is "Expired_Profile"
    };
    billing: {
      balance: number;
      planPrice: number | null;
      billingStatus: 'Paid' | 'Due' | 'Expired' | 'Left' | 'Suspended' | 'Pending' | null;
      accountStatus: 'active' | 'suspended' | 'expired' | 'free' | null;
      expiryDate: string | null;
      lastPaymentDate: string | null;
      connectedBy: string | null;
      location: string | null;
    };
    onu: {
      olt: string | null;
      onuMac: string | null;
      onuVendor?: string | null;
      routerMac?: string | null;
      ponId: string | null;
      vlan: string | null;
      power: string | null;
      rxPower?: number | null;
      distance: string | null;
      status?: string | null;
      lastUpdate: string | null;
    };
  };
}

export interface CustomerService {
  serviceId: string;
  packageName: string;
  status: string;
  startDate: string;
  expiryDate: string | null;
  downloadSpeed: number;
  uploadSpeed: number;
}

export interface CustomerServicesResponse {
  success: boolean;
  data: CustomerService[];
  message?: string;
}

export interface CustomerNetworkAccount {
  accountId: string;
  accountType: 'pppoe' | 'hotspot' | 'static_ip';
  username: string;
  serverName: string;
  ipAddress: string | null;
  macAddress: string | null;
  status: string;
  createdAt: string;
}

export interface CustomerNetworkAccountsResponse {
  success: boolean;
  data: CustomerNetworkAccount[];
  message?: string;
}

export interface CustomerBillingSummary {
  total_due: number;
  last_invoice_amount: number | null;
  last_payment_date: string | null;
  billing_status: 'current' | 'overdue' | 'suspended';
}

export interface CustomerBillingSummaryResponse {
  success: boolean;
  data: CustomerBillingSummary;
  message?: string;
}

export interface CustomerStatusHistory {
  historyId: string;
  previousStatus: string;
  newStatus: string;
  changedAt: string;
  changedBy: string;
  reason: string | null;
}

export interface CustomerStatusHistoryResponse {
  success: boolean;
  data: CustomerStatusHistory[];
  message?: string;
}

export interface CustomersResponse {
  success: boolean;
  data: Customer[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CustomersFilters {
  status?: string;
  search?: string;
  ownerId?: string;
  area?: string;
  serverId?: string;
  page?: number;
  limit?: number;
}

export interface CreateCustomerPayload {
  fullName: string;
  phone: string;
  email?: string;
  installationAddress: string;
  latitude?: number;
  longitude?: number;
}

export interface CreateCustomerResponse {
  success: boolean;
  data: Customer;
}