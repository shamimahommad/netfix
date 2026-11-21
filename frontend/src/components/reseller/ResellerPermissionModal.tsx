import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Shield,
  CheckCircle2,
  Lock,
  Layers,
  Users,
  CreditCard,
  Eye,
  Sliders,
  Settings,
  RefreshCw,
  Check,
} from 'lucide-react';
import {
  resellerService,
  Reseller,
  PermissionItem,
} from '@/services/reseller.service';
import { useToastContext } from '@/contexts/ToastContext';

interface ResellerPermissionModalProps {
  user: Reseller;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  pppoe: {
    label: 'PPPoE Access',
    icon: <Sliders className="w-4 h-4" />,
    color: 'from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  },
  customers: {
    label: 'Customers & Subscribers',
    icon: <Users className="w-4 h-4" />,
    color: 'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  },
  billing: {
    label: 'Billing & Invoicing',
    icon: <CreditCard className="w-4 h-4" />,
    color: 'from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
  reseller: {
    label: 'Downline & Resellers',
    icon: <Layers className="w-4 h-4" />,
    color: 'from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  },
  visibility: {
    label: 'Privacy & Hiding',
    icon: <Eye className="w-4 h-4" />,
    color: 'from-rose-500/10 to-red-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  },
  system: {
    label: 'System & Tools',
    icon: <Settings className="w-4 h-4" />,
    color: 'from-slate-500/10 to-gray-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
  },
};

export const ResellerPermissionModal: React.FC<ResellerPermissionModalProps> = ({
  user,
  onClose,
  onSuccess,
}) => {
  const toast = useToastContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [grantedIds, setGrantedIds] = useState<Set<number>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load permissions for this user
  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await resellerService.getPermissions(user.userId);
        if (!isMounted) return;
        const list = res.permissions || [];
        setPermissions(list);
        const grantedSet = new Set<number>();
        list.forEach((p) => {
          if (p.granted) grantedSet.add(p.permission_id);
        });
        setGrantedIds(grantedSet);
      } catch (err: any) {
        if (!isMounted) return;
        toast.error(err?.message || 'Failed to load permissions');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [user.userId]);

  // Toggle single permission
  const handleToggle = (id: number) => {
    setGrantedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Categories list
  const categories = useMemo(() => {
    const cats = Array.from(new Set(permissions.map((p) => p.category)));
    return cats;
  }, [permissions]);

  // Filtered permissions
  const filteredPermissions = useMemo(() => {
    return permissions.filter((p) => {
      const matchesCat =
        selectedCategory === 'all' || p.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.permission_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [permissions, selectedCategory, searchQuery]);

  // Select / Deselect for visible items
  const handleToggleAllVisible = (enable: boolean) => {
    setGrantedIds((prev) => {
      const next = new Set(prev);
      filteredPermissions.forEach((p) => {
        if (enable) {
          next.add(p.permission_id);
        } else {
          next.delete(p.permission_id);
        }
      });
      return next;
    });
  };

  // Save changes
  const handleSave = async () => {
    try {
      setSaving(true);
      await resellerService.updatePermissions(
        user.userId,
        Array.from(grantedIds)
      );
      toast.success('Permissions updated successfully');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const totalGranted = grantedIds.size;
  const totalCount = permissions.length;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg shadow-sm">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Permission Management
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                    {user.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure feature and operational access for{' '}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {user.name}
                  </strong>{' '}
                  (@{user.username})
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Stats & Controls Bar */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {totalGranted} of {totalCount} Granted
              </span>
              <span className="text-xs text-slate-400">
                ({Math.round(totalCount > 0 ? (totalGranted / totalCount) * 100 : 0)}% access)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToggleAllVisible(true)}
                disabled={loading || saving}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Enable Visible
              </button>
              <button
                type="button"
                onClick={() => handleToggleAllVisible(false)}
                disabled={loading || saving}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Disable Visible
              </button>
            </div>
          </div>
        </div>

        {/* Category Navigation & Search */}
        <div className="shrink-0 px-6 py-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700'
              }`}
            >
              All ({permissions.length})
            </button>
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat] || {
                label: cat.toUpperCase(),
                icon: <Lock className="w-3.5 h-3.5" />,
              };
              const count = permissions.filter((p) => p.category === cat).length;
              const grantedInCat = permissions.filter(
                (p) => p.category === cat && grantedIds.has(p.permission_id)
              ).length;
              const isSelected = selectedCategory === cat;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {meta.icon}
                  <span>{meta.label}</span>
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {grantedInCat}/{count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="w-full sm:w-56">
            <input
              type="text"
              placeholder="Filter permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
              <p className="text-sm font-medium">Loading permissions configuration...</p>
            </div>
          ) : filteredPermissions.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Shield className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-medium">No matching permissions found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredPermissions.map((p) => {
                const isGranted = grantedIds.has(p.permission_id);
                const meta = CATEGORY_META[p.category] || {
                  label: p.category,
                  color: 'border-slate-200 dark:border-slate-800',
                };

                return (
                  <div
                    key={p.permission_id}
                    onClick={() => handleToggle(p.permission_id)}
                    className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3 ${
                      isGranted
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-500/70 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    {/* Modern Checkbox / Toggle button */}
                    <div className="pt-0.5">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                          isGranted
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'border-2 border-slate-300 dark:border-slate-600 group-hover:border-slate-400 dark:group-hover:border-slate-500 bg-transparent'
                        }`}
                      >
                        {isGranted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {p.permission_code}
                        </span>
                      </div>
                      {p.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Changes will take effect immediately upon saving.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-md hover:shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Permissions'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
