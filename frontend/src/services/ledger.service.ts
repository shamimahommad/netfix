import api from '@/lib/api';

export interface LedgerStatementParams {
  user_id?: number | string;
  start_date?: string;
  end_date?: string;
  purpose?: string;
  type?: 'credit' | 'debit';
  page?: number;
  limit?: number;
}

export interface LedgerEntry {
  id: number;
  txn_group_id: string;
  type: 'credit' | 'debit';
  amount: number | string;
  opening_balance: number | string;
  closing_balance: number | string;
  purpose: 'customer_payment' | 'commission_margin' | 'wallet_recharge' | 'package_deduction';
  description: string;
  created_at: string;
  invoice_id: number | null;
  invoice_number: string | null;
  source_customer_id: number | null;
  customer_username: string | null;
  customer_full_name: string | null;
  account_username: string;
  account_role: string;
}

export interface LedgerSummary {
  total_credit: number;
  total_debit: number;
  net_profit: number;
  current_balance: number;
}

export interface LedgerPagination {
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
}

export interface LedgerStatementResponse {
  success: boolean;
  message?: string;
  user: {
    user_id: number;
    username: string;
    full_name: string | null;
    role: string;
  };
  wallet: {
    balance: number;
    currency: string;
    status: string;
  };
  summary: LedgerSummary;
  pagination: LedgerPagination;
  data: LedgerEntry[];
}

export interface DownlineReconciliationRow {
  user_id: number;
  username: string;
  full_name: string | null;
  role: string;
  txn_count: number;
  commission_earned: number;
  direct_payment_received: number;
  total_credited: number;
  current_wallet_balance: number;
}

export interface PackageReconciliationRow {
  access_profile_id: number;
  package_name: string;
  retail_price: number;
  total_invoices_paid: number;
  total_retail_volume: number;
  active_subscribers: number;
}

export interface ReconciliationTimelineRow {
  txn_date: string;
  settlements_count: number;
  daily_commissions: number;
  daily_isp_revenue: number;
  daily_total_disbursed: number;
}

export interface ReconciliationResponse {
  success: boolean;
  message?: string;
  period: {
    key: string;
    start_date: string;
    end_date: string;
  };
  overall: {
    total_settled_txns: number;
    total_settled_invoices: number;
    total_disbursed_funds: number;
    total_commissions_distributed: number;
    total_isp_collected: number;
  };
  downline_reconciliation: DownlineReconciliationRow[];
  package_reconciliation: PackageReconciliationRow[];
  daily_timeline: ReconciliationTimelineRow[];
}

export const ledgerService = {
  getLedgerStatement: async (params?: LedgerStatementParams): Promise<LedgerStatementResponse> => {
    const res = await api.get('/reports/ledger_statement', { params });
    return res.data;
  },

  getReconciliation: async (params?: {
    period?: string;
    start_date?: string;
    end_date?: string;
    package_id?: number;
    downline_user_id?: number;
  }): Promise<ReconciliationResponse> => {
    const res = await api.get('/reports/reconciliation', { params });
    return res.data;
  },
};

export default ledgerService;
