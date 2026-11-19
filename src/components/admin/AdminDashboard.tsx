import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Edit3,
  LogOut,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trophy,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { formatIndianClassLabel } from '../../types/math';
import {
  AgentProfile,
  ComputedSubscriptionState,
  PAYMENT_METHOD_LABELS,
  evaluateSubscriptionState,
  formatCurrency,
  formatIsoDate,
} from '../../types/platform';

type AdminTab = 'agents' | 'subscriptions' | 'leaderboard';
type SubFilter = 'all' | ComputedSubscriptionState;

interface AgentFormState {
  agentCode: string;
  name: string;
  phone: string;
  email: string;
  assignedArea: string;
  commissionRate: string;
  defaultYearlyFee: string;
  passcode: string;
}

const EMPTY_AGENT_FORM: AgentFormState = {
  agentCode: '',
  name: '',
  phone: '',
  email: '',
  assignedArea: '',
  commissionRate: '15',
  defaultYearlyFee: '1200',
  passcode: '',
};

export const AdminDashboard: React.FC = () => {
  const {
    agents,
    parents,
    children,
    subscriptions,
    roleSession,
    logoutRole,
    createAgent,
    updateAgent,
    toggleAgentActive,
    adminOverrideSubscription,
    getAgentById,
    getChildrenForParent,
    getLatestSubscriptionForParent,
    getSubscriptionHistoryForParent,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<AdminTab>('agents');
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState<AgentFormState>(EMPTY_AGENT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [savingAgent, setSavingAgent] = useState(false);

  const [agentQuery, setAgentQuery] = useState('');
  const [subFilter, setSubFilter] = useState<SubFilter>('all');
  const [subQuery, setSubQuery] = useState('');
  const [overrideNotice, setOverrideNotice] = useState<string | null>(null);
  const [busyParentId, setBusyParentId] = useState<string | null>(null);

  // Platform Analytics
  const analytics = useMemo(() => {
    let activeYearlyPlans = 0;
    let expiringSoonPlans = 0;
    let expiredOrSuspendedPlans = 0;

    for (const parent of parents) {
      const latest = getLatestSubscriptionForParent(parent.id);
      const evalState = evaluateSubscriptionState(latest);
      if (evalState.state === 'active') activeYearlyPlans += 1;
      else if (evalState.state === 'expiring_soon') {
        activeYearlyPlans += 1;
        expiringSoonPlans += 1;
      } else {
        expiredOrSuspendedPlans += 1;
      }
    }

    const totalRevenue = subscriptions.reduce((sum, s) => sum + s.feeAmount, 0);
    const activeAgentsCount = agents.filter((a) => a.isActive).length;

    return {
      totalParents: parents.length,
      totalChildren: children.length,
      activeYearlyPlans,
      expiringSoonPlans,
      expiredOrSuspendedPlans,
      totalRevenue,
      activeAgentsCount,
    };
  }, [agents, children.length, getLatestSubscriptionForParent, parents, subscriptions]);

  // Agent Performance Metrics (used in both Agent cards and Leaderboard)
  const agentStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        parentsCount: number;
        childrenCount: number;
        activePlans: number;
        feesCollected: number;
        estimatedCommission: number;
      }
    >();

    for (const ag of agents) {
      const agParents = parents.filter((p) => p.createdByAgentId === ag.id);
      const agChildren = children.filter((c) => c.createdByAgentId === ag.id);
      const agSubs = subscriptions.filter((s) => s.collectedByAgentId === ag.id);
      const feesCollected = agSubs.reduce((sum, s) => sum + s.feeAmount, 0);
      const activePlans = agParents.filter((p) => {
        const st = evaluateSubscriptionState(getLatestSubscriptionForParent(p.id));
        return st.canPractice;
      }).length;
      const estimatedCommission = Math.round(
        (feesCollected * ag.commissionRate) / 100
      );

      map.set(ag.id, {
        parentsCount: agParents.length,
        childrenCount: agChildren.length,
        activePlans,
        feesCollected,
        estimatedCommission,
      });
    }
    return map;
  }, [agents, children, getLatestSubscriptionForParent, parents, subscriptions]);

  const filteredAgents = useMemo(() => {
    const q = agentQuery.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.agentCode.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q) ||
        a.assignedArea.toLowerCase().includes(q)
    );
  }, [agentQuery, agents]);

  const parentSubscriptionRows = useMemo(() => {
    const q = subQuery.trim().toLowerCase();
    return parents
      .map((parent) => {
        const latest = getLatestSubscriptionForParent(parent.id);
        const history = getSubscriptionHistoryForParent(parent.id);
        const evalState = evaluateSubscriptionState(latest);
        const linkedChildren = getChildrenForParent(parent.id);
        const agent = getAgentById(parent.createdByAgentId);
        const totalPaid = history.reduce((sum, s) => sum + s.feeAmount, 0);
        return {
          parent,
          latest,
          historyCount: history.length,
          evalState,
          linkedChildren,
          agent,
          totalPaid,
        };
      })
      .filter((row) => {
        if (subFilter !== 'all' && row.evalState.state !== subFilter) return false;
        if (!q) return true;
        return (
          row.parent.name.toLowerCase().includes(q) ||
          row.parent.contact.toLowerCase().includes(q) ||
          (row.agent?.name.toLowerCase().includes(q) ?? false) ||
          row.linkedChildren.some(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.grade.toLowerCase().includes(q)
          )
        );
      });
  }, [
    getAgentById,
    getChildrenForParent,
    getLatestSubscriptionForParent,
    getSubscriptionHistoryForParent,
    parents,
    subFilter,
    subQuery,
  ]);

  const agentLeaderboard = useMemo(() => {
    return [...agents]
      .map((agent) => ({
        agent,
        stats: agentStatsMap.get(agent.id) ?? {
          parentsCount: 0,
          childrenCount: 0,
          activePlans: 0,
          feesCollected: 0,
          estimatedCommission: 0,
        },
      }))
      .sort((a, b) => {
        if (b.stats.feesCollected !== a.stats.feesCollected) {
          return b.stats.feesCollected - a.stats.feesCollected;
        }
        return b.stats.parentsCount - a.stats.parentsCount;
      });
  }, [agentStatsMap, agents]);

  const openCreateForm = () => {
    setEditingAgentId(null);
    setAgentForm({
      ...EMPTY_AGENT_FORM,
      agentCode: `AG${String(agents.length + 1).padStart(2, '0')}`,
    });
    setFormError(null);
    setShowAgentForm(true);
  };

  const openEditForm = (agent: AgentProfile) => {
    setEditingAgentId(agent.id);
    setAgentForm({
      agentCode: agent.agentCode,
      name: agent.name,
      phone: agent.phone,
      email: agent.email,
      assignedArea: agent.assignedArea,
      commissionRate: String(agent.commissionRate),
      defaultYearlyFee: String(agent.defaultYearlyFee),
      passcode: '',
    });
    setFormError(null);
    setShowAgentForm(true);
  };

  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSavingAgent(true);

    if (editingAgentId) {
      const existing = getAgentById(editingAgentId);
      const res = await updateAgent(editingAgentId, {
        agentCode: agentForm.agentCode,
        name: agentForm.name,
        phone: agentForm.phone,
        email: agentForm.email,
        assignedArea: agentForm.assignedArea,
        commissionRate: Number(agentForm.commissionRate) || 0,
        defaultYearlyFee: Number(agentForm.defaultYearlyFee) || 0,
        newPasscode: agentForm.passcode || undefined,
        isActive: existing ? existing.isActive : true,
      });
      setSavingAgent(false);
      if (!res.ok) {
        setFormError(res.error || 'Could not update Agent.');
        return;
      }
      setFormSuccess(`Updated Agent ${agentForm.name}.`);
    } else {
      const res = await createAgent({
        agentCode: agentForm.agentCode,
        name: agentForm.name,
        phone: agentForm.phone,
        email: agentForm.email,
        assignedArea: agentForm.assignedArea,
        commissionRate: Number(agentForm.commissionRate) || 0,
        defaultYearlyFee: Number(agentForm.defaultYearlyFee) || 0,
        passcode: agentForm.passcode,
      });
      setSavingAgent(false);
      if (!res.ok) {
        setFormError(res.error || 'Could not create Agent.');
        return;
      }
      setFormSuccess(
        `Created Agent ${res.agent?.name} (${res.agent?.agentCode}). They can now sign in with Google (${res.agent?.email}) at /agent on any device.`
      );
    }

    setShowAgentForm(false);
    setEditingAgentId(null);
    setAgentForm(EMPTY_AGENT_FORM);
    setTimeout(() => setFormSuccess(null), 5000);
  };

  const handleOverride = async (
    parentId: string,
    parentName: string,
    action: 'activate' | 'extend_year' | 'suspend'
  ) => {
    setBusyParentId(parentId);
    const res = await adminOverrideSubscription(parentId, action);
    setBusyParentId(null);
    if (res.ok) {
      const verb =
        action === 'activate'
          ? 'Activated'
          : action === 'extend_year'
          ? 'Extended by +1 Year'
          : 'Suspended';
      setOverrideNotice(`${verb}: ${parentName}'s yearly subscription.`);
      setTimeout(() => setOverrideNotice(null), 4000);
    } else if (res.error) {
      setOverrideNotice(res.error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Admin Console · {roleSession?.displayName || 'Platform Admin'}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Platform Operations & Subscriptions
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Manage field Agents, monitor yearly plans, and oversee revenue across
            all families.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('agents');
              openCreateForm();
            }}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Add Agent
          </button>
          <button
            type="button"
            onClick={logoutRole}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </div>

      {/* Platform Analytics 4-Card KPI Strip */}
      <section aria-label="Platform Analytics" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Parents
          </span>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
            {analytics.totalParents}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {analytics.activeAgentsCount} active{' '}
            {analytics.activeAgentsCount === 1 ? 'agent' : 'agents'}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Children
          </span>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
            {analytics.totalChildren}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            linked student profiles
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Active Yearly Plans
          </span>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {analytics.activeYearlyPlans}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {analytics.expiringSoonPlans} expiring · {analytics.expiredOrSuspendedPlans} inactive
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Revenue Collected
          </span>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
            {formatCurrency(analytics.totalRevenue)}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {subscriptions.length} yearly{' '}
            {subscriptions.length === 1 ? 'payment' : 'payments'}
          </span>
        </div>
      </section>

      {/* Primary Section Tabs */}
      <div
        role="tablist"
        aria-label="Admin sections"
        className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800"
      >
        {(
          [
            { id: 'agents', label: `Agents (${agents.length})` },
            { id: 'subscriptions', label: `Subscriptions (${parents.length})` },
            { id: 'leaderboard', label: 'Agent Board' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[44px] px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap truncate ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback Banners */}
      {formSuccess && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 flex items-center justify-between gap-3 text-sm text-emerald-800 dark:text-emerald-300">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {formSuccess}
          </span>
          <button
            type="button"
            onClick={() => setFormSuccess(null)}
            aria-label="Dismiss"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {overrideNotice && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 flex items-center justify-between gap-3 text-sm text-blue-900 dark:text-blue-200">
          <span>{overrideNotice}</span>
          <button
            type="button"
            onClick={() => setOverrideNotice(null)}
            aria-label="Dismiss"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: AGENT MANAGEMENT                                               */}
      {/* ===================================================================== */}
      {activeTab === 'agents' && (
        <div className="space-y-5">
          {/* Create / Edit Agent Form Drawer */}
          {showAgentForm && (
            <form
              onSubmit={handleSaveAgent}
              className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5"
            >
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                    {editingAgentId ? 'Edit Field Agent' : 'Create New Field Agent'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Agents sign in at /agent using their registered Google Email
                    for live desktop &amp; mobile Firestore sync.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAgentForm(false);
                    setEditingAgentId(null);
                  }}
                  aria-label="Close form"
                  className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 flex items-center gap-2 text-xs sm:text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Agent Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={agentForm.name}
                    onChange={(e) =>
                      setAgentForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Agent ID / Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={agentForm.agentCode}
                    onChange={(e) =>
                      setAgentForm((f) => ({ ...f, agentCode: e.target.value }))
                    }
                    placeholder="e.g. AG01"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={agentForm.phone}
                    onChange={(e) =>
                      setAgentForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="e.g. 9876543210"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Google Email (for Sign-In) *
                  </label>
                  <input
                    type="email"
                    required
                    value={agentForm.email}
                    onChange={(e) =>
                      setAgentForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="agent@gmail.com"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Assigned Area / Zone
                  </label>
                  <input
                    type="text"
                    value={agentForm.assignedArea}
                    onChange={(e) =>
                      setAgentForm((f) => ({
                        ...f,
                        assignedArea: e.target.value,
                      }))
                    }
                    placeholder="e.g. North Zone / Sector 14"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={agentForm.commissionRate}
                    onChange={(e) =>
                      setAgentForm((f) => ({
                        ...f,
                        commissionRate: e.target.value,
                      }))
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Default Yearly Fee (INR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={agentForm.defaultYearlyFee}
                    onChange={(e) =>
                      setAgentForm((f) => ({
                        ...f,
                        defaultYearlyFee: e.target.value,
                      }))
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2 lg:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {editingAgentId
                      ? 'Reset Passcode (leave blank to keep current)'
                      : 'Login Passcode / PIN *'}
                  </label>
                  <input
                    type="text"
                    required={!editingAgentId}
                    value={agentForm.passcode}
                    onChange={(e) =>
                      setAgentForm((f) => ({ ...f, passcode: e.target.value }))
                    }
                    placeholder={
                      editingAgentId
                        ? 'Leave blank to keep existing passcode'
                        : 'Set passcode for agent sign-in'
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAgentForm(false);
                    setEditingAgentId(null);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAgent}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold"
                >
                  {savingAgent
                    ? 'Saving…'
                    : editingAgentId
                    ? 'Save Agent Changes'
                    : 'Create Agent'}
                </button>
              </div>
            </form>
          )}

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={agentQuery}
              onChange={(e) => setAgentQuery(e.target.value)}
              placeholder="Search agents by name, Agent ID, phone, or assigned area…"
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Agent Cards */}
          {filteredAgents.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 text-center space-y-3">
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {agents.length === 0
                  ? 'No field Agents created yet'
                  : 'No Agents match your search'}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {agents.length === 0
                  ? 'Create your first Agent profile so they can onboard Parents, register Children, and collect yearly subscription fees.'
                  : 'Try another name, Agent ID, or area.'}
              </p>
              {agents.length === 0 && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Create First Agent
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAgents.map((agent) => {
                const stats = agentStatsMap.get(agent.id) ?? {
                  parentsCount: 0,
                  childrenCount: 0,
                  activePlans: 0,
                  feesCollected: 0,
                  estimatedCommission: 0,
                };
                return (
                  <article
                    key={agent.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white truncate">
                            {agent.name}
                          </h3>
                          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {agent.agentCode}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            {agent.phone}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            {agent.assignedArea}
                          </span>
                        </p>
                        {agent.email && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {agent.email}
                          </p>
                        )}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${
                          agent.isActive
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {agent.isActive ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            Active
                          </>
                        ) : (
                          <>
                            <Ban className="w-4 h-4 shrink-0" />
                            Inactive
                          </>
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 font-mono tabular-nums">
                      <div>
                        <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                          Families
                        </span>
                        <span className="text-base font-bold text-slate-950 dark:text-white">
                          {stats.parentsCount}
                        </span>
                      </div>
                      <div>
                        <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                          Fees Collected
                        </span>
                        <span className="text-base font-bold text-slate-950 dark:text-white">
                          {formatCurrency(stats.feesCollected)}
                        </span>
                      </div>
                      <div>
                        <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                          Rate · Fee
                        </span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {agent.commissionRate}% · {formatCurrency(agent.defaultYearlyFee)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => openEditForm(agent)}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <Edit3 className="w-4 h-4 shrink-0" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleAgentActive(agent.id)}
                        className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-colors ${
                          agent.isActive
                            ? 'border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                            : 'border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                      >
                        {agent.isActive ? (
                          <>
                            <UserX className="w-4 h-4 shrink-0" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 shrink-0" />
                            Activate
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: SUBSCRIPTION & FEE OVERSIGHT + MANUAL OVERRIDES                */}
      {/* ===================================================================== */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={subQuery}
                onChange={(e) => setSubQuery(e.target.value)}
                placeholder="Search parent, child name, class, contact, or agent…"
                className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'Active' },
                  { id: 'expiring_soon', label: 'Expiring' },
                  { id: 'expired', label: 'Expired' },
                  { id: 'suspended', label: 'Suspended' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSubFilter(f.id)}
                  className={`min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    subFilter === f.id
                      ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {parentSubscriptionRows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {parents.length === 0
                  ? 'No Parent subscriptions recorded yet'
                  : 'No subscriptions match this filter'}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {parents.length === 0
                  ? 'Once a field Agent onboards a family in /agent, their yearly plan and manual override controls appear here.'
                  : 'Try selecting All or clearing your search query.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {parentSubscriptionRows.map((row) => {
                const isBusy = busyParentId === row.parent.id;
                const StatusIcon =
                  row.evalState.state === 'active'
                    ? CheckCircle2
                    : row.evalState.state === 'expiring_soon'
                    ? Clock
                    : row.evalState.state === 'suspended'
                    ? Ban
                    : AlertCircle;

                const statusTone =
                  row.evalState.state === 'active'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : row.evalState.state === 'expiring_soon'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-red-700 dark:text-red-400';

                return (
                  <article
                    key={row.parent.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="font-display text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                            {row.parent.name}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${statusTone}`}
                          >
                            <StatusIcon className="w-4 h-4 shrink-0" />
                            {row.evalState.label}
                            {row.evalState.canPractice && (
                              <span className="font-mono tabular-nums">
                                ({row.evalState.daysLeft}d left)
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 break-words">
                          {row.parent.contact} · Agent:{' '}
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {row.agent ? `${row.agent.name} (${row.agent.agentCode})` : 'Unassigned'}
                          </span>
                        </p>
                      </div>

                      <div className="text-left sm:text-right font-mono tabular-nums shrink-0">
                        <span className="block text-base font-bold text-slate-950 dark:text-white">
                          {formatCurrency(row.totalPaid)}
                        </span>
                        <span className="font-sans text-xs text-slate-500 dark:text-slate-400">
                          {row.latest
                            ? `${PAYMENT_METHOD_LABELS[row.latest.paymentMethod]} · ${row.historyCount} ${
                                row.historyCount === 1 ? 'cycle' : 'cycles'
                              }`
                            : 'No payment'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="tabular-nums">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Yearly Term:{' '}
                        </span>
                        {row.latest
                          ? `${formatIsoDate(row.latest.startDate)} → ${formatIsoDate(row.latest.expiryDate)}`
                          : 'Not started'}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Children ({row.linkedChildren.length}):{' '}
                        </span>
                        {row.linkedChildren.length > 0
                          ? row.linkedChildren
                              .map(
                                (c) =>
                                  `${c.name} (${formatIndianClassLabel(c.grade)})`
                              )
                              .join(', ')
                          : 'None'}
                      </div>
                    </div>

                    {row.latest?.receiptNote && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Note: {row.latest.receiptNote}
                      </p>
                    )}

                    {/* Manual Override Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleOverride(row.parent.id, row.parent.name, 'activate')
                        }
                        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        Activate
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleOverride(
                            row.parent.id,
                            row.parent.name,
                            'extend_year'
                          )
                        }
                        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <CalendarPlus className="w-4 h-4 shrink-0" />
                        Extend +1 Year
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleOverride(row.parent.id, row.parent.name, 'suspend')
                        }
                        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Ban className="w-4 h-4 shrink-0" />
                        Suspend
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: AGENT ONBOARDING LEADERBOARD                                   */}
      {/* ===================================================================== */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          {agentLeaderboard.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
              <Trophy className="w-7 h-7 text-amber-500 mx-auto" />
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                No Agent onboarding records yet
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add field Agents to compare onboarded families, active yearly
                plans, and total fee collections.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card List (< md) */}
              <div className="md:hidden space-y-3">
                {agentLeaderboard.map(({ agent, stats }, idx) => (
                  <article
                    key={agent.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                          #{idx + 1} · {agent.agentCode}
                        </span>
                        <h3 className="font-display text-base font-bold text-slate-950 dark:text-white truncate">
                          {agent.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {agent.assignedArea}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <span className="block text-base font-bold text-slate-950 dark:text-white">
                          {formatCurrency(stats.feesCollected)}
                        </span>
                        <span className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                          Est. comm {formatCurrency(stats.estimatedCommission)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 font-mono text-xs tabular-nums">
                      <div>
                        <span className="block font-sans text-slate-500 dark:text-slate-400">
                          Parents
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {stats.parentsCount}
                        </span>
                      </div>
                      <div>
                        <span className="block font-sans text-slate-500 dark:text-slate-400">
                          Active Plans
                        </span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {stats.activePlans}
                        </span>
                      </div>
                      <div>
                        <span className="block font-sans text-slate-500 dark:text-slate-400">
                          Children
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {stats.childrenCount}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/40">
                      <th className="py-3 px-4 w-16">Rank</th>
                      <th className="py-3 px-4">Agent</th>
                      <th className="py-3 px-4">Area</th>
                      <th className="py-3 px-4 text-right">Parents</th>
                      <th className="py-3 px-4 text-right">Children</th>
                      <th className="py-3 px-4 text-right">Active Plans</th>
                      <th className="py-3 px-4 text-right">Fees Collected</th>
                      <th className="py-3 px-4 text-right">Est. Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {agentLeaderboard.map(({ agent, stats }, idx) => (
                      <tr
                        key={agent.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                          #{idx + 1}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-950 dark:text-white">
                            {agent.name}
                          </span>
                          <span className="ml-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                            {agent.agentCode}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                          {agent.assignedArea}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                          {stats.parentsCount}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                          {stats.childrenCount}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {stats.activePlans}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-950 dark:text-white tabular-nums">
                          {formatCurrency(stats.feesCollected)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                          {formatCurrency(stats.estimatedCommission)} ({agent.commissionRate}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
