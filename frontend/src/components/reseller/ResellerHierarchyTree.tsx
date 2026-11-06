import React, { useState, useEffect } from 'react';
import {
  Users,
  ChevronRight,
  ChevronDown,
  UserCheck,
  UserPlus,
  Wallet,
  Shield,
  Layers,
  Sparkles,
  RotateCw,
  ExternalLink,
  DollarSign,
  TrendingUp,
  Package,
  Eye,
  ArrowRight,
  Plus,
} from 'lucide-react';
import {
  resellerService,
  HierarchyTreeNode,
  HierarchyUserNode,
} from '@/services/reseller.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useToastContext } from '@/contexts/ToastContext';
import { PackagePricingMatrix } from './PackagePricingMatrix';

const ROLE_META: Record<string, { label: string; badgeClass: string; level: number }> = {
  admin: { label: 'ISP Admin', badgeClass: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300', level: 0 },
  isp_admin: { label: 'ISP Admin', badgeClass: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300', level: 0 },
  manager: { label: 'Manager', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300', level: 0 },
  reseller: { label: 'Reseller', badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300', level: 1 },
  sub_reseller: { label: 'Sub-Reseller', badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', level: 2 },
  dealer: { label: 'Dealer', badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300', level: 3 },
  agent: { label: 'Agent', badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', level: 4 },
};

interface TreeNodeItemProps {
  node: HierarchyTreeNode;
  onOpenPricing: (user: HierarchyTreeNode) => void;
  onAddChild: (parent: HierarchyTreeNode) => void;
  canManageSubTier: boolean;
  canAssignPackage: boolean;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  onOpenPricing,
  onAddChild,
  canManageSubTier,
  canAssignPackage,
}) => {
  const [expanded, setExpanded] = useState(true);
  const children = node.children || [];
  const hasChildren = children.length > 0;

  const roleKey = (node.role || '').toLowerCase();
  const meta = ROLE_META[roleKey] || {
    label: node.role,
    badgeClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    level: node.role_level || 50,
  };

  const formatCurrency = (n: number) =>
    `৳${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const canHaveDownline = meta.level < 4; // Level 4 Agent cannot have children

  return (
    <div className="relative pl-6 before:absolute before:left-2.5 before:top-4 before:bottom-0 before:w-px before:bg-slate-200 dark:before:bg-slate-800 last:before:hidden">
      <div className="py-2">
        <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm hover:shadow transition-shadow flex flex-wrap items-center justify-between gap-3">
          {/* Left: User identity & path */}
          <div className="flex items-center gap-3 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {node.first_name} {node.last_name}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  (@{node.username})
                </span>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${meta.badgeClass}`}>
                  Level {meta.level} • {meta.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                <span>Path: {node.hierarchy_path}</span>
                {node.phone && <span>Tel: {node.phone}</span>}
              </div>
            </div>
          </div>

          {/* Right: Balance & Action Controls */}
          <div className="flex items-center gap-3">
            {/* Wallet Balance Badge */}
            <div className="text-right">
              <span className="text-[10px] uppercase text-slate-400 block font-semibold">Wallet</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatCurrency(node.wallet_balance || 0)}
              </span>
            </div>

            {/* Downline Count */}
            {hasChildren && (
              <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                {children.length} {children.length === 1 ? 'Downline' : 'Downlines'}
              </span>
            )}

            {/* Actions (Defensive UI: Automatically hidden if unauthorized) */}
            <div className="flex items-center gap-1.5">
              {canAssignPackage && meta.level > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenPricing(node)}
                  title="Configure Package Pricing Matrix & Floor Rules"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors"
                >
                  <Package className="w-3.5 h-3.5" /> Pricing
                </button>
              )}

              {canManageSubTier && canHaveDownline && (
                <button
                  type="button"
                  onClick={() => onAddChild(node)}
                  title="Add Direct Downline User"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Downline
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Children Subtrees */}
        {expanded && hasChildren && (
          <div className="mt-1">
            {children.map((child) => (
              <TreeNodeItem
                key={child.user_id}
                node={child}
                onOpenPricing={onOpenPricing}
                onAddChild={onAddChild}
                canManageSubTier={canManageSubTier}
                canAssignPackage={canAssignPackage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const ResellerHierarchyTree: React.FC = () => {
  const toast = useToastContext();
  const permissions = usePermissions();
  const [treeData, setTreeData] = useState<HierarchyTreeNode | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [activePricingUser, setActivePricingUser] = useState<HierarchyTreeNode | null>(null);
  const [activeParentUser, setActiveParentUser] = useState<HierarchyTreeNode | null>(null);

  // New Downline Form state
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTree = async () => {
    try {
      setLoading(true);
      const res = await resellerService.getHierarchy();
      setTreeData(res.tree || null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to load reseller hierarchy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  const handleCreateDownline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername || !formPassword || !formName) {
      toast.error('Username, password, and name are required.');
      return;
    }

    try {
      setSubmitting(true);
      await resellerService.createDownline({
        username: formUsername,
        password: formPassword,
        first_name: formName,
        phone: formPhone,
        notes: formNotes,
      });
      toast.success('Downline tier user created successfully.');
      setActiveParentUser(null);
      setFormUsername('');
      setFormPassword('');
      setFormName('');
      setFormPhone('');
      setFormNotes('');
      loadTree();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to create downline');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400">
        <RotateCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
        <p className="text-sm font-medium">Loading multi-tier tree and materialized paths...</p>
      </div>
    );
  }

  if (!treeData) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No downline hierarchy found for current account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hierarchy Overview Header */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> Multi-Tier Reseller Downline Hierarchy
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Strict Chain: Level 0 (ISP Admin) → Level 1 (Reseller) → Level 2 (Sub-Reseller) → Level 3 (Dealer) → Level 4 (Agent).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTree}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh Hierarchy Tree"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Tree View */}
      <div className="p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
        <TreeNodeItem
          node={treeData}
          onOpenPricing={(user) => setActivePricingUser(user)}
          onAddChild={(parent) => setActiveParentUser(parent)}
          canManageSubTier={permissions.canManageSubTier}
          canAssignPackage={permissions.canAssignPackage}
        />
      </div>

      {/* Package Pricing Matrix Modal */}
      {activePricingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Package Pricing & Price Floor Matrix
              </h3>
              <button
                type="button"
                onClick={() => setActivePricingUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            <PackagePricingMatrix
              childUserId={activePricingUser.user_id}
              childName={`${activePricingUser.first_name} ${activePricingUser.last_name}`}
              childRole={activePricingUser.role}
              onSuccess={() => {
                setActivePricingUser(null);
                loadTree();
              }}
              onCancel={() => setActivePricingUser(null)}
            />
          </div>
        </div>
      )}

      {/* Create Downline Modal */}
      {activeParentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Add Direct Downline User
              </h3>
              <button
                type="button"
                onClick={() => setActiveParentUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDownline} className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-800 dark:text-blue-300">
                Creating child under parent: <span className="font-bold">{activeParentUser.first_name} (@{activeParentUser.username})</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Arif Hossain"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="e.g. arif_dealer"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveParentUser(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white shadow-sm transition-colors"
                >
                  {submitting ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" /> Creating...
                    </>
                  ) : (
                    'Create Downline'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
