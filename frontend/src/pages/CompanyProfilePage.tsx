import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Mail,
  Phone,
  PhoneCall,
  MapPin,
  Image as ImageIcon,
  Upload,
  Save,
  RotateCcw,
  Lock,
  X,
  AlertCircle,
  User,
  Key,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common';
import { useToastContext } from '@/contexts/ToastContext';
import { companyService } from '@/services/company.service';
import { CompanyProfile } from '@/types/company.types';
import { useAuthStore } from '@/stores/authStore';
import { authService, MeResponse } from '@/services/auth.service';

const getRoleLabel = (roleCode: string | undefined): string => {
  if (!roleCode) return 'User';
  const r = roleCode.toLowerCase();
  const labels: Record<string, string> = {
    saas_admin: 'SaaS Admin',
    admin: 'Admin',
    isp_admin: 'ISP Admin',
    manager: 'Manager',
    reseller: 'Reseller',
    sub_reseller: 'Sub Reseller',
    agent: 'Agent',
  };
  return labels[r] ?? roleCode.replace(/_/g, ' ');
};

const getUserTypeLabel = (userType: string | undefined): string => {
  if (!userType) return '—';
  const t = userType.toLowerCase();
  if (t === 'saas') return 'SaaS Administrator';
  if (t === 'isp') return 'ISP / Tenant';
  if (t === 'customer') return 'Customer Subscriber';
  return userType;
};

