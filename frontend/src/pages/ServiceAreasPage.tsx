import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  Search,
  Calendar,
  FileText,
  Layers,
  Users,
  CheckCircle2,
  Clock,
  UserX,
  Wifi,
  Radio,
  Gift,
  Crown,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { serviceAreaService } from '@/services/service-area.service';
import { ServiceArea } from '@/types/service-area.types';
import { useToastContext } from '@/contexts/ToastContext';
import { PageHeader, MetricCard } from '@/components/common';

const stagger = { animate: { transition: { staggerChildren: 0.04 } } };
const itemUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

function formatDate(s?: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function ServiceAreasPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceArea | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await serviceAreaService.listAreas();
      setAreas(res.data || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to load service areas';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
  };

  const filteredAreas = useMemo(() => {
    if (!search.trim()) return areas;
    const q = search.trim().toLowerCase();
    return areas.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q))
    );
  }, [areas, search]);

  // Aggregate metrics
  const totals = useMemo(() => {
    return areas.reduce(
      (acc, a) => {
        acc.total += a.totalUsers || 0;
        acc.active += a.activeUsers || 0;
        acc.expired += a.expiredUsers || 0;
        acc.left += a.leftUsers || 0;
        acc.pending += a.pendingUsers || 0;
        acc.pppoe += a.pppoeUsers || 0;
        acc.hotspot += a.hotspotUsers || 0;
        acc.free += a.freeUsers || 0;
        acc.vip += a.vipUsers || 0;
        return acc;
      },
      {
        total: 0,
        active: 0,
        expired: 0,
        left: 0,
        pending: 0,
        pppoe: 0,
        hotspot: 0,
        free: 0,
        vip: 0,
      }
    );
  }, [areas]);

  const configuredAreasCount = useMemo(() => {
    return areas.filter((a) => !a.isUnassigned).length;
  }, [areas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Area name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const areaId = editing?.serviceAreaId || editing?.id;
      if (editing && areaId) {
        await serviceAreaService.updateArea(areaId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        });
        toast.success('Service area updated successfully');
      } else {
        await serviceAreaService.createArea({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        });
        toast.success('Service area created successfully');
      }
      setIsModalOpen(false);
      resetForm();
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to save service area';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (area: ServiceArea) => {
    const areaId = area.serviceAreaId || area.id;
    if (!areaId || area.isUnassigned) return;

    if ((area.totalUsers || 0) > 0) {
      if (!confirm(`Warning: Area "${area.name}" currently has ${area.totalUsers} registered users. Deleting this area may affect user assignments. Are you sure you want to delete it?`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete area "${area.name}"?`)) {
        return;
      }
    }

    try {
      await serviceAreaService.deleteArea(areaId);
      toast.success('Area deleted successfully');
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to delete area';
      toast.error(msg);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <PageHeader
        icon={<MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="Service Areas"
        subtitle="Manage geographical coverage zones and view comprehensive client breakdowns"
        badge={`${configuredAreasCount} Areas`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh statistics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add Area
            </button>
          </div>
        }
      />

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50"
          >
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <MetricCard
          title="Total Areas"
          value={configuredAreasCount}
          subtext="Configured zones"
          icon={<MapPin className="w-4 h-4" />}
          variant="blue"
        />
        <MetricCard
          title="Total Users"
          value={totals.total.toLocaleString()}
          subtext="All subscribers"
          icon={<Users className="w-4 h-4" />}
          variant="indigo"
          onClick={() => navigate('/dashboard/customers/all')}
        />
        <MetricCard
          title="Active Lines"
          value={totals.active.toLocaleString()}
          subtext="Online & paid"
          icon={<CheckCircle2 className="w-4 h-4" />}
          variant="emerald"
          onClick={() => navigate('/dashboard/customers/all?status=active')}
        />
        <MetricCard
          title="Expired / Left"
          value={`${totals.expired} / ${totals.left}`}
          subtext="Overdue or cancelled"
          icon={<Clock className="w-4 h-4" />}
          variant="rose"
          onClick={() => navigate('/dashboard/customers/all?billingStatus=Expired')}
        />
        <MetricCard
          title="PPPoE / Hotspot"
          value={`${totals.pppoe} / ${totals.hotspot}`}
          subtext="Protocol distribution"
          icon={<Wifi className="w-4 h-4" />}
          variant="cyan"
        />
        <MetricCard
          title="Free / VIP"
          value={`${totals.free} / ${totals.vip}`}
          subtext="Special accounts"
          icon={<Crown className="w-4 h-4" />}
          variant="purple"
        />
      </div>

      {/* Main List Section */}
      <motion.section
        variants={stagger}
        initial="initial"
        animate="animate"
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        {/* Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              Area Breakdown List
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
              {filteredAreas.length} {filteredAreas.length === 1 ? 'Area' : 'Areas'}
            </span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by area name or description..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-xs outline-none"
            />
          </div>
        </div>

        {/* Areas Table / List */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
              <div className="w-9 h-9 border-2 border-blue-500/30 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium">Loading service areas & client metrics...</p>
            </div>
          ) : filteredAreas.length === 0 ? (
            <motion.div
              variants={itemUp}
              className="p-16 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400"
            >
              <MapPin className="w-14 h-14 mb-3 opacity-30 text-blue-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {areas.length === 0 ? 'No service areas found' : 'No matching service areas'}
              </p>
              <p className="text-xs mt-1 text-slate-400">
                {areas.length === 0 ? 'Create your first service area to organize clients by zone.' : 'Try adjusting your search criteria.'}
              </p>
              {areas.length === 0 && (
                <button
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(true);
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5 inline-block mr-1.5" />
                  Add Service Area
                </button>
              )}
            </motion.div>
          ) : (
            <table className="w-full min-w-[980px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Area / Zone</th>
                  <th className="py-3 px-3 text-center">Total Users</th>
                  <th className="py-3 px-3 text-center">Active</th>
                  <th className="py-3 px-3 text-center">Expired</th>
                  <th className="py-3 px-3 text-center">Left</th>
                  <th className="py-3 px-3 text-center">PPPoE</th>
                  <th className="py-3 px-3 text-center">Hotspot</th>
                  <th className="py-3 px-3 text-center">Free Line</th>
                  <th className="py-3 px-3 text-center">VIP</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredAreas.map((area, index) => {
                  const areaId = area.serviceAreaId || area.id;
                  const total = area.totalUsers || 0;
                  const active = area.activeUsers || 0;
                  const expired = area.expiredUsers || 0;
                  const left = area.leftUsers || 0;
                  const pppoe = area.pppoeUsers || 0;
                  const hotspot = area.hotspotUsers || 0;
                  const free = area.freeUsers || 0;
                  const vip = area.vipUsers || 0;

                  return (
                    <motion.tr
                      key={areaId || `area-${index}`}
                      variants={itemUp}
                      className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Area Name & Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-sm"
                            style={{
                              background: area.isUnassigned
                                ? 'linear-gradient(135deg, #64748b, #475569)'
                                : `linear-gradient(135deg, ${CHART_COLORS[index % CHART_COLORS.length]}, ${CHART_COLORS[(index + 1) % CHART_COLORS.length]})`,
                            }}
                          >
                            {area.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">
                                {area.name}
                              </span>
                              {area.isUnassigned && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                              {area.description ? (
                                <span className="flex items-center gap-1 truncate max-w-[220px]" title={area.description}>
                                  <FileText className="w-3 h-3 shrink-0" />
                                  {area.description}
                                </span>
                              ) : (
                                <span>No description</span>
                              )}
                              {area.createdAt && (
                                <span className="flex items-center gap-1 shrink-0">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(area.createdAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Total Users */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => navigate(`/dashboard/customers/all?area=${encodeURIComponent(area.name)}`)}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-blue-700 dark:text-blue-400 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all cursor-pointer"
                          title={`View all ${total} clients in ${area.name}`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{total}</span>
                        </button>
                      </td>

                      {/* Active Users */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => navigate(`/dashboard/customers/all?area=${encodeURIComponent(area.name)}&status=active`)}
                          className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                            active > 0
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/40 text-slate-400'
                          }`}
                          title={`View ${active} active clients in ${area.name}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${active > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          <span>{active}</span>
                        </button>
                      </td>

                      {/* Expired Users */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => navigate(`/dashboard/customers/all?area=${encodeURIComponent(area.name)}&billingStatus=Expired`)}
                          className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                            expired > 0
                              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/40 text-slate-400'
                          }`}
                          title={`View ${expired} expired clients in ${area.name}`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{expired}</span>
                        </button>
                      </td>

                      {/* Left / Terminated Users */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => navigate(`/dashboard/customers/all?area=${encodeURIComponent(area.name)}&status=terminated`)}
                          className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                            left > 0
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/40 text-slate-400'
                          }`}
                          title={`View ${left} left/cancelled clients in ${area.name}`}
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>{left}</span>
                        </button>
                      </td>

                      {/* PPPoE */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border font-medium ${
                            pppoe > 0
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/60 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-400'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/40 text-slate-400'
                          }`}
                        >
                          <Wifi className="w-3.5 h-3.5" />
                          <span>{pppoe}</span>
                        </span>
                      </td>

                      {/* Hotspot */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border font-medium ${
                            hotspot > 0
                              ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200/60 dark:border-orange-900/40 text-orange-700 dark:text-orange-400'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/40 text-slate-400'
                          }`}
                        >
                          <Radio className="w-3.5 h-3.5" />
                          <span>{hotspot}</span>
                        </span>
                      </td>

                      {/* Free Line */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border font-medium ${
                            free > 0
                              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200/60 dark:border-teal-900/40 text-teal-700 dark:text-teal-400 font-semibold'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/40 text-slate-400'
                          }`}
                        >
                          <Gift className="w-3.5 h-3.5" />
                          <span>{free}</span>
                        </span>
                      </td>

                      {/* VIP */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border font-medium ${
                            vip > 0
                              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200/60 dark:border-purple-900/40 text-purple-700 dark:text-purple-400 font-semibold'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/40 text-slate-400'
                          }`}
                        >
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          <span>{vip}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/dashboard/customers/all?area=${encodeURIComponent(area.name)}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="View clients in this area"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Clients</span>
                          </button>

                          {!area.isUnassigned && (
                            <>
                              <button
                                onClick={() => {
                                  setEditing(area);
                                  setForm({ name: area.name, description: area.description || '' });
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                                title="Edit area"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(area)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                title="Delete area"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </motion.section>

      {/* Modal for Add / Edit Area */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isSubmitting) {
                setIsModalOpen(false);
                resetForm();
              }
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    {editing ? 'Edit Service Area' : 'Add Service Area'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {editing ? 'Update area details and boundary coverage' : 'Define a new geographical coverage area'}
                  </p>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Area Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm outline-none"
                    placeholder="e.g. Kutubpur, Mirpur Sector 10"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Description / Coverage Notes
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm outline-none resize-none"
                    rows={3}
                    placeholder="Optional coverage notes, landmarks, or notes for field technicians..."
                  />
                </div>
                <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {editing ? 'Update Area' : 'Create Area'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
