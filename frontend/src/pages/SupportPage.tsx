import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LifeBuoy,
  PhoneCall,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Phone,
  Save,
  Trash2,
  Check,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/common';
import { useToastContext } from '@/contexts/ToastContext';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import {
  supportService,
  TicketItem,
  SupportDirectoryItem,
} from '@/services/support.service';
import { searchService, SearchCustomerResult } from '@/services/search.service';

export default function SupportPage() {
  const { type = 'ticket' } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();

  // Current logged in user context
  const { user: currentUser } = useAuthStore();
  const currentUserId = currentUser?.user_id;

  // Active Tab
  const activeTab = useMemo(() => {
    if (['ticket', 'assigned', 'numbers'].includes(type)) return type;
    return 'ticket';
  }, [type]);

  // =========================================================================
  // TAB 1: SUPPORT TICKETS STATE
  // =========================================================================
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [ticketMetrics, setTicketMetrics] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
  });
  const [isTicketsLoading, setIsTicketsLoading] = useState(true);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'mine' | 'unassigned'>('all');

  // Staff members for forwarding/assigning
  const [staffList, setStaffList] = useState<Array<{ userId: string; name: string; username: string }>>([]);

  // Create Ticket Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [custSearchQuery, setCustSearchQuery] = useState('');
  const [custSearchResults, setCustSearchResults] = useState<SearchCustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<SearchCustomerResult | null>(null);
  const [newTicketTitle, setNewTicketTitle] = useState('');
  const [newTicketDesc, setNewTicketDesc] = useState('');
  const [newTicketPriority, setNewTicketPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [newTicketAssignedTo, setNewTicketAssignedTo] = useState<number | undefined>(undefined);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Load staff list for technician dispatch & forwarding
  useEffect(() => {
    api
      .get('/users')
      .then((res) => {
        if (res?.data?.success && Array.isArray(res.data.data)) {
          setStaffList(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Load Tickets
  const loadTickets = useCallback(async () => {
    setIsTicketsLoading(true);
    try {
      const res = await supportService.getTickets({
        status: ticketStatusFilter !== 'all' ? ticketStatusFilter : undefined,
        priority: ticketPriorityFilter !== 'all' ? ticketPriorityFilter : undefined,
        search: ticketSearch.trim() || undefined,
      });
      if (res && res.success) {
        setTickets(res.tickets || []);
        if (res.metrics) setTicketMetrics(res.metrics);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load support tickets');
    } finally {
      setIsTicketsLoading(false);
    }
  }, [ticketStatusFilter, ticketPriorityFilter, ticketSearch, toast]);

  useEffect(() => {
    if (activeTab === 'ticket' || activeTab === 'assigned') {
      loadTickets();
    }
  }, [activeTab, loadTickets]);

  useEffect(() => {
    if (type === 'assigned') {
      setAssignmentFilter('mine');
    } else if (type === 'ticket') {
      setAssignmentFilter('all');
    }
  }, [type]);

  // Compute tickets assigned to current user
  const myTicketsCount = useMemo(() => {
    return tickets.filter((t) => {
      return (
        (currentUserId && String(t.assigned_to) === String(currentUserId)) ||
        (currentUser?.username && t.assigned_username?.toLowerCase() === currentUser.username.toLowerCase())
      );
    }).length;
  }, [tickets, currentUserId, currentUser?.username]);

  // Filtered tickets based on assignment tab
  const displayedTickets = useMemo(() => {
    return tickets.filter((t) => {
      const isMine =
        (currentUserId && String(t.assigned_to) === String(currentUserId)) ||
        (currentUser?.username && t.assigned_username?.toLowerCase() === currentUser.username.toLowerCase());

      if (assignmentFilter === 'mine') return isMine;
      if (assignmentFilter === 'unassigned') return !t.assigned_to;
      return true;
    });
  }, [tickets, assignmentFilter, currentUserId, currentUser?.username]);

  // Quick Customer Search for Ticket Creation
  useEffect(() => {
    if (!custSearchQuery.trim()) {
      setCustSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await searchService.searchCustomers(custSearchQuery.trim());
        setCustSearchResults(res?.data || []);
      } catch {
        setCustSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [custSearchQuery]);

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      toast.warning('Please select a customer first.');
      return;
    }
    if (!newTicketTitle.trim()) {
      toast.warning('Please enter an issue title / subject.');
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const res = await supportService.createTicket({
        customer_id: selectedCustomer.customerId,
        title: newTicketTitle.trim(),
        description: newTicketDesc.trim(),
        priority: newTicketPriority,
        assigned_to: newTicketAssignedTo,
      });

      if (res && res.success) {
        toast.success(res.message || 'Ticket opened successfully!');
        setIsCreateModalOpen(false);
        setSelectedCustomer(null);
        setCustSearchQuery('');
        setNewTicketTitle('');
        setNewTicketDesc('');
        setNewTicketAssignedTo(undefined);
        loadTickets();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to open ticket');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const res = await supportService.updateTicketStatus(ticketId, { status: newStatus });
      if (res && res.success) {
        toast.success(`Ticket marked as ${newStatus}`);
        loadTickets();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update ticket status');
    }
  };

  const handleForwardTicket = async (ticketId: string, assignedUserId: number) => {
    try {
      await supportService.updateTicketStatus(ticketId, { assigned_to: assignedUserId });
      toast.success(assignedUserId > 0 ? 'Ticket forwarded successfully!' : 'Ticket unassigned');
      loadTickets();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update ticket assignment');
    }
  };

  const handleAssignToMe = async (ticketId: string) => {
    if (!currentUserId) {
      toast.warning('Unable to identify your user ID');
      return;
    }
    handleForwardTicket(ticketId, Number(currentUserId));
  };

  // =========================================================================
  // TAB 2: SUPPORT NUMBERS STATE
  // =========================================================================
  const [supportPhone, setSupportPhone] = useState('');
  const [directory, setDirectory] = useState<SupportDirectoryItem[]>([]);
  const [isNumbersLoading, setIsNumbersLoading] = useState(false);
  const [isSavingNumbers, setIsSavingNumbers] = useState(false);

  // New Directory Entry Modal/State
  const [newEntryTitle, setNewEntryTitle] = useState('');
  const [newEntryNumber, setNewEntryNumber] = useState('');
  const [newEntryHours, setNewEntryHours] = useState('24 Hours / 7 Days');

  const loadSupportNumbers = useCallback(async () => {
    setIsNumbersLoading(true);
    try {
      const res = await supportService.getSupportNumbers();
      if (res && res.success) {
        setSupportPhone(res.supportPhone || '');
        setDirectory(res.directory || []);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load support numbers');
    } finally {
      setIsNumbersLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'numbers') {
      loadSupportNumbers();
    }
  }, [activeTab, loadSupportNumbers]);

  const handleAddDirectoryEntry = () => {
    if (!newEntryTitle.trim() || !newEntryNumber.trim()) {
      toast.warning('Please enter both title and phone number.');
      return;
    }
    const updated = [
      ...directory,
      {
        title: newEntryTitle.trim(),
        number: newEntryNumber.trim(),
        hours: newEntryHours.trim(),
        category: 'technical',
      },
    ];
    setDirectory(updated);
    setNewEntryTitle('');
    setNewEntryNumber('');
    toast.info('Added to directory. Click "Save Directory Changes" to persist.');
  };

  const handleRemoveDirectoryEntry = (index: number) => {
    const updated = directory.filter((_, i) => i !== index);
    setDirectory(updated);
  };

  const handleSaveSupportDirectory = async () => {
    setIsSavingNumbers(true);
    try {
      const res = await supportService.saveSupportNumbers({
        supportPhone,
        directory,
      });
      if (res && res.success) {
        toast.success('Support directory saved successfully!');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save support numbers');
    } finally {
      setIsSavingNumbers(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={activeTab === 'assigned' ? 'Tickets Assigned to You' : 'Support & Customer Service Desk'}
        subtitle={
          activeTab === 'assigned'
            ? 'Review, update, and resolve customer support tickets assigned directly to your desk.'
            : 'Manage customer support tickets, technician dispatch, and emergency helpline directory.'
        }
        actions={
          activeTab === 'numbers' ? (
            <button
              type="button"
              onClick={handleSaveSupportDirectory}
              disabled={isSavingNumbers}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow active:scale-95 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSavingNumbers ? 'Saving...' : 'Save Directory'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              Open Support Ticket
            </button>
          )
        }
      />

      {/* Top Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
        <button
          type="button"
          onClick={() => {
            navigate('/dashboard/support/ticket');
            setAssignmentFilter('all');
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'ticket'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          <span>All Support Tickets</span>
          {ticketMetrics.open > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
              {ticketMetrics.open}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            navigate('/dashboard/support/assigned');
            setAssignmentFilter('mine');
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'assigned'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Assigned to You</span>
          {myTicketsCount > 0 && (
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'assigned' ? 'bg-white text-blue-700' : 'bg-blue-600 text-white'
              }`}
            >
              {myTicketsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard/support/numbers')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'numbers'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>Support Numbers</span>
        </button>
      </div>

      {/* =========================================================================
          VIEW 1: SUPPORT TICKETS TAB
         ========================================================================= */}
      {(activeTab === 'ticket' || activeTab === 'assigned') && (
        <div className="space-y-6">
          {/* KPI Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div
              onClick={() => setAssignmentFilter('all')}
              className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                assignmentFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-800 border-slate-900 shadow-md ring-2 ring-slate-400'
                  : 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:border-slate-400'
              } flex items-center gap-3.5`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  assignmentFilter === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                }`}
              >
                <LifeBuoy className="w-5 h-5" />
              </div>
              <div>
                <p
                  className={`text-xs font-medium ${
                    assignmentFilter === 'all' ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Total Tickets
                </p>
                <p
                  className={`text-xl font-bold ${
                    assignmentFilter === 'all' ? 'text-white' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {ticketMetrics.total}
                </p>
              </div>
            </div>

            {/* NOC Highlight Card: Assigned to You */}
            <div
              onClick={() => setAssignmentFilter('mine')}
              className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                assignmentFilter === 'mine'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400'
                  : 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:border-blue-400'
              } flex items-center gap-3.5`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  assignmentFilter === 'mine'
                    ? 'bg-white/20 text-white'
                    : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                }`}
              >
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <p
                  className={`text-xs font-medium ${
                    assignmentFilter === 'mine' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Assigned to You
                </p>
                <p
                  className={`text-xl font-bold ${
                    assignmentFilter === 'mine' ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {myTicketsCount}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Open Tickets</p>
                <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{ticketMetrics.open}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">In Progress</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{ticketMetrics.inProgress}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Resolved / Closed</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{ticketMetrics.resolved + ticketMetrics.closed}</p>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-wrap items-center justify-between gap-3.5">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search ticket title, description, customer name, code, or phone..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Assignment Filter */}
              <div className="min-w-[170px]">
                <select
                  value={assignmentFilter}
                  onChange={(e: any) => setAssignmentFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none font-medium"
                >
                  <option value="all">👥 All Staff Tickets</option>
                  <option value="mine">👤 Assigned to Me ({myTicketsCount})</option>
                  <option value="unassigned">⚠️ Unassigned Tickets</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="min-w-[150px]">
                <select
                  value={ticketStatusFilter}
                  onChange={(e) => setTicketStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">⚡ All Statuses</option>
                  <option value="open">🔴 Open</option>
                  <option value="in_progress">🟡 In Progress</option>
                  <option value="resolved">🟢 Resolved</option>
                  <option value="closed">⚪ Closed</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div className="min-w-[150px]">
                <select
                  value={ticketPriorityFilter}
                  onChange={(e) => setTicketPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="all">🎯 All Priorities</option>
                  <option value="critical">🔥 Critical</option>
                  <option value="high">🔺 High</option>
                  <option value="medium">🔹 Medium</option>
                  <option value="low">▫️ Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tickets Table */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Customer Details</th>
                    <th className="py-3 px-4">Subject & Issue</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned / Forward</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                  {isTicketsLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                        Loading support tickets...
                      </td>
                    </tr>
                  ) : displayedTickets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
                        No support tickets found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    displayedTickets.map((t) => {
                      const isAssignedToMe = Boolean(
                        (currentUserId && String(t.assigned_to) === String(currentUserId)) ||
                        (currentUser?.username && t.assigned_username?.toLowerCase() === currentUser.username.toLowerCase())
                      );

                      return (
                        <tr
                          key={t.ticket_id}
                          className={`transition-colors ${
                            isAssignedToMe
                              ? 'bg-blue-50/40 dark:bg-blue-950/20 border-l-4 border-l-blue-600 hover:bg-blue-50/70 dark:hover:bg-blue-900/30'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-700/30'
                          }`}
                        >
                          {/* Ticket ID */}
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                              #TKT-{t.ticket_id}
                            </span>
                          </td>

                          {/* Customer Info */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {t.customer_name || 'Subscriber'}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              <span className="font-mono font-medium">{t.customer_code}</span>
                              <span>•</span>
                              <span>{t.customer_phone}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              {t.reseller_name || t.reseller_username ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/60 px-1.5 py-0.5 rounded">
                                  Reseller: {t.reseller_name || t.reseller_username}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                  Direct Office
                                </span>
                              )}
                            </div>
                            {t.installation_address && (
                              <div className="text-[11px] text-slate-400 truncate max-w-[180px] mt-0.5">
                                {t.installation_address}
                              </div>
                            )}
                          </td>

                          {/* Title & Desc */}
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-medium text-slate-900 dark:text-white truncate">
                              {t.title}
                            </div>
                            {t.description && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                {t.description}
                              </div>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-md uppercase tracking-wider ${
                                t.priority === 'critical'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                  : t.priority === 'high'
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                                  : t.priority === 'medium'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {t.priority}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${
                                t.status === 'open'
                                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200'
                                  : t.status === 'in_progress'
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200'
                                  : t.status === 'resolved'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  t.status === 'open'
                                    ? 'bg-rose-500'
                                    : t.status === 'in_progress'
                                    ? 'bg-amber-500 animate-pulse'
                                    : t.status === 'resolved'
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-400'
                                }`}
                              />
                              <span className="capitalize">{t.status.replace('_', ' ')}</span>
                            </span>
                          </td>

                          {/* Assigned To & Forwarding */}
                          <td className="py-3 px-4 text-xs">
                            <div className="space-y-1.5 min-w-[150px]">
                              {isAssignedToMe ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Assigned to You
                                </span>
                              ) : t.assigned_username || t.assigned_first_name ? (
                                <span className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">
                                  <Users className="w-3 h-3 text-slate-400" />
                                  {t.assigned_first_name
                                    ? `${t.assigned_first_name} ${t.assigned_last_name || ''}`
                                    : t.assigned_username}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAssignToMe(t.ticket_id)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/80 transition-colors"
                                  title="Take ownership of this ticket"
                                >
                                  <UserPlus className="w-3 h-3" />
                                  Claim Ticket
                                </button>
                              )}

                              {/* Forward Selector */}
                              <div>
                                <select
                                  value={t.assigned_to || ''}
                                  onChange={(e) =>
                                    handleForwardTicket(t.ticket_id, e.target.value ? Number(e.target.value) : 0)
                                  }
                                  className="text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer w-full max-w-[140px]"
                                  title="Forward or assign to technician"
                                >
                                  <option value="">↳ Forward to...</option>
                                  {staffList.map((s) => (
                                    <option key={s.userId} value={s.userId}>
                                      {s.name} ({s.username})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </td>

                          {/* Created Date */}
                          <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                            {new Date(t.created_at).toLocaleDateString()}
                          </td>

                        {/* Action Quick Status Dropdown */}
                        <td className="py-3 px-4 text-right">
                          <select
                            value={t.status}
                            onChange={(e) => handleStatusChange(t.ticket_id, e.target.value)}
                            className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: SUPPORT NUMBERS TAB
         ========================================================================= */}
      {activeTab === 'numbers' && (
        <div className="space-y-6">
          {/* Main Support Hotline Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" />
                <span>Primary ISP Support Hotline</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                This number is printed on invoice receipts, sent in SMS notifications, and displayed on the customer portal.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 max-w-md">
              <input
                type="text"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="+880 1700-000000"
                className="flex-1 px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleSaveSupportDirectory}
                disabled={isSavingNumbers}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all disabled:opacity-50"
              >
                Save Phone
              </button>
            </div>
          </div>

          {/* Directory Grid */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-emerald-600" />
                  <span>Support Contacts & Department Directory</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Internal and customer-facing helpline lines for NOC, field engineers, and billing inquiries.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveSupportDirectory}
                disabled={isSavingNumbers}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                Save Directory Changes
              </button>
            </div>

            {/* Directory Cards */}
            {isNumbersLoading ? (
              <div className="py-8 text-center text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-blue-600" />
                Loading helpline directory...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {directory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 relative group space-y-2"
                  >
                    <button
                      type="button"
                      onClick={() => handleRemoveDirectoryEntry(idx)}
                      className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 transition-colors p-1"
                      title="Remove Entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="font-semibold text-sm text-slate-900 dark:text-white pr-6">
                      {item.title}
                    </div>
                    <div className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{item.number}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{item.hours}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Line Form */}
            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/20 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Add New Helpline / Staff Contact
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Desk Title (e.g. NOC Fiber Team)"
                  value={newEntryTitle}
                  onChange={(e) => setNewEntryTitle(e.target.value)}
                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Phone Number (e.g. 01700...)"
                  value={newEntryNumber}
                  onChange={(e) => setNewEntryNumber(e.target.value)}
                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Support Hours (e.g. 9 AM - 9 PM)"
                  value={newEntryHours}
                  onChange={(e) => setNewEntryHours(e.target.value)}
                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddDirectoryEntry}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to List
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* =========================================================================
          MODAL: CREATE NEW SUPPORT TICKET
         ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-blue-600" />
                <span>Open New Support Ticket</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicketSubmit} className="space-y-4">
              {/* Customer Selector */}
              <div className="space-y-1.5 relative">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Select Subscriber <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Type customer name, code or phone..."
                  value={custSearchQuery}
                  onChange={(e) => {
                    setCustSearchQuery(e.target.value);
                    if (selectedCustomer) setSelectedCustomer(null);
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                />

                {/* Dropdown Options */}
                {custSearchResults.length > 0 && !selectedCustomer && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {custSearchResults.map((c) => (
                      <button
                        key={c.customerId}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustSearchResults([]);
                          setCustSearchQuery(`${c.fullName} (${c.customerCode})`);
                        }}
                        className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-xs"
                      >
                        <div className="font-semibold text-slate-900 dark:text-white">{c.fullName}</div>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                          {c.customerCode} • {c.phone}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedCustomer && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Selected: {selectedCustomer.fullName} [{selectedCustomer.customerCode}]</span>
                  </div>
                )}
              </div>

              {/* Priority & Issue Presets */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Priority Level
                  </label>
                  <select
                    value={newTicketPriority}
                    onChange={(e: any) => setNewTicketPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical / Urgent</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Quick Preset
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) setNewTicketTitle(e.target.value);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="">Select an issue preset...</option>
                    <option value="Fiber Cut / Red LOS Blinking">Fiber Cut / Red LOS Blinking</option>
                    <option value="Slow Speed / Packet Loss">Slow Speed / Packet Loss</option>
                    <option value="Router Configuration Reset">Router Configuration Reset</option>
                    <option value="Billing / Payment Verification">Billing / Payment Verification</option>
                    <option value="ONU Power / Low Signal Issue">ONU Power / Low Signal Issue</option>
                  </select>
                </div>
              </div>

              {/* Assign to Staff / Technician */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Assign NOC Engineer / Field Technician
                </label>
                <select
                  value={newTicketAssignedTo || ''}
                  onChange={(e) => setNewTicketAssignedTo(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="">Unassigned (Open for NOC team)</option>
                  {staffList.map((s) => (
                    <option key={s.userId} value={s.userId}>
                      {s.name} ({s.username})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Issue Title / Subject <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Red light blinking on ONU since morning"
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Detailed Notes / Symptoms
                </label>
                <textarea
                  rows={3}
                  placeholder="Add details about optical power, technician assignment, or notes..."
                  value={newTicketDesc}
                  onChange={(e) => setNewTicketDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTicket}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:opacity-50"
                >
                  {isSubmittingTicket ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