export default function CompanyProfilePage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const { user, setUser, balance, refreshMe, updateBranding, impersonated, impersonatedBy } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  // Company Form Fields
  const [companyName, setCompanyName] = useState('Star Network');
  const [companyEmail, setCompanyEmail] = useState('shamimahommad@gmail.com');
  const [ownerPhone, setOwnerPhone] = useState('01774581701');
  const [supportPhone, setSupportPhone] = useState('01771119070');
  const [address, setAddress] = useState('Kutubpur, Sariyakandi, Bogura');
  const [canEditName, setCanEditName] = useState(false);

  // Administrator Personal Form Fields
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');

  // Logo Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setFileError(null);
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      // 1. Fetch Company Profile
      const compRes = await companyService.getProfile();
      if (compRes.success && compRes.data) {
        const d = compRes.data;
        setCompanyProfile(d);
        setCompanyName(d.company_name || 'Star Network');
        setCompanyEmail(d.company_email || 'shamimahommad@gmail.com');
        setOwnerPhone(d.owner_phone || '01774581701');
        setSupportPhone(d.support_phone || '01771119070');
        setAddress(d.address || 'Kutubpur, Sariyakandi, Bogura');
        setCanEditName(Boolean(d.can_edit_name));
      }

      // 2. Fetch Administrator Profile
      await refreshMe();
      const meData = await authService.getMe();
      if (meData) {
        setMe(meData);
        setAdminFirstName(meData.first_name || user?.first_name || '');
        setAdminLastName(meData.last_name || user?.last_name || '');
        setAdminEmail(meData.email || user?.email || '');
        setAdminPhone((meData as any).phone || (user as any)?.phone || '');
      }
    } catch (err: any) {
      console.error('Failed to load profile data:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to load profile data.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    // Strict 300 KB validation (300 * 1024 = 307200 bytes)
    const maxBytes = 300 * 1024;
    if (file.size > maxBytes) {
      const currentKb = (file.size / 1024).toFixed(1);
      setFileError(`Logo size (${currentKb} KB) exceeds the 300 KB limit. Please choose an image under 300 KB.`);
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setFileError('Invalid format. Allowed formats: PNG, JPG, JPEG, WEBP, SVG.');
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (fileError) return;

    setSaving(true);
    try {
      // 1. Update Company Profile
      const compRes = await companyService.updateProfile({
        company_name: canEditName ? companyName : undefined,
        company_email: companyEmail,
        owner_phone: ownerPhone,
        support_phone: supportPhone,
        address: address,
        logo: selectedFile,
      });

      if (compRes.success && compRes.data) {
        setCompanyProfile(compRes.data);
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Immediately update global auth store so sidebar header logo updates live
        updateBranding({
          tenant_name: compRes.data.company_name,
          tenant_logo: compRes.data.logo_url,
        });
      }

      // 2. Update Admin Personal Details (if populated)
      if (adminFirstName.trim()) {
        try {
          const authRes = await authService.updateProfile({
            first_name: adminFirstName.trim(),
            last_name: adminLastName.trim(),
            email: adminEmail.trim(),
            phone: adminPhone.trim(),
          });

          if (authRes.user && user) {
            setUser({
              ...user,
              ...authRes.user,
            });
          }
        } catch (authErr) {
          console.warn('Personal profile update note:', authErr);
        }
      }

      await refreshMe();
      toast.success('Company profile updated successfully');
    } catch (err: any) {
      console.error('Failed to update company profile:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to update company profile';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const currentDisplayLogo = filePreview || companyProfile?.logo_url;
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || companyName || 'Admin';
  const roleLabel = getRoleLabel(user?.role_code);
  const userTypeLabel = getUserTypeLabel(user?.user_type);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Company Profile"
        subtitle="Manage company information, contact details, support numbers, and administrator account"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => navigate('/dashboard/change-password')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-sm font-semibold shadow-xs transition-colors"
            >
              <Key className="w-4 h-4 text-slate-500" />
              <span>Change Password</span>
            </button>
            <button
              type="button"
              onClick={loadAllData}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={saving || Boolean(fileError)}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm hover:shadow transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        }
      />

      {impersonated && impersonatedBy && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm font-medium">
          You are currently viewing as this user. Exit impersonation via the user menu in the top bar.
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-16 flex flex-col items-center justify-center shadow-sm">
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
          <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">Loading company details...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Top Organization Overview Banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                {currentDisplayLogo ? (
                  <img
                    src={currentDisplayLogo}
                    alt={companyName}
                    className="max-h-12 max-w-full object-contain p-1"
                  />
                ) : (
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {(companyName || 'S')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                    {companyName}
                  </h2>
                  <StatusBadge role={user?.role_code || 'isp_admin'} />
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  <span>Code: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{companyProfile?.tenant_code || '1002'}</strong></span>
                  <span>•</span>
                  <span>Admin ID: <strong className="text-slate-700 dark:text-slate-300 font-semibold">#{user?.user_id}</strong></span>
                  <span>•</span>
                  <span>Type: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{userTypeLabel}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Balance or Action */}
            {(user?.user_type === 'isp' || user?.user_type === 'tenant') && balance != null && (
              <div className="flex items-center gap-3 bg-blue-50/70 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-4 py-2.5 rounded-xl shrink-0 self-start sm:self-auto">
                <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <div className="text-[11px] font-medium text-blue-600 dark:text-blue-300">Account Balance</div>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                    ৳{Number(balance).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Columns: Company Setup + Administrator Profile */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card 1: Company Setup */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Company Setup
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Primary ISP organization identity and administrative contacts
                  </p>
                </div>

                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Company Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={companyName}
                      disabled={!canEditName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Star Network"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all ${
                        !canEditName
                          ? 'bg-slate-100/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-not-allowed font-medium'
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                    />
                    {!canEditName && (
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    Company name can only be changed by a super-admin.
                  </p>
                </div>

                {/* Company Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Company Email
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="shamimahommad@gmail.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Owner Phone No & Support No */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Owner Phone No */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Owner Phone No
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </span>
                      <input
                        type="tel"
                        value={ownerPhone}
                        onChange={(e) => setOwnerPhone(e.target.value)}
                        placeholder="01774581701"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Support No */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Support No
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <PhoneCall className="w-4 h-4" />
                      </span>
                      <input
                        type="tel"
                        value={supportPhone}
                        onChange={(e) => setSupportPhone(e.target.value)}
                        placeholder="01771119070"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Address
                  </label>
                  <div className="relative">
                    <span className="absolute top-3 left-3.5 pointer-events-none text-slate-400">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <textarea
                      rows={3}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Kutubpur, Sariyakandi, Bogura"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Administrator Profile Details */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Administrator Account
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Personal profile and credentials of the logged-in administrator
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={adminFirstName}
                      onChange={(e) => setAdminFirstName(e.target.value)}
                      placeholder="First Name"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    />
                  </div>

                  {/* Last Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={adminLastName}
                      onChange={(e) => setAdminLastName(e.target.value)}
                      placeholder="Last Name"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Admin Email */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Admin Email
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@netfix.com"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Admin Phone */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Admin Phone
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </span>
                      <input
                        type="tel"
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Role: <strong className="text-slate-900 dark:text-slate-100 font-bold">{roleLabel}</strong></span>
                  </div>
                  <div>
                    Username: <strong className="text-slate-900 dark:text-slate-100 font-semibold">{me?.username || user?.email || 'admin'}</strong>
                  </div>
                </div>
              </div>

            </div>

            {/* Right 1 Column: Company Logo & Security Actions */}
            <div className="space-y-6">
              
              {/* Card 3: Company Logo */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Logo
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Display brand logo on system header and invoices
                  </p>
                </div>

                {/* Logo Preview Area */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Company Logo
                  </label>
                  <div className="w-full h-36 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 flex flex-col items-center justify-center p-3 relative overflow-hidden">
                    {currentDisplayLogo ? (
                      <div className="flex flex-col items-center justify-center w-full h-full">
                        <img
                          src={currentDisplayLogo}
                          alt="Company Logo Preview"
                          className="max-h-24 max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="text-center space-y-1 text-slate-400">
                        <ImageIcon className="w-8 h-8 mx-auto stroke-1" />
                        <p className="text-xs text-slate-500 dark:text-slate-400">No logo chosen</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* File Input Controls */}
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    onChange={handleFileChange}
                    className="hidden"
                    id="company-logo-file"
                  />

                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="company-logo-file"
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Choose File</span>
                    </label>

                    <span
                      className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1"
                      title={selectedFile ? selectedFile.name : 'No file chosen'}
                    >
                      {selectedFile ? selectedFile.name : 'No file chosen'}
                    </span>

                    {selectedFile && (
                      <button
                        type="button"
                        onClick={handleRemoveSelectedFile}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                        title="Remove chosen file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Upload a new image to replace the current logo.
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400">Max size:</span>
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      300 KB
                    </span>
                  </div>

                  {fileError && (
                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40">
                      {fileError}
                    </p>
                  )}
                </div>
              </div>

              {/* Card 4: Security & Password */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Security
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Manage administrative login credentials and password
                  </p>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Keep your account secure by using a strong, unique password.
                </p>

                <button
                  type="button"
                  onClick={() => navigate('/dashboard/change-password')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-colors"
                >
                  <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Change Password</span>
                </button>
              </div>

            </div>

          </div>

          {/* Footer Save Row */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={loadAllData}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={saving || Boolean(fileError)}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
