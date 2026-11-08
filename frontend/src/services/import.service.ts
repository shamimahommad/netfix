import api from '@/lib/api';
import * as XLSX from 'xlsx';

export interface MikrotikPreviewUser {
  username: string;
  password?: string;
  profile?: string;
  comment?: string;
  caller_id?: string;
  disabled?: boolean;
  exists_in_db?: boolean;
  existing_info?: {
    customer_code?: string;
    full_name?: string;
    phone?: string;
  } | null;
  suggested_name?: string;
  suggested_phone?: string;
  matched_package_id?: string | number | null;
  matched_package_name?: string | null;
  matched_package_price?: number;
}

export interface MikrotikPreviewResponse {
  success: boolean;
  router?: {
    id: string;
    name: string;
    ip: string;
  };
  total: number;
  new_count: number;
  existing_count: number;
  data: MikrotikPreviewUser[];
}

export interface MikrotikImportPayload {
  deviceId: string;
  importAs: 'prepaid' | 'postpaid';
  expiryDate?: string;
  invoiceMonth?: string;
  generateInvoice?: boolean;
  deductResellerBalance?: boolean;
  savePasswords?: boolean;
  doNotOverwriteExisting?: boolean;
  resellerId?: string | number | null;
  areaId?: string | number | null;
  subAreaId?: string | number | null;
  defaultPackageId?: string | number | null;
  users: Array<{
    username: string;
    password?: string;
    profile?: string;
    name?: string;
    phone?: string;
    packageId?: string | number | null;
    caller_id?: string;
    comment?: string;
    disabled?: boolean;
  }>;
}

export interface CsvClientRow {
  name: string;
  pppoe_id: string;
  package: string;
  pppoe_pass?: string;
  mobile?: string;
  alternate_mobile?: string;
  address?: string;
  area?: string;
  zone?: string;
  status?: string;
  router?: string;
  join_date?: string;
  expiry_date?: string;
  monthly_bill?: string | number;
  email?: string;
  remarks?: string;
  onu_mac?: string;
  ip_address?: string;
  client_code?: string;
  // UI validation flags
  _isValid?: boolean;
  _error?: string;
  _isExisting?: boolean;
  _selected?: boolean;
}

export interface BatchClientsImportPayload {
  clients: CsvClientRow[];
  importTarget: 'admin' | string | number;
  importAs: 'prepaid' | 'postpaid';
  expiryDate?: string;
  invoiceMonth?: string;
  createInvoice?: boolean;
  defaultDeviceId?: string;
  defaultPackageId?: string;
  defaultAreaId?: string;
}

export const importService = {
  async getMikrotikPreview(params: {
    deviceId: string;
    profile?: string;
    hideExisting?: boolean;
    importAs?: string;
  }): Promise<MikrotikPreviewResponse> {
    const res = await api.get<MikrotikPreviewResponse>('/network/mikrotik/import-preview', {
      params: {
        deviceId: params.deviceId,
        profile: params.profile && params.profile !== '-- All Profiles --' ? params.profile : undefined,
        hideExisting: params.hideExisting ? 'true' : 'false',
        importAs: params.importAs || 'prepaid',
      },
    });
    return res.data;
  },

  async confirmMikrotikImport(payload: MikrotikImportPayload): Promise<{
    success: boolean;
    message: string;
    importedCount: number;
    skippedCount: number;
  }> {
    const res = await api.post('/network/mikrotik/import-confirm', payload);
    return res.data;
  },

  async importBatchClients(payload: BatchClientsImportPayload): Promise<{
    success: boolean;
    message: string;
    importedCount: number;
    skippedCount: number;
    errors?: string[];
  }> {
    const res = await api.post('/customers/import-batch', payload);
    return res.data;
  },

  downloadCsvTemplate() {
    const headers = [
      'name',
      'pppoe_id',
      'package',
      'pppoe_pass',
      'mobile',
      'alternate_mobile',
      'address',
      'area',
      'zone',
      'status',
      'router',
      'join_date',
      'expiry_date',
      'monthly_bill',
      'email',
      'remarks',
      'client_code',
    ];
    const sampleRows = [
      [
        'Rahim Ahmed',
        'rahim_pppoe',
        '10 Mbps',
        'pass123',
        '01711223344',
        '01811223344',
        'House 12, Road 4, Mirpur',
        'Mirpur-10',
        'North Zone',
        'active',
        'Core Router',
        '2026-11-01',
        '2026-12-01',
        '800',
        'rahim@example.com',
        'VIP client',
        '100015',
      ],
      [
        'Karim Hasan',
        'karim_net',
        '20 Mbps',
        'secret456',
        '01911223344',
        '',
        'Flat 3B, Dhanmondi 27',
        'Dhanmondi',
        'South Zone',
        'active',
        'Core Router',
        '2026-11-05',
        '2026-12-05',
        '1200',
        'karim@example.com',
        '',
        '',
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const csvOutput = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'clients_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  downloadXlsxTemplate() {
    const headers = [
      'name',
      'pppoe_id',
      'package',
      'pppoe_pass',
      'mobile',
      'alternate_mobile',
      'address',
      'area',
      'zone',
      'status',
      'router',
      'join_date',
      'expiry_date',
      'monthly_bill',
      'email',
      'remarks',
      'client_code',
    ];
    const sampleRows = [
      [
        'Rahim Ahmed',
        'rahim_pppoe',
        '10 Mbps',
        'pass123',
        '01711223344',
        '01811223344',
        'House 12, Road 4, Mirpur',
        'Mirpur-10',
        'North Zone',
        'active',
        'Core Router',
        '2026-11-01',
        '2026-12-01',
        '800',
        'rahim@example.com',
        'VIP client',
        '100015',
      ],
      [
        'Karim Hasan',
        'karim_net',
        '20 Mbps',
        'secret456',
        '01911223344',
        '',
        'Flat 3B, Dhanmondi 27',
        'Dhanmondi',
        'South Zone',
        'active',
        'Core Router',
        '2026-11-05',
        '2026-12-05',
        '1200',
        'karim@example.com',
        '',
        '',
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ClientsTemplate');
    XLSX.writeFile(wb, 'clients_import_template.xlsx');
  },
};

