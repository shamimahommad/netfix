/**
 * Company Profile & Setup Types
 */

export interface CompanyProfile {
  tenant_id: string;
  tenant_code: string;
  company_name: string;
  company_email: string;
  owner_phone: string;
  support_phone: string;
  address: string;
  logo_url: string | null;
  can_edit_name: boolean;
}

export interface CompanyProfileUpdatePayload {
  company_name?: string;
  company_email?: string;
  owner_phone?: string;
  support_phone?: string;
  address?: string;
  logo?: File | null;
  logo_data?: string | null;
}

