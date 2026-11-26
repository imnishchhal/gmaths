import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  IndianRupee,
  Lock,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import {
  INDIAN_CLASSES,
  IndianClass,
  formatIndianClassLabel,
} from '../../types/math';
import {
  AGENT_TIER2_THRESHOLD,
  ChildOnboardingInput,
  PAYMENT_METHOD_LABELS,
  PAYOUT_MINIMUM_INR,
  PaymentMethod,
  addOneYearIso,
  computeAgentCommissionSummary,
  evaluateSubscriptionState,
  formatCurrency,
  formatIsoDate,
  getAgentApprovalStatus,
  todayIsoDate,
} from '../../types/platform';
import {
  buildAgentReferralUrl,
  buildWhatsAppPitchUrl,
} from '../../utils/referral';

type AgentTab = 'portfolio' | 'leads' | 'payouts' | 'onboard';
type PortfolioFilter = 'all' | 'active' | 'expiring_soon' | 'expired';

function createBlankChild(): ChildOnboardingInput {
  return {
    name: '',
    grade: '3rd',
  };
}

export const AgentDashboard: React.FC = () => {
  const {
    roleSession,
    parents,
    subscriptions,
    leads,
    studentSubscriptions,
    payoutRequests,
    logoutRole,
    getAgentById,
    getChildrenForParent,
    getLatestSubscriptionForParent,
    onboardParentAccount,
    addChildToParent,
    renewParentSubscription,
    updateAgentSelfProfile,
    changeAgentPassword,
    requestAgentPayout,
  } = usePlatform();

  const agent = roleSession ? getAgentById(roleSession.accountId) : undefined;

  const [activeTab, setActiveTab] = useState<AgentTab>('portfolio');
  const [filter, setFilter] = useState<PortfolioFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedItem, setCopiedItem] = useState<'code' | 'link' | null>(null);

  // Payout & Partner Profile Form State
  const [payoutAmount, setPayoutAmount] = useState('500');
  const [payoutUpi, setPayoutUpi] = useState(agent?.upiId ?? '');
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const [profileName, setProfileName] = useState(agent?.name ?? '');
  const [profilePhone, setProfilePhone] = useState(agent?.phone ?? '');
  const [profileCity, setProfileCity] = useState(
    agent?.city || agent?.assignedArea || ''
  );
  const [profileUpi, setProfileUpi] = useState(agent?.upiId ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // Onboard Parent + Children + Fee Form State
  const [parentName, setParentName] = useState('');
  const [parentContact, setParentContact] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPasscode, setParentPasscode] = useState('');
  const [childRows, setChildRows] = useState<ChildOnboardingInput[]>([
    createBlankChild(),
  ]);
  const [feeAmount, setFeeAmount] = useState(
    String(agent?.defaultYearlyFee ?? 1200)
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [receiptNote, setReceiptNote] = useState('');
  const [startDate, setStartDate] = useState<string>(todayIsoDate);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [submittingOnboard, setSubmittingOnboard] = useState(false);

  // Renew +1 Year Inline Panel State
  const [renewParentId, setRenewParentId] = useState<string | null>(null);
  const [renewFee, setRenewFee] = useState(
    String(agent?.defaultYearlyFee ?? 1200)
  );
  const [renewMethod, setRenewMethod] = useState<PaymentMethod>('upi');
  const [renewNote, setRenewNote] = useState('');
  const [renewStartDate, setRenewStartDate] = useState<string>(todayIsoDate);
  const [submittingRenew, setSubmittingRenew] = useState(false);

  // Add Child to Existing Parent Inline Panel State
  const [addChildParentId, setAddChildParentId] = useState<string | null>(null);
  const [extraChild, setExtraChild] =
    useState<ChildOnboardingInput>(createBlankChild());
  const [addChildError, setAddChildError] = useState<string | null>(null);
  const [submittingChild, setSubmittingChild] = useState(false);

  const myParents = useMemo(() => {
    if (!agent) return [];
    return parents.filter((p) => p.createdByAgentId === agent.id);
  }, [agent, parents]);

  const myPortfolio = useMemo(() => {
    return myParents.map((parent) => {
      const latestSub = getLatestSubscriptionForParent(parent.id);
      const evalState = evaluateSubscriptionState(latestSub);
      const linkedChildren = getChildrenForParent(parent.id);
      return { parent, latestSub, evalState, linkedChildren };
    });
  }, [getChildrenForParent, getLatestSubscriptionForParent, myParents]);

  const summary = useMemo(() => {
    if (!agent) {
      return {
        totalCollected: 0,
        commissionEarned: 0,
        activeCount: 0,
        expiringCount: 0,
        expiredCount: 0,
      };
    }
    const mySubs = subscriptions.filter((s) => s.collectedByAgentId === agent.id);
    const totalCollected = mySubs.reduce((sum, s) => sum + s.feeAmount, 0);
    const commissionEarned = Math.round(
      (totalCollected * agent.commissionRate) / 100
    );

    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;
    for (const item of myPortfolio) {
      if (item.evalState.state === 'active') activeCount += 1;
      else if (item.evalState.state === 'expiring_soon') expiringCount += 1;
      else expiredCount += 1;
    }

    return {
      totalCollected,
      commissionEarned,
      activeCount,
      expiringCount,
      expiredCount,
    };
  }, [agent, myPortfolio, subscriptions]);

  const filteredPortfolio = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return myPortfolio.filter((row) => {
      if (filter === 'active' && row.evalState.state !== 'active') return false;
      if (filter === 'expiring_soon' && row.evalState.state !== 'expiring_soon')
        return false;
      if (
        filter === 'expired' &&
        row.evalState.state !== 'expired' &&
        row.evalState.state !== 'suspended'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        row.parent.name.toLowerCase().includes(q) ||
        row.parent.contact.toLowerCase().includes(q) ||
        row.parent.email.toLowerCase().includes(q) ||
        row.linkedChildren.some(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.grade.toLowerCase().includes(q)
        )
      );
    });
  }, [filter, myPortfolio, searchQuery]);

  const myLeads = useMemo(() => {
    if (!agent) return [];
    return leads.filter((l) => l.agentId === agent.id);
  }, [agent, leads]);

  const myReferralSales = useMemo(() => {
    if (!agent) return [];
    return studentSubscriptions.filter((s) => s.attributedAgentId === agent.id);
  }, [agent, studentSubscriptions]);

  const myPayouts = useMemo(() => {
    if (!agent) return [];
    return payoutRequests.filter((p) => p.agentId === agent.id);
  }, [agent, payoutRequests]);

  const commissionLedger = useMemo(() => {
    if (!agent) {
      return {
        totalConversions: 0,
        monthConversions: 0,
        currentRatePerConversion: 300,
        totalEarned: 0,
        pendingPayouts: 0,
        paidOut: 0,
        availableBalance: 0,
      };
    }
    return computeAgentCommissionSummary(
      agent,
      studentSubscriptions,
      subscriptions,
      payoutRequests
    );
  }, [agent, payoutRequests, studentSubscriptions, subscriptions]);

  if (!agent) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-base font-semibold text-slate-900 dark:text-white">
          Agent account could not be loaded.
        </p>
        <button
          type="button"
          onClick={logoutRole}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
        >
          Return to Sign-In
        </button>
      </div>
    );
  }

  const approvalStatus = getAgentApprovalStatus(agent);
  const isApproved = approvalStatus === 'approved';
  const referralUrl = buildAgentReferralUrl(agent.agentCode);
  const whatsappUrl = buildWhatsAppPitchUrl(agent.name, agent.agentCode);

  const computedExpiry = addOneYearIso(startDate);
  const computedRenewExpiry = addOneYearIso(renewStartDate);

  const handleCopyText = async (value: string, kind: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedItem(kind);
      window.setTimeout(() => setCopiedItem(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleRequestPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError(null);
    const numericAmount = Math.round(Number(payoutAmount) || 0);
    const targetUpi = (payoutUpi || agent.upiId || '').trim();
    if (!isApproved) {
      setPayoutError('Account must be approved by Admin before requesting payouts.');
      return;
    }
    if (numericAmount < PAYOUT_MINIMUM_INR) {
      setPayoutError(`Minimum payout withdrawal is ₹${PAYOUT_MINIMUM_INR}.`);
      return;
    }
    if (numericAmount > commissionLedger.availableBalance) {
      setPayoutError('Requested amount exceeds your available balance.');
      return;
    }
    if (!targetUpi.includes('@')) {
      setPayoutError('Enter a valid UPI ID (e.g. name@okicici).');
      return;
    }
    setSubmittingPayout(true);
    const res = await requestAgentPayout(agent.id, numericAmount, targetUpi);
    setSubmittingPayout(false);
    if (!res.ok) {
      setPayoutError(res.error || 'Could not submit payout request.');
      return;
    }
    setNotice(
      `Payout request of ${formatCurrency(numericAmount)} to ${targetUpi} submitted for Admin settlement.`
    );
    setPayoutAmount(String(PAYOUT_MINIMUM_INR));
    setTimeout(() => setNotice(null), 5000);
  };

  const handleSaveSelfProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    const res = await updateAgentSelfProfile(agent.id, {
      name: profileName || agent.name,
      phone: profilePhone || agent.phone,
      city: profileCity || agent.city || agent.assignedArea,
      upiId: profileUpi || agent.upiId || '',
    });
    setSavingProfile(false);
    if (res.ok) {
      setPayoutUpi(profileUpi || agent.upiId || '');
      setNotice('Partner profile and payout UPI ID updated.');
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setSavingPassword(true);
    const res = await changeAgentPassword(agent.id, newPassword);
    setSavingPassword(false);
    if (!res.ok) {
      setPasswordError(res.error || 'Could not update login password.');
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setNotice('Your login password has been updated.');
    setTimeout(() => setNotice(null), 4000);
  };

  const handleUpdateChildRow = (
    idx: number,
    patch: Partial<ChildOnboardingInput>
  ) => {
    setChildRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    );
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError(null);
    setSubmittingOnboard(true);

    const res = await onboardParentAccount({
      agentId: agent.id,
      parentName,
      parentContact,
      parentEmail,
      parentPasscode,
      children: childRows,
      feeAmount: Number(feeAmount) || 0,
      paymentMethod,
      receiptNote,
      startDate,
    });

    setSubmittingOnboard(false);
    if (!res.ok) {
      setOnboardError(res.error || 'Could not onboard parent account.');
      return;
    }

    const displayId = parentEmail.trim().toLowerCase() || parentContact.trim();
    setNotice(
      `Onboarded ${parentName} (${displayId}) with ${childRows.length} ${
        childRows.length === 1 ? 'child' : 'children'
      }. Yearly plan valid through ${formatIsoDate(computedExpiry)}.`
    );
    setParentName('');
    setParentContact('');
    setParentEmail('');
    setParentPasscode('');
    setChildRows([createBlankChild()]);
    setFeeAmount(String(agent.defaultYearlyFee || 1200));
    setPaymentMethod('upi');
    setReceiptNote('');
    setStartDate(todayIsoDate());
    setActiveTab('portfolio');
    setTimeout(() => setNotice(null), 5000);
  };

  const openRenewPanel = (parentId: string, currentExpiry?: string) => {
    const today = todayIsoDate();
    const suggestedStart =
      currentExpiry && currentExpiry > today ? currentExpiry : today;
    setRenewParentId(parentId);
    setAddChildParentId(null);
    setRenewFee(String(agent.defaultYearlyFee || 1200));
    setRenewMethod('upi');
    setRenewNote('');
    setRenewStartDate(suggestedStart);
  };

  const handleRenewSubmit = async (e: React.FormEvent, parentNameLabel: string) => {
    e.preventDefault();
    if (!renewParentId) return;
    setSubmittingRenew(true);

    const res = await renewParentSubscription({
      parentId: renewParentId,
      agentId: agent.id,
      feeAmount: Number(renewFee) || 0,
      paymentMethod: renewMethod,
      receiptNote: renewNote,
      startDate: renewStartDate,
    });

    setSubmittingRenew(false);
    if (res.ok) {
      setNotice(
        `Renewed ${parentNameLabel} for 1 year (${formatIsoDate(renewStartDate)} → ${formatIsoDate(
          computedRenewExpiry
        )}).`
      );
      setRenewParentId(null);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const handleAddChildSubmit = async (e: React.FormEvent, parentNameLabel: string) => {
    e.preventDefault();
    if (!addChildParentId) return;
    setAddChildError(null);
    setSubmittingChild(true);

    const res = await addChildToParent(addChildParentId, agent.id, extraChild);
    setSubmittingChild(false);
    if (!res.ok) {
      setAddChildError(res.error || 'Could not add child profile.');
      return;
    }

    setNotice(`Added student ${extraChild.name} under ${parentNameLabel}.`);
    setAddChildParentId(null);
    setExtraChild(createBlankChild());
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <Briefcase className="w-4 h-4 shrink-0" />
            <span>
              Sales Partner · {agent.agentCode} · {agent.city || agent.assignedArea}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {agent.name}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Share referral links, track trial-to-annual conversions, onboard families, and withdraw commissions to UPI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!isApproved}
            onClick={() => setActiveTab('onboard')}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            Onboard Parent
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

      {/* Approval Status Banner when Pending or Suspended */}
      {approvalStatus === 'pending' && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/35 p-4 sm:p-5 flex items-start gap-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Partner Application Pending Admin Approval</p>
            <p>
              Your partner profile ({agent.agentCode}) is saved and awaiting Super Admin verification. Once approved, your promo code will activate ₹100 student discounts and UPI payout withdrawals.
            </p>
          </div>
        </div>
      )}

      {approvalStatus === 'suspended' && (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-4 sm:p-5 flex items-start gap-3 text-xs sm:text-sm text-red-800 dark:text-red-300">
          <Ban className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Partner Account Suspended</p>
            <p>
              Please contact Platform Admin to reactivate family onboarding and referral payouts.
            </p>
          </div>
        </div>
      )}

      {/* Agent Earnings & Portfolio KPI Strip */}
      <section aria-label="Agent Fee Summary" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Commission Earned
          </span>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
            {formatCurrency(commissionLedger.totalEarned)}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {commissionLedger.totalConversions} total conversions
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Available for Payout
          </span>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatCurrency(commissionLedger.availableBalance)}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Min withdrawal ₹{PAYOUT_MINIMUM_INR}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Monthly Rate Tier
          </span>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
            {formatCurrency(commissionLedger.currentRatePerConversion)}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {commissionLedger.monthConversions} / {AGENT_TIER2_THRESHOLD} this month
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Active Family Plans
          </span>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white tabular-nums">
            {summary.activeCount}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {summary.expiringCount} expiring · {myLeads.length} leads
          </span>
        </div>
      </section>

      {/* Referral Toolkit Card */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
              Referral &amp; WhatsApp Sharing Toolkit
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Students using code <strong className="font-mono text-slate-900 dark:text-white">{agent.agentCode}</strong> save ₹100 (pay ₹1,100/yr), and you earn{' '}
              <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                {formatCurrency(commissionLedger.currentRatePerConversion)}
              </strong>{' '}
              per conversion.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleCopyText(agent.agentCode, 'code')}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {copiedItem === 'code' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Copy className="w-4 h-4 shrink-0" />
              )}
              {copiedItem === 'code' ? 'Copied Code' : `Code: ${agent.agentCode}`}
            </button>

            <button
              type="button"
              onClick={() => void handleCopyText(referralUrl, 'link')}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {copiedItem === 'link' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Copy className="w-4 h-4 shrink-0" />
              )}
              {copiedItem === 'link' ? 'Link Copied' : 'Copy Referral Link'}
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              Share on WhatsApp
            </a>
          </div>
        </div>
        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 rounded-lg px-3 py-2">
          {referralUrl}
        </p>
      </section>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Agent workspace sections"
        className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800"
      >
        {(
          [
            { id: 'portfolio', label: `Families (${myParents.length})` },
            {
              id: 'leads',
              label: `Leads & Sales (${myLeads.length + myReferralSales.length})`,
            },
            { id: 'payouts', label: 'Earnings & Payouts' },
            { id: 'onboard', label: 'Onboard Family' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[44px] px-2.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap truncate ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 flex items-center justify-between gap-3 text-sm text-emerald-800 dark:text-emerald-300">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: AGENT PORTFOLIO + RENEW +1 YEAR WORKFLOW                       */}
      {/* ===================================================================== */}
      {activeTab === 'portfolio' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search parent name, mobile, email, or child name/class…"
                className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-4 sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'Active' },
                  { id: 'expiring_soon', label: 'Expiring' },
                  { id: 'expired', label: 'Expired' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`min-h-[40px] px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    filter === f.id
                      ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredPortfolio.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 text-center space-y-3">
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {myParents.length === 0
                  ? 'No families onboarded yet'
                  : 'No accounts match this filter'}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {myParents.length === 0
                  ? 'Onboard your first Parent and Child profile to start recording yearly subscriptions.'
                  : 'Switch filter tabs or clear the search box.'}
              </p>
              {myParents.length === 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('onboard')}
                  className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                >
                  <UserPlus className="w-4 h-4" />
                  Onboard First Family
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPortfolio.map(
                ({ parent, latestSub, evalState, linkedChildren }) => {
                  const StatusIcon =
                    evalState.state === 'active'
                      ? CheckCircle2
                      : evalState.state === 'expiring_soon'
                      ? Clock
                      : evalState.state === 'suspended'
                      ? Ban
                      : AlertCircle;

                  const statusColor =
                    evalState.state === 'active'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : evalState.state === 'expiring_soon'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-red-700 dark:text-red-400';

                  const isRenewing = renewParentId === parent.id;
                  const isAddingChild = addChildParentId === parent.id;

                  return (
                    <article
                      key={parent.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h3 className="font-display text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                              {parent.name}
                            </h3>
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold ${statusColor}`}
                            >
                              <StatusIcon className="w-4 h-4 shrink-0" />
                              {evalState.label}
                              {evalState.canPractice && (
                                <span className="font-mono tabular-nums">
                                  ({evalState.daysLeft}d left)
                                </span>
                              )}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 break-words">
                            {parent.contact}
                            {parent.email ? ` · ${parent.email}` : ''}
                          </p>
                        </div>

                        {latestSub && (
                          <div className="text-left sm:text-right font-mono tabular-nums shrink-0">
                            <span className="block text-sm font-bold text-slate-950 dark:text-white">
                              {formatCurrency(latestSub.feeAmount)} ·{' '}
                              {PAYMENT_METHOD_LABELS[latestSub.paymentMethod]}
                            </span>
                            <span className="font-sans text-xs text-slate-500 dark:text-slate-400">
                              {formatIsoDate(latestSub.startDate)} →{' '}
                              {formatIsoDate(latestSub.expiryDate)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Linked Children */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Linked Students ({linkedChildren.length})
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {linkedChildren.map((ch) => (
                            <div
                              key={ch.id}
                              className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 px-3 py-2 text-xs flex items-center justify-between gap-2"
                            >
                              <span className="font-semibold text-slate-900 dark:text-white truncate">
                                {ch.name}
                              </span>
                              <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                                {formatIndianClassLabel(ch.grade)} · {ch.totalScore} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() =>
                            isRenewing
                              ? setRenewParentId(null)
                              : openRenewPanel(parent.id, latestSub?.expiryDate)
                          }
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <RefreshCw className="w-4 h-4 shrink-0" />
                          {isRenewing ? 'Cancel Renewal' : 'Renew for 1 Year'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRenewParentId(null);
                            setAddChildError(null);
                            setExtraChild(createBlankChild());
                            setAddChildParentId(isAddingChild ? null : parent.id);
                          }}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Plus className="w-4 h-4 shrink-0" />
                          {isAddingChild ? 'Close' : 'Add Child'}
                        </button>
                      </div>

                      {/* Inline One-Tap Renew for 1 Year Form */}
                      {isRenewing && (
                        <form
                          onSubmit={(e) => void handleRenewSubmit(e, parent.name)}
                          className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-4"
                        >
                          <p className="text-sm font-bold text-slate-950 dark:text-white">
                            Renew Yearly Subscription · {parent.name}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Yearly Fee (INR)
                              </label>
                              <input
                                type="number"
                                min={0}
                                required
                                value={renewFee}
                                onChange={(e) => setRenewFee(e.target.value)}
                                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Payment Mode
                              </label>
                              <select
                                value={renewMethod}
                                onChange={(e) =>
                                  setRenewMethod(e.target.value as PaymentMethod)
                                }
                                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                              >
                                <option value="upi">UPI</option>
                                <option value="cash">Cash</option>
                                <option value="bank">Bank Transfer</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Renewal Start Date
                              </label>
                              <input
                                type="date"
                                required
                                value={renewStartDate}
                                onChange={(e) => setRenewStartDate(e.target.value)}
                                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                New Expiry (+1 Year)
                              </label>
                              <div className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 shrink-0" />
                                {formatIsoDate(computedRenewExpiry)}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Receipt / Reference Note
                            </label>
                            <input
                              type="text"
                              value={renewNote}
                              onChange={(e) => setRenewNote(e.target.value)}
                              placeholder="e.g. UPI Ref #482910 or Cash Receipt #14"
                              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                            />
                          </div>

                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setRenewParentId(null)}
                              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={submittingRenew}
                              className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold"
                            >
                              {submittingRenew
                                ? 'Recording Renewal…'
                                : 'Confirm 1-Year Renewal'}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Inline Add Child Form */}
                      {isAddingChild && (
                        <form
                          onSubmit={(e) =>
                            void handleAddChildSubmit(e, parent.name)
                          }
                          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3"
                        >
                          <p className="text-sm font-bold text-slate-950 dark:text-white">
                            Link Additional Child · {parent.name}
                          </p>
                          {addChildError && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {addChildError}
                            </p>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                Child Name *
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Aarav"
                                value={extraChild.name}
                                onChange={(e) =>
                                  setExtraChild((c) => ({ ...c, name: e.target.value }))
                                }
                                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                Class / Grade *
                              </label>
                              <select
                                value={extraChild.grade}
                                onChange={(e) =>
                                  setExtraChild((c) => ({
                                    ...c,
                                    grade: e.target.value as IndianClass,
                                  }))
                                }
                                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                              >
                                {INDIAN_CLASSES.map((cls) => (
                                  <option key={cls} value={cls}>
                                    {formatIndianClassLabel(cls)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setAddChildParentId(null)}
                              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={submittingChild}
                              className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold"
                            >
                              {submittingChild ? 'Adding…' : 'Save Child Profile'}
                            </button>
                          </div>
                        </form>
                      )}
                    </article>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: LEADS & REFERRAL CONVERSIONS                                   */}
      {/* ===================================================================== */}
      {activeTab === 'leads' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Trial Signups */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
                Trial Signups ({myLeads.length})
              </h2>
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            </div>
            {myLeads.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                When students open your referral link and sign in with Google, they appear here automatically.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs sm:text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {lead.name || lead.email}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {lead.email}
                        {lead.phone ? ` · ${lead.phone}` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold shrink-0 ${
                        lead.status === 'converted'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {lead.status === 'converted' ? 'Paid Pro' : 'Trial'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Paid Annual Referral Conversions */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
                Paid Annual Subscriptions ({myReferralSales.length})
              </h2>
              <IndianRupee className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </div>
            {myReferralSales.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Self-serve ₹1,100/₹1,200 conversions using your link or voucher appear here immediately.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myReferralSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs sm:text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {sale.subscriberName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {sale.subscriberEmail} · {formatIsoDate(sale.startDate)}
                      </p>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <span className="block font-bold text-emerald-700 dark:text-emerald-400">
                        +{formatCurrency(sale.commissionAmount)}
                      </span>
                      <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                        Paid {formatCurrency(sale.amountPaid)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: COMMISSION LEDGER, UPI PAYOUTS & PROFILE                       */}
      {/* ===================================================================== */}
      {activeTab === 'payouts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Request Withdrawal Card */}
          <section className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  Request UPI Payout
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Withdraw ₹{PAYOUT_MINIMUM_INR}+ available commission directly to your UPI ID.
                </p>
              </div>
              <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 font-mono tabular-nums text-xs">
              <div>
                <span className="block font-sans text-slate-500 dark:text-slate-400">
                  Available
                </span>
                <span className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(commissionLedger.availableBalance)}
                </span>
              </div>
              <div>
                <span className="block font-sans text-slate-500 dark:text-slate-400">
                  Pending
                </span>
                <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(commissionLedger.pendingPayouts)}
                </span>
              </div>
              <div>
                <span className="block font-sans text-slate-500 dark:text-slate-400">
                  Paid Out
                </span>
                <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {formatCurrency(commissionLedger.paidOut)}
                </span>
              </div>
            </div>

            {payoutError && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{payoutError}</span>
              </div>
            )}

            <form onSubmit={handleRequestPayoutSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Amount (INR) *
                  </label>
                  <input
                    type="number"
                    min={PAYOUT_MINIMUM_INR}
                    max={Math.max(PAYOUT_MINIMUM_INR, commissionLedger.availableBalance)}
                    required
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Destination UPI ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={payoutUpi}
                    onChange={(e) => setPayoutUpi(e.target.value)}
                    placeholder="name@okicici"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  !isApproved ||
                  submittingPayout ||
                  commissionLedger.availableBalance < PAYOUT_MINIMUM_INR
                }
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold"
              >
                {submittingPayout ? 'Submitting Request…' : 'Request UPI Payout'}
              </button>
            </form>

            {/* Payout History */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Withdrawal Ledger
              </h3>
              {myPayouts.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No payout requests yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {myPayouts.map((req) => (
                    <div
                      key={req.id}
                      className="py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(req.amount)} → {req.upiId}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 truncate">
                          {req.status === 'paid' && req.utrNumber
                            ? `UTR: ${req.utrNumber} · Paid ${formatIsoDate(req.paidAt)}`
                            : 'Pending Admin settlement'}
                        </p>
                      </div>
                      <span
                        className={`font-bold shrink-0 ${
                          req.status === 'paid'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {req.status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Editable Partner Profile & UPI Details */}
          <section className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                Partner Profile &amp; Payout Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Keep your City and UPI ID accurate for fast Admin settlements.
              </p>
            </div>

            <form onSubmit={handleSaveSelfProfile} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Phone Number (Login ID)
                  </label>
                  <input
                    type="tel"
                    readOnly
                    disabled
                    value={agent.phone}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 text-sm font-mono text-slate-600 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    City
                  </label>
                  <input
                    type="text"
                    value={profileCity}
                    onChange={(e) => setProfileCity(e.target.value)}
                    placeholder="e.g. Pune"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Default UPI ID
                  </label>
                  <input
                    type="text"
                    value={profileUpi}
                    onChange={(e) => setProfileUpi(e.target.value)}
                    placeholder="name@okicici"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="min-h-[44px] px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs sm:text-sm font-bold"
              >
                {savingProfile ? 'Saving…' : 'Save Partner Profile'}
              </button>
            </form>

            {/* Change Login Password */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Update Login Password
                </h3>
              </div>

              {passwordError && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      New Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full min-h-[44px] pl-3 pr-11 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        aria-label={
                          showNewPassword ? 'Hide password' : 'Show password'
                        }
                        className="absolute right-0.5 top-0 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Confirm Password *
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  {savingPassword ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </div>
          </section>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: ONBOARD PARENT + CHILD(REN) + YEARLY FEE ACTIVATION            */}
      {/* ===================================================================== */}
      {activeTab === 'onboard' && (
        <form
          onSubmit={handleOnboardSubmit}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-6"
        >
          <div className="space-y-1 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950 dark:text-white">
              Onboard New Family & Activate Yearly Plan
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Create the Parent login, link one or more Child student profiles,
              and record the yearly fee collection.
            </p>
          </div>

          {onboardError && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-3 flex items-center gap-2 text-xs sm:text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{onboardError}</span>
            </div>
          )}

          {/* Section 1: Parent Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              1. Parent Account Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Parent Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="e.g. Sunita Verma"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={parentContact}
                  onChange={(e) => setParentContact(e.target.value)}
                  placeholder="e.g. 9811223344"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Parent Email (Optional)
                </label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="Optional (parent@gmail.com)"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Login Password * (min 6 chars)
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={parentPasscode}
                  onChange={(e) => setParentPasscode(e.target.value)}
                  placeholder="e.g. parent123"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Parents sign in at /parent using their Mobile Number (or Email if
              entered) + Password, or via Google Sign-In — no child passwords
              needed.
            </p>
          </div>

          {/* Section 2: Linked Child Profiles */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                2. Linked Child Student Profiles ({childRows.length})
              </h3>
              <button
                type="button"
                onClick={() =>
                  setChildRows((prev) => [...prev, createBlankChild()])
                }
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Add Another Child
              </button>
            </div>

            <div className="space-y-3">
              {childRows.map((row, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Child #{idx + 1}
                    </span>
                    {childRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setChildRows((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label={`Remove child ${idx + 1}`}
                        className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Child Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={row.name}
                        onChange={(e) =>
                          handleUpdateChildRow(idx, { name: e.target.value })
                        }
                        placeholder="e.g. Aarav"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Class / Grade *
                      </label>
                      <select
                        value={row.grade}
                        onChange={(e) =>
                          handleUpdateChildRow(idx, {
                            grade: e.target.value as IndianClass,
                          })
                        }
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                      >
                        {INDIAN_CLASSES.map((cls) => (
                          <option key={cls} value={cls}>
                            {formatIndianClassLabel(cls)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Yearly Fee Collection & Automatic Expiry */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              3. Yearly Subscription Fee & Activation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Yearly Fee Collected (INR) *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Payment Mode *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Automatic Expiry (+1 Year)
                </label>
                <div className="min-h-[44px] px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-sm font-mono font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 shrink-0" />
                  {formatIsoDate(computedExpiry)}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Receipt / Payment Reference Note
              </label>
              <input
                type="text"
                value={receiptNote}
                onChange={(e) => setReceiptNote(e.target.value)}
                placeholder="e.g. UPI Txn #982144 · Collected in person"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('portfolio')}
              className="min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingOnboard || !isApproved}
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold"
            >
              {!isApproved
                ? 'Awaiting Admin Approval'
                : submittingOnboard
                ? 'Creating Account…'
                : 'Create Accounts & Activate 1-Year Plan'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
