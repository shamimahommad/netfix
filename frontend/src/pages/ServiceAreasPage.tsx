import { useEffect, useMemo, useState } from 'react';
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
  ChevronRight,
} from 'lucide-react';
import { serviceAreaService } from '@/services/service-area.service';
import { ServiceArea } from '@/types/service-area.types';
import { useToastContext } from '@/contexts/ToastContext';
import { PageHeader } from '@/components/common';

const stagger = { animate: { transition: { staggerChildren: 0.04 } } };
const itemUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

function formatDate(s: string): string {
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
  const toast = useToastContext();
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceArea | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [search, setSearch] = useState('');

  const filteredAreas = useMemo(() => {
    if (!search.trim()) return areas;
    const q = search.trim().toLowerCase();
    return areas.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q))
    );
  }, [areas, search]);

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
        'Failed to load areas';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await serviceAreaService.updateArea(editing.serviceAreaId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        });
        toast.success('Area updated');
      } else {
        await serviceAreaService.createArea({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        });
        toast.success('Area created');
      }
      setIsModalOpen(false);
      resetForm();
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to save area';
      toast.error(msg);
    }
  };

  const handleDelete = async (area: ServiceArea) => {
    if (!confirm(`Delete area "${area.name}"?`)) return;
    try {
      await serviceAreaService.deleteArea(area.serviceAreaId);
      toast.success('Area deleted');
      load();
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
        subtitle="Define geographical distribution boundaries and client zones"
        badge={`${areas.length} Areas`}
        actions={
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Area
          </button>
        }
      />

        {/* Error */}
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

        {/* Areas list */}
        <motion.section
          variants={stagger}
          initial="initial"
          animate="animate"
          className="rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 shadow-xl overflow-hidden"
        >
          <div className="p-5 border-b border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2 shrink-0">
              <Layers className="w-4 h-4" />
              All Areas
            </h2>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or description..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
          </div>
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              {loading ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                  <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin mb-4" />
                  <p className="text-sm font-medium">Loading areas...</p>
                </div>
              ) : filteredAreas.length === 0 ? (
                <motion.div
                  variants={itemUp}
                  className="p-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400"
                >
                  <MapPin className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-sm font-medium">
                    {areas.length === 0 ? 'No areas yet' : 'No matching areas'}
                  </p>
                  <p className="text-xs mt-1">
                    {areas.length === 0 ? 'Add your first service area' : 'Try a different search'}
                  </p>
                  {areas.length === 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      resetForm();
                      setIsModalOpen(true);
                    }}
                    className="mt-4 px-5 py-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium text-sm"
                  >
                    Add Area
                  </motion.button>
                  )}
                </motion.div>
              ) : (
                <motion.ul
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                  className="divide-y divide-slate-200/80 dark:divide-slate-700/80"
                >
                  <AnimatePresence>
                    {filteredAreas.map((area, index) => (
                      <motion.li
                        key={area.serviceAreaId}
                        variants={itemUp}
                        initial="initial"
                        animate="animate"
                        exit={{ opacity: 0, x: -20 }}
                        className="group flex items-center gap-4 p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
                          style={{
                            background: `linear-gradient(135deg, ${CHART_COLORS[index % CHART_COLORS.length]}, ${CHART_COLORS[(index + 1) % CHART_COLORS.length]})`,
                          }}
                        >
                          {area.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {area.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {area.description && (
                              <span className="flex items-center gap-1 truncate max-w-[200px]">
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                {area.description}
                              </span>
                            )}
                            <span className="flex items-center gap-1 shrink-0">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(area.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <motion.button
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => {
                              setEditing(area);
                              setForm({ name: area.name, description: area.description || '' });
                              setIsModalOpen(true);
                            }}
                            className="p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => handleDelete(area)}
                            className="p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </div>
        </motion.section>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setIsModalOpen(false);
              resetForm();
            }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {editing ? 'Edit Area' : 'Add Area'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {editing ? 'Update area details' : 'Create a new service area'}
                </p>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    placeholder="e.g. North Zone"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm hover:shadow transition-all active:scale-95"
                  >
                    {editing ? 'Update' : 'Create'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
