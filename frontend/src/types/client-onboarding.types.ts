import { NetworkProtocol } from '@/types/network.types';

export type BillingCycle = 'monthly' | 'custom';

export interface CreateClientPayload {
  // 1) Basic info
  clientName: string;
  mobileNo: string;
  email?: string;
  nidNo?: string;
  dob?: string; // yyyy-mm-dd
  address?: string;
  area?: string;
  subArea?: string;
  district?: string;
  thana?: string;
  latitude?: number;
  longitude?: number;

  // 2) Server info
  serverId: string;
  protocol: NetworkProtocol;
  packageId: string;
  username: string;
  password: string;
  remoteAddress?: string;
  billingCycle: BillingCycle;

  // 3) Ownership/status
  /** Assign customer to this user (Reseller/Sub Reseller/Agent). Admin: any; Reseller: self + downline; Sub Reseller: self + agents; Agent: do not send */
  ownerId?: string;
  initialStatus?: 'active' | 'pending_activation';
  /** Customer category: Prepaid, Postpaid, VIP, Free */
  clientCategory?: 'prepaid' | 'postpaid' | 'vip' | 'free';
  /** Balance adjustment at creation: positive = credit (add), negative = debit (less). Amount in ৳ */
  addLessAmount?: number;
  /** Installation charge / OTC (One Time Charge) in ৳ */
  installationCharge?: number;
  /** Optional 6-digit numeric Customer ID. If provided and unique per tenant, used; else auto-generated. */
  customerCode?: string;
}

export interface CreateClientResponse {
  success: boolean;
  data: {
    customerId: string;
    customerCode: string;
  };
}

