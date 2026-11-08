import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  Server,
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowLeft,
  Calendar,
  Layers,
  Check,
  X,
  FileCheck,
  ShieldAlert,
  ChevronRight,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { useToastContext } from '@/contexts/ToastContext';
import { useAuthStore } from '@/stores/authStore';
import { networkService } from '@/services/network.service';
import { networkPackagesService } from '@/services/network-packages.service';
import { serviceAreaService } from '@/services/service-area.service';
import { resellerService, Reseller } from '@/services/reseller.service';
import {
  importService,
  MikrotikPreviewUser,
  CsvClientRow,
} from '@/services/import.service';
import { NetworkDevice, NetworkPackage } from '@/types/network.types';
import { ServiceArea } from '@/types/service-area.types';

type ImportTab = 'mikrotik' | 'csv';

export default function ImportPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<ImportTab>('mikrotik');

  // Common Metadata State
  const [routers, setRouters] = useState<NetworkDevice[]>([]);
  const [packages, setPackages] = useState<NetworkPackage[]>([]);
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);

  // -------------------------------------------------------------
  // TAB 1: MIKROTIK PPPOE USERS STATE
  // -------------------------------------------------------------
  const [mtRouterId, setMtRouterId] = useState<string>('');
  const [mtProfiles, setMtProfiles] = useState<string[]>([]);
  const [mtSelectedProfile, setMtSelectedProfile] = useState<string>('-- All Profiles --');
  const [mtImportAs, setMtImportAs] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [mtExpiryDate, setMtExpiryDate] = useState<string>('');
  const [mtInvoiceMonth, setMtInvoiceMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  // MikroTik Checkboxes (matching demo photos)
  const [mtDoNotOverwrite, setMtDoNotOverwrite] = useState(true);
  const [mtSavePasswords, setMtSavePasswords] = useState(true);
  const [mtHideExisting, setMtHideExisting] = useState(true);
  const [mtGenerateFirstInvoice, setMtGenerateFirstInvoice] = useState(true);
  const [mtResellerAutoMinus, setMtResellerAutoMinus] = useState(true);

  // Additional options
  const [mtTargetReseller, setMtTargetReseller] = useState<string>('admin');
  const [mtDefaultArea, setMtDefaultArea] = useState<string>('');
  const [mtDefaultPackage, setMtDefaultPackage] = useState<string>('');

  // MikroTik Preview State
  const [mtLoadingPreview, setMtLoadingPreview] = useState(false);
  const [mtPreviewList, setMtPreviewList] = useState<MikrotikPreviewUser[]>([]);
  const [mtSelectedUsers, setMtSelectedUsers] = useState<Record<string, boolean>>({});
  const [mtSearchQuery, setMtSearchQuery] = useState('');
  const [mtStatusFilter, setMtStatusFilter] = useState<'all' | 'new' | 'existing'>('all');
  const [mtShowPasswords, setMtShowPasswords] = useState(false);
  const [mtIsImporting, setMtIsImporting] = useState(false);

  // -------------------------------------------------------------
  // TAB 2: CSV / XLSX CLIENTS STATE
  // -------------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvImportTarget, setCsvImportTarget] = useState<string>('admin');
  const [csvImportAs, setCsvImportAs] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [csvExpiryDate, setCsvExpiryDate] = useState<string>('');
  const [csvInvoiceMonth, setCsvInvoiceMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );
  const [csvCreateFirstInvoice, setCsvCreateFirstInvoice] = useState(true);

  // Additional smart fallbacks
  const [csvDefaultRouter, setCsvDefaultRouter] = useState<string>('');
  const [csvDefaultPackage, setCsvDefaultPackage] = useState<string>('');
  const [csvDefaultArea, setCsvDefaultArea] = useState<string>('');

  // CSV Preview & Rows
  const [csvLoadingPreview, setCsvLoadingPreview] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvClientRow[]>([]);
  const [csvSearchQuery, setCsvSearchQuery] = useState('');
  const [csvStatusFilter, setCsvStatusFilter] = useState<'all' | 'valid' | 'existing' | 'error'>('all');
  const [csvShowPasswords, setCsvShowPasswords] = useState(false);
  const [csvIsImporting, setCsvIsImporting] = useState(false);

  // -------------------------------------------------------------
  // INITIAL METADATA LOADING
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    setIsLoadingMeta(true);

    Promise.allSettled([
      networkService.getNetworkDevices('mikrotik'),
      networkPackagesService.list({ limit: 100 }),
      serviceAreaService.listAreas(),
      resellerService.list(),
    ]).then(([devRes, pkgRes, areaRes, resRes]) => {
      if (!isMounted) return;

      if (devRes.status === 'fulfilled' && devRes.value.devices) {
        setRouters(devRes.value.devices);
        if (devRes.value.devices.length > 0) {
          setMtRouterId(String(devRes.value.devices[0].deviceId));
          setCsvDefaultRouter(String(devRes.value.devices[0].deviceId));
        }
      }

      if (pkgRes.status === 'fulfilled' && pkgRes.value.packages) {
        setPackages(pkgRes.value.packages);
        if (pkgRes.value.packages.length > 0) {
          setMtDefaultPackage(String(pkgRes.value.packages[0].packageId));
          setCsvDefaultPackage(String(pkgRes.value.packages[0].packageId));
        }
      }

      if (areaRes.status === 'fulfilled' && areaRes.value) {
        const areaData = areaRes.value.data || (Array.isArray(areaRes.value) ? areaRes.value : []);
        setAreas(Array.isArray(areaData) ? areaData : []);
      }

      if (resRes.status === 'fulfilled' && resRes.value.data) {
        setResellers(resRes.value.data);
      }

      setIsLoadingMeta(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch MikroTik profiles when selected router changes
  useEffect(() => {
    if (!mtRouterId) {
      setMtProfiles([]);
      return;
    }

    networkService
      .getDeviceProfiles(mtRouterId, 'pppoe')
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const names = res.data.map((p) => p.name).filter(Boolean);
          setMtProfiles(names);
        } else {
          setMtProfiles([]);
        }
      })
      .catch(() => {
        setMtProfiles([]);
      });
  }, [mtRouterId]);

  // -------------------------------------------------------------
  // MIKROTIK PREVIEW HANDLER
  // -------------------------------------------------------------
  const handleLoadMtPreview = async () => {
    if (!mtRouterId) {
      toast.warning('Please select a router first');
      return;
    }

    setMtLoadingPreview(true);
    try {
      const res = await importService.getMikrotikPreview({
        deviceId: mtRouterId,
        profile: mtSelectedProfile,
        hideExisting: mtHideExisting,
        importAs: mtImportAs,
      });

      if (res.success) {
        setMtPreviewList(res.data || []);
        // By default select all new (non-existing) users
        const selectedMap: Record<string, boolean> = {};
        (res.data || []).forEach((u) => {
          if (!u.exists_in_db) {
            selectedMap[u.username] = true;
          }
        });
        setMtSelectedUsers(selectedMap);

        if ((res.data || []).length === 0) {
          toast.info('No PPPoE secrets found on router matching criteria');
        } else {
          toast.success(`Loaded ${res.total} secrets from router (${res.new_count} ready to import)`);
        }
      } else {
        toast.error((res as any)?.message || 'Failed to load secrets preview');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Could not connect to router';
      toast.error(msg);
    } finally {
      setMtLoadingPreview(false);
    }
  };

  // Filtered MikroTik Preview List
  const filteredMtList = useMemo(() => {
    return mtPreviewList.filter((item) => {
      // Status filter
      if (mtStatusFilter === 'new' && item.exists_in_db) return false;
      if (mtStatusFilter === 'existing' && !item.exists_in_db) return false;

      // Search query
      if (mtSearchQuery.trim()) {
        const q = mtSearchQuery.toLowerCase();
        const u = item.username.toLowerCase();
        const n = (item.suggested_name || '').toLowerCase();
        const p = (item.suggested_phone || '').toLowerCase();
        const prof = (item.profile || '').toLowerCase();
        return u.includes(q) || n.includes(q) || p.includes(q) || prof.includes(q);
      }
      return true;
    });
  }, [mtPreviewList, mtStatusFilter, mtSearchQuery]);

  const mtSelectedCount = useMemo(() => {
    return Object.values(mtSelectedUsers).filter(Boolean).length;
  }, [mtSelectedUsers]);

  const handleToggleSelectAllMt = () => {
    const allSelected = filteredMtList.every((u) => mtSelectedUsers[u.username]);
    const updated = { ...mtSelectedUsers };
    filteredMtList.forEach((u) => {
      if (allSelected) {
        delete updated[u.username];
      } else {
        updated[u.username] = true;
      }
    });
    setMtSelectedUsers(updated);
  };

  // Submit MikroTik Import
  const handleConfirmMtImport = async () => {
    const toImport = mtPreviewList.filter((u) => mtSelectedUsers[u.username]);
    if (toImport.length === 0) {
      toast.warning('No users selected for import');
      return;
    }

    const result = await Swal.fire({
      title: 'Confirm MikroTik Import',
      text: `Are you sure you want to import ${toImport.length} PPPoE client(s) into NetFix?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Yes, Import ${toImport.length} Clients`,
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0ea5e9',
    });

    if (!result.isConfirmed) return;

    setMtIsImporting(true);
    try {
      const res = await importService.confirmMikrotikImport({
        deviceId: mtRouterId,
        importAs: mtImportAs,
        expiryDate: mtImportAs === 'prepaid' ? mtExpiryDate : undefined,
        invoiceMonth: mtImportAs === 'postpaid' ? mtInvoiceMonth : undefined,
        generateInvoice: mtImportAs === 'postpaid' ? mtGenerateFirstInvoice : false,
        deductResellerBalance: mtResellerAutoMinus,
        savePasswords: mtSavePasswords,
        doNotOverwriteExisting: mtDoNotOverwrite,
        resellerId: mtTargetReseller === 'admin' ? null : mtTargetReseller,
        areaId: mtDefaultArea || null,
        defaultPackageId: mtDefaultPackage || null,
        users: toImport.map((u) => ({
          username: u.username,
          password: u.password,
          profile: u.profile,
          name: u.suggested_name,
          phone: u.suggested_phone,
          packageId: u.matched_package_id || mtDefaultPackage || null,
          caller_id: u.caller_id,
          comment: u.comment,
          disabled: u.disabled,
        })),
      });

      if (res.success) {
        await Swal.fire({
          title: 'Import Completed!',
          html: `<div class="text-left text-sm space-y-1">
            <p class="text-emerald-600 font-semibold">✓ ${res.importedCount} client(s) successfully created.</p>
            ${res.skippedCount > 0 ? `<p class="text-amber-600">⚠ ${res.skippedCount} existing client(s) skipped.</p>` : ''}
          </div>`,
          icon: 'success',
          confirmButtonColor: '#0ea5e9',
        });
        // Refresh preview list
        handleLoadMtPreview();
      } else {
        toast.error(res.message || 'Import failed');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to complete import';
      toast.error(msg);
    } finally {
      setMtIsImporting(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: CSV / XLSX FILE PROCESSING
  // -------------------------------------------------------------
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx') {
      toast.error('Only .xlsx or UTF-8 .csv files are supported. Classic .xls is not supported.');
      return;
    }

    setCsvFile(file);
    setCsvFileName(file.name);
  };

  const handlePreviewCsv = () => {
    if (!csvFile) {
      toast.warning('Please select a CSV or XLSX file first');
      return;
    }

    setCsvLoadingPreview(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

        if (rawJson.length === 0) {
          toast.warning('The uploaded file is empty');
          setCsvRows([]);
          setCsvLoadingPreview(false);
          return;
        }

        // Map column synonyms
        const mappedRows: CsvClientRow[] = rawJson.map((row) => {
          // Find value using synonym keys
          const getVal = (...keys: string[]) => {
            for (const k of keys) {
              for (const rowKey of Object.keys(row)) {
                if (rowKey.toLowerCase().trim() === k.toLowerCase()) {
                  return String(row[rowKey] ?? '').trim();
                }
              }
            }
            return '';
          };

          const name = getVal('name', 'full_name', 'client_name', 'customer_name', 'নাম');
          const pppoe_id = getVal('pppoe_id', 'username', 'user_id', 'pppoe_user', 'id', 'user', 'ইউজারনেম');
          const pkg = getVal('package', 'plan', 'package_name', 'profile', 'স্পিড', 'প্যাকেজ');
          const pppoe_pass = getVal('pppoe_pass', 'password', 'pass', 'pwd', 'পাসওয়ার্ড');
          const mobile = getVal('mobile', 'phone', 'mobile_no', 'phone_number', 'contact', 'ফোন', 'মোবাইল');
          const alternate_mobile = getVal('alternate_mobile', 'alt_phone', 'alt_mobile');
          const address = getVal('address', 'installation_address', 'location', 'ঠিকানা');
          const area = getVal('area', 'service_area', 'এলাকা');
          const zone = getVal('zone', 'zone_name');
          const status = getVal('status', 'state');
          const router = getVal('router', 'server', 'mikrotik', 'রাউটার');
          const join_date = getVal('join_date', 'connection_date', 'date');
          const expiry_date = getVal('expiry_date', 'expire_date', 'expiry', 'মেয়াদ');
          const monthly_bill = getVal('monthly_bill', 'bill', 'price', 'amount', 'টাকা', 'বিল');
          const email = getVal('email', 'mail');
          const remarks = getVal('remarks', 'note', 'notes');
          const onu_mac = getVal('onu_mac', 'mac', 'mac_address');
          const ip_address = getVal('ip_address', 'ip');
          const client_code = getVal('client_code', 'code', 'customer_code');

          // Validation
          let isValid = true;
          let error = '';

          if (!name) {
            isValid = false;
            error = 'Missing Name';
          } else if (!pppoe_id) {
            isValid = false;
            error = 'Missing PPPoE ID';
          } else if (!pkg && !csvDefaultPackage) {
            isValid = false;
            error = 'Missing Package';
          }

          return {
            name,
            pppoe_id,
            package: pkg || 'Default Plan',
            pppoe_pass: pppoe_pass || 'pass123',
            mobile: mobile || '',
            alternate_mobile,
            address: address || 'Dhaka, Bangladesh',
            area,
            zone,
            status: status || 'active',
            router: router || '',
            join_date,
            expiry_date,
            monthly_bill,
            email,
            remarks,
            onu_mac,
            ip_address,
            client_code,
            _isValid: isValid,
            _error: error,
            _selected: isValid,
          };
        });

        // Check duplicates within the file itself
        const seenPppoe: Record<string, number> = {};
        mappedRows.forEach((r, idx) => {
          if (r.pppoe_id) {
            const key = r.pppoe_id.toLowerCase();
            if (seenPppoe[key] !== undefined) {
              r._isValid = false;
              r._error = `Duplicate username in file (row #${seenPppoe[key] + 1})`;
              r._selected = false;
            } else {
              seenPppoe[key] = idx;
            }
          }
        });

        setCsvRows(mappedRows);
        toast.success(`Parsed ${mappedRows.length} rows from ${csvFile.name}`);
      } catch (err: any) {
        toast.error('Failed to parse file: ' + (err.message || 'Invalid format'));
      } finally {
        setCsvLoadingPreview(false);
      }
    };

    reader.onerror = () => {
      toast.error('Could not read file');
      setCsvLoadingPreview(false);
    };

    reader.readAsBinaryString(csvFile);
  };

  // Filtered CSV Rows
  const filteredCsvRows = useMemo(() => {
    return csvRows.filter((r) => {
      if (csvStatusFilter === 'valid' && !r._isValid) return false;
      if (csvStatusFilter === 'error' && r._isValid) return false;

      if (csvSearchQuery.trim()) {
        const q = csvSearchQuery.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.pppoe_id.toLowerCase().includes(q) ||
          (r.mobile || '').includes(q) ||
          r.package.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [csvRows, csvStatusFilter, csvSearchQuery]);

  const csvSelectedCount = useMemo(() => {
    return csvRows.filter((r) => r._selected && r._isValid).length;
  }, [csvRows]);

  const handleToggleCsvRow = (idx: number) => {
    setCsvRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], _selected: !next[idx]._selected };
      return next;
    });
  };

  const handleToggleAllCsv = () => {
    const allSelected = filteredCsvRows.every((r) => r._selected);
    const updatedUsernames = new Set(filteredCsvRows.map((r) => r.pppoe_id));

    setCsvRows((prev) =>
      prev.map((r) => {
        if (updatedUsernames.has(r.pppoe_id) && r._isValid) {
          return { ...r, _selected: !allSelected };
        }
        return r;
      })
    );
  };

  // Submit CSV Import
  const handleConfirmCsvImport = async () => {
    const toImport = csvRows.filter((r) => r._selected && r._isValid);
    if (toImport.length === 0) {
      toast.warning('No valid clients selected for import');
      return;
    }

    const result = await Swal.fire({
      title: 'Confirm Client Import',
      text: `Ready to import ${toImport.length} subscriber(s) into NetFix?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Yes, Import ${toImport.length} Clients`,
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0ea5e9',
    });

    if (!result.isConfirmed) return;

    setCsvIsImporting(true);
    try {
      const res = await importService.importBatchClients({
        clients: toImport,
        importTarget: csvImportTarget,
        importAs: csvImportAs,
        expiryDate: csvImportAs === 'prepaid' ? csvExpiryDate : undefined,
        invoiceMonth: csvImportAs === 'postpaid' ? csvInvoiceMonth : undefined,
        createInvoice: csvImportAs === 'postpaid' ? csvCreateFirstInvoice : false,
        defaultDeviceId: csvDefaultRouter || undefined,
        defaultPackageId: csvDefaultPackage || undefined,
        defaultAreaId: csvDefaultArea || undefined,
      });

      if (res.success) {
        await Swal.fire({
          title: 'Batch Import Complete!',
          html: `<div class="text-left text-sm space-y-1">
            <p class="text-emerald-600 font-semibold">✓ ${res.importedCount} client(s) successfully created.</p>
            ${res.skippedCount > 0 ? `<p class="text-amber-600">⚠ ${res.skippedCount} client(s) skipped (duplicates/errors).</p>` : ''}
          </div>`,
          icon: 'success',
          confirmButtonColor: '#0ea5e9',
        });
        // Clear preview
        setCsvRows([]);
        setCsvFile(null);
        setCsvFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        toast.error(res.message || 'Batch import failed');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to import clients';
      toast.error(msg);
    } finally {
      setCsvIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Tab Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm transition-all">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-indigo-500/5 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900/50 flex items-center justify-center shrink-0 shadow-sm">
              {activeTab === 'mikrotik' ? (
                <Download className="w-6 h-6" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {activeTab === 'mikrotik' ? 'Import MikroTik PPPoE Users' : 'Import clients'}
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300">
                  Settings
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {activeTab === 'mikrotik'
                  ? 'Directly sync and onboard PPPoE secrets from connected MikroTik routers'
                  : 'Bulk upload customers and subscriptions via Excel (.xlsx) or CSV file'}
              </p>
            </div>
          </div>

          {/* Top Actions: Templates (for CSV) & Tab Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === 'csv' && (
              <>
                <button
                  type="button"
                  onClick={() => importService.downloadCsvTemplate()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  CSV template
                </button>
                <button
                  type="button"
                  onClick={() => importService.downloadXlsxTemplate()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  XLSX template
                </button>
              </>
            )}

            {/* Tab Pill Buttons */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('mikrotik')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'mikrotik'
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                MikroTik PPPoE
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('csv')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'csv'
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                CSV / XLSX File
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: MIKROTIK PPPOE USERS (Matching Photo 1 & 2)       */}
      {/* ========================================================= */}
      {activeTab === 'mikrotik' && (
        <div className="space-y-6">
          {/* MikroTik Configuration Form Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Download className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Import MikroTik PPPoE Users
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Router Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Router <span className="text-rose-500">*</span>
                </label>
                <select
                  value={mtRouterId}
                  onChange={(e) => setMtRouterId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  {routers.length === 0 ? (
                    <option value="">No routers available</option>
                  ) : (
                    routers.map((r) => (
                      <option key={r.deviceId} value={r.deviceId}>
                        {r.deviceName} ({r.managementIp})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Profile / Package (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Profile / Package (Optional)
                </label>
                <select
                  value={mtSelectedProfile}
                  onChange={(e) => setMtSelectedProfile(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  <option value="-- All Profiles --">-- All Profiles --</option>
                  {mtProfiles.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Import as: Prepaid / Postpaid */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Import as
                </label>
                <select
                  value={mtImportAs}
                  onChange={(e) => setMtImportAs(e.target.value as 'prepaid' | 'postpaid')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  <option value="prepaid">Prepaid</option>
                  <option value="postpaid">Postpaid</option>
                </select>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Reseller imports are always prepaid.
                </p>
              </div>
            </div>

            {/* Dynamic Expiry Date / Invoice Month Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
              {mtImportAs === 'prepaid' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Expiry Date (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={mtExpiryDate}
                      onChange={(e) => setMtExpiryDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Invoice Month
                  </label>
                  <input
                    type="month"
                    value={mtInvoiceMonth}
                    onChange={(e) => setMtInvoiceMonth(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
              )}

              {/* Assign to Reseller (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Import target (reseller)
                </label>
                <select
                  value={mtTargetReseller}
                  onChange={(e) => setMtTargetReseller(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  <option value="admin">Admin (company clients)</option>
                  {resellers.map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {r.name} ({r.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Area (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Default Area (Optional)
                </label>
                <select
                  value={mtDefaultArea}
                  onChange={(e) => setMtDefaultArea(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  <option value="">-- No Default Area --</option>
                  {areas.map((a) => (
                    <option key={a.serviceAreaId} value={a.serviceAreaId}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Checkboxes matching Photo 1 & Photo 2 */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-700 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={mtDoNotOverwrite}
                  onChange={(e) => setMtDoNotOverwrite(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <span>Do not overwrite existing client name/mobile</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-700 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={mtSavePasswords}
                  onChange={(e) => setMtSavePasswords(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <span>Save PPPoE passwords</span>
              </label>

              {mtImportAs === 'postpaid' && (
                <>
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-700 dark:text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={mtGenerateFirstInvoice}
                      onChange={(e) => setMtGenerateFirstInvoice(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                    <span>Generate first invoice</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-700 dark:text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={mtResellerAutoMinus}
                      onChange={(e) => setMtResellerAutoMinus(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                    <span>For reseller import, auto minus reseller balance with first invoice</span>
                  </label>
                </>
              )}

              <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-700 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={mtHideExisting}
                  onChange={(e) => setMtHideExisting(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <span>Hide clients that already exist in software</span>
              </label>
            </div>

            {/* Load Preview Button */}
            <div className="mt-6">
              <button
                type="button"
                onClick={handleLoadMtPreview}
                disabled={mtLoadingPreview || !mtRouterId}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mtLoadingPreview ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Querying MikroTik Router...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Load Preview
                  </>
                )}
              </button>
            </div>
          </div>

          {/* MikroTik Preview Table Section */}
          {mtPreviewList.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              {/* Stats overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Secrets Found</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {mtPreviewList.length}
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Ready to Import</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {mtPreviewList.filter((u) => !u.exists_in_db).length}
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-100 dark:border-amber-900/50">
                  <p className="text-xs text-amber-600 dark:text-amber-400">Already in Software</p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                    {mtPreviewList.filter((u) => u.exists_in_db).length}
                  </p>
                </div>
                <div className="bg-cyan-50 dark:bg-cyan-950/30 p-3.5 rounded-xl border border-cyan-100 dark:border-cyan-900/50">
                  <p className="text-xs text-cyan-600 dark:text-cyan-400">Selected to Import</p>
                  <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300 mt-0.5">
                    {mtSelectedCount}
                  </p>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by username, name, phone, profile..."
                    value={mtSearchQuery}
                    onChange={(e) => setMtSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMtShowPasswords(!mtShowPasswords)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {mtShowPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {mtShowPasswords ? 'Hide Passwords' : 'Show Passwords'}
                  </button>

                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setMtStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        mtStatusFilter === 'all'
                          ? 'bg-white dark:bg-slate-900 text-cyan-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      All ({mtPreviewList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMtStatusFilter('new')}
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        mtStatusFilter === 'new'
                          ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      New ({mtPreviewList.filter((u) => !u.exists_in_db).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMtStatusFilter('existing')}
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        mtStatusFilter === 'existing'
                          ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Existing ({mtPreviewList.filter((u) => u.exists_in_db).length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleSelectAllMt}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    {filteredMtList.every((u) => mtSelectedUsers[u.username]) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredMtList.length > 0 && filteredMtList.every((u) => mtSelectedUsers[u.username])}
                          onChange={handleToggleSelectAllMt}
                          className="rounded text-cyan-600 focus:ring-cyan-500"
                        />
                      </th>
                      <th className="p-3">Status</th>
                      <th className="p-3">PPPoE Username</th>
                      <th className="p-3">Password</th>
                      <th className="p-3">Customer Name</th>
                      <th className="p-3">Mobile</th>
                      <th className="p-3">MikroTik Profile</th>
                      <th className="p-3">Matched Package</th>
                      <th className="p-3">Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredMtList.map((u) => {
                      const isSelected = Boolean(mtSelectedUsers[u.username]);
                      return (
                        <tr
                          key={u.username}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-cyan-50/40 dark:bg-cyan-950/20' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                setMtSelectedUsers((prev) => ({
                                  ...prev,
                                  [u.username]: !prev[u.username],
                                }))
                              }
                              className="rounded text-cyan-600 focus:ring-cyan-500"
                            />
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {u.exists_in_db ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                <AlertTriangle className="w-3 h-3" />
                                In Software ({u.existing_info?.customer_code})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                <Check className="w-3 h-3" />
                                Ready to Import
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                            {u.username}
                          </td>
                          <td className="p-3 font-mono text-slate-500 dark:text-slate-400">
                            {mtShowPasswords ? u.password || '—' : '••••••••'}
                          </td>
                          <td className="p-3">{u.suggested_name || '—'}</td>
                          <td className="p-3">{u.suggested_phone || '—'}</td>
                          <td className="p-3 font-medium text-slate-700 dark:text-slate-200">
                            {u.profile}
                          </td>
                          <td className="p-3">
                            {u.matched_package_name ? (
                              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                                {u.matched_package_name} ({u.matched_package_price} ৳)
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Fallback Plan</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-400 truncate max-w-xs" title={u.comment}>
                            {u.comment || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Floating / Sticky Import Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {mtSelectedCount}
                  </span>{' '}
                  of {mtPreviewList.length} user(s) selected for import.
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMtPreviewList([])}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Clear Preview
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMtImport}
                    disabled={mtIsImporting || mtSelectedCount === 0}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white shadow-sm transition-all disabled:opacity-50"
                  >
                    {mtIsImporting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Importing Clients...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirm & Import ({mtSelectedCount})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: CSV / XLSX CLIENTS IMPORT (Matching Photo 3 & 4)   */}
      {/* ========================================================= */}
      {activeTab === 'csv' && (
        <div className="space-y-6">
          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Import Form Card (lg:col-span-8) */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <Upload className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Import clients
                </h2>
              </div>

              {/* CSV / XLSX File Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  CSV / XLSX file
                </label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileSelect}
                    className="block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 dark:file:bg-cyan-950/50 file:text-cyan-700 dark:file:text-cyan-300 hover:file:bg-cyan-100 dark:hover:file:bg-cyan-900/60 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 cursor-pointer"
                  />
                  {csvFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setCsvFile(null);
                        setCsvFileName('');
                        setCsvRows([]);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Clear file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
                  Required columns: <span className="font-mono text-slate-600 dark:text-slate-300">name, pppoe_id, package</span>. Use .xlsx or UTF-8 CSV (Bangla names OK). Classic Excel 97–2003 <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-rose-500">.xls</code> is not supported — Save As .xlsx. Synonyms: username, plan, phone, নাম, ...
                </p>
              </div>

              {/* Import target (reseller) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Import target (reseller)
                </label>
                <select
                  value={csvImportTarget}
                  onChange={(e) => setCsvImportTarget(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  <option value="admin">Admin (company clients)</option>
                  {resellers.map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {r.name} ({r.role})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Optional. Assigns imported clients to the selected reseller and uses reseller client-code prefixes when set. Reseller imports are always prepaid.
                </p>
              </div>

              {/* Import as: Prepaid / Postpaid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Import as
                  </label>
                  <select
                    value={csvImportAs}
                    onChange={(e) => setCsvImportAs(e.target.value as 'prepaid' | 'postpaid')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  >
                    <option value="prepaid">Prepaid</option>
                    <option value="postpaid">Postpaid</option>
                  </select>
                </div>

                {csvImportAs === 'prepaid' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Expiry date (optional)
                    </label>
                    <input
                      type="date"
                      value={csvExpiryDate}
                      onChange={(e) => setCsvExpiryDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      Applied to all rows when set. Per-row expiry_date in the file is used when this is empty.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Invoice month
                    </label>
                    <input
                      type="month"
                      value={csvInvoiceMonth}
                      onChange={(e) => setCsvInvoiceMonth(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                )}
              </div>

              {/* Postpaid First Invoice Checkbox (Photo 4) */}
              {csvImportAs === 'postpaid' && (
                <div className="pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-700 dark:text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={csvCreateFirstInvoice}
                      onChange={(e) => setCsvCreateFirstInvoice(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                    <span>Create first invoice</span>
                  </label>
                </div>
              )}

              {/* Fallback Defaults (Smart ISP feature) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Default Router (Fallback)
                  </label>
                  <select
                    value={csvDefaultRouter}
                    onChange={(e) => setCsvDefaultRouter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {routers.map((r) => (
                      <option key={r.deviceId} value={r.deviceId}>
                        {r.deviceName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Default Package (Fallback)
                  </label>
                  <select
                    value={csvDefaultPackage}
                    onChange={(e) => setCsvDefaultPackage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {packages.map((p) => (
                      <option key={p.packageId} value={p.packageId}>
                        {p.packageName} ({p.price} ৳)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Default Area (Fallback)
                  </label>
                  <select
                    value={csvDefaultArea}
                    onChange={(e) => setCsvDefaultArea(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Optional --</option>
                    {areas.map((a) => (
                      <option key={a.serviceAreaId} value={a.serviceAreaId}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview import Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePreviewCsv}
                  disabled={csvLoadingPreview || !csvFile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {csvLoadingPreview ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Parsing file...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      Preview import
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Format Card (lg:col-span-4) (Matching Photo 3 & 4) */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Format</h3>
              <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Required:</span>{' '}
                  <span className="font-mono text-cyan-600 dark:text-cyan-400">name, pppoe_id, package</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Optional:</span>{' '}
                  <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px] leading-5">
                    client_code, pppoe_pass, mobile, alternate_mobile, address, area, zone, status, router, join_date, expiry_date, monthly_bill, email, remarks, onu_mac, ip_address
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Dates:</span>{' '}
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    YYYY-MM-DD, DD/MM/YYYY, or DD/MM/YY.
                  </span>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-xl text-amber-700 dark:text-amber-300 text-[11px] leading-5">
                  Duplicate client_code / pppoe_id (in file or DB) are rejected at preview.
                </div>
              </div>
            </div>
          </div>

          {/* CSV Preview Table Section */}
          {csvRows.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              {/* Metric stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Rows in File</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {csvRows.length}
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Valid to Import</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {csvRows.filter((r) => r._isValid).length}
                  </p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/30 p-3.5 rounded-xl border border-rose-100 dark:border-rose-900/50">
                  <p className="text-xs text-rose-600 dark:text-rose-400">Invalid / Errors</p>
                  <p className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                    {csvRows.filter((r) => !r._isValid).length}
                  </p>
                </div>
                <div className="bg-cyan-50 dark:bg-cyan-950/30 p-3.5 rounded-xl border border-cyan-100 dark:border-cyan-900/50">
                  <p className="text-xs text-cyan-600 dark:text-cyan-400">Selected for Import</p>
                  <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300 mt-0.5">
                    {csvSelectedCount}
                  </p>
                </div>
              </div>

              {/* Search & Actions Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search preview rows..."
                    value={csvSearchQuery}
                    onChange={(e) => setCsvSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCsvShowPasswords(!csvShowPasswords)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {csvShowPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {csvShowPasswords ? 'Hide Passwords' : 'Show Passwords'}
                  </button>

                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setCsvStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        csvStatusFilter === 'all'
                          ? 'bg-white dark:bg-slate-900 text-cyan-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      All ({csvRows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCsvStatusFilter('valid')}
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        csvStatusFilter === 'valid'
                          ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Valid ({csvRows.filter((r) => r._isValid).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCsvStatusFilter('error')}
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        csvStatusFilter === 'error'
                          ? 'bg-white dark:bg-slate-900 text-rose-600 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Errors ({csvRows.filter((r) => !r._isValid).length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleAllCsv}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    {filteredCsvRows.every((r) => r._selected) ? 'Deselect All' : 'Select All Valid'}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={filteredCsvRows.length > 0 && filteredCsvRows.every((r) => r._selected)}
                          onChange={handleToggleAllCsv}
                          className="rounded text-cyan-600 focus:ring-cyan-500"
                        />
                      </th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Customer Name</th>
                      <th className="p-3">PPPoE ID</th>
                      <th className="p-3">Password</th>
                      <th className="p-3">Package / Plan</th>
                      <th className="p-3">Mobile</th>
                      <th className="p-3">Area / Zone</th>
                      <th className="p-3">Address</th>
                      <th className="p-3">Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredCsvRows.map((r, i) => {
                      const isSelected = Boolean(r._selected);
                      return (
                        <tr
                          key={i}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                            !r._isValid
                              ? 'bg-rose-50/30 dark:bg-rose-950/20'
                              : isSelected
                              ? 'bg-cyan-50/40 dark:bg-cyan-950/20'
                              : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!r._isValid}
                              onChange={() => handleToggleCsvRow(i)}
                              className="rounded text-cyan-600 focus:ring-cyan-500 disabled:opacity-30"
                            />
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {r._isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                <Check className="w-3 h-3" />
                                Valid
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                                title={r._error}
                              >
                                <X className="w-3 h-3" />
                                {r._error || 'Error'}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                            {r.name || '—'}
                          </td>
                          <td className="p-3 font-mono font-medium text-cyan-600 dark:text-cyan-400">
                            {r.pppoe_id || '—'}
                          </td>
                          <td className="p-3 font-mono text-slate-500 dark:text-slate-400">
                            {csvShowPasswords ? r.pppoe_pass || 'pass123' : '••••••••'}
                          </td>
                          <td className="p-3 font-medium text-slate-700 dark:text-slate-200">
                            {r.package}
                          </td>
                          <td className="p-3">{r.mobile || '—'}</td>
                          <td className="p-3">
                            {r.area ? (
                              <span>
                                {r.area} {r.zone ? `(${r.zone})` : ''}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-3 truncate max-w-xs text-slate-500">{r.address || '—'}</td>
                          <td className="p-3 whitespace-nowrap">{r.expiry_date || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Sticky Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {csvSelectedCount}
                  </span>{' '}
                  of {csvRows.length} client(s) ready to import.
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCsvRows([]);
                      setCsvFile(null);
                      setCsvFileName('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Clear File
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCsvImport}
                    disabled={csvIsImporting || csvSelectedCount === 0}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white shadow-sm transition-all disabled:opacity-50"
                  >
                    {csvIsImporting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Importing Subscribers...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirm & Import ({csvSelectedCount})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

