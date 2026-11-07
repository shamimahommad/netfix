import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Filter,
  Plus,
  Download,
  Search,
  UserPlus,
  User,
  AtSign,
  Lock,
  Eye,
  EyeOff,
  Phone,
  Server,
  Shield,
  CreditCard,
  Wallet,
  Layers,
  X,
  CheckCircle2,
  RotateCw,
} from 'lucide-react';
import { PageHeader } from '@/components/common';
import {
  resellerService,
  Reseller,
  CreateResellerPayload,
  UpdateResellerPayload,
  ResellerRole,
  ListResellersParams,
} from '@/services/reseller.service';
import { authService } from '@/services/auth.service';
import { networkService } from '@/services/network.service';
import { useToastContext } from '@/contexts/ToastContext';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { ResellerHierarchyTree } from '@/components/reseller/ResellerHierarchyTree';
import api from '@/lib/api';

const RESELLER_ROLE_LABELS: Record<string, string> = {
  admin: 'ISP Admin',
  isp_admin: 'ISP Admin',
  manager: 'Manager',
  reseller: 'Reseller',
  sub_reseller: 'Sub Reseller',
  dealer: 'Dealer',
  agent: 'Agent',
};

const ROLE_BADGE_CLASS: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  isp_admin: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  reseller: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  sub_reseller: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  dealer: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  agent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const formatCurrency = (n: number) =>
  `৳${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
function LoginAsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
    </svg>
  );
}
function DotsVerticalIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  );
}

/* Add User Modal — colorful field icons */
function UserIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function AtSymbolIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
    </svg>
  );
}
function LockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
function PhoneIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}
function ServerIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}
function BadgeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  );
}
function CurrencyIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function WalletIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function StatusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function XMarkIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function FilterIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) {
    return (
      <svg className="w-4 h-4 inline-block ml-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return dir === 'asc' ? (
    <svg className="w-4 h-4 inline-block ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-4 h-4 inline-block ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
function UserMinusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 11h-6" />
    </svg>
  );
}
function RechargeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function DotsHorizontalIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  );
}
function DocumentIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function MapPinIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function MonitorIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function ExportIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function AvatarInitials({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase() || '?';
  return (
    <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-sm font-medium shrink-0">
      {initials}
    </div>
  );
}

/** Strict Tier Chain: Agent cannot add. Dealer adds Agent. Sub Reseller adds Dealer. Reseller adds Sub Reseller. Admin adds Reseller. */
function getAllowedAddRoles(roleCode: string | undefined): ResellerRole[] {
  const r = (roleCode ?? '').toLowerCase();
  if (r === 'agent') return [];
  if (r === 'dealer') return ['agent'];
  if (r === 'sub_reseller') return ['dealer'];
  if (r === 'reseller') return ['sub_reseller'];
  return ['reseller', 'sub_reseller', 'dealer', 'agent'];
}

export default function ResellerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToastContext();
  const { user, refreshMe } = useAuthStore();
  const permissions = usePermissions();
  const isAdmin = user?.role_code === 'admin' || user?.role_code === 'isp_admin';
  const allowedAddRoles = getAllowedAddRoles(user?.role_code);
  const canShowAddUser = permissions.canManageSubTier && allowedAddRoles.length > 0;

  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const [list, setList] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<Array<{ id: string; name: string }>>([]);
  const [addOpen, setAddOpen] = useState(searchParams.get('add') === '1');
  const [addForm, setAddForm] = useState<CreateResellerPayload>({
    name: '',
    username: '',
    password: '',
    phone: '',
    role: 'agent',
    serverId: '',
    status: 'active',
    credit_limit: 0,
    opening_balance: 0,
  });
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userPanelUser, setUserPanelUser] = useState<Reseller | null>(null);
  const [addBalanceUserId, setAddBalanceUserId] = useState<string | null>(null);
  const [addBalanceAmount, setAddBalanceAmount] = useState('');
  const [rechargeAction, setRechargeAction] = useState<'credit' | 'debit'>('credit');
  const [rechargeMethod, setRechargeMethod] = useState('cash');
  const [rechargeTransactionId, setRechargeTransactionId] = useState('');
  const [rechargeRemarks, setRechargeRemarks] = useState('');
  const [rechargeSendSms, setRechargeSendSms] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateResellerPayload & { name?: string; phone?: string }>({});

  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterServerId, setFilterServerId] = useState<string>('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('userId');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [canImpersonateMap, setCanImpersonateMap] = useState<Record<string, boolean>>({});
  const [impersonateConfirmTarget, setImpersonateConfirmTarget] = useState<Reseller | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const impersonated = useAuthStore((s) => s.impersonated);

  const loadList = async () => {
    setLoading(true);
    try {
      const params: ListResellersParams = {};
      if (filterRole) params.role = filterRole as ResellerRole;
      if (filterStatus) params.status = filterStatus as 'active' | 'suspended';
      if (filterServerId) params.serverId = filterServerId;
      const res = await resellerService.list(params);
      const data = res.data || [];
      setList(data);
      if (data.length > 0) {
        try {
          const allowed = await authService.canImpersonateBatch(data.map((r) => r.userId));
          setCanImpersonateMap(allowed);
        } catch {
          setCanImpersonateMap({});
        }
      } else {
        setCanImpersonateMap({});
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load resellers');
      setList([]);
      setCanImpersonateMap({});
    } finally {
      setLoading(false);
    }
  };

  const loadServers = async () => {
    try {
      const res = await networkService.getDevicesDropdown('router');
      setServers(Array.isArray(res?.data) ? res.data.filter((d: any) => d.type !== 'olt') : []);
    } catch {
      setServers([]);
    }
  };

  useEffect(() => {
    loadList();
  }, [filterRole, filterStatus, filterServerId]);

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    setAddOpen(searchParams.get('add') === '1');
  }, [searchParams]);

  useEffect(() => {
    if (addOpen) loadServers();
  }, [addOpen]);

  useEffect(() => {
    if (addOpen && allowedAddRoles.length > 0 && !allowedAddRoles.includes(addForm.role)) {
      setAddForm((f) => ({ ...f, role: allowedAddRoles[0] }));
    }
  }, [addOpen, allowedAddRoles, addForm.role]);

  const handleCreate = async () => {
    const username = (addForm.username || '').trim();
    if (!addForm.name?.trim() || !username || !addForm.password) {
      toast.error('Name, username and password are required');
      return;
    }
    if (username.includes('@')) {
      toast.error('Username cannot contain @. Please enter a username, not an email.');
      return;
    }
    const serverId =
      addForm.role !== 'admin'
        ? addForm.serverId || (isAdmin ? undefined : servers[0]?.id)
        : undefined;
    if (addForm.role !== 'admin' && !serverId) {
      toast.error('Server is required for non-Admin roles');
      return;
    }
    setSubmitting(true);
    try {
      await resellerService.create({
        ...addForm,
        username,
        serverId: serverId || undefined,
        credit_limit: isAdmin ? (addForm.credit_limit ? Number(addForm.credit_limit) : undefined) : 0,
        opening_balance: isAdmin ? (addForm.opening_balance ? Number(addForm.opening_balance) : undefined) : 0,
      });
      toast.success('User created');
      setAddOpen(false);
      setSearchParams({});
      setAddForm({
        name: '',
        username: '',
        password: '',
        phone: '',
        role: 'agent',
        serverId: '',
        status: 'active',
        credit_limit: 0,
        opening_balance: 0,
      });
      loadList();
    } catch (e: any) {
      toast.error(e?.message || 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editId) return;
    setSubmitting(true);
    try {
      await resellerService.update(editId, {
        name: editForm.name,
        username: editForm.username,
        password: editForm.password,
        phone: editForm.phone,
        serverId: editForm.serverId,
        role: editForm.role,
        status: editForm.status as 'active' | 'suspended' | undefined,
        credit_limit: editForm.credit_limit,
      });
      toast.success('User updated');
      setEditId(null);
      setEditForm({});
      setUserPanelUser(null);
      loadList();
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async (id: string, currentStatus: string) => {
    const next = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await resellerService.setStatus(id, next);
      toast.success(next === 'active' ? 'User restored' : 'User suspended');
      setUserPanelUser((u) => (u && u.userId === id ? null : u));
      loadList();
    } catch (e: any) {
      toast.error(e?.message || 'Status update failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Soft delete this user? They will be hidden from the list.')) return;
    try {
      await resellerService.delete(id);
      toast.success('User deleted');
      setUserPanelUser((u) => (u && u.userId === id ? null : u));
      loadList();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  const handleLoginAsConfirm = async () => {
    const target = impersonateConfirmTarget;
    if (!target) return;
    setImpersonating(true);
    try {
      const data = await authService.impersonate(target.userId);
      toast.success('Switching account…');
      window.location.href = data.redirect_url || '/dashboard';
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Impersonation failed');
      setImpersonating(false);
      setImpersonateConfirmTarget(null);
    }
  };

  const closeRechargeModal = () => {
    setAddBalanceUserId(null);
    setAddBalanceAmount('');
    setRechargeAction('credit');
    setRechargeMethod('cash');
    setRechargeTransactionId('');
    setRechargeRemarks('');
    setRechargeSendSms(false);
  };

  const handleRechargeConfirm = async () => {
    if (!addBalanceUserId) return;
    const amount = Number(addBalanceAmount);
    if (!addBalanceAmount || isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!rechargeRemarks.trim()) {
      toast.error('Transaction Remarks is required');
      return;
    }
    if (rechargeMethod !== 'cash' && !rechargeTransactionId.trim()) {
      toast.error('Transaction ID is required for this method');
      return;
    }
    setSubmitting(true);
    try {
      const refPart =
        rechargeMethod !== 'cash' && rechargeTransactionId.trim()
          ? ` Ref: ${rechargeTransactionId.trim()}`
          : '';
      const notes = `[${rechargeMethod}]${refPart} ${rechargeRemarks.trim()}`;

      if (rechargeAction === 'debit') {
        // Debit: admin-only manual debit; affects only reseller ledger, not admin balance
        await api.patch(`/resellers/${addBalanceUserId}/balance`, {
          amount,
          operation: 'debit',
        });
        toast.success('Balance debited from reseller');
      } else {
        // Credit: add balance to reseller (ledger credit only)
        await resellerService.addBalance(addBalanceUserId, amount, notes);
        toast.success('Balance recharged');
      }
      closeRechargeModal();
      loadList();
      await refreshMe(); // update header balance when balance changes
    } catch (e: any) {
      toast.error(e?.message || 'Recharge failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    toast.info('Export will download current filtered list (CSV). Placeholder.');
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredBySearch = searchLower
    ? list.filter(
        (r) =>
          r.name.toLowerCase().includes(searchLower) ||
          (r.username || '').toLowerCase().includes(searchLower) ||
          (r.phone || '').includes(searchQuery.trim()),
      )
    : list;

  const sorted = [...filteredBySearch].sort((a, b) => {
    let va: string | number = (a as any)[sortBy] ?? '';
    let vb: string | number = (b as any)[sortBy] ?? '';
    if (sortBy === 'balance' || sortBy === 'credit_limit') {
      va = Number(va) || 0;
      vb = Number(vb) || 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    }
    const sa = String(va);
    const sb = String(vb);
    const cmp = sa.localeCompare(sb, undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const pageStart = 0;
  const paginated = sorted.slice(pageStart, pageStart + rowsPerPage);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Reseller Management"
        subtitle="Manage resellers, sub-resellers, and agents. Roles, credit limits, and permissions."
        badge={`${list.length} Users`}
        actions={
          <div className="flex items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Table View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'tree'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Hierarchy Tree
              </button>
            </div>

            {viewMode === 'table' && (
              <button
                type="button"
                onClick={() => setFilterPanelOpen((o) => !o)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors shadow-sm ${
                  filterPanelOpen
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                }`}
              >
                <FilterIcon /> Filters
              </button>
            )}

            {canShowAddUser && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition-all active:scale-95"
              >
                <UserPlus className="w-4 h-4" /> Add Reseller
              </button>
            )}
          </div>
        }
      />

      {viewMode === 'tree' ? (
        <ResellerHierarchyTree />
      ) : (
        <>
          {/* Collapsible filter panel */}
      {filterPanelOpen && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Role</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="">All Roles</option>
                {(Object.keys(RESELLER_ROLE_LABELS) as ResellerRole[]).map((r) => (
                  <option key={r} value={r}>{RESELLER_ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Server</label>
              <select
                value={filterServerId}
                onChange={(e) => setFilterServerId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                <option value="">All Servers</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main table card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value={10}>10 rows</option>
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-medium transition-colors"
            >
              <ExportIcon /> Export
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                id="reseller-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, username..."
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 pl-8 pr-3 py-1.5 text-xs w-48 sm:w-60 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading resellers…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">No users match the filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800/90 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort('userId')} className="inline-flex items-center hover:text-slate-900 dark:hover:text-white">ID <SortIcon active={sortBy === 'userId'} dir={sortDir} /></button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center hover:text-slate-900 dark:hover:text-white">User <SortIcon active={sortBy === 'name'} dir={sortDir} /></button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort('username')} className="inline-flex items-center hover:text-slate-900 dark:hover:text-white">Username <SortIcon active={sortBy === 'username'} dir={sortDir} /></button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort('role')} className="inline-flex items-center hover:text-slate-900 dark:hover:text-white">Role <SortIcon active={sortBy === 'role'} dir={sortDir} /></button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort('balance')} className="inline-flex items-center hover:text-slate-900 dark:hover:text-white">Balance <SortIcon active={sortBy === 'balance'} dir={sortDir} /></button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort('credit_limit')} className="inline-flex items-center hover:text-slate-900 dark:hover:text-white">Limit <SortIcon active={sortBy === 'credit_limit'} dir={sortDir} /></button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort('phone')} className="inline-flex items-center hover:text-slate-900 dark:hover:text-white">Phone <SortIcon active={sortBy === 'phone'} dir={sortDir} /></button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center hover:text-slate-900 dark:hover:text-white">Status <SortIcon active={sortBy === 'status'} dir={sortDir} /></button>
                  </th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginated.map((r) => (
                  <tr
                    key={r.userId}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                      <td className="p-3 text-slate-600 dark:text-slate-400 text-sm">{r.userId}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <AvatarInitials name={r.name} />
                          <span className="text-slate-900 dark:text-slate-100">{r.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">{r.username}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            ROLE_BADGE_CLASS[r.role] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {RESELLER_ROLE_LABELS[r.role] || r.role}
                        </span>
                      </td>
                      <td className={`p-3 font-bold ${(r.balance ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {formatCurrency(r.balance)}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400 font-bold">
                        {r.credit_limit != null ? formatCurrency(r.credit_limit) : '৳0'}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{r.phone || '—'}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            STATUS_BADGE_CLASS[r.status] || 'bg-gray-100'
                          }`}
                        >
                          {r.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAddBalanceUserId(r.userId);
                              setAddBalanceAmount('');
                              setRechargeAction('credit');
                              setRechargeMethod('cash');
                              setRechargeTransactionId('');
                              setRechargeRemarks('');
                              setRechargeSendSms(false);
                            }}
                            className="p-2 rounded-lg bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-900/40 dark:hover:bg-cyan-800/50 text-cyan-700 dark:text-cyan-300"
                            title="Add Balance / Recharge"
                          >
                            <RechargeIcon />
                          </button>
                          {canImpersonateMap[r.userId] && (
                            <button
                              type="button"
                              onClick={() => setImpersonateConfirmTarget(r)}
                              className="p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-800/50 text-red-700 dark:text-red-300"
                              title="Login as user"
                            >
                              <LoginAsIcon />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setUserPanelUser(r)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                            aria-label="More actions"
                          >
                            <DotsHorizontalIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {/* User Action Panel modal — elegant sky/teal theme */}
      {userPanelUser && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
          onClick={() => !submitting && setUserPanelUser(null)}
        >
          <div
            className="bg-white dark:bg-slate-800/95 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col border border-white/20 dark:border-slate-600/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — soft sky gradient */}
            <div className="shrink-0 bg-gradient-to-br from-sky-50 to-teal-50/80 dark:from-sky-950/50 dark:to-teal-950/40 p-4 border-b border-sky-100/80 dark:border-slate-700/80">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-teal-500 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-sky-500/30">
                  {userPanelUser.name.split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-800 dark:text-white text-lg truncate">{userPanelUser.name}</div>
                  <span
                    className={`inline-block mt-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      ROLE_BADGE_CLASS[userPanelUser.role] || 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {RESELLER_ROLE_LABELS[userPanelUser.role] || userPanelUser.role}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                  (userPanelUser.balance ?? 0) < 0
                    ? 'bg-red-100/90 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                    : 'bg-teal-100/90 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${(userPanelUser.balance ?? 0) < 0 ? 'bg-red-500' : 'bg-teal-500'}`} /> Balance {formatCurrency(userPanelUser.balance)}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-100/90 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-xs font-bold">
                  Limit {userPanelUser.credit_limit != null ? formatCurrency(userPanelUser.credit_limit) : '৳0'}
                </span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 text-xs">
                  {userPanelUser.phone || '—'}
                </span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 text-xs truncate max-w-[180px]">
                  {userPanelUser.email && !String(userPanelUser.email).endsWith('@reseller.local')
                  ? userPanelUser.email
                  : (userPanelUser.username || '—')}
                </span>
              </div>
            </div>
            {/* Actions — unified elegant rows, accent left border */}
            <div className="p-2.5 overflow-y-auto flex-1 min-h-0 space-y-1 bg-slate-50/30 dark:bg-slate-900/30">
              <button
                type="button"
                onClick={() => {
                  setAddBalanceUserId(userPanelUser.userId);
                  setAddBalanceAmount('');
                  setRechargeAction('credit');
                  setRechargeMethod('cash');
                  setRechargeTransactionId('');
                  setRechargeRemarks('');
                  setRechargeSendSms(false);
                  setUserPanelUser(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium rounded-xl bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/20 border-l-4 border-teal-400 dark:border-teal-500 shadow-sm hover:shadow transition-all"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400"><RechargeIcon /></span>
                Recharge
              </button>
              {isAdmin && canImpersonateMap[userPanelUser.userId] && (
                <button
                  type="button"
                  onClick={() => { setImpersonateConfirmTarget(userPanelUser); setUserPanelUser(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium rounded-xl bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/20 border-l-4 border-sky-400 dark:border-sky-500 shadow-sm hover:shadow transition-all"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400"><LoginAsIcon /></span>
                  Login as user
                </button>
              )}
              <button
                type="button"
                onClick={() => { handleStatus(userPanelUser.userId, userPanelUser.status); setUserPanelUser(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium rounded-xl bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-500 shadow-sm hover:shadow transition-all"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
                  {userPanelUser.status === 'active' ? <UserMinusIcon /> : <PlayIcon />}
                </span>
                {userPanelUser.status === 'active' ? 'Suspend' : 'Restore'}
              </button>
              <button type="button" onClick={() => toast.info('Edit Permission – coming soon')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium rounded-xl bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-4 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow transition-all">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400"><LockIcon /></span>
                Edit Permission
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate(`/dashboard/reseller/plan-permission/${userPanelUser.userId}`);
                  setUserPanelUser(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium rounded-xl bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-4 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow transition-all"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400"><DocumentIcon /></span>
                Plan Permission
              </button>
              <button type="button" onClick={() => toast.info('Zone Permission – coming soon')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium rounded-xl bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-4 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow transition-all">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400"><MapPinIcon /></span>
                Zone Permission
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate(`/dashboard/reseller/login-log/${userPanelUser.userId}`);
                  setUserPanelUser(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium rounded-xl bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-4 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow transition-all"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400"><MonitorIcon /></span>
                Login Log
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditId(userPanelUser.userId);
                  setEditForm({
                    name: userPanelUser.name,
                    username: userPanelUser.username,
                    phone: userPanelUser.phone ?? undefined,
                    serverId: userPanelUser.serverId ?? undefined,
                    role: userPanelUser.role as ResellerRole,
                    status: userPanelUser.status as 'active' | 'suspended',
                    credit_limit: userPanelUser.credit_limit ?? undefined,
                  });
                  setUserPanelUser(null);
                }}
                disabled={impersonated}
                title={impersonated ? 'Disabled during impersonation' : undefined}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium rounded-xl bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-900/20 border-l-4 border-teal-400 dark:border-teal-500 shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400"><PencilIcon /></span>
                Edit Information
              </button>
              <button
                type="button"
                onClick={() => { handleDelete(userPanelUser.userId); setUserPanelUser(null); }}
                disabled={impersonated}
                title={impersonated ? 'Disabled during impersonation' : undefined}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium rounded-xl bg-white dark:bg-slate-800/80 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 border-l-4 border-rose-400 dark:border-rose-500 shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400"><TrashIcon /></span>
                Delete
              </button>
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => setUserPanelUser(null)}
                className="w-full py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Recharge modal — elegant sky/teal theme */}
      {addBalanceUserId && (() => {
        const target = list.find((r) => r.userId === addBalanceUserId);
        const userEmail = target?.email && !String(target.email).endsWith('@reseller.local')
          ? target.email
          : (target?.username || '—');
        const currentBalance = target?.balance ?? 0;
        return (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
            onClick={() => !submitting && closeRechargeModal()}
          >
            <div
              className="bg-white dark:bg-slate-800/95 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20 dark:border-slate-600/50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header — soft sky/teal gradient */}
              <div className="bg-gradient-to-r from-sky-50 to-teal-50/80 dark:from-sky-950/50 dark:to-teal-950/40 px-4 py-3 border-b border-sky-100/80 dark:border-slate-700/80 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Balance Recharge</h3>
                <button
                  type="button"
                  onClick={() => !submitting && closeRechargeModal()}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4 bg-slate-50/20 dark:bg-slate-900/20">
                {/* User & Balance chips — soft sky & teal */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-sm font-semibold">
                    <span className="w-2 h-2 rounded-full bg-sky-500" /> {userEmail}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-sm font-bold">
                    Balance {formatCurrency(currentBalance)}
                  </span>
                </div>
                {/* Choose Action — soft pill toggle */}
                <div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Choose Action</div>
                  <div className="flex gap-1 p-1 rounded-xl bg-slate-200/60 dark:bg-slate-700/50 w-fit">
                    <button
                      type="button"
                      onClick={() => setRechargeAction('credit')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        rechargeAction === 'credit'
                          ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => setRechargeAction('debit')}
                      className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        rechargeAction === 'debit'
                          ? 'bg-rose-400 text-white shadow-md shadow-rose-400/30'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Debit
                    </button>
                  </div>
                </div>
                {/* Form — clean inputs, sky focus */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Method</label>
                    <select
                      value={rechargeMethod}
                      onChange={(e) => setRechargeMethod(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 dark:focus:ring-sky-500/50 dark:focus:border-sky-500 transition-all"
                    >
                      <option value="cash">Cash</option>
                      <option value="bkash">Bkash</option>
                      <option value="bank">Bank</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {rechargeMethod !== 'cash' && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Transaction ID <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={rechargeTransactionId}
                        onChange={(e) => setRechargeTransactionId(e.target.value)}
                        placeholder="Enter transaction / reference ID"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 dark:focus:ring-sky-500/50 transition-all placeholder-slate-400"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Amount <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={addBalanceAmount}
                      onChange={(e) => setAddBalanceAmount(e.target.value)}
                      placeholder="Enter Amount"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2.5 focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 dark:focus:ring-sky-500/50 transition-all placeholder-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Transaction Remarks <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={rechargeRemarks}
                      onChange={(e) => setRechargeRemarks(e.target.value)}
                      placeholder="Enter remarks"
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2.5 resize-y focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 dark:focus:ring-sky-500/50 transition-all placeholder-slate-400"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rechargeSendSms}
                      onChange={(e) => setRechargeSendSms(e.target.checked)}
                      className="rounded border-slate-300 text-sky-500 focus:ring-sky-400 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-white">Send Sms</span>
                  </label>
                </div>
                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeRechargeModal}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRechargeConfirm}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        Confirm
                      </span>
                    ) : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Impersonation confirmation modal */}
      {impersonateConfirmTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-amber-200 dark:border-amber-800">
            <p className="text-slate-700 dark:text-slate-200 font-medium mb-2">
              Login as this user?
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              You will temporarily switch account. Your session will act as <strong>{impersonateConfirmTarget.name}</strong> ({impersonateConfirmTarget.role}) until you exit impersonation.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setImpersonateConfirmTarget(null)}
                disabled={impersonating}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLoginAsConfirm}
                disabled={impersonating}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {impersonating ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Switching…
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Redesigned Add Reseller / User Modal */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !submitting && setAddOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 ring-1 ring-slate-900/5 dark:ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 dark:from-blue-700 dark:via-indigo-700 dark:to-blue-800 text-white shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold leading-tight">Add New Reseller / User</h2>
                  <p className="text-xs text-blue-100/90 mt-0.5">
                    Configure profile, access role, POP router and financial limit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setAddOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Form Body */}
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
              
              {/* Section 1: Basic & Login Credentials */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Account Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={addForm.name}
                        onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        placeholder="e.g. Hasan Mahmud"
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Username <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <AtSign className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={addForm.username}
                        onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                        placeholder="e.g. hasan_reseller"
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">Unique system username (no @ allowed)</span>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showAddPassword ? 'text' : 'password'}
                        value={addForm.password}
                        onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                        className="w-full pl-9 pr-10 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        placeholder="Login password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAddPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                        {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number <span className="text-slate-400 text-[11px] font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={addForm.phone ?? ''}
                        onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                        placeholder="e.g. 01712345678"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Role & System Assignment */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Role & Network Permissions</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Role Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Role <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Shield className="w-4 h-4" />
                      </span>
                      <select
                        value={allowedAddRoles.includes(addForm.role) ? addForm.role : (allowedAddRoles[0] ?? 'agent')}
                        onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as ResellerRole }))}
                        className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all capitalize"
                      >
                        {allowedAddRoles.map((r) => (
                          <option key={r} value={r}>
                            {RESELLER_ROLE_LABELS[r] || r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Initial Status <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                      <select
                        value={addForm.status ?? 'active'}
                        onChange={(e) => setAddForm((f) => ({ ...f, status: e.target.value as 'active' | 'suspended' }))}
                        className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      >
                        <option value="active">Active (Access Granted)</option>
                        <option value="suspended">Suspended (Access Disabled)</option>
                      </select>
                    </div>
                  </div>

                  {/* Server (POP) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Server (POP Router) {addForm.role !== 'admin' ? <span className="text-rose-500">*</span> : <span className="text-slate-400 text-[11px] font-normal">(Optional for Admin)</span>}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Server className="w-4 h-4" />
                      </span>
                      <select
                        value={addForm.serverId ?? ''}
                        onChange={(e) => setAddForm((f) => ({ ...f, serverId: e.target.value || undefined }))}
                        className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      >
                        <option value="">{addForm.role === 'admin' ? '— All Routers / Global Access —' : '— Select Assigned MikroTik / POP Router —'}</option>
                        {servers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    {addForm.role !== 'admin' && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block">
                        Assigned router controls customer creation & PPPoE authentication for this reseller.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Financial & Credit Settings (Admin only) */}
              {isAdmin && (
                <div className="pt-2">
                  <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Financial & Wallet Allocation</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Credit Limit */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Postpaid Credit Limit (৳)
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <CreditCard className="w-4 h-4" />
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={addForm.credit_limit ?? ''}
                            onChange={(e) =>
                              setAddForm((f) => ({ ...f, credit_limit: e.target.value ? Number(e.target.value) : 0 }))
                            }
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                            placeholder="0"
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">Max negative balance allowed for customer recharge</span>
                      </div>

                      {/* Opening Balance */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Opening Balance (৳)
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Wallet className="w-4 h-4" />
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={addForm.opening_balance ?? ''}
                            onChange={(e) =>
                              setAddForm((f) => ({ ...f, opening_balance: e.target.value ? Number(e.target.value) : 0 }))
                            }
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono"
                            placeholder="0"
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">Initial wallet balance immediately credited</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-400 dark:text-slate-500 hidden sm:flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Passwords hashed with secure bcrypt
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => !submitting && setAddOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm shadow-blue-500/20 active:scale-95 disabled:opacity-50 transition-all min-w-[130px]"
                >
                  {submitting ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Edit Modal — same sky/teal design as Action & Recharge modals */}
      {editId && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md"
          onClick={() => !submitting && (setEditId(null), setEditForm({}))}
        >
          <div
            className="bg-white dark:bg-slate-800/95 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/20 dark:border-slate-600/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — soft sky/teal gradient */}
            <div className="shrink-0 bg-gradient-to-r from-sky-50 to-teal-50/80 dark:from-sky-950/50 dark:to-teal-950/40 px-4 py-3 border-b border-sky-100/80 dark:border-slate-700/80 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Edit User</h3>
              <button
                type="button"
                onClick={() => !submitting && (setEditId(null), setEditForm({}))}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0 bg-slate-50/20 dark:bg-slate-900/20">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  value={editForm.name ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 dark:focus:ring-sky-500/50 dark:focus:border-sky-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Username</label>
                <input
                  value={editForm.username ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 dark:focus:ring-sky-500/50 dark:focus:border-sky-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Password (leave blank to keep)</label>
                <input
                  type="password"
                  value={editForm.password ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="New password"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 dark:focus:ring-sky-500/50 dark:focus:border-sky-500 transition-all placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                <input
                  value={editForm.phone ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 dark:focus:ring-sky-500/50 dark:focus:border-sky-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Server (POP)</label>
                <select
                  value={editForm.serverId ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, serverId: e.target.value || undefined }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 dark:focus:ring-sky-500/50 dark:focus:border-sky-500 transition-all"
                >
                  <option value="">— None —</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Role</label>
                <select
                  value={editForm.role ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as ResellerRole }))}
                  disabled={impersonated}
                  title={impersonated ? 'Role change disabled during impersonation' : undefined}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 dark:focus:ring-sky-500/50 dark:focus:border-sky-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {(Object.keys(RESELLER_ROLE_LABELS) as ResellerRole[]).map((r) => (
                    <option key={r} value={r}>{RESELLER_ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Credit limit</label>
                <input
                  type="number"
                  min={0}
                  value={editForm.credit_limit ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, credit_limit: e.target.value ? Number(e.target.value) : undefined }))
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 dark:focus:ring-sky-500/50 dark:focus:border-sky-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                <select
                  value={editForm.status ?? 'active'}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as 'active' | 'suspended' }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-400/60 focus:border-sky-400 dark:focus:ring-sky-500/50 dark:focus:border-sky-500 transition-all"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 shrink-0 flex gap-2">
              <button
                type="button"
                onClick={() => { setEditId(null); setEditForm({}); }}
                className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    Update
                  </span>
                ) : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
