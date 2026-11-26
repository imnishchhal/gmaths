import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  LogOut,
  MapPin,
  Megaphone,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  UserCheck,
  UserX,
  Wallet,
  X,
} from 'lucide-react';
import { useFirebase } from '../../context/FirebaseContext';
import { usePlatform } from '../../context/PlatformContext';
import {
  INDIAN_CLASSES,
  IndianClass,
  formatIndianClassLabel,
} from '../../types/math';
import {
  AgentApprovalStatus,
  AgentProfile,
  ChildProfile,
  ComputedSubscriptionState,
  PAYMENT_METHOD_LABELS,
  ParentProfile,
  computeAgentCommissionSummary,
  evaluateSubscriptionState,
  formatCurrency,
  formatIsoDate,
  getAgentApprovalStatus,
  isSuspiciousSpeedRun,
} from '../../types/platform';
import {
  isLocalSyntheticAuthEmail,
  isPhoneAgentAuthEmail,
} from '../../utils/referral';

type AdminTab = 'agents' | 'subscriptions' | 'payouts' | 'leaderboard';
type SubFilter = 'all' | ComputedSubscriptionState;

interface AgentFormState {
  agentCode: string;
  name: string;
  phone: string;
  email: string;
  assignedArea: string;
  city: string;
  upiId: string;
  approvalStatus: AgentApprovalStatus;
  commissionRate: string;
  commissionPerConversion: string;
  defaultYearlyFee: string;
  passcode: string;
}

const EMPTY_AGENT_FORM: AgentFormState = {
  agentCode: '',
  name: '',
  phone: '',
  email: '',
  assignedArea: '',
  city: '',
  upiId: '',
  approvalStatus: 'approved',
  commissionRate: '15',
  commissionPerConversion: '',
  defaultYearlyFee: '1200',
  passcode: '',
};

export const AdminDashboard: React.FC = () => {
  const { leaderboard } = useFirebase();
  const {
    agents,
    parents,
    children,
    subscriptions,
    studentSubscriptions,
    payoutRequests,
    vouchers,
    appConfig,
    childLeaderboard,
    roleSession,
    logoutRole,
    createAgent,
    updateAgent,
    setAgentApprovalStatus,
    adminOverrideSubscription,
    adminUpdateParent,
    adminUpdateChild,
    adminAddChildToParent,
    markPayoutPaid,
    generateOfflineVoucher,
    updateAppConfig,
    moderateLeaderboardEntry,
    moderateChildChampion,
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
  const [agentStatusFilter, setAgentStatusFilter] = useState<
    'all' | AgentApprovalStatus
  >('all');
  const [subFilter, setSubFilter] = useState<SubFilter>('all');
  const [subQuery, setSubQuery] = useState('');
  const [overrideNotice, setOverrideNotice] = useState<string | null>(null);
  const [busyParentId, setBusyParentId] = useState<string | null>(null);

  // Parent & Child Inline Editing State (Tab 2)
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [parentEditForm, setParentEditForm] = useState({
    name: '',
    contact: '',
    email: '',
    newPassword: '',
  });
  const [showParentEditPassword, setShowParentEditPassword] = useState(false);
  const [savingParentEdit, setSavingParentEdit] = useState(false);

  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [childEditForm, setChildEditForm] = useState<{
    name: string;
    grade: IndianClass;
  }>({ name: '', grade: '1st' });
  const [savingChildEdit, setSavingChildEdit] = useState(false);

  const [addingChildParentId, setAddingChildParentId] = useState<string | null>(
    null
  );
  const [newChildForm, setNewChildForm] = useState<{
    name: string;
    grade: IndianClass;
  }>({ name: '', grade: '1st' });
  const [savingAdminChild, setSavingAdminChild] = useState(false);
  const [familyEditError, setFamilyEditError] = useState<string | null>(null);

  // Payouts & Vouchers State
  const [utrByPayoutId, setUtrByPayoutId] = useState<Record<string, string>>({});
  const [busyPayoutId, setBusyPayoutId] = useState<string | null>(null);
  const [voucherAgentId, setVoucherAgentId] = useState<string>('');
  const [voucherFilter, setVoucherFilter] = useState<'all' | 'unused' | 'redeemed'>(
    'all'
  );
  const [generatingVoucher, setGeneratingVoucher] = useState(false);
  const [copiedVoucherCode, setCopiedVoucherCode] = useState<string | null>(null);

  // Global Content & Seed Controls State
  const [dailySeedInput, setDailySeedInput] = useState(
    appConfig.dailyChallengeSeed
  );
  const [announcementEnabledInput, setAnnouncementEnabledInput] = useState(
    appConfig.announcementEnabled
  );
  const [announcementTextInput, setAnnouncementTextInput] = useState(
    appConfig.announcementText
  );
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    setDailySeedInput(appConfig.dailyChallengeSeed);
    setAnnouncementEnabledInput(appConfig.announcementEnabled);
    setAnnouncementTextInput(appConfig.announcementText);
  }, [
    appConfig.announcementEnabled,
    appConfig.announcementText,
    appConfig.dailyChallengeSeed,
  ]);

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

    const totalRevenue =
      subscriptions.reduce((sum, s) => sum + s.feeAmount, 0) +
      studentSubscriptions.reduce((sum, s) => sum + s.amountPaid, 0);
    const activeAgentsCount = agents.filter(
      (a) => getAgentApprovalStatus(a) === 'approved'
    ).length;

    return {
      totalParents: parents.length,
      totalChildren: children.length,
      activeYearlyPlans: activeYearlyPlans + studentSubscriptions.length,
      expiringSoonPlans,
      expiredOrSuspendedPlans,
      totalRevenue,
      activeAgentsCount,
    };
  }, [
    agents,
    children.length,
    getLatestSubscriptionForParent,
    parents,
    studentSubscriptions,
    subscriptions,
  ]);

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
      const agStudentSubs = studentSubscriptions.filter(
        (s) => s.attributedAgentId === ag.id
      );
      const feesCollected =
        agSubs.reduce((sum, s) => sum + s.feeAmount, 0) +
        agStudentSubs.reduce((sum, s) => sum + s.amountPaid, 0);
      const activePlans =
        agParents.filter((p) => {
          const st = evaluateSubscriptionState(getLatestSubscriptionForParent(p.id));
          return st.canPractice;
        }).length + agStudentSubs.length;
      const estimatedCommission =
        Math.round(
          (agSubs.reduce((sum, s) => sum + s.feeAmount, 0) * ag.commissionRate) /
            100
        ) + agStudentSubs.reduce((sum, s) => sum + s.commissionAmount, 0);

      map.set(ag.id, {
        parentsCount: agParents.length,
        childrenCount: agChildren.length,
        activePlans,
        feesCollected,
        estimatedCommission,
      });
    }
    return map;
  }, [
    agents,
    children,
    getLatestSubscriptionForParent,
    parents,
    studentSubscriptions,
    subscriptions,
  ]);

  const filteredAgents = useMemo(() => {
    const q = agentQuery.trim().toLowerCase();
    return agents.filter((a) => {
      const status = getAgentApprovalStatus(a);
      if (agentStatusFilter !== 'all' && status !== agentStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.agentCode.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q) ||
        (a.city || a.assignedArea).toLowerCase().includes(q) ||
        (a.upiId || '').toLowerCase().includes(q)
      );
    });
  }, [agentQuery, agentStatusFilter, agents]);

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
          (row.parent.email
            ? row.parent.email.toLowerCase().includes(q)
            : false) ||
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

  const sortedPayouts = useMemo(() => {
    return [...payoutRequests].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      return b.createdAtMs - a.createdAtMs;
    });
  }, [payoutRequests]);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) =>
      voucherFilter === 'all' ? true : v.status === voucherFilter
    );
  }, [voucherFilter, vouchers]);

  const sortedSprintLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      const aFlag = a.isFlagged || isSuspiciousSpeedRun(a.avgResponseMs, a.score) ? 1 : 0;
      const bFlag = b.isFlagged || isSuspiciousSpeedRun(b.avgResponseMs, b.score) ? 1 : 0;
      if (aFlag !== bFlag) return bFlag - aFlag;
      return b.score - a.score;
    });
  }, [leaderboard]);

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
      city: agent.city ?? '',
      upiId: agent.upiId ?? '',
      approvalStatus: getAgentApprovalStatus(agent),
      commissionRate: String(agent.commissionRate),
      commissionPerConversion: agent.commissionPerConversion
        ? String(agent.commissionPerConversion)
        : '',
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

    const flatComm = Number(agentForm.commissionPerConversion) || 0;

    if (editingAgentId) {
      const res = await updateAgent(editingAgentId, {
        agentCode: agentForm.agentCode,
        name: agentForm.name,
        phone: agentForm.phone,
        email: agentForm.email,
        assignedArea: agentForm.assignedArea || agentForm.city,
        city: agentForm.city,
        upiId: agentForm.upiId,
        approvalStatus: agentForm.approvalStatus,
        commissionRate: Number(agentForm.commissionRate) || 0,
        commissionPerConversion: flatComm,
        defaultYearlyFee: Number(agentForm.defaultYearlyFee) || 0,
        newPasscode: agentForm.passcode || undefined,
        isActive: agentForm.approvalStatus === 'approved',
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
        assignedArea: agentForm.assignedArea || agentForm.city,
        city: agentForm.city,
        upiId: agentForm.upiId,
        commissionRate: Number(agentForm.commissionRate) || 0,
        commissionPerConversion: flatComm,
        defaultYearlyFee: Number(agentForm.defaultYearlyFee) || 0,
        passcode: agentForm.passcode,
      });
      setSavingAgent(false);
      if (!res.ok) {
        setFormError(res.error || 'Could not create Agent.');
        return;
      }
      setFormSuccess(
        `Created Agent ${res.agent?.name} (${res.agent?.agentCode}). They can now sign in at /agent using phone ${res.agent?.phone} and their password.`
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

  const openParentEdit = (parent: ParentProfile) => {
    setFamilyEditError(null);
    setEditingChildId(null);
    setAddingChildParentId(null);
    setShowParentEditPassword(false);
    setEditingParentId(parent.id);
    setParentEditForm({
      name: parent.name,
      contact: parent.contact,
      email:
        parent.email && !isLocalSyntheticAuthEmail(parent.email)
          ? parent.email
          : '',
      newPassword: '',
    });
  };

  const handleSaveParentEdit = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    setFamilyEditError(null);
    setSavingParentEdit(true);
    const res = await adminUpdateParent(parentId, {
      name: parentEditForm.name,
      contact: parentEditForm.contact,
      email: parentEditForm.email,
      newPassword: parentEditForm.newPassword.trim() || undefined,
    });
    setSavingParentEdit(false);
    if (!res.ok) {
      setFamilyEditError(res.error || 'Could not update Parent details.');
      return;
    }
    setEditingParentId(null);
    setParentEditForm({ name: '', contact: '', email: '', newPassword: '' });
    setOverrideNotice(
      res.warning
        ? `Updated Parent details (${res.warning})`
        : 'Updated Parent details and synced family records.'
    );
    setTimeout(() => setOverrideNotice(null), 5000);
  };

  const openChildEdit = (child: ChildProfile) => {
    setFamilyEditError(null);
    setEditingParentId(null);
    setAddingChildParentId(null);
    setEditingChildId(child.id);
    setChildEditForm({
      name: child.name,
      grade: child.grade,
    });
  };

  const handleSaveChildEdit = async (e: React.FormEvent, childId: string) => {
    e.preventDefault();
    setFamilyEditError(null);
    setSavingChildEdit(true);
    const res = await adminUpdateChild(childId, {
      name: childEditForm.name,
      grade: childEditForm.grade,
    });
    setSavingChildEdit(false);
    if (!res.ok) {
      setFamilyEditError(res.error || 'Could not update Child details.');
      return;
    }
    setEditingChildId(null);
    setOverrideNotice('Updated Child profile and leaderboard entry.');
    setTimeout(() => setOverrideNotice(null), 4000);
  };

  const openAdminAddChild = (parentId: string) => {
    setFamilyEditError(null);
    setEditingParentId(null);
    setEditingChildId(null);
    setAddingChildParentId(parentId);
    setNewChildForm({ name: '', grade: '1st' });
  };

  const handleSaveAdminAddChild = async (
    e: React.FormEvent,
    parentId: string
  ) => {
    e.preventDefault();
    setFamilyEditError(null);
    setSavingAdminChild(true);
    const res = await adminAddChildToParent(parentId, {
      name: newChildForm.name,
      grade: newChildForm.grade,
    });
    setSavingAdminChild(false);
    if (!res.ok) {
      setFamilyEditError(res.error || 'Could not add Child profile.');
      return;
    }
    setAddingChildParentId(null);
    setNewChildForm({ name: '', grade: '1st' });
    setOverrideNotice('Added Child profile to Parent family.');
    setTimeout(() => setOverrideNotice(null), 4000);
  };

  const handleMarkPayoutPaid = async (payoutId: string) => {
    const utr = (utrByPayoutId[payoutId] || '').trim();
    if (utr.length < 4) {
      setOverrideNotice('Enter a valid UTR / Transaction Reference before marking Paid.');
      return;
    }
    setBusyPayoutId(payoutId);
    const res = await markPayoutPaid(payoutId, utr);
    setBusyPayoutId(null);
    if (res.ok) {
      setOverrideNotice(`Payout settled with UTR ${utr}.`);
      setTimeout(() => setOverrideNotice(null), 4000);
    } else if (res.error) {
      setOverrideNotice(res.error);
    }
  };

  const handleGenerateVoucher = async () => {
    setGeneratingVoucher(true);
    const res = await generateOfflineVoucher(voucherAgentId || undefined);
    setGeneratingVoucher(false);
    if (res.ok && res.voucher) {
      setFormSuccess(`Generated 1-Year Cash Voucher: ${res.voucher.code}`);
      setTimeout(() => setFormSuccess(null), 5000);
    } else if (res.error) {
      setOverrideNotice(res.error);
    }
  };

  const handleCopyVoucher = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedVoucherCode(code);
      window.setTimeout(() => setCopiedVoucherCode(null), 2000);
    } catch {
      // Ignore
    }
  };

  const handleSaveGlobalConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    const res = await updateAppConfig({
      dailyChallengeSeed: dailySeedInput,
      announcementEnabled: announcementEnabledInput,
      announcementText: announcementTextInput,
    });
    setSavingConfig(false);
    if (res.ok) {
      setFormSuccess('Saved Daily Challenge Seed & site-wide announcement settings.');
      setTimeout(() => setFormSuccess(null), 4000);
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
        className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800"
      >
        {(
          [
            { id: 'agents', label: `Agents (${agents.length})` },
            { id: 'subscriptions', label: `Families (${parents.length})` },
            {
              id: 'payouts',
              label: `Payouts (${
                payoutRequests.filter((p) => p.status === 'pending').length
              })`,
            },
            { id: 'leaderboard', label: 'Boards & Config' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[44px] px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap truncate ${
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
                    Agents sign in at /agent using their Mobile Phone Number and
                    Password for live desktop &amp; mobile sync.
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
                    Mobile Phone (Login ID) *
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

                {editingAgentId && (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Login Email / Identifier
                    </label>
                    <input
                      type="email"
                      value={agentForm.email}
                      onChange={(e) =>
                        setAgentForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="Auto-generated from phone"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    City
                  </label>
                  <input
                    type="text"
                    value={agentForm.city}
                    onChange={(e) =>
                      setAgentForm((f) => ({ ...f, city: e.target.value }))
                    }
                    placeholder="e.g. Pune"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    UPI ID (for Payouts)
                  </label>
                  <input
                    type="text"
                    value={agentForm.upiId}
                    onChange={(e) =>
                      setAgentForm((f) => ({ ...f, upiId: e.target.value }))
                    }
                    placeholder="e.g. rajesh@okicici"
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
                    Flat Comm / Sale (INR, 0 = Auto Tier)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={25}
                    value={agentForm.commissionPerConversion}
                    onChange={(e) =>
                      setAgentForm((f) => ({
                        ...f,
                        commissionPerConversion: e.target.value,
                      }))
                    }
                    placeholder="Auto (₹300 → ₹350)"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Family Renewal Comm (%)
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

                {editingAgentId && (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Approval Status
                    </label>
                    <select
                      value={agentForm.approvalStatus}
                      onChange={(e) =>
                        setAgentForm((f) => ({
                          ...f,
                          approvalStatus: e.target.value as AgentApprovalStatus,
                        }))
                      }
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                    >
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                )}

                {!editingAgentId ? (
                  <div className="space-y-1 sm:col-span-2 lg:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Login Password * (min 6 characters)
                    </label>
                    <input
                      type="text"
                      required
                      minLength={6}
                      value={agentForm.passcode}
                      onChange={(e) =>
                        setAgentForm((f) => ({ ...f, passcode: e.target.value }))
                      }
                      placeholder="Set initial password (min 6 chars) for /agent sign-in"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                ) : (
                  <div className="space-y-1 sm:col-span-2 lg:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Password Management
                    </label>
                    <p className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-600 dark:text-slate-400 flex items-center">
                      Agents update their own login password inside the Agent Portal under Earnings &amp; Payouts → Settings.
                    </p>
                  </div>
                )}
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

          {/* Search Bar & Approval Status Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={agentQuery}
                onChange={(e) => setAgentQuery(e.target.value)}
                placeholder="Search agents by name, code, phone, city, or UPI…"
                className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-4 sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: 'Pending' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'suspended', label: 'Suspended' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setAgentStatusFilter(st.id)}
                  className={`min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    agentStatusFilter === st.id
                      ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
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
                const approvalStatus = getAgentApprovalStatus(agent);
                const ledger = computeAgentCommissionSummary(
                  agent,
                  studentSubscriptions,
                  subscriptions,
                  payoutRequests
                );
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
                            {agent.city || agent.assignedArea || 'No city'}
                          </span>
                        </p>
                        {((agent.email && !isPhoneAgentAuthEmail(agent.email)) ||
                          agent.upiId) && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {agent.email && !isPhoneAgentAuthEmail(agent.email)
                              ? agent.email
                              : ''}
                            {agent.upiId
                              ? `${
                                  agent.email &&
                                  !isPhoneAgentAuthEmail(agent.email)
                                    ? ' · '
                                    : ''
                                }UPI: ${agent.upiId}`
                              : ''}
                          </p>
                        )}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${
                          approvalStatus === 'approved'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : approvalStatus === 'pending'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {approvalStatus === 'approved' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            Approved
                          </>
                        ) : approvalStatus === 'pending' ? (
                          <>
                            <Clock className="w-4 h-4 shrink-0" />
                            Pending
                          </>
                        ) : (
                          <>
                            <Ban className="w-4 h-4 shrink-0" />
                            Suspended
                          </>
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 font-mono tabular-nums">
                      <div>
                        <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                          Conversions
                        </span>
                        <span className="text-base font-bold text-slate-950 dark:text-white">
                          {ledger.totalConversions}
                        </span>
                      </div>
                      <div>
                        <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                          Earned / Avail
                        </span>
                        <span className="text-sm font-bold text-slate-950 dark:text-white">
                          {formatCurrency(ledger.totalEarned)} / {formatCurrency(ledger.availableBalance)}
                        </span>
                      </div>
                      <div>
                        <span className="block font-sans text-[11px] text-slate-500 dark:text-slate-400">
                          Comm Tier
                        </span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {agent.commissionPerConversion && agent.commissionPerConversion > 0
                            ? `${formatCurrency(agent.commissionPerConversion)}/sale`
                            : `${formatCurrency(ledger.currentRatePerConversion)} (Auto)`}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => openEditForm(agent)}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <Edit3 className="w-4 h-4 shrink-0" />
                        Edit
                      </button>

                      {approvalStatus !== 'approved' && (
                        <button
                          type="button"
                          onClick={() =>
                            void setAgentApprovalStatus(agent.id, 'approved')
                          }
                          className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors"
                        >
                          <UserCheck className="w-4 h-4 shrink-0" />
                          Approve
                        </button>
                      )}

                      {approvalStatus !== 'suspended' && (
                        <button
                          type="button"
                          onClick={() =>
                            void setAgentApprovalStatus(agent.id, 'suspended')
                          }
                          className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs sm:text-sm font-semibold transition-colors"
                        >
                          <UserX className="w-4 h-4 shrink-0" />
                          Suspend
                        </button>
                      )}
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
                          {row.parent.contact}
                          {row.parent.email &&
                          !isLocalSyntheticAuthEmail(row.parent.email)
                            ? ` · ${row.parent.email}`
                            : ''}{' '}
                          · Agent:{' '}
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
                          ? `${row.linkedChildren.length} linked`
                          : 'None'}
                      </div>
                    </div>

                    {row.latest?.receiptNote && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Note: {row.latest.receiptNote}
                      </p>
                    )}

                    {/* Family Edit Error Banner (for active card) */}
                    {familyEditError &&
                      (editingParentId === row.parent.id ||
                        addingChildParentId === row.parent.id ||
                        row.linkedChildren.some((c) => c.id === editingChildId)) && (
                        <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 flex items-center gap-2 text-xs sm:text-sm text-red-700 dark:text-red-300">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{familyEditError}</span>
                        </div>
                      )}

                    {/* Inline Parent Edit Form */}
                    {editingParentId === row.parent.id && (
                      <form
                        onSubmit={(e) => void handleSaveParentEdit(e, row.parent.id)}
                        className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-slate-50 dark:bg-slate-950/70 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            Edit Parent Details
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingParentId(null);
                              setFamilyEditError(null);
                            }}
                            aria-label="Close parent edit form"
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Parent Full Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={parentEditForm.name}
                              onChange={(e) =>
                                setParentEditForm((f) => ({
                                  ...f,
                                  name: e.target.value,
                                }))
                              }
                              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Mobile Number *
                            </label>
                            <input
                              type="tel"
                              required
                              value={parentEditForm.contact}
                              onChange={(e) =>
                                setParentEditForm((f) => ({
                                  ...f,
                                  contact: e.target.value,
                                }))
                              }
                              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Email (Optional)
                            </label>
                            <input
                              type="email"
                              value={parentEditForm.email}
                              onChange={(e) =>
                                setParentEditForm((f) => ({
                                  ...f,
                                  email: e.target.value,
                                }))
                              }
                              placeholder="parent@example.com"
                              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              New Login Password (Optional, min 6 chars)
                            </label>
                            <div className="relative">
                              <input
                                type={showParentEditPassword ? 'text' : 'password'}
                                minLength={6}
                                value={parentEditForm.newPassword}
                                onChange={(e) =>
                                  setParentEditForm((f) => ({
                                    ...f,
                                    newPassword: e.target.value,
                                  }))
                                }
                                placeholder="Leave blank to keep current"
                                className="w-full min-h-[44px] pl-3 pr-11 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowParentEditPassword((s) => !s)
                                }
                                aria-label={
                                  showParentEditPassword
                                    ? 'Hide password'
                                    : 'Show password'
                                }
                                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                              >
                                {showParentEditPassword ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingParentId(null);
                              setFamilyEditError(null);
                            }}
                            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingParentEdit}
                            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold"
                          >
                            {savingParentEdit ? 'Saving…' : 'Save Parent'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Children List with Individual Edit Actions */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Linked Children ({row.linkedChildren.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => openAdminAddChild(row.parent.id)}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          Add Child
                        </button>
                      </div>

                      {row.linkedChildren.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          No children linked yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {row.linkedChildren.map((child) => (
                            <div
                              key={child.id}
                              className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 px-3 py-2.5"
                            >
                              {editingChildId === child.id ? (
                                <form
                                  onSubmit={(e) =>
                                    void handleSaveChildEdit(e, child.id)
                                  }
                                  className="flex flex-col sm:flex-row sm:items-end gap-2.5"
                                >
                                  <div className="flex-1 space-y-1">
                                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                      Child Name *
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      value={childEditForm.name}
                                      onChange={(e) =>
                                        setChildEditForm((f) => ({
                                          ...f,
                                          name: e.target.value,
                                        }))
                                      }
                                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    />
                                  </div>

                                  <div className="sm:w-44 space-y-1">
                                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                      Class / Grade *
                                    </label>
                                    <select
                                      value={childEditForm.grade}
                                      onChange={(e) =>
                                        setChildEditForm((f) => ({
                                          ...f,
                                          grade: e.target.value as IndianClass,
                                        }))
                                      }
                                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    >
                                      {INDIAN_CLASSES.map((cls) => (
                                        <option key={cls} value={cls}>
                                          {formatIndianClassLabel(cls)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingChildId(null);
                                        setFamilyEditError(null);
                                      }}
                                      className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={savingChildEdit}
                                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold"
                                    >
                                      {savingChildEdit ? 'Saving…' : 'Save'}
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                      {child.name}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                      {formatIndianClassLabel(child.grade)} ·{' '}
                                      {child.totalScore} pts
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openChildEdit(child)}
                                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 shrink-0"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 shrink-0" />
                                    Edit
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inline Add Child Form */}
                      {addingChildParentId === row.parent.id && (
                        <form
                          onSubmit={(e) =>
                            void handleSaveAdminAddChild(e, row.parent.id)
                          }
                          className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-slate-50 dark:bg-slate-950/70 p-3 flex flex-col sm:flex-row sm:items-end gap-2.5"
                        >
                          <div className="flex-1 space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                              New Child Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={newChildForm.name}
                              onChange={(e) =>
                                setNewChildForm((f) => ({
                                  ...f,
                                  name: e.target.value,
                                }))
                              }
                              placeholder="e.g. Aarav"
                              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </div>

                          <div className="sm:w-44 space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                              Class / Grade *
                            </label>
                            <select
                              value={newChildForm.grade}
                              onChange={(e) =>
                                setNewChildForm((f) => ({
                                  ...f,
                                  grade: e.target.value as IndianClass,
                                }))
                              }
                              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                              {INDIAN_CLASSES.map((cls) => (
                                <option key={cls} value={cls}>
                                  {formatIndianClassLabel(cls)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setAddingChildParentId(null);
                                setFamilyEditError(null);
                              }}
                              className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={savingAdminChild}
                              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold"
                            >
                              {savingAdminChild ? 'Adding…' : 'Add Child'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>

                    {/* Manual Override & Family Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => openParentEdit(row.parent)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Edit3 className="w-4 h-4 shrink-0" />
                        Edit Parent
                      </button>

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
      {/* TAB 3: PAYOUT SETTLEMENT QUEUE & OFFLINE CASH VOUCHER GENERATOR       */}
      {/* ===================================================================== */}
      {activeTab === 'payouts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Payout Settlement Queue */}
          <section className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  Payout Settlement Queue
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Transfer requested commissions to Agent UPI IDs and record the UTR reference.
                </p>
              </div>
              <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            </div>

            {sortedPayouts.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                No agent withdrawal requests submitted yet.
              </p>
            ) : (
              <div className="space-y-3">
                {sortedPayouts.map((req) => (
                  <article
                    key={req.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-sm font-bold text-slate-950 dark:text-white truncate">
                          {req.agentName}
                        </p>
                        <p className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate">
                          UPI: {req.upiId}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <span className="block text-base font-bold text-slate-950 dark:text-white">
                          {formatCurrency(req.amount)}
                        </span>
                        <span
                          className={`text-[11px] font-sans font-bold ${
                            req.status === 'paid'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {req.status === 'paid' ? 'Settled' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    {req.status === 'pending' ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={utrByPayoutId[req.id] ?? ''}
                          onChange={(e) =>
                            setUtrByPayoutId((prev) => ({
                              ...prev,
                              [req.id]: e.target.value,
                            }))
                          }
                          placeholder="Enter UTR / Bank Ref #"
                          className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          disabled={busyPayoutId === req.id}
                          onClick={() => void handleMarkPayoutPaid(req.id)}
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold whitespace-nowrap"
                        >
                          {busyPayoutId === req.id ? 'Saving…' : 'Mark as Paid'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                        UTR: {req.utrNumber} · Paid {formatIsoDate(req.paidAt)}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Offline Cash Voucher Generator */}
          <section className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  Offline Cash Voucher Generator
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Issue single-use 1-year activation codes for cash-paying students.
                </p>
              </div>
              <Ticket className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={voucherAgentId}
                onChange={(e) => setVoucherAgentId(e.target.value)}
                aria-label="Attribute voucher to agent"
                className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-white"
              >
                <option value="">Direct Admin (No Agent Attribution)</option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name} ({ag.agentCode})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={generatingVoucher}
                onClick={() => void handleGenerateVoucher()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold whitespace-nowrap"
              >
                {generatingVoucher ? 'Generating…' : 'Generate 1-Yr Voucher'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
              {(
                [
                  { id: 'all', label: `All (${vouchers.length})` },
                  {
                    id: 'unused',
                    label: `Unused (${
                      vouchers.filter((v) => v.status === 'unused').length
                    })`,
                  },
                  {
                    id: 'redeemed',
                    label: `Redeemed (${
                      vouchers.filter((v) => v.status === 'redeemed').length
                    })`,
                  },
                ] as const
              ).map((vf) => (
                <button
                  key={vf.id}
                  type="button"
                  onClick={() => setVoucherFilter(vf.id)}
                  className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    voucherFilter === vf.id
                      ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {vf.label}
                </button>
              ))}
            </div>

            {filteredVouchers.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-3">
                No vouchers in this filter yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                {filteredVouchers.map((v) => (
                  <div
                    key={v.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-mono text-sm font-bold text-slate-950 dark:text-white">
                        {v.code}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 truncate">
                        {v.agentName ? `Partner: ${v.agentName}` : 'Direct Admin'}
                        {v.status === 'redeemed' && v.redeemedByEmail
                          ? ` · Used by ${v.redeemedByEmail}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-bold ${
                          v.status === 'unused'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {v.status === 'unused' ? 'Unused' : 'Redeemed'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyVoucher(v.code)}
                        aria-label={`Copy voucher ${v.code}`}
                        className="min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {copiedVoucherCode === v.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: BOARDS, ANTI-CHEAT MODERATION & GLOBAL CONFIG                  */}
      {/* ===================================================================== */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          {/* Platform Content Controls: Daily Seed & Announcement Banner */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  Daily Challenge Seed &amp; Site Announcement
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Control today&apos;s deterministic Daily Challenge seed and broadcast a site-wide banner.
                </p>
              </div>
              <Megaphone className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            </div>

            <form onSubmit={handleSaveGlobalConfig} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4 space-y-1">
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Daily Challenge Seed
                  </label>
                  <input
                    type="text"
                    required
                    value={dailySeedInput}
                    onChange={(e) => setDailySeedInput(e.target.value)}
                    placeholder="DAILY-2026"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div className="md:col-span-6 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Site-Wide Announcement Text
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={announcementEnabledInput}
                        onChange={(e) =>
                          setAnnouncementEnabledInput(e.target.checked)
                        }
                        className="w-4 h-4 rounded border-slate-300 text-blue-600"
                      />
                      Banner Active
                    </label>
                  </div>
                  <input
                    type="text"
                    value={announcementTextInput}
                    onChange={(e) => setAnnouncementTextInput(e.target.value)}
                    placeholder="e.g. Sunday Speedster Challenge starts at 5 PM IST!"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold whitespace-nowrap"
                  >
                    {savingConfig ? 'Saving…' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* Anti-Cheat Sprint Leaderboard Moderation */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  Anti-Cheat Sprint Moderation ({sortedSprintLeaderboard.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Runs faster than 150ms/question are auto-flagged. Hide suspicious runs or restore valid scores.
                </p>
              </div>
            </div>

            {sortedSprintLeaderboard.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No speed sprint records found yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                {sortedSprintLeaderboard.slice(0, 30).map((entry) => {
                  const flagged =
                    entry.isFlagged ||
                    isSuspiciousSpeedRun(entry.avgResponseMs, entry.score);
                  return (
                    <div
                      key={entry.id}
                      className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                        flagged ? 'bg-red-50/50 dark:bg-red-950/20 -mx-2 px-2 rounded-xl' : ''
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-950 dark:text-white">
                            {entry.displayName}
                          </span>
                          {flagged && (
                            <span className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              {entry.flagReason || 'Sub-150ms speed run'}
                            </span>
                          )}
                          {entry.isHidden && (
                            <span className="font-bold text-slate-500 dark:text-slate-400">
                              [Hidden]
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                          Score {entry.score} · {entry.accuracy.toFixed(0)}% ·{' '}
                          {entry.avgResponseMs}ms/q · {entry.mode} ({entry.difficulty})
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void moderateLeaderboardEntry(entry.id, {
                            isHidden: !entry.isHidden,
                          })
                        }
                        className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                      >
                        {entry.isHidden ? (
                          <>
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                            Restore
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 shrink-0" />
                            Hide
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Student Champions Moderation */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                Student Champions Moderation ({childLeaderboard.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hide or restore student champion cards from the public Home &amp; Leaderboard views.
              </p>
            </div>
            {childLeaderboard.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No Student Champion scores recorded yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {childLeaderboard.slice(0, 18).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 px-3 py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-950 dark:text-white truncate">
                        {entry.name} {entry.isHidden ? '(Hidden)' : ''}
                      </p>
                      <p className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatIndianClassLabel(entry.grade)} · {entry.totalScore} pts
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void moderateChildChampion(entry.id, !entry.isHidden)
                      }
                      className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                    >
                      {entry.isHidden ? 'Restore' : 'Hide'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Agent Performance Leaderboard
            </h2>
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
        </div>
      )}
    </div>
  );
};
